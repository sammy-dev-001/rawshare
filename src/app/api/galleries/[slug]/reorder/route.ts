import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { z } from "zod";
import { auth } from "@clerk/nextjs/server";
import { rateLimiter } from "@/lib/rate-limit";
import { timingSafeEqual } from "crypto";

function safeTokenEquals(a: string | null | undefined, b: string | null | undefined): boolean {
  if (!a || !b) return false;
  try {
    const bufA = Buffer.from(a, "utf8");
    const bufB = Buffer.from(b, "utf8");
    if (bufA.length !== bufB.length) return false;
    return timingSafeEqual(bufA, bufB);
  } catch {
    return false;
  }
}

const reorderSchema = z.object({
  itemIds: z.array(z.string()).min(1, "At least one item is required"),
});

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
): Promise<NextResponse> {
  // Rate-limit reorder requests
  const ip = req.headers.get("x-forwarded-for") ?? "127.0.0.1";
  const { success } = await rateLimiter.limit(ip);
  if (!success) {
    return NextResponse.json({ error: "Too many requests. Please try again later." }, { status: 429 });
  }

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
    } else if (safeTokenEquals(gallery.adminToken, adminToken)) {
      isAuthorized = true;
    }

    if (!isAuthorized) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    const body = await req.json();
    const parsedData = reorderSchema.parse(body);

    // Update each item's sortOrder in a transaction
    await prisma.$transaction(
      parsedData.itemIds.map((id, index) => 
        prisma.mediaItem.updateMany({
          where: { id, galleryId: gallery.id },
          data: { sortOrder: index }
        })
      )
    );

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error) {
    console.error("[PUT /api/galleries/[slug]/reorder] Error:", error);
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues[0].message }, { status: 400 });
    }
    return NextResponse.json(
      { error: "Failed to reorder images." },
      { status: 500 }
    );
  }
}
