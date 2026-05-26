<div align="center">

# 📸 RawShare

### Instant, beautiful photo galleries — created in seconds, shared with a link.

[![Next.js](https://img.shields.io/badge/Next.js-16-black?style=for-the-badge&logo=next.js)](https://nextjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-blue?style=for-the-badge&logo=typescript)](https://www.typescriptlang.org/)
[![Prisma](https://img.shields.io/badge/Prisma-5-2D3748?style=for-the-badge&logo=prisma)](https://www.prisma.io/)
[![Supabase](https://img.shields.io/badge/Supabase-PostgreSQL-3ECF8E?style=for-the-badge&logo=supabase)](https://supabase.com/)
[![Cloudflare R2](https://img.shields.io/badge/Cloudflare-R2_Storage-F38020?style=for-the-badge&logo=cloudflare)](https://developers.cloudflare.com/r2/)

</div>

---

## ✨ What is RawShare?

**RawShare** is a zero-friction media sharing app. Drop your photos or videos, give your gallery a title, and instantly get a shareable link — no accounts, no compression, no nonsense. Links expire automatically after **5 days** to keep things clean.

Built with a premium dark-mode UI and smooth animations, it feels great on every device.

---

## 🚀 Features

- **Drag-and-drop uploads** — drop multiple files at once, watch live progress bars
- **Instant shareable links** — one click copies your gallery URL to the clipboard
- **Lightbox viewer** — full-screen preview with keyboard navigation (← →) and zoom
- **Bulk download** — select images and download them as a `.zip` file right in the browser
- **5-day auto-expiry** — links expire automatically, no cleanup needed
- **Cloudflare R2 storage** — fast, global delivery with zero egress fees
- **Supabase (PostgreSQL)** — reliable, scalable database with connection pooling
- **Mobile-first** — responsive layout, works great on phones and tablets

---

## 🛠️ Tech Stack

| Layer | Technology |
|---|---|
| **Framework** | [Next.js 16](https://nextjs.org/) (App Router) |
| **Language** | TypeScript 5 |
| **Styling** | Tailwind CSS v4 |
| **Animations** | Framer Motion |
| **Database ORM** | Prisma 5 |
| **Database** | Supabase (PostgreSQL) |
| **File Storage** | Cloudflare R2 |
| **Icons** | Lucide React |

---

## ⚙️ Getting Started

### Prerequisites

- Node.js 18+
- A [Supabase](https://supabase.com/) project
- A [Cloudflare R2](https://developers.cloudflare.com/r2/) bucket

### 1. Clone & Install

```bash
git clone https://github.com/sammy-dev-001/rawshare.git
cd rawshare
npm install
```

### 2. Set up Environment Variables

Copy the example file and fill in your values:

```bash
cp .env.example .env.local
```

```env
# Supabase — use direct connection (port 5432) for local dev
DATABASE_URL="postgresql://USER:PASSWORD@HOST:5432/postgres?connection_limit=1"
DIRECT_URL="postgresql://USER:PASSWORD@HOST:5432/postgres"

# Cloudflare R2
R2_ACCOUNT_ID="your-account-id"
R2_ACCESS_KEY_ID="your-access-key"
R2_SECRET_ACCESS_KEY="your-secret-key"
R2_BUCKET_NAME="your-bucket-name"
R2_PUBLIC_URL="https://pub-xxxx.r2.dev"
```

> **⚠️ Vercel / Production:** Use the **pooler URL** (port `6543` + `?pgbouncer=true`) for `DATABASE_URL` in serverless environments.

### 3. Push the Database Schema

```bash
npx prisma db push
```

### 4. Run the Dev Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) 🎉

---

## 🌐 Deploying to Vercel

1. Push this repo to GitHub
2. Import the project at [vercel.com/new](https://vercel.com/new)
3. Add the following environment variables in the Vercel dashboard:

| Variable | Notes |
|---|---|
| `DATABASE_URL` | Use port `6543` with `?pgbouncer=true` for Vercel |
| `DIRECT_URL` | Use port `5432` (direct connection) |
| `R2_ACCOUNT_ID` | From Cloudflare dashboard |
| `R2_ACCESS_KEY_ID` | From Cloudflare R2 API tokens |
| `R2_SECRET_ACCESS_KEY` | From Cloudflare R2 API tokens |
| `R2_BUCKET_NAME` | Your R2 bucket name |
| `R2_PUBLIC_URL` | Your R2 public dev/custom domain URL |

4. Click **Deploy** ✅

---

## 📁 Project Structure

```
src/
├── app/
│   ├── api/
│   │   ├── galleries/    # POST — create gallery & save to DB
│   │   └── upload/       # POST — generate R2 presigned upload URLs
│   ├── g/[slug]/         # Gallery viewer page (SSR)
│   └── page.tsx          # Upload / home page
├── components/
│   └── gallery/
│       ├── UploadDropzone.tsx   # Drag-and-drop file picker
│       ├── FileUploadItem.tsx   # Per-file progress row
│       ├── GalleryGrid.tsx      # Masonry image grid + selection
│       ├── Lightbox.tsx         # Full-screen viewer with zoom
│       ├── ActionBar.tsx        # Floating download / select bar
│       └── ShareButton.tsx      # Copy-link button
├── lib/
│   └── db.ts             # Prisma client singleton
prisma/
└── schema.prisma         # DB schema (Gallery + MediaItem)
```

---

## 📄 License

MIT © [sammy-dev-001](https://github.com/sammy-dev-001)

---

<div align="center">
  <sub>Built with ❤️ using Next.js, Supabase & Cloudflare R2</sub>
</div>
