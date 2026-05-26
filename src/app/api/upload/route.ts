/**
 * src/app/api/upload/route.ts
 *
 * POST /api/upload
 *
 * Generates two short-lived R2 presigned PUT URLs:
 *   1. `originalUploadUrl`  – for the full-resolution original file.
 *   2. `previewUploadUrl`   – for the client-compressed WebP thumbnail.
 *
 * The browser uses these URLs to upload both files directly to Cloudflare R2,
 * completely bypassing Vercel's 4.5 MB serverless payload limit.
 *
 * Security model:
 *   • The server holds R2 credentials; the browser never sees them.
 *   • Each presigned URL is scoped to a single key and expires in 5 minutes.
 *   • The Content-Type is locked at signing time — clients cannot upload
 *     a different MIME type using the same URL.
 */

import { NextRequest, NextResponse } from "next/server";
import { PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { r2Client, R2_BUCKET_NAME } from "@/lib/r2";
import { randomUUID } from "crypto";

// ─── Request body shape ───────────────────────────────────────────────────────

interface UploadRequestBody {
  /** Original MIME type, e.g. "image/png", "video/mp4". */
  fileType: string;
  /** Original file name, used only to derive the extension. */
  fileName: string;
}

// ─── Response shape ───────────────────────────────────────────────────────────

interface UploadResponseBody {
  /** Presigned PUT URL for the full-resolution original. */
  originalUploadUrl: string;
  /** R2 object key that the original will be stored under. */
  originalKey: string;
  /** Presigned PUT URL for the client-generated WebP thumbnail. */
  previewUploadUrl: string | null;
  /** R2 object key that the preview will be stored under. */
  previewKey: string | null;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Extracts a safe file extension from the original file name.
 * Falls back to the sub-type part of the MIME type (e.g. "png" from "image/png").
 */
function getExtension(fileName: string, fileType: string): string {
  const dotIndex = fileName.lastIndexOf(".");
  if (dotIndex !== -1) {
    return fileName.slice(dotIndex + 1).toLowerCase();
  }
  // Fallback: derive from MIME type
  const mimeSubtype = fileType.split("/")[1] ?? "bin";
  return mimeSubtype.toLowerCase();
}

/**
 * Builds a deterministic, collision-free R2 key.
 *
 * Key structure: `originals/<uuid>.<ext>`
 * This keeps originals and previews in separate "folders", making bucket
 * lifecycle rules and analytics easier to set up later.
 */
function buildOriginalKey(fileName: string, fileType: string): string {
  const ext = getExtension(fileName, fileType);
  return `originals/${randomUUID()}.${ext}`;
}

/**
 * Preview is always stored as WebP (the format browser-image-compression
 * outputs). The UUID is shared with the original so the two objects can be
 * linked by key prefix if needed.
 */
function buildPreviewKey(originalKey: string): string {
  // e.g. "originals/abc-123.png" → "previews/abc-123.webp"
  const uuid = originalKey.split("/")[1]?.split(".")[0] ?? randomUUID();
  return `previews/${uuid}.webp`;
}

// ─── Presigned URL expiry ─────────────────────────────────────────────────────

/** 5 minutes — short enough to limit abuse, long enough for slow connections. */
const PRESIGNED_URL_TTL_SECONDS = 300;

// ─── Route Handler ────────────────────────────────────────────────────────────

export async function POST(req: NextRequest): Promise<NextResponse> {
  // 1. Parse and validate the request body
  let body: UploadRequestBody;
  try {
    body = (await req.json()) as UploadRequestBody;
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON body." },
      { status: 400 }
    );
  }

  const { fileType, fileName } = body;

  if (!fileType || !fileName) {
    return NextResponse.json(
      { error: "`fileType` and `fileName` are required fields." },
      { status: 400 }
    );
  }

  // Basic MIME type sanity check — prevents uploading executables etc.
  const ALLOWED_MIME_PREFIXES = ["image/", "video/"];
  const isAllowed = ALLOWED_MIME_PREFIXES.some((prefix) =>
    fileType.startsWith(prefix)
  );
  if (!isAllowed) {
    return NextResponse.json(
      { error: `File type "${fileType}" is not permitted.` },
      { status: 415 }
    );
  }

  // 2. Derive R2 object keys
  const originalKey = buildOriginalKey(fileName, fileType);
  const isImage = fileType.startsWith("image/");
  const previewKey = isImage ? buildPreviewKey(originalKey) : null;

  try {
    // 3. Generate presigned PUT URL for the original file
    const originalUploadUrl = await getSignedUrl(
      r2Client,
      new PutObjectCommand({
        Bucket: R2_BUCKET_NAME,
        Key: originalKey,
        ContentType: fileType, // Locked to the declared MIME type
      }),
      { expiresIn: PRESIGNED_URL_TTL_SECONDS }
    );

    // 4. Generate presigned PUT URL for the preview/thumbnail (only if it's an image)
    let previewUploadUrl: string | null = null;
    if (previewKey) {
      previewUploadUrl = await getSignedUrl(
        r2Client,
        new PutObjectCommand({
          Bucket: R2_BUCKET_NAME,
          Key: previewKey,
          ContentType: "image/webp",
        }),
        { expiresIn: PRESIGNED_URL_TTL_SECONDS }
      );
    }

    // 5. Return both URLs and keys to the browser
    const response: UploadResponseBody = {
      originalUploadUrl,
      originalKey,
      previewUploadUrl,
      previewKey,
    };

    return NextResponse.json(response, { status: 200 });
  } catch (error) {
    console.error("[POST /api/upload] Failed to generate presigned URLs:", error);
    return NextResponse.json(
      { error: "Failed to generate upload URLs. Please try again." },
      { status: 500 }
    );
  }
}
