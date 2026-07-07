import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import Link from "next/link";
import { Image as ImageIcon, Calendar } from "lucide-react";

export default async function DashboardPage() {
  const { userId } = await auth();
  
  if (!userId) {
    redirect("/");
  }

  const galleries = await prisma.gallery.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    include: {
      _count: {
        select: { items: true }
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
          {galleries.map(gallery => (
            <Link 
              key={gallery.id} 
              href={`/g/${gallery.slug}`}
              className="bg-zinc-950 border border-zinc-800 rounded-xl p-6 hover:border-zinc-700 transition-colors group block"
            >
              <h3 className="text-lg font-medium text-white mb-2 group-hover:text-blue-400 transition-colors truncate">
                {gallery.title}
              </h3>
              
              <div className="flex flex-col gap-2 text-sm text-zinc-500">
                <div className="flex items-center gap-2">
                  <ImageIcon className="w-4 h-4" />
                  <span>{gallery._count.items} {gallery._count.items === 1 ? 'item' : 'items'}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Calendar className="w-4 h-4" />
                  <span>{gallery.createdAt.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
