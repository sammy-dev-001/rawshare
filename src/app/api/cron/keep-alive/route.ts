import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

/**
 * GET /api/cron/keep-alive
 *
 * Lightweight cron endpoint that runs a cheap DB query every few days
 * to prevent Supabase from pausing the project due to inactivity.
 *
 * Supabase pauses free-tier projects after 7 days of inactivity.
 * This runs every 4 days (via vercel.json schedule) to stay well within that window.
 *
 * Must be called with:  Authorization: Bearer <CRON_SECRET>
 */
export async function GET(req: Request) {
  const cronSecret = process.env.CRON_SECRET;
  const authHeader = req.headers.get("authorization");

  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const start = Date.now();

    // 1. Force a live raw SQL query on PostgreSQL (bypasses any caching, forces engine compute)
    await prisma.$queryRaw`SELECT 1;`;

    // 2. Also count galleries
    const count = await prisma.gallery.count();

    const elapsed = Date.now() - start;

    console.log(`[Keep-Alive] Supabase ping OK — ${count} galleries (${elapsed}ms)`);

    return NextResponse.json({
      ok: true,
      message: "Supabase keep-alive ping successful.",
      galleryCount: count,
      responseTimeMs: elapsed,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("[Keep-Alive] Supabase ping FAILED:", error);
    return NextResponse.json(
      {
        ok: false,
        error: "Keep-alive ping failed — check DB connection.",
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
}

