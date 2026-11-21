import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { r2Client, R2_BUCKET_NAME } from "@/lib/r2";
import { ListObjectsV2Command, ListObjectsV2CommandOutput, DeleteObjectsCommand } from "@aws-sdk/client-s3";

export const maxDuration = 300; // Allow long execution time

export async function GET(req: Request) {
  // CRON_SECRET is mandatory. If it isn't set the cron endpoint is locked down.
  const cronSecret = process.env.CRON_SECRET;
  const authHeader = req.headers.get("Authorization");
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    let deletedCount = 0;
    const prefixes = ["originals/", "previews/"];
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

    for (const prefix of prefixes) {
      let isTruncated = true;
      let continuationToken: string | undefined = undefined;

      while (isTruncated) {
        const response: ListObjectsV2CommandOutput = await r2Client.send(
          new ListObjectsV2Command({
            Bucket: R2_BUCKET_NAME,
            Prefix: prefix,
            ContinuationToken: continuationToken,
          })
        );
        const Contents = response.Contents;
        const IsTruncated = response.IsTruncated;
        const NextContinuationToken = response.NextContinuationToken;

        if (!Contents || Contents.length === 0) break;

        const oldObjects = Contents.filter(
          (obj) => obj.LastModified && new Date(obj.LastModified) < twentyFourHoursAgo && obj.Key
        );

        if (oldObjects.length > 0) {
          const keys = oldObjects.map((obj) => obj.Key as string);
          
          const inDb = await prisma.mediaItem.findMany({
            where: {
              OR: [
                { originalR2Key: { in: keys } },
                { previewR2Key: { in: keys } }
              ]
            },
            select: { originalR2Key: true, previewR2Key: true }
          });

          const dbKeys = new Set<string>();
          inDb.forEach(item => {
            dbKeys.add(item.originalR2Key);
            if (item.previewR2Key) dbKeys.add(item.previewR2Key);
          });

          const toDelete = keys.filter(key => !dbKeys.has(key));

          if (toDelete.length > 0) {
            for (let i = 0; i < toDelete.length; i += 1000) {
              const chunk = toDelete.slice(i, i + 1000);
              await r2Client.send(new DeleteObjectsCommand({
                Bucket: R2_BUCKET_NAME,
                Delete: { Objects: chunk.map(Key => ({ Key })) }
              }));
              deletedCount += chunk.length;
            }
          }
        }

        isTruncated = IsTruncated ?? false;
        continuationToken = NextContinuationToken;
      }
    }

    return NextResponse.json({ success: true, deletedCount });
  } catch (err) {
    console.error("[Cron] Error:", err);
    return NextResponse.json({ success: false }, { status: 500 });
  }
}
