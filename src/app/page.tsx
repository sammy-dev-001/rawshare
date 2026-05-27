/* eslint-disable */
"use client";

import { useState, useCallback } from "react";
import { UploadDropzone } from "@/components/gallery/UploadDropzone";
import { UploadManager } from "@/components/gallery/UploadManager";
import { motion, AnimatePresence } from "framer-motion";
import { Image as ImageIcon } from "lucide-react";

export default function Home() {
  const [files, setFiles] = useState<File[]>([]);

  const handleFilesSelected = useCallback((selectedFiles: File[]) => {
    setFiles(selectedFiles);
  }, []);

  const handleClear = useCallback(() => {
    setFiles([]);
  }, []);

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
                <UploadManager key="manager" initialFiles={files} onClear={handleClear} />
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
