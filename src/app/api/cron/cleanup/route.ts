import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { r2Client, R2_BUCKET_NAME } from "@/lib/r2";
import { DeleteObjectsCommand } from "@aws-sdk/client-s3";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  // Optional: Add a simple secret check to prevent abuse
  const authHeader = req.headers.get("authorization");
  if (
    process.env.CRON_SECRET &&
    authHeader !== `Bearer ${process.env.CRON_SECRET}`
  ) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    // 1. Find all galleries where expiresAt is in the past
    const expiredGalleries = await prisma.gallery.findMany({
      where: {
        expiresAt: {
          lt: new Date(),
        },
      },
      include: {
        items: true,
      },
    });

    if (expiredGalleries.length === 0) {
      return NextResponse.json({ message: "No expired galleries found." });
    }

    // 2. Collect all R2 keys that need to be deleted
    const keysToDelete: { Key: string }[] = [];
    
    for (const gallery of expiredGalleries) {
      for (const item of gallery.items) {
        if (item.originalR2Key) keysToDelete.push({ Key: item.originalR2Key });
        if (item.previewR2Key) keysToDelete.push({ Key: item.previewR2Key });
      }
    }

    // 3. Delete objects from R2 in batches of 1000 (S3 API limit)
    const batchSize = 1000;
    for (let i = 0; i < keysToDelete.length; i += batchSize) {
      const batch = keysToDelete.slice(i, i + batchSize);
      await r2Client.send(
        new DeleteObjectsCommand({
          Bucket: R2_BUCKET_NAME,
          Delete: {
            Objects: batch,
            Quiet: true,
          },
        })
      );
    }

    // 4. Delete the galleries from the database (cascading will delete the items)
    const galleryIds = expiredGalleries.map((g) => g.id);
    await prisma.gallery.deleteMany({
      where: {
        id: { in: galleryIds },
      },
    });

    return NextResponse.json({
      message: `Successfully deleted ${expiredGalleries.length} galleries and ${keysToDelete.length} files.`,
    });
  } catch (error) {
    console.error("[CRON Cleanup Error]", error);
    return NextResponse.json(
      { error: "Internal Server Error during cleanup." },
      { status: 500 }
    );
  }
}
