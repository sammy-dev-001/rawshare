import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { z } from "zod";
import { rateLimiter } from "@/lib/rate-limit";
import { auth } from "@clerk/nextjs/server";
import { DeleteObjectsCommand } from "@aws-sdk/client-s3";
import { r2Client, R2_BUCKET_NAME } from "@/lib/r2";

const addImagesSchema = z.object({
  items: z.array(
    z.object({
      originalKey: z.string(),
      previewKey: z.string().optional(),
      fileType: z.string(),
      sizeBytes: z.number().int().positive(),
      width: z.number().int().positive().optional(),
      height: z.number().int().positive().optional(),
    })
  ).min(1, "At least one item is required").max(50, "Maximum 50 items allowed"),
});

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
): Promise<NextResponse> {
  const ip = req.headers.get("x-forwarded-for") ?? "127.0.0.1";
  const { success } = await rateLimiter.limit(ip);
  if (!success) {
    return NextResponse.json({ error: "Too many requests. Please try again later." }, { status: 429 });
  }

  const resolvedParams = await params;

  try {
    const gallery = await prisma.gallery.findUnique({
      where: { slug: resolvedParams.slug },
      include: { items: { select: { id: true } } },
    });

    if (!gallery) {
      return NextResponse.json({ error: "Gallery not found" }, { status: 404 });
    }

    // Authorization check
    const { userId } = await auth();
    const adminToken = req.headers.get("x-admin-token");

    let isAuthorized = false;
    if (gallery.userId && gallery.userId === userId) {
      isAuthorized = true;
    } else if (gallery.adminToken && gallery.adminToken === adminToken) {
      isAuthorized = true;
    }

    if (!isAuthorized) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    const body = await req.json();
    const parsedData = addImagesSchema.parse(body);

    // Calculate starting sort order (append to end)
    const startingSortOrder = gallery.items.length;

    await prisma.mediaItem.createMany({
      data: parsedData.items.map((item, index) => ({
        galleryId: gallery.id,
        originalR2Key: item.originalKey,
        previewR2Key: item.previewKey ?? null,
        fileType: item.fileType,
        sizeBytes: item.sizeBytes,
        width: item.width,
        height: item.height,
        sortOrder: startingSortOrder + index,
      })),
    });

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error) {
    console.error("[POST /api/galleries/[slug]] Error:", error);
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues[0].message }, { status: 400 });
    }
    return NextResponse.json(
      { error: "Failed to add images to gallery." },
      { status: 500 }
    );
  }
}

const deleteImagesSchema = z.object({
  itemIds: z.array(z.string()).min(1, "At least one item is required"),
});

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
): Promise<NextResponse> {
  const resolvedParams = await params;

  try {
    const gallery = await prisma.gallery.findUnique({
      where: { slug: resolvedParams.slug },
      select: { id: true, userId: true, adminToken: true }
    });

    if (!gallery) {
      return NextResponse.json({ error: "Gallery not found" }, { status: 404 });
    }

    // Authorization check
    const { userId } = await auth();
    const adminToken = req.headers.get("x-admin-token");

    let isAuthorized = false;
    if (gallery.userId && gallery.userId === userId) {
      isAuthorized = true;
    } else if (gallery.adminToken && gallery.adminToken === adminToken) {
      isAuthorized = true;
    }

    if (!isAuthorized) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    const body = await req.json();
    const parsedData = deleteImagesSchema.parse(body);

    const itemsToDelete = await prisma.mediaItem.findMany({
      where: {
        galleryId: gallery.id,
        id: { in: parsedData.itemIds },
      },
      select: { originalR2Key: true, previewR2Key: true }
    });

    const objectsToDelete = itemsToDelete.flatMap(item => {
      const keys = [{ Key: item.originalR2Key }];
      if (item.previewR2Key) keys.push({ Key: item.previewR2Key });
      return keys;
    });

    if (objectsToDelete.length > 0) {
      await r2Client.send(new DeleteObjectsCommand({
        Bucket: R2_BUCKET_NAME,
        Delete: {
          Objects: objectsToDelete,
        }
      }));
    }

    await prisma.mediaItem.deleteMany({
      where: {
        galleryId: gallery.id,
        id: { in: parsedData.itemIds },
      },
    });

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error) {
    console.error("[DELETE /api/galleries/[slug]] Error:", error);
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues[0].message }, { status: 400 });
    }
    return NextResponse.json(
      { error: "Failed to delete images from gallery." },
      { status: 500 }
    );
  }
}
