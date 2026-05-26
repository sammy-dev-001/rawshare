import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { randomBytes } from "crypto";

// Schema to validate the incoming POST request
const createGallerySchema = z.object({
  title: z.string().min(1, "Title is required").max(100, "Title is too long"),
  items: z.array(
    z.object({
      originalKey: z.string(),
      previewKey: z.string().optional(),
      fileType: z.string(),
      sizeBytes: z.number().int().positive(),
      width: z.number().int().positive().optional(),
      height: z.number().int().positive().optional(),
    })
  ).min(1, "At least one item is required").max(35, "Maximum 35 items allowed"),
});

function generateSlug(title: string): string {
  const base = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)+/g, "");
  const randomStr = randomBytes(3).toString("hex");
  return base ? `${base}-${randomStr}` : randomStr;
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    const body = await req.json();
    const parsedData = createGallerySchema.parse(body);

    const slug = generateSlug(parsedData.title);
    
    // Fixed expiration of 5 days as per requirements
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 5);

    // Save to database
    const gallery = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      return tx.gallery.create({
        data: {
          title: parsedData.title,
          slug,
          expiresAt,
          items: {
            create: parsedData.items.map((item, index) => ({
              originalR2Key: item.originalKey,
              previewR2Key: item.previewKey,
              fileType: item.fileType,
              sizeBytes: item.sizeBytes,
              width: item.width,
              height: item.height,
              sortOrder: index, // Preserve the order from the client array
            })),
          },
        },
      });
    });

    return NextResponse.json({ slug: gallery.slug }, { status: 200 });
  } catch (error) {
    console.error("[POST /api/galleries] Error:", error);
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues[0].message }, { status: 400 });
    }
    return NextResponse.json(
      { error: "Failed to create gallery." },
      { status: 500 }
    );
  }
}
