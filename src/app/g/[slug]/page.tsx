import { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/db";
import { GalleryGrid } from "@/components/gallery/GalleryGrid";
import { ShieldAlert, Calendar } from "lucide-react";
import ShareButton from "@/components/gallery/ShareButton";

interface GalleryPageProps {
  params: Promise<{
    slug: string;
  }>;
}

export async function generateMetadata({ params }: GalleryPageProps): Promise<Metadata> {
  const { slug } = await params;
  
  const gallery = await prisma.gallery.findUnique({
    where: { slug },
    include: {
      items: {
        orderBy: { sortOrder: "asc" },
        take: 1, // We only need the first item for the OG image
      },
    },
  });

  if (!gallery) {
    return {
      title: "Gallery Not Found | RawShare",
    };
  }

  const r2PublicUrl = process.env.R2_PUBLIC_URL || "";
  let ogImageUrl = "";
  
  if (gallery.items.length > 0) {
    const firstItem = gallery.items[0];
    const key = firstItem.previewR2Key || firstItem.originalR2Key;
    ogImageUrl = `${r2PublicUrl}/${key}`;
  }

  return {
    title: `${gallery.title} | RawShare`,
    description: `View ${gallery.title} on RawShare. Shared instantly, no compression.`,
    openGraph: {
      title: `${gallery.title} | RawShare`,
      description: `View ${gallery.title} on RawShare. Shared instantly, no compression.`,
      images: ogImageUrl ? [ogImageUrl] : [],
      type: "website",
    },
    twitter: {
      card: "summary_large_image",
      title: `${gallery.title} | RawShare`,
      description: `View ${gallery.title} on RawShare. Shared instantly, no compression.`,
      images: ogImageUrl ? [ogImageUrl] : [],
    },
  };
}

export default async function GalleryPage({ params }: GalleryPageProps) {
  const { slug } = await params;

  // Fetch the gallery and its media items in order
  const gallery = await prisma.gallery.findUnique({
    where: { slug },
    include: {
      items: {
        orderBy: { sortOrder: "asc" },
      },
    },
  });

  if (!gallery) {
    notFound();
  }

  // Check if link has expired
  const isExpired = gallery.expiresAt ? new Date() > new Date(gallery.expiresAt) : false;

  if (isExpired) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-zinc-950 px-4 text-center text-zinc-100 font-sans">
        <div className="rounded-3xl border border-zinc-800 bg-zinc-900/40 p-8 shadow-2xl backdrop-blur-md max-w-md w-full">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-red-950/40 text-red-500 border border-red-500/10 mb-6">
            <ShieldAlert className="h-7 w-7" />
          </div>
          <h1 className="text-xl font-bold tracking-tight text-white mb-2">Link Expired</h1>
          <p className="text-zinc-400 text-sm mb-6 leading-relaxed">
            The owner configured an expiration date for this shared gallery, and it is no longer available.
          </p>
          <div className="flex items-center justify-center gap-2 text-xs text-zinc-500 bg-zinc-900/80 px-4 py-2.5 rounded-2xl border border-zinc-800">
            <Calendar className="h-4 w-4 text-zinc-400" />
            <span>Expired on {new Date(gallery.expiresAt!).toLocaleDateString(undefined, { dateStyle: 'long' })}</span>
          </div>
        </div>
      </div>
    );
  }

  // Pass down R2 Public URL from Server to Client component
  const r2PublicUrl = process.env.R2_PUBLIC_URL || "";

  // Convert BigInt sizeBytes and serialize Dates to avoid hydration issues
  const serializedItems = gallery.items.map((item) => ({
    id: item.id,
    originalKey: item.originalR2Key,
    previewKey: item.previewR2Key,
    fileType: item.fileType,
    sizeBytes: Number(item.sizeBytes),
    width: item.width,
    height: item.height,
    sortOrder: item.sortOrder,
    createdAt: item.createdAt.toISOString(),
  }));

  return (
    <div className="min-h-screen bg-black text-zinc-100 flex flex-col font-sans selection:bg-zinc-800 relative">
      
      {/* Ambient Background Glows */}
      <div className="fixed inset-0 z-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-[30%] -left-[10%] w-[70%] h-[70%] rounded-full bg-indigo-900/15 blur-[120px] mix-blend-screen" />
        <div className="absolute top-[20%] -right-[20%] w-[60%] h-[60%] rounded-full bg-purple-900/15 blur-[120px] mix-blend-screen" />
        <div className="absolute -bottom-[40%] left-[20%] w-[80%] h-[80%] rounded-full bg-emerald-900/10 blur-[120px] mix-blend-screen" />
      </div>

      <header className="border-b border-white/5 bg-black/40 sticky top-0 z-40 backdrop-blur-xl">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between">
          <div className="flex flex-col">
            <span className="text-[10px] font-bold tracking-widest text-zinc-500 uppercase">Shared Gallery</span>
            <h1 className="text-lg font-bold tracking-tight text-white">{gallery.title}</h1>
          </div>
          <div className="flex items-center gap-3">
            <div className="text-xs text-zinc-400 bg-white/5 border border-white/10 px-3.5 py-1.5 rounded-full font-semibold hidden sm:block">
              {serializedItems.length} {serializedItems.length === 1 ? 'item' : 'items'}
            </div>
            <ShareButton galleryTitle={gallery.title} />
          </div>
        </div>
      </header>

      <main className="flex-grow mx-auto max-w-7xl w-full px-4 sm:px-6 lg:px-8 py-6 relative">
        <GalleryGrid 
          items={serializedItems} 
          r2PublicUrl={r2PublicUrl} 
          galleryTitle={gallery.title} 
        />

        <div className="mt-24 pb-8 flex justify-center">
          <Link 
            href="/" 
            className="flex items-center gap-2 text-sm font-semibold text-zinc-300 hover:text-white transition-colors bg-zinc-900/80 hover:bg-zinc-800 px-6 py-3 rounded-full border border-zinc-800"
          >
            Create your own RawShare gallery
          </Link>
        </div>
      </main>
    </div>
  );
}
