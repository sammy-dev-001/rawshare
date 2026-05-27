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

// ─── Types ────────────────────────────────────────────────────────────────────

/** The two R2 keys returned after a successful upload. */
export interface UploadResult {
  /** R2 key of the full-resolution original, e.g. "originals/abc-123.png". */
  originalKey: string;
  /** R2 key of the WebP thumbnail, e.g. "previews/abc-123.webp". */
  previewKey: string;
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
  previewUploadUrl: string;
  previewKey: string;
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

      if (file.type.startsWith("image/")) {
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

      // ── Step 2: Request presigned URLs from the Next.js API ─────────────────
      setStatus("requesting_urls");

      const apiResponse = await fetch("/api/upload", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fileName: file.name,
          fileType: file.type,
        }),
        signal: abortControllerRef.current.signal,
      });

      if (!apiResponse.ok) {
        const { error: apiError } = (await apiResponse.json()) as {
          error?: string;
        };
        throw new Error(apiError ?? "Failed to get presigned upload URLs.");
      }

      const {
        originalUploadUrl,
        originalKey,
        previewUploadUrl,
        previewKey,
      } = (await apiResponse.json()) as {
        originalUploadUrl: string;
        originalKey: string;
        previewUploadUrl: string | null;
        previewKey: string | null;
      };

      // ── Step 3: Upload files directly to R2 in parallel ────────────────
      //
      // Using XMLHttpRequest for the original gives us real `progress` events.
      // The preview is small, so a plain fetch() is fine there.
      setStatus("uploading");
      setProgress(0);

      const uploadPromises: Promise<any>[] = [
        // Upload the original with progress tracking
        uploadWithProgress(
          originalUploadUrl,
          originalBlob,
          file.type,
          (pct) => setProgress(pct),
          xhrRef
        )
      ];

      // Upload the compressed preview if available
      if (previewUploadUrl && previewBlob) {
        uploadPromises.push(
          fetch(previewUploadUrl, {
            method: "PUT",
            headers: { "Content-Type": "image/webp" },
            body: previewBlob,
            signal: abortControllerRef.current?.signal,
          }).then((res) => {
            if (!res.ok) {
              throw new Error(
                `Preview upload failed with status ${res.status}.`
              );
            }
          })
        );
      }

      await Promise.all(uploadPromises);

      // ── Step 4: Return the keys so the caller can save them to the DB ────────
      setStatus("success");
      setProgress(100);

      return { originalKey, previewKey: previewKey || "" };
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

