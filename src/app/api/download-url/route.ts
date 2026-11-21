import { NextRequest, NextResponse } from "next/server";
import { GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { r2Client, R2_BUCKET_NAME } from "@/lib/r2";
import { rateLimiter } from "@/lib/rate-limit";
import { prisma } from "@/lib/db";
import { cookies } from "next/headers";
import { auth } from "@clerk/nextjs/server";

export async function GET(req: NextRequest) {
  // Rate-limit download URL requests
  const ip = req.headers.get("x-forwarded-for") ?? "127.0.0.1";
  const { success } = await rateLimiter.limit(ip);
  if (!success) {
    return NextResponse.json({ error: "Too many requests." }, { status: 429 });
  }

  try {
    const { searchParams } = new URL(req.url);
    const key = searchParams.get("key");
    const filename = searchParams.get("filename");
    const slug = searchParams.get("slug");

    if (!key || !slug) {
      return NextResponse.json({ error: "Missing key or slug parameter" }, { status: 400 });
    }

    // Look up the gallery to verify ownership and access
    const gallery = await prisma.gallery.findUnique({
      where: { slug },
      include: {
        items: {
          where: {
            OR: [
              { originalR2Key: key },
              { previewR2Key: key },
            ],
          },
          select: { id: true },
        },
      },
    });

    if (!gallery) {
      return NextResponse.json({ error: "Gallery not found" }, { status: 404 });
    }

    // Check the key actually belongs to this gallery
    if (gallery.items.length === 0) {
      return NextResponse.json({ error: "Key does not belong to this gallery" }, { status: 403 });
    }

    // Check expiration
    if (gallery.expiresAt && new Date() > gallery.expiresAt) {
      return NextResponse.json({ error: "Gallery has expired" }, { status: 403 });
    }

    // Check password protection
    if (gallery.passwordHash) {
      const { userId } = await auth();
      const isOwner = userId && gallery.userId === userId;

      if (!isOwner) {
        const cookieStore = await cookies();
        const hasAccess = cookieStore.get(`gallery_access_${slug}`)?.value === "true";
        if (!hasAccess) {
          return NextResponse.json({ error: "Access denied" }, { status: 403 });
        }
      }
    }

    const downloadFilename = filename || key.split("/").pop() || "download";

    const command = new GetObjectCommand({
      Bucket: R2_BUCKET_NAME,
      Key: key,
      ResponseContentDisposition: `attachment; filename="${downloadFilename}"`,
    });

    // Generate a short-lived presigned URL (15 minutes)
    const signedUrl = await getSignedUrl(r2Client, command, { expiresIn: 900 });

    return NextResponse.json({ url: signedUrl });
  } catch (error) {
    console.error("Failed to generate download URL:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
