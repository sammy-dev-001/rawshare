/* eslint-disable */
/**
 * src/hooks/useUpload.ts
 *
 * Custom React hook that orchestrates the full client-side upload pipeline:
 *
 *   1. Compress the image to a lightweight WebP thumbnail using
 *      `browser-image-compression` (runs entirely in the browser — no server
 *      round-trip, no cost).
 *   2. Request two presigned PUT URLs from `/api/upload`.
 *   3. Execute both direct PUT requests to Cloudflare R2 in parallel.
 *   4. Return the two R2 keys so the caller can persist them in the database.
 *
 * Why client-side compression?
 *   Vercel serverless functions have a 4.5 MB request payload limit and a
 *   10-second timeout on the free tier. Compressing on the client means the
 *   Next.js server never touches the binary data — it only issues presigned
 *   URLs — so uploads of any size work without upgrading Vercel.
 *
 * Dependencies required in package.json:
 *   "browser-image-compression": "^2.0.2"
 *
 * Install:  npm install browser-image-compression
 */

"use client";

import { useState, useCallback, useRef, MutableRefObject } from "react";
import imageCompression from "browser-image-compression";
import exifr from "exifr";

// ─── Types ────────────────────────────────────────────────────────────────────

/** The two R2 keys returned after a successful upload. */
export interface UploadResult {
  /** R2 key of the full-resolution original, e.g. "originals/abc-123.png". */
  originalKey: string;
  /** R2 key of the WebP thumbnail, e.g. "previews/abc-123.webp". */
  previewKey: string;
  /** Extracted EXIF metadata */
  exifData?: any;
}

/** The quality settings for uploading original images. */
export type UploadQuality = "original" | "high" | "standard";

export interface UploadOptions {
  quality?: UploadQuality;
  precompressedBlob?: Blob;
}

/** Granular upload state exposed to the UI. */
export type UploadStatus =
  | "idle"
  | "compressing"
  | "requesting_urls"
  | "uploading"
  | "success"
  | "error"
  | "aborted";

export interface UseUploadReturn {
  /** Upload a single file. Returns the R2 keys on success. */
  upload: (file: File, options?: UploadOptions) => Promise<UploadResult>;
  /** Granular status of the current upload. */
  status: UploadStatus;
  /** Upload progress as a 0–100 integer (covers the PUT-to-R2 phase). */
  progress: number;
  /** Human-readable error message when `status === "error"`. */
  error: string | null;
  /** Reset state back to "idle" (useful after showing an error). */
  reset: () => void;
  /** Abort the ongoing upload. */
  abort: () => void;
  /** The size of the file after compression. */
  compressedSize: number | null;
}

// ─── Preview compression options ─────────────────────────────────────────────

/**
 * Thumbnail target: ≤ 200 KB, max 800 px on the longest edge, WebP output.
 *
 * Tweak `maxSizeMB` / `maxWidthOrHeight` to balance quality vs. load time.
 * For a masonry/grid gallery, 800 px wide is typically more than sufficient.
 */
const PREVIEW_COMPRESSION_OPTIONS: Parameters<typeof imageCompression>[1] = {
  maxSizeMB: 0.2,          // 200 KB ceiling
  maxWidthOrHeight: 800,    // Downscale if either dimension exceeds 800 px
  useWebWorker: true,       // Off the main thread — keeps the UI responsive
  fileType: "image/webp",   // Always output WebP for maximum compression
  initialQuality: 0.8,      // Starting quality (library iterates if needed)
};

export const HIGH_QUALITY_OPTIONS: Parameters<typeof imageCompression>[1] = {
  maxSizeMB: 10,
  maxWidthOrHeight: 3840,
  useWebWorker: true,
  initialQuality: 0.85,
};

export const STANDARD_QUALITY_OPTIONS: Parameters<typeof imageCompression>[1] = {
  maxSizeMB: 5,
  maxWidthOrHeight: 2560,
  useWebWorker: true,
  initialQuality: 0.75,
};

// ─── API response shape (mirrors route.ts) ────────────────────────────────────

interface PresignedUrlResponse {
  originalUploadUrl: string;
  originalKey: string;
  previewUploadUrl: string | null;
  previewKey: string | null;
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useUpload(): UseUploadReturn {
  const [status, setStatus] = useState<UploadStatus>("idle");
  const [progress, setProgress] = useState<number>(0);
  const [error, setError] = useState<string | null>(null);
  const [compressedSize, setCompressedSize] = useState<number | null>(null);

  // Keep track of ongoing requests to allow cancellation
  const abortControllerRef = useRef<AbortController | null>(null);
  const xhrRef = useRef<XMLHttpRequest | null>(null);

  const reset = useCallback(() => {
    setStatus("idle");
    setProgress(0);
    setError(null);
    setCompressedSize(null);
  }, []);

  const upload = useCallback(async (file: File, options?: UploadOptions): Promise<UploadResult> => {
    setError(null);
    setProgress(0);
    
    abortControllerRef.current = new AbortController();

    try {
      // ── Step 1: Compress the image to a WebP thumbnail ──────────────────────
      //
      // This runs in a Web Worker via `browser-image-compression`, so it won't
      // freeze the UI even for large source files.
      //
      // Non-image files (e.g. videos) are skipped — we pass them through as-is
      // for the original, and there's no preview generated for video.
      let previewBlob: Blob | null = null;
      let originalBlob: Blob = file;
      let exifData: any = null;

      if (file.type.startsWith("image/")) {
        try {
          exifData = await exifr.parse(file, {
            tiff: true,
            exif: true,
            gps: true,
            pick: ['Make', 'Model', 'LensModel', 'ISO', 'FNumber', 'ExposureTime', 'FocalLength', 'latitude', 'longitude']
          });
        } catch (e) {
          console.warn("Failed to extract EXIF data:", e);
        }

        setStatus("compressing");
        
        // 1a: Compress original image based on quality setting
        if (options?.precompressedBlob) {
          originalBlob = options.precompressedBlob;
        } else {
          const quality = options?.quality || "original";
          if (quality === "high") {
            originalBlob = await imageCompression(file, HIGH_QUALITY_OPTIONS);
          } else if (quality === "standard") {
            originalBlob = await imageCompression(file, STANDARD_QUALITY_OPTIONS);
          }
        }

        // 1b: Compress to a lightweight WebP thumbnail
        previewBlob = await imageCompression(file, PREVIEW_COMPRESSION_OPTIONS);
      }

      setCompressedSize(originalBlob.size);

      // ── Step 2: Determine Upload Strategy (Standard vs Multipart) ──
      const isMultipart = originalBlob.size > 20 * 1024 * 1024; // 20MB threshold
      
      let originalKey = "";
      let previewKey = "";

      if (isMultipart) {
        setStatus("uploading");
        setProgress(0);

        const uploadPromises: Promise<any>[] = [
          multipartUploadWithProgress(
            originalBlob,
            file.name,
            file.type,
            (pct) => setProgress(pct),
            abortControllerRef.current.signal
          ).then(key => { originalKey = key; })
        ];

        // Compress and upload preview if available
        if (previewBlob) {
          const apiResponse = await fetch("/api/upload", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              fileName: "preview.webp",
              fileType: "image/webp",
              sizeBytes: previewBlob.size,
            }),
            signal: abortControllerRef.current.signal,
          });
          if (apiResponse.ok) {
            const { originalUploadUrl, originalKey: pKey } = await apiResponse.json();
            previewKey = pKey;
            uploadPromises.push(
              fetch(originalUploadUrl, {
                method: "PUT",
                headers: { "Content-Type": "image/webp" },
                body: previewBlob,
                signal: abortControllerRef.current.signal,
              }).then((res) => {
                if (!res.ok) throw new Error(`Preview upload failed: ${res.status}`);
              })
            );
          }
        }

        await Promise.all(uploadPromises);
      } else {
        setStatus("requesting_urls");

        const apiResponse = await fetch("/api/upload", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            fileName: file.name,
            fileType: file.type,
            sizeBytes: originalBlob.size,
            previewSizeBytes: previewBlob?.size,
          }),
          signal: abortControllerRef.current.signal,
        });

        if (!apiResponse.ok) {
          const { error: apiError } = (await apiResponse.json()) as { error?: string };
          throw new Error(apiError ?? "Failed to get presigned upload URLs.");
        }

        const {
          originalUploadUrl,
          originalKey: oKey,
          previewUploadUrl,
          previewKey: pKey,
        } = (await apiResponse.json()) as PresignedUrlResponse;

        originalKey = oKey;
        previewKey = pKey || "";

        setStatus("uploading");
        setProgress(0);

        const uploadPromises: Promise<any>[] = [
          uploadWithProgress(
            originalUploadUrl,
            originalBlob,
            file.type,
            (pct) => setProgress(pct),
            xhrRef
          )
        ];

        if (previewUploadUrl && previewBlob) {
          uploadPromises.push(
            fetch(previewUploadUrl, {
              method: "PUT",
              headers: { "Content-Type": "image/webp" },
              body: previewBlob,
              signal: abortControllerRef.current.signal,
            }).then((res) => {
              if (!res.ok) throw new Error(`Preview upload failed: ${res.status}`);
            })
          );
        }

        await Promise.all(uploadPromises);
      }

      // ── Step 4: Return the keys so the caller can save them to the DB ────────
      setStatus("success");
      setProgress(100);

      return { originalKey, previewKey: previewKey || "", exifData };
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") {
        setStatus("aborted");
        setError("Upload aborted.");
        throw err;
      }

      const message =
        err instanceof Error ? err.message : "An unknown upload error occurred.";
      setError(message);
      setStatus("error");

      // Re-throw so the calling component can also react (e.g. show a toast)
      throw new Error(message);
    }
  }, []);

  const abort = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    if (xhrRef.current) {
      xhrRef.current.abort();
    }
    setStatus("aborted");
    setError("Upload aborted.");
  }, []);

  return { upload, status, progress, error, reset, abort, compressedSize };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Uploads `body` to `url` via a presigned PUT request, reporting integer
 * progress (0–100) through the `onProgress` callback.
 *
 * We use XMLHttpRequest instead of fetch() because the Fetch API does not yet
 * expose upload progress in a cross-browser way (the `duplex: "half"` + body
 * ReadableStream approach is not universally supported).
 */
function uploadWithProgress(
  url: string,
  body: Blob,
  contentType: string,
  onProgress: (percent: number) => void,
  xhrRef?: MutableRefObject<XMLHttpRequest | null>
): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    if (xhrRef) {
      xhrRef.current = xhr;
    }

    // Report progress as a 0–100 integer
    xhr.upload.addEventListener("progress", (event) => {
      if (event.lengthComputable) {
        const pct = Math.round((event.loaded / event.total) * 100);
        onProgress(pct);
      }
    });

    xhr.addEventListener("load", () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve();
      } else {
        reject(
          new Error(
            `Original upload failed: HTTP ${xhr.status} ${xhr.statusText}`
          )
        );
      }
    });

    xhr.addEventListener("error", () =>
      reject(new Error("Original upload failed due to a network error."))
    );
    xhr.addEventListener("abort", () => {
      const err = new Error("Original upload was aborted.");
      err.name = "AbortError";
      reject(err);
    });

    xhr.open("PUT", url);
    xhr.setRequestHeader("Content-Type", contentType);
    xhr.send(body);
  });
}

/**
 * Handles multipart upload for files > 20MB.
 */
async function multipartUploadWithProgress(
  file: Blob,
  fileName: string,
  fileType: string,
  onProgress: (percent: number) => void,
  abortSignal: AbortSignal
): Promise<string> {
  const createRes = await fetch("/api/upload/multipart", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "create", fileName, fileType }),
    signal: abortSignal,
  });
  if (!createRes.ok) throw new Error("Failed to create multipart upload");
  const { uploadId, key } = await createRes.json();

  const CHUNK_SIZE = 10 * 1024 * 1024; // 10MB chunks
  const numParts = Math.ceil(file.size / CHUNK_SIZE);
  const parts: { ETag: string; PartNumber: number }[] = [];
  
  let uploadedBytes = 0;
  
  for (let i = 0; i < numParts; i++) {
    if (abortSignal.aborted) throw new DOMException("Aborted", "AbortError");
    
    const start = i * CHUNK_SIZE;
    const end = Math.min(start + CHUNK_SIZE, file.size);
    const chunk = file.slice(start, end);
    const partNumber = i + 1;
    
    const signRes = await fetch("/api/upload/multipart", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "sign-part", key, uploadId, partNumber }),
      signal: abortSignal,
    });
    if (!signRes.ok) throw new Error(`Failed to sign part ${partNumber}`);
    const { signedUrl } = await signRes.json();
    
    const uploadRes = await fetch(signedUrl, {
      method: "PUT",
      body: chunk,
      signal: abortSignal,
    });
    if (!uploadRes.ok) throw new Error(`Failed to upload part ${partNumber}`);
    
    const eTag = uploadRes.headers.get("ETag") || uploadRes.headers.get("etag");
    if (!eTag) throw new Error(`No ETag returned for part ${partNumber}`);
    
    // S3 requires ETags to be wrapped in quotes if they aren't already
    const cleanETag = eTag.replace(/"/g, "");
    parts.push({ ETag: `"${cleanETag}"`, PartNumber: partNumber });
    
    uploadedBytes += chunk.size;
    onProgress(Math.round((uploadedBytes / file.size) * 100));
  }
  
  const completeRes = await fetch("/api/upload/multipart", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "complete", key, uploadId, parts }),
    signal: abortSignal,
  });
  
  if (!completeRes.ok) {
    throw new Error("Failed to complete multipart upload");
  }
  
  return key;
}

