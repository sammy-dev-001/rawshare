import { NextRequest, NextResponse } from "next/server";
import {
  CreateMultipartUploadCommand,
  UploadPartCommand,
  CompleteMultipartUploadCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { r2Client, R2_BUCKET_NAME } from "@/lib/r2";
import { randomUUID } from "crypto";
import { rateLimiter, chunkRateLimiter } from "@/lib/rate-limit";

// Helpers
function getExtension(fileName: string, fileType: string): string {
  const dotIndex = fileName.lastIndexOf(".");
  if (dotIndex !== -1) {
    return fileName.slice(dotIndex + 1).toLowerCase();
  }
  const mimeSubtype = fileType.split("/")[1] ?? "bin";
  return mimeSubtype.toLowerCase();
}

function buildOriginalKey(fileName: string, fileType: string): string {
  const ext = getExtension(fileName, fileType);
  return `originals/${randomUUID()}.${ext}`;
}

export async function POST(req: NextRequest) {
  const ip = req.headers.get("x-forwarded-for") ?? "127.0.0.1";
  const { success } = await rateLimiter.limit(ip);
  if (!success) {
    return NextResponse.json({ error: "Too many upload requests." }, { status: 429 });
  }

  try {
    const body = await req.json();
    const { action } = body;

    if (action === "create") {
      // Rate-limit: one token per multipart create
      const { success } = await rateLimiter.limit(ip);
      if (!success) {
        return NextResponse.json({ error: "Too many upload requests." }, { status: 429 });
      }

      const { fileName, fileType } = body;
      const key = buildOriginalKey(fileName, fileType);
      
      const command = new CreateMultipartUploadCommand({
        Bucket: R2_BUCKET_NAME,
        Key: key,
        ContentType: fileType,
      });
      
      const response = await r2Client.send(command);
      return NextResponse.json({ uploadId: response.UploadId, key }, { status: 200 });
      
    } else if (action === "sign-part") {
      // sign-part is called once per 10 MB chunk — use the higher-ceiling chunk bucket
      // so large files don't exhaust the main upload rate limit.
      const { success } = await chunkRateLimiter.limit(ip);
      if (!success) {
        return NextResponse.json({ error: "Too many chunk-sign requests. Please try again later." }, { status: 429 });
      }

      const { key, uploadId, partNumber } = body;
      
      const command = new UploadPartCommand({
        Bucket: R2_BUCKET_NAME,
        Key: key,
        UploadId: uploadId,
        PartNumber: partNumber,
      });
      
      const signedUrl = await getSignedUrl(r2Client, command, { expiresIn: 3600 });
      return NextResponse.json({ signedUrl }, { status: 200 });
      
    } else if (action === "complete") {
      // Rate-limit: one token per multipart complete
      const { success } = await rateLimiter.limit(ip);
      if (!success) {
        return NextResponse.json({ error: "Too many upload requests." }, { status: 429 });
      }

      const { key, uploadId, parts } = body;
      
      const command = new CompleteMultipartUploadCommand({
        Bucket: R2_BUCKET_NAME,
        Key: key,
        UploadId: uploadId,
        MultipartUpload: {
          Parts: parts, // Array of { ETag, PartNumber }
        },
      });
      
      await r2Client.send(command);
      return NextResponse.json({ success: true, key }, { status: 200 });
      
    } else {
      return NextResponse.json({ error: "Invalid action" }, { status: 400 });
    }
  } catch (error) {
    console.error("[Multipart API Error]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
