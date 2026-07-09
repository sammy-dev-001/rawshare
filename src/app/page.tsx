"use client";

import { useState, useCallback } from "react";
import { UploadDropzone } from "@/components/gallery/UploadDropzone";
import { UploadManager } from "@/components/gallery/UploadManager";
import { motion, AnimatePresence } from "framer-motion";
import { Image as ImageIcon, Zap, Lock, Smartphone } from "lucide-react";
import { PwaFileLoader } from "@/components/PwaFileLoader";

export default function Home() {
  const [files, setFiles] = useState<File[]>([]);

  const handleFilesSelected = useCallback((selectedFiles: File[]) => {
    setFiles(selectedFiles);
  }, []);

  const handleClear = useCallback(() => {
    setFiles([]);
  }, []);

  return (
    <main className="min-h-screen bg-black text-zinc-100 selection:bg-zinc-800 flex flex-col relative overflow-hidden">
      <PwaFileLoader onFilesLoaded={setFiles} />
      {/* Ambient Background Glows */}
      <div className="absolute inset-0 z-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-[30%] -left-[10%] w-[70%] h-[70%] rounded-full bg-slate-bg blur-[120px] mix-blend-screen animate-aurora-1" />
        <div className="absolute top-[20%] -right-[20%] w-[60%] h-[60%] rounded-full bg-teal-accent/10 blur-[120px] mix-blend-screen animate-aurora-2" />
        <div className="absolute -bottom-[40%] left-[20%] w-[80%] h-[80%] rounded-full bg-slate-surface blur-[120px] mix-blend-screen animate-aurora-3" />
      </div>



      <div className="flex-1 max-w-3xl w-full mx-auto px-6 py-12 flex flex-col justify-center">
        
        <div className="text-center mb-10">
          <motion.h2 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-4xl md:text-5xl font-bold tracking-tight text-white mb-4"
          >
            Share your media, <br className="hidden md:block" />
            <span className="bg-gradient-to-r from-zinc-300 to-teal-accent/80 text-transparent bg-clip-text">beautifully.</span>
          </motion.h2>
          <motion.p 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="text-lg text-zinc-400 max-w-xl mx-auto"
          >
            Upload high-quality photos and videos to create a stunning, shareable gallery link.
          </motion.p>
        </div>

        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.2, type: "spring", stiffness: 300, damping: 25 }}
          className="relative z-10 bg-slate-surface/40 backdrop-blur-2xl border border-white/10 rounded-3xl p-2 shadow-[0_0_50px_rgba(0,0,0,0.5)]"
        >
          <div className="bg-white/5 rounded-2xl p-6 md:p-8 border border-white/5">
            
            <AnimatePresence mode="wait">
              {files.length === 0 ? (
                <motion.div
                  key="dropzone"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                >
                  <UploadDropzone onFilesSelected={handleFilesSelected} maxFiles={50} />
                </motion.div>
              ) : (
                <UploadManager key="manager" initialFiles={files} onClear={handleClear} />
              )}
            </AnimatePresence>

          </div>
        </motion.div>
        
        
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-12 max-w-2xl mx-auto text-center"
        >
          <div className="flex flex-col items-center gap-2 text-zinc-400">
            <div className="p-3 rounded-full bg-white/5 border border-white/10 text-white">
              <Zap size={20} />
            </div>
            <h3 className="font-semibold text-zinc-200">Original Quality</h3>
            <p className="text-sm">Bypass standard compression. Your files stay perfectly crisp.</p>
          </div>
          <div className="flex flex-col items-center gap-2 text-zinc-400">
            <div className="p-3 rounded-full bg-white/5 border border-white/10 text-white">
              <Lock size={20} />
            </div>
            <h3 className="font-semibold text-zinc-200">Auto-Expires</h3>
            <p className="text-sm">Set your links to expire automatically, or keep them forever.</p>
          </div>
          <div className="flex flex-col items-center gap-2 text-zinc-400">
            <div className="p-3 rounded-full bg-white/5 border border-white/10 text-white">
              <Smartphone size={20} />
            </div>
            <h3 className="font-semibold text-zinc-200">WhatsApp Bypass</h3>
            <p className="text-sm">Share directly to WhatsApp Status without losing quality.</p>
          </div>
        </motion.div>
        
      </div>
    </main>
  );
}
