"use client";

import { useState, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { UploadCloud, Image as ImageIcon, Video, X } from "lucide-react";

interface UploadDropzoneProps {
  onFilesSelected: (files: File[]) => void;
  maxFiles?: number;
  disabled?: boolean;
}

export function UploadDropzone({ onFilesSelected, maxFiles = 35, disabled = false }: UploadDropzoneProps) {
  const [isDragActive, setIsDragActive] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFiles = useCallback(
    (newFiles: FileList | File[]) => {
      if (disabled) return;
      setError(null);

      const filesArray = Array.from(newFiles);
      
      // Filter out unsupported files
      const validFiles = filesArray.filter(
        (file) => file.type.startsWith("image/") || file.type.startsWith("video/")
      );

      if (validFiles.length !== filesArray.length) {
        setError("Some files were skipped. Only images and videos are supported.");
      }

      if (validFiles.length > maxFiles) {
        setError(`You can only upload up to ${maxFiles} files at once.`);
        onFilesSelected(validFiles.slice(0, maxFiles));
      } else if (validFiles.length > 0) {
        onFilesSelected(validFiles);
      }
    },
    [maxFiles, onFilesSelected, disabled]
  );

  const onDragOver = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      e.stopPropagation();
      if (!disabled) setIsDragActive(true);
    },
    [disabled]
  );

  const onDragLeave = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragActive(false);
  }, []);

  const onDrop = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragActive(false);
      
      if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
        handleFiles(e.dataTransfer.files);
      }
    },
    [handleFiles]
  );

  const onFileInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.files && e.target.files.length > 0) {
        handleFiles(e.target.files);
        // Reset input so the same files can be selected again if needed
        e.target.value = "";
      }
    },
    [handleFiles]
  );

  return (
    <div className="w-full">
      <motion.div
        className={`relative overflow-hidden rounded-3xl border-2 border-dashed transition-colors duration-300 ${
          disabled
            ? "border-zinc-800 bg-zinc-900/50 cursor-not-allowed opacity-60"
            : isDragActive
            ? "border-white bg-zinc-800/80 cursor-copy"
            : "border-zinc-800 bg-zinc-900/40 hover:bg-zinc-800/60 hover:border-zinc-700 cursor-pointer"
        }`}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onDrop={onDrop}
        onClick={() => !disabled && fileInputRef.current?.click()}
        animate={{
          scale: isDragActive && !disabled ? 1.02 : 1,
        }}
        whileHover={{
          scale: !isDragActive && !disabled ? 1.01 : 1,
        }}
        whileTap={{
          scale: !disabled ? 0.98 : 1,
        }}
      >
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept="image/*,video/*"
          className="hidden"
          onChange={onFileInputChange}
          disabled={disabled}
        />

        <div className="flex flex-col items-center justify-center p-12 text-center">
          <div className="mb-6 flex gap-4 text-zinc-500">
            <motion.div
              animate={{ y: isDragActive ? -10 : 0, rotate: isDragActive ? -10 : 0 }}
              transition={{ type: "spring", stiffness: 300, damping: 20 }}
            >
              <ImageIcon className="h-10 w-10" />
            </motion.div>
            <motion.div
              animate={{ y: isDragActive ? -15 : 0, scale: isDragActive ? 1.1 : 1 }}
              transition={{ type: "spring", stiffness: 300, damping: 20 }}
            >
              <UploadCloud className="h-12 w-12 text-white drop-shadow-lg" />
            </motion.div>
            <motion.div
              animate={{ y: isDragActive ? -10 : 0, rotate: isDragActive ? 10 : 0 }}
              transition={{ type: "spring", stiffness: 300, damping: 20 }}
            >
              <Video className="h-10 w-10" />
            </motion.div>
          </div>

          <h3 className="mb-2 text-xl font-bold tracking-tight text-white">
            {isDragActive ? "Drop them here!" : "Drag & drop your media"}
          </h3>
          <p className="mb-6 text-sm text-zinc-400 max-w-sm">
            High-quality photos and videos are supported. Max {maxFiles} files per gallery.
          </p>

          <div className="rounded-full bg-white px-6 py-2.5 text-sm font-semibold text-black shadow-md">
            Browse Files
          </div>
        </div>
        
        {/* Glow effect behind dropzone */}
        {isDragActive && (
          <div className="absolute inset-0 -z-10 bg-white/5 blur-2xl rounded-full pointer-events-none" />
        )}
      </motion.div>

      <AnimatePresence>
        {error && (
          <motion.div
            initial={{ opacity: 0, y: 10, height: 0 }}
            animate={{ opacity: 1, y: 0, height: "auto" }}
            exit={{ opacity: 0, y: -10, height: 0 }}
            className="mt-4"
          >
            <div className="flex items-center justify-between rounded-2xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-400">
              <span>{error}</span>
              <button 
                onClick={() => setError(null)}
                className="rounded-full p-1 hover:bg-red-500/20 transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
