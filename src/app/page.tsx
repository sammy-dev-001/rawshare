"use client";

import { useState, useCallback, useEffect } from "react";
import { UploadDropzone } from "@/components/gallery/UploadDropzone";
import { FileUploadItem } from "@/components/gallery/FileUploadItem";
import { UploadResult, UploadQuality } from "@/hooks/useUpload";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowRight, Loader2, Image as ImageIcon } from "lucide-react";

export default function Home() {
  const router = useRouter();
  
  const [files, setFiles] = useState<File[]>([]);
  const [title, setTitle] = useState("");
  const [isUploading, setIsUploading] = useState(false);
  const [isCreatingGallery, setIsCreatingGallery] = useState(false);
  const [completedUploads, setCompletedUploads] = useState<(UploadResult & { file: File })[]>([]);
  const [globalError, setGlobalError] = useState<string | null>(null);
  const [quality, setQuality] = useState<UploadQuality>("high");

  const QUALITY_OPTIONS: { id: UploadQuality; label: string; desc: string }[] = [
    { id: "standard", label: "Standard", desc: "Fast upload, smaller sizes (~1.5MB max)" },
    { id: "high", label: "High", desc: "Great balance of quality and size (~3MB max)" },
    { id: "original", label: "Original", desc: "Raw untouched files" },
  ];

  const handleFilesSelected = useCallback((selectedFiles: File[]) => {
    setFiles(selectedFiles);
    setCompletedUploads([]);
    setGlobalError(null);
    setIsUploading(false);
  }, []);

  const handleUploadComplete = useCallback((result: UploadResult & { file: File }) => {
    setCompletedUploads((prev) => [...prev, result]);
  }, []);

  const handleUploadError = useCallback((error: string) => {
    setGlobalError(`Upload failed: ${error}`);
    setIsUploading(false);
  }, []);

  // Watch for all uploads completing
  useEffect(() => {
    if (isUploading && files.length > 0 && completedUploads.length === files.length) {
      createGallery();
    }
  }, [isUploading, files.length, completedUploads.length]);

  const createGallery = async () => {
    if (isCreatingGallery) return;
    setIsCreatingGallery(true);
    setGlobalError(null);

    try {
      const response = await fetch("/api/galleries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title || `Gallery from ${new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}`,
          items: completedUploads.map((u) => ({
            originalKey: u.originalKey,
            previewKey: u.previewKey,
            fileType: u.file.type,
            sizeBytes: u.file.size,
          })),
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to create gallery");
      }

      const { slug } = await response.json();
      router.push(`/g/${slug}`);
    } catch (err: any) {
      setGlobalError(err.message);
      setIsCreatingGallery(false);
    }
  };

  const handleStartUpload = () => {
    if (files.length === 0) return;
    setIsUploading(true);
  };

  return (
    <main className="min-h-screen bg-black text-zinc-100 selection:bg-zinc-800 flex flex-col">
      <header className="w-full p-6 flex justify-between items-center border-b border-zinc-900/50 bg-black/50 backdrop-blur-md sticky top-0 z-50">
        <div className="flex items-center gap-3">
          <div className="bg-white text-black p-1.5 rounded-xl">
            <ImageIcon size={20} />
          </div>
          <h1 className="text-xl font-bold tracking-tight">Gallery</h1>
        </div>
      </header>

      <div className="flex-1 max-w-3xl w-full mx-auto px-6 py-12 flex flex-col justify-center">
        
        <div className="text-center mb-10">
          <motion.h2 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-4xl md:text-5xl font-bold tracking-tight text-white mb-4"
          >
            Share your media, <br className="hidden md:block" />
            <span className="text-zinc-500">beautifully.</span>
          </motion.h2>
          <motion.p 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="text-lg text-zinc-400 max-w-xl mx-auto"
          >
            Upload high-quality photos and videos to create a stunning, shareable gallery link. Links expire automatically in 5 days.
          </motion.p>
        </div>

        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.2, type: "spring", stiffness: 300, damping: 25 }}
          className="bg-zinc-950 border border-zinc-800 rounded-3xl p-2 shadow-2xl"
        >
          <div className="bg-zinc-900/30 rounded-2xl p-6 md:p-8">
            
            <AnimatePresence mode="wait">
              {files.length === 0 ? (
                <motion.div
                  key="dropzone"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                >
                  <UploadDropzone onFilesSelected={handleFilesSelected} maxFiles={35} />
                </motion.div>
              ) : (
                <motion.div
                  key="upload-form"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  className="flex flex-col space-y-6"
                >
                  <div className="flex items-center justify-between">
                    <h3 className="text-lg font-medium text-white">
                      {files.length} {files.length === 1 ? "file" : "files"} selected
                    </h3>
                    {!isUploading && (
                      <button 
                        onClick={() => setFiles([])}
                        className="text-sm text-zinc-500 hover:text-white transition-colors"
                      >
                        Clear all
                      </button>
                    )}
                  </div>

                  <div className="max-h-[40vh] overflow-y-auto space-y-2 pr-2 scrollbar-thin scrollbar-thumb-zinc-800">
                    {files.map((file, i) => (
                      <FileUploadItem
                        key={`${file.name}-${i}`}
                        file={file}
                        quality={quality}
                        startUpload={isUploading}
                        onComplete={handleUploadComplete}
                        onError={handleUploadError}
                      />
                    ))}
                  </div>

                  <div className="pt-4 border-t border-zinc-800/50">
                    <label className="block text-sm font-medium text-zinc-400 mb-3">
                      Upload Quality (Images only)
                    </label>
                    <div className="flex gap-2 p-1 bg-zinc-950 border border-zinc-800 rounded-xl relative">
                      {QUALITY_OPTIONS.map((opt) => {
                        const isActive = quality === opt.id;
                        return (
                          <button
                            key={opt.id}
                            onClick={() => setQuality(opt.id)}
                            disabled={isUploading}
                            className={`flex-1 relative py-2.5 px-3 text-sm font-medium rounded-lg transition-colors z-10 ${
                              isActive ? "text-white" : "text-zinc-500 hover:text-zinc-300"
                            } ${isUploading ? "opacity-50 cursor-not-allowed" : ""}`}
                          >
                            {isActive && (
                              <motion.div
                                layoutId="quality-active"
                                className="absolute inset-0 bg-zinc-800 rounded-lg -z-10 shadow-sm"
                                transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
                              />
                            )}
                            {opt.label}
                          </button>
                        );
                      })}
                    </div>
                    <p className="text-xs text-zinc-500 mt-2.5 ml-1">
                      {QUALITY_OPTIONS.find((o) => o.id === quality)?.desc}
                    </p>
                  </div>

                  <div className="pt-4 border-t border-zinc-800/50">
                    <label htmlFor="title" className="block text-sm font-medium text-zinc-400 mb-2">
                      Gallery Title
                    </label>
                    <input
                      id="title"
                      type="text"
                      placeholder={`e.g. Gallery from ${new Date().toLocaleDateString("en-US", { month: "short", day: "numeric" })}`}
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      disabled={isUploading}
                      className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3 text-white placeholder-zinc-600 focus:outline-none focus:ring-2 focus:ring-white/20 transition-all disabled:opacity-50"
                    />
                  </div>

                  {globalError && (
                    <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
                      {globalError}
                    </div>
                  )}

                  <button
                    onClick={handleStartUpload}
                    disabled={isUploading || isCreatingGallery}
                    className="w-full bg-white text-black hover:bg-zinc-200 disabled:bg-white/10 disabled:text-zinc-500 flex items-center justify-center gap-2 py-4 rounded-xl font-bold transition-all"
                  >
                    {isCreatingGallery ? (
                      <>
                        <Loader2 className="w-5 h-5 animate-spin" />
                        Finishing Gallery...
                      </>
                    ) : isUploading ? (
                      <>
                        <Loader2 className="w-5 h-5 animate-spin" />
                        Uploading {completedUploads.length} / {files.length}
                      </>
                    ) : (
                      <>
                        Upload and Create Link
                        <ArrowRight className="w-5 h-5" />
                      </>
                    )}
                  </button>
                </motion.div>
              )}
            </AnimatePresence>

          </div>
        </motion.div>
        
        <p className="text-center text-zinc-600 text-xs mt-8">
          Max 35 files per gallery. High resolution supported.
        </p>
      </div>
    </main>
  );
}
