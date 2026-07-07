import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { rateLimiter } from "@/lib/rate-limit";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
): Promise<NextResponse> {
  const ip = req.headers.get("x-forwarded-for") ?? "127.0.0.1";
  const { success } = await rateLimiter.limit(ip);
  if (!success) {
    return NextResponse.json({ error: "Too many requests." }, { status: 429 });
  }

  const resolvedParams = await params;

  try {
    const body = await req.json();
    
    if (body.type === "view") {
      await prisma.gallery.update({
        where: { slug: resolvedParams.slug },
        data: { viewCount: { increment: 1 } }
      });
    } else if (body.type === "download") {
      await prisma.gallery.update({
        where: { slug: resolvedParams.slug },
        data: { downloadCount: { increment: 1 } }
      });
    }

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error) {
    console.error("[POST /api/galleries/[slug]/analytics] Error:", error);
    return NextResponse.json(
      { error: "Failed to update analytics." },
      { status: 500 }
    );
  }
}
