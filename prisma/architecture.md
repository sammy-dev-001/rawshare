# Architecture – $0 Media-Sharing Web App

## Stack at a Glance

| Layer | Service | Free Tier Limit |
|-------|---------|-----------------|
| **Frontend + API** | Next.js (App Router) on Vercel | 100 GB bandwidth, serverless functions |
| **Database** | Supabase PostgreSQL | 500 MB storage, 2 projects |
| **Media Storage** | Cloudflare R2 | 10 GB storage, **zero egress** |

---

## 1. Prisma Schema

> [!NOTE]
> The schema lives at [schema.prisma](file:///c:/Users/USER/Documents/CODE%20X/web-upload/prisma/schema.prisma).

### Entity-Relationship Diagram

```mermaid
erDiagram
    Gallery ||--o{ MediaItem : "has many"
    Gallery {
        string id PK
        string slug UK
        string title
        datetime expires_at
        datetime created_at
        datetime updated_at
    }
    MediaItem {
        string id PK
        string gallery_id FK
        string original_r2_key
        string preview_r2_key
        string file_type
        bigint size_bytes
        int width
        int height
        int sort_order
        datetime created_at
    }
```

### Key Design Decisions

| Decision | Rationale |
|----------|-----------|
| `cuid()` IDs | URL-safe, sortable, no collision risk across distributed systems |
| `slug` on Gallery | Human-readable share URLs (`/g/summer-trip-2026`) |
| `expiresAt` on Gallery | Optional link expiry — enforced in the API layer, not the DB |
| `sortOrder` on MediaItem | Explicit ordering within a gallery (drag-and-drop reorder later) |
| `previewR2Key` nullable | Thumbnails generated asynchronously after upload |
| `BigInt` for `sizeBytes` | Uncompressed video files can easily exceed 2 GB (Int max ~2.1 GB) |
| Compound index `(galleryId, sortOrder)` | Efficient single-query gallery listing in display order |
| `onDelete: Cascade` | Deleting a gallery removes all its media items automatically |
| `@@map("snake_case")` | Keeps PostgreSQL columns in idiomatic `snake_case` while Prisma uses `camelCase` |

---

## 2. Folder Structure

```
web-upload/
├── prisma/
│   └── schema.prisma              # Database schema (✅ exists)
│
├── src/
│   ├── app/                       # Next.js App Router
│   │   ├── layout.tsx             # Root layout (fonts, metadata, providers)
│   │   ├── page.tsx               # Landing / gallery creation page
│   │   ├── g/
│   │   │   └── [slug]/
│   │   │       └── page.tsx       # Public gallery viewer
│   │   └── api/
│   │       ├── galleries/
│   │       │   └── route.ts       # POST: create gallery
│   │       ├── galleries/[id]/
│   │       │   └── route.ts       # GET / DELETE gallery by id
│   │       └── upload/
│   │           └── route.ts       # POST: presigned R2 upload URL
│   │
│   ├── components/                # React components
│   │   ├── ui/                    # Generic UI primitives (Button, Card…)
│   │   ├── gallery/               # Gallery-specific components
│   │   │   ├── GalleryGrid.tsx
│   │   │   ├── MediaCard.tsx
│   │   │   └── UploadDropzone.tsx
│   │   └── layout/                # Shell components (Header, Footer)
│   │
│   ├── lib/                       # Server-side library code
│   │   ├── db.ts                  # Prisma client singleton
│   │   ├── r2.ts                  # Cloudflare R2 (S3-compatible) client
│   │   └── env.ts                 # Validated env vars (zod)
│   │
│   ├── hooks/                     # Custom React hooks
│   │   └── useUpload.ts           # Client-side upload state machine
│   │
│   └── types/                     # Shared TypeScript types
│       └── index.ts
│
├── public/                        # Static assets (favicon, OG images)
│
├── .env.local                     # Local env vars (git-ignored)
├── .env.example                   # Template for collaborators
├── next.config.ts
├── tsconfig.json
├── package.json
└── README.md
```

### Guiding Principles

- **`src/app/api/**`** — Every data mutation goes through these Route Handlers. The client **never** touches the database or R2 directly.
- **`src/lib/`** — Server-only code, imported exclusively by API routes and Server Components. The Prisma client and R2 SDK live here.
- **`src/components/`** — Pure presentation. All data comes in via props or `fetch()` calls to the API routes.
- **`src/hooks/`** — Client-side only logic (upload progress, optimistic UI).

---

## 3. Data-Flow Architecture

```mermaid
sequenceDiagram
    participant Browser
    participant API as Next.js API Routes<br>(Vercel Serverless)
    participant DB as Supabase<br>PostgreSQL
    participant R2 as Cloudflare R2

    Note over Browser,R2: Upload Flow
    Browser->>API: POST /api/upload (fileName, fileType)
    API->>R2: Generate presigned PUT URL
    R2-->>API: Presigned URL (5 min TTL)
    API-->>Browser: { uploadUrl, r2Key }
    Browser->>R2: PUT file (direct upload)
    R2-->>Browser: 200 OK
    Browser->>API: POST /api/galleries (confirm upload)
    API->>DB: INSERT Gallery + MediaItem
    DB-->>API: Created record
    API-->>Browser: { slug }

    Note over Browser,R2: View Flow
    Browser->>API: GET /api/galleries/[id]
    API->>DB: SELECT Gallery + MediaItems
    DB-->>API: Records
    API->>R2: Generate presigned GET URLs
    R2-->>API: Signed URLs (1 hr TTL)
    API-->>Browser: Gallery data + signed media URLs
```

> [!IMPORTANT]
> The browser **never** holds R2 credentials. All presigned URLs are generated server-side with short TTLs.

---

## 4. Environment Variables Setup

### 4.1 Supabase (Database)

1. Go to your [Supabase Dashboard](https://supabase.com/dashboard) → Project → **Settings → Database**.
2. Copy two connection strings:

```env
# .env.local

# Pooled connection (via PgBouncer) — used by the app at runtime
DATABASE_URL="postgresql://postgres.[PROJECT-REF]:[PASSWORD]@aws-0-[REGION].pooler.supabase.com:6543/postgres?pgbouncer=true"

# Direct connection — used only by Prisma Migrate
DIRECT_URL="postgresql://postgres.[PROJECT-REF]:[PASSWORD]@aws-0-[REGION].pooler.supabase.com:5432/postgres"
```

> [!TIP]
> Supabase auto-generates both URLs for you. Click **"URI"** under the Connection Pooling section for `DATABASE_URL`, and **"URI"** under Direct Connection for `DIRECT_URL`.

### 4.2 Cloudflare R2 (Storage)

1. Go to [Cloudflare Dashboard](https://dash.cloudflare.com) → **R2** → **Create Bucket** (e.g. `gallery-media`).
2. Under **R2** → **Manage R2 API Tokens** → **Create API Token** with `Object Read & Write` permissions.

```env
# .env.local (continued)

R2_ACCOUNT_ID="your-cloudflare-account-id"
R2_ACCESS_KEY_ID="your-r2-access-key"
R2_SECRET_ACCESS_KEY="your-r2-secret-key"
R2_BUCKET_NAME="gallery-media"
R2_PUBLIC_URL="https://your-custom-domain-or-r2-dev-url"  # optional, for public bucket access
```

### 4.3 `.env.example` Template

```env
# Database (Supabase)
DATABASE_URL=
DIRECT_URL=

# Storage (Cloudflare R2)
R2_ACCOUNT_ID=
R2_ACCESS_KEY_ID=
R2_SECRET_ACCESS_KEY=
R2_BUCKET_NAME=
R2_PUBLIC_URL=
```

### 4.4 Vercel Deployment

On Vercel, add these same variables under **Settings → Environment Variables**. Prisma will use `DATABASE_URL` at runtime; `DIRECT_URL` is only needed during `prisma migrate deploy` (run from CI or locally).

---

## 5. Next Steps

Once this architecture is approved, the implementation order would be:

1. **Scaffold the Next.js project** — `npx create-next-app@latest`
2. **Install dependencies** — `prisma`, `@prisma/client`, `@aws-sdk/client-s3`, `@aws-sdk/s3-request-presigner`, `zod`
3. **Run initial migration** — `npx prisma migrate dev --name init`
4. **Build API routes** — upload flow → gallery CRUD
5. **Build UI** — landing page → gallery viewer → upload dropzone
