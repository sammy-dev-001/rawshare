/**
 * src/lib/r2.ts
 *
 * Singleton S3-compatible client that points to Cloudflare R2.
 *
 * R2 is fully S3-compatible, so we use the official AWS SDK with a custom
 * `endpoint` that routes all traffic to Cloudflare instead of AWS.
 *
 * This file is SERVER-ONLY — never import it from client components or hooks.
 * Next.js will throw a build error if you try, because the AWS SDK contains
 * Node.js-only APIs that cannot run in the browser.
 */

import { S3Client } from "@aws-sdk/client-s3";

/**
 * Validate that all required R2 environment variables are present at module
 * load time. This surfaces misconfiguration as a clear startup error instead
 * of a cryptic runtime failure deep inside an API route.
 */
function requireEnv(key: string): string {
  const value = process.env[key];
  if (!value) {
    throw new Error(
      `Missing required environment variable: ${key}. ` +
        `Add it to .env.local (development) or Vercel Environment Variables (production).`
    );
  }
  return value;
}

const accountId = requireEnv("R2_ACCOUNT_ID");
const accessKeyId = requireEnv("R2_ACCESS_KEY_ID");
const secretAccessKey = requireEnv("R2_SECRET_ACCESS_KEY");

/**
 * The Cloudflare R2 S3-compatible endpoint.
 * Format: https://<ACCOUNT_ID>.r2.cloudflarestorage.com
 *
 * The `region` is set to "auto" — R2 doesn't use AWS regions, but the SDK
 * requires a non-empty string. "auto" is the Cloudflare-recommended value.
 */
export const r2Client = new S3Client({
  region: "auto",
  endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId,
    secretAccessKey,
  },
});

/** The name of the R2 bucket, used in every PutObject / GetObject command. */
export const R2_BUCKET_NAME = requireEnv("R2_BUCKET_NAME");
