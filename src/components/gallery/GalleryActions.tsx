"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@clerk/nextjs";
import { Plus, X } from "lucide-react";
import { UploadManager } from "./UploadManager";
import { motion, AnimatePresence } from "framer-motion";

interface GalleryActionsProps {
  slug: string;
  ownerId?: string | null;
  viewCount?: number;
  downloadCount?: number;
}

export function GalleryActions({ slug, ownerId, viewCount = 0, downloadCount = 0 }: GalleryActionsProps) {
  const { userId, isLoaded } = useAuth();
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [files, setFiles] = useState<File[]>([]);

  useEffect(() => {
    if (!isLoaded) return;

    let authorized = false;
    
    // Check Clerk owner
    if (ownerId && userId === ownerId) {
      authorized = true;
    }

    // Check Local Storage admin token
    if (typeof window !== "undefined") {
      const token = localStorage.getItem(`admin_token_${slug}`);
      if (token) authorized = true;
    }

    setIsAuthorized(authorized);
  }, [userId, isLoaded, ownerId, slug]);

  if (!isAuthorized) return null;

  return (
    <>
      <div className="fixed bottom-8 right-8 z-40 flex items-center gap-3">
        {/* Analytics Pill */}
        <div className="bg-slate-surface/80 backdrop-blur-xl border border-white/10 px-4 py-2.5 rounded-full shadow-lg flex items-center gap-4 text-xs font-semibold text-zinc-300">
          <div className="flex items-center gap-1.5" title="Total Views">
            <span className="text-zinc-500">👁</span>
            <span>{viewCount}</span>
          </div>
          <div className="w-px h-3 bg-zinc-800" />
          <div className="flex items-center gap-1.5" title="Total Downloads">
            <span className="text-zinc-500">↓</span>
            <span>{downloadCount}</span>
          </div>
        </div>

        {/* Add Images Button */}
        <button
          onClick={() => setIsModalOpen(true)}
          className="bg-teal-accent hover:bg-teal-accent/90 text-black p-4 rounded-full shadow-lg transition-transform hover:scale-105 flex items-center justify-center"
          aria-label="Add Images"
        >
          <Plus className="w-6 h-6" />
        </button>
      </div>

      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-slate-bg border border-zinc-800 rounded-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]"
            >
              <div className="flex justify-between items-center p-6 border-b border-zinc-800">
                <h2 className="text-xl font-bold text-white">Add Images to Gallery</h2>
                <button
                  onClick={() => {
                    setIsModalOpen(false);
                    setFiles([]);
                  }}
                  className="text-zinc-400 hover:text-white p-2"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="p-6 overflow-y-auto">
                {files.length === 0 ? (
                  <div className="border-2 border-dashed border-zinc-700 rounded-xl p-12 text-center">
                    <input
                      type="file"
                      multiple
                      accept="image/*,video/*"
                      className="hidden"
                      id="file-upload"
                      onChange={(e) => {
                        if (e.target.files) {
                          setFiles(Array.from(e.target.files));
                        }
                      }}
                    />
                    <label
                      htmlFor="file-upload"
                      className="cursor-pointer inline-flex items-center justify-center gap-2 bg-white text-black px-6 py-3 rounded-xl font-bold hover:bg-zinc-200 transition-colors"
                    >
                      <Plus className="w-5 h-5" />
                      Select Files to Append
                    </label>
                  </div>
                ) : (
                  <UploadManager
                    initialFiles={files}
                    onClear={() => setFiles([])}
                    existingSlug={slug}
                    onUploadComplete={() => {
                      setIsModalOpen(false);
                      window.location.reload();
                    }}
                  />
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
}
