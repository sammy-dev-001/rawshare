import { NextRequest, NextResponse } from "next/server";
import { GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { r2Client, R2_BUCKET_NAME } from "@/lib/r2";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const key = searchParams.get("key");
    const filename = searchParams.get("filename");

    if (!key) {
      return NextResponse.json({ error: "Missing key parameter" }, { status: 400 });
    }

    const downloadFilename = filename || key.split("/").pop() || "download";

    const command = new GetObjectCommand({
      Bucket: R2_BUCKET_NAME,
      Key: key,
      ResponseContentDisposition: `attachment; filename="${downloadFilename}"`,
    });

    // Generate a short-lived presigned URL (5 minutes)
    const signedUrl = await getSignedUrl(r2Client, command, { expiresIn: 300 });

    return NextResponse.json({ url: signedUrl });
  } catch (error) {
    console.error("Failed to generate download URL:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
