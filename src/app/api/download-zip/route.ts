import { NextRequest } from "next/server";
import { Zip, ZipPassThrough } from "fflate";

export const runtime = "edge";

export async function POST(req: NextRequest) {
  const formData = await req.formData();
  const keysStr = formData.get("keys") as string;
  const title = (formData.get("title") as string) || "gallery";

  if (!keysStr) {
    return new Response("Missing keys", { status: 400 });
  }

  const keys = keysStr.split(",");
  if (keys.length === 0 || keys.length > 50) {
    return new Response("Invalid number of keys (1-50)", { status: 400 });
  }

  // Ensure r2PublicUrl is available
  const r2PublicUrl = process.env.R2_PUBLIC_URL;
  if (!r2PublicUrl) {
    return new Response("Server configuration error", { status: 500 });
  }

  const zip = new Zip();

  const stream = new ReadableStream({
    start(controller) {
      zip.ondata = (err, data, final) => {
        if (err) {
          controller.error(err);
        } else {
          controller.enqueue(data);
          if (final) {
            controller.close();
          }
        }
      };
    },
  });

  // Start processing files asynchronously without blocking the stream initialization
  (async () => {
    try {
      // Process sequentially to limit memory overhead on the Edge function
      for (const key of keys) {
        const url = `${r2PublicUrl}/${key}`;
        const response = await fetch(url);
        
        if (!response.ok || !response.body) {
          console.error(`Failed to fetch ${url}`);
          continue;
        }

        const filename = key.split("/").pop() || "file";
        const zipStream = new ZipPassThrough(filename);
        zip.add(zipStream);

        // Pipe the fetch response body (WebStream) to the fflate ZipPassThrough
        const reader = response.body.getReader();
        while (true) {
          const { done, value } = await reader.read();
          if (done) {
            zipStream.push(new Uint8Array(0), true); // true = EOF
            break;
          }
          if (value) {
            zipStream.push(value);
          }
        }
      }
    } catch (err) {
      console.error("Zipping error:", err);
    } finally {
      zip.end();
    }
  })();

  return new Response(stream, {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="${title.replace(/[^a-z0-9]/gi, "_")}.zip"`,
    },
  });
}
