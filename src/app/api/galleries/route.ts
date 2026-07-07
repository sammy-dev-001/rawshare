import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { randomBytes } from "crypto";
import { rateLimiter } from "@/lib/rate-limit";
import { auth } from "@clerk/nextjs/server";
import bcrypt from "bcryptjs";

// Schema to validate the incoming POST request
const createGallerySchema = z.object({
  title: z.string().min(1, "Title is required").max(100, "Title is too long"),
  password: z.string().optional(),
  items: z.array(
    z.object({
      originalKey: z.string(),
      previewKey: z.string().optional(),
      fileType: z.string(),
      sizeBytes: z.number().int().positive(),
      width: z.number().int().positive().optional(),
      height: z.number().int().positive().optional(),
      exifData: z.any().optional(),
    })
  ).min(1, "At least one item is required").max(50, "Maximum 50 items allowed"),
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
  const ip = req.headers.get("x-forwarded-for") ?? "127.0.0.1";
  const { success } = await rateLimiter.limit(ip);
  if (!success) {
    return NextResponse.json({ error: "Too many gallery creation requests. Please try again later." }, { status: 429 });
  }

  try {
    const body = await req.json();
    const parsedData = createGallerySchema.parse(body);

    const slug = generateSlug(parsedData.title);
    
    const { userId } = await auth();
    let adminToken: string | undefined = undefined;
    let expiresAt: Date | null = new Date();
    
    if (userId) {
      expiresAt = null; // No expiration for authenticated users
    } else {
      expiresAt.setDate(expiresAt.getDate() + 5); // 5 days expiration for guests
      adminToken = randomBytes(16).toString("hex");
    }

    let passwordHash: string | undefined = undefined;
    if (parsedData.password && parsedData.password.trim().length > 0) {
      passwordHash = await bcrypt.hash(parsedData.password.trim(), 10);
    }

    // Save to database
    const gallery = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      return tx.gallery.create({
        data: {
          title: parsedData.title,
          slug,
          expiresAt,
          userId,
          adminToken,
          passwordHash,
          items: {
            create: parsedData.items.map((item, index) => ({
              originalR2Key: item.originalKey,
              previewR2Key: item.previewKey,
              fileType: item.fileType,
              sizeBytes: item.sizeBytes,
              width: item.width,
              height: item.height,
              exifData: item.exifData ?? undefined,
              sortOrder: index, // Preserve the order from the client array
            })),
          },
        },
      });
    });

    return NextResponse.json({ slug: gallery.slug, adminToken }, { status: 200 });
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
