import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import Link from "next/link";
import { Image as ImageIcon, Calendar } from "lucide-react";

export default async function DashboardPage() {
  const { userId } = await auth();
  const r2PublicUrl = process.env.R2_PUBLIC_URL || "";
  
  if (!userId) {
    redirect("/");
  }

  const galleries = await prisma.gallery.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    include: {
      _count: {
        select: { items: true }
      },
      items: {
        take: 1,
        orderBy: { sortOrder: 'asc' }
      }
    }
  });

  return (
    <div className="max-w-6xl mx-auto px-4 py-12 w-full">
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-3xl font-bold text-white">Your Galleries</h1>
        <Link 
          href="/" 
          className="bg-white text-black px-4 py-2 rounded-lg font-medium hover:bg-zinc-200 transition-colors"
        >
          Create New
        </Link>
      </div>

      {galleries.length === 0 ? (
        <div className="text-center py-24 bg-zinc-900/50 rounded-2xl border border-zinc-800">
          <ImageIcon className="w-12 h-12 text-zinc-600 mx-auto mb-4" />
          <h2 className="text-xl font-medium text-zinc-300 mb-2">No galleries yet</h2>
          <p className="text-zinc-500 mb-6">Create your first gallery to start sharing photos.</p>
          <Link 
            href="/" 
            className="bg-white text-black px-6 py-2.5 rounded-lg font-medium hover:bg-zinc-200 transition-colors inline-block"
          >
            Create Gallery
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {galleries.map(gallery => {
            const coverItem = gallery.items[0];
            const coverUrl = coverItem 
              ? (coverItem.previewR2Key ? `${r2PublicUrl}/${coverItem.previewR2Key}` : `${r2PublicUrl}/${coverItem.originalR2Key}`) 
              : null;

            return (
              <Link 
                key={gallery.id} 
                href={`/g/${gallery.slug}`}
                className="group relative flex flex-col h-56 rounded-xl overflow-hidden border border-zinc-800 hover:border-zinc-700 transition-colors"
              >
                {coverUrl ? (
                  <div 
                    className="absolute inset-0 bg-cover bg-center transition-transform duration-700 group-hover:scale-105"
                    style={{ backgroundImage: `url(${coverUrl})` }}
                  />
                ) : (
                  <div className="absolute inset-0 bg-zinc-900" />
                )}
                
                {/* Gradient Overlay for text readability */}
                <div className="absolute inset-0 bg-gradient-to-t from-black/95 via-black/40 to-transparent transition-opacity duration-300 group-hover:opacity-90" />

                {/* Content */}
                <div className="relative mt-auto p-5">
                  <h3 className="text-lg font-bold text-white mb-2 group-hover:text-teal-400 transition-colors line-clamp-2 drop-shadow-md">
                    {gallery.title}
                  </h3>
                  
                  <div className="flex flex-wrap items-center gap-4 text-xs text-zinc-300 font-semibold drop-shadow">
                    <div className="flex items-center gap-1.5">
                      <ImageIcon className="w-3.5 h-3.5" />
                      <span>{gallery._count.items} {gallery._count.items === 1 ? 'item' : 'items'}</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Calendar className="w-3.5 h-3.5" />
                      <span>{gallery.createdAt.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</span>
                    </div>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
