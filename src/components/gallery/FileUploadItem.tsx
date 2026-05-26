/* eslint-disable */
"use client";

import { useEffect, useState } from "react";
import { useUpload, UploadResult, UploadQuality } from "@/hooks/useUpload";
import { motion } from "framer-motion";
import { CheckCircle2, AlertCircle, Loader2, FileIcon, ImageIcon, VideoIcon, RefreshCcw } from "lucide-react";

interface FileUploadItemProps {
  file: File;
  onComplete: (result: UploadResult & { file: File }) => void;
  onError: (error: string) => void;
  startUpload: boolean;
  quality: UploadQuality;
}

export function FileUploadItem({ file, onComplete, onError, startUpload, quality }: FileUploadItemProps) {
  const { upload, status, progress, error, reset } = useUpload();
  const [hasStarted, setHasStarted] = useState(false);
  
  // Preview URL for local display
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  useEffect(() => {
    // Generate a local preview URL if it's an image
    if (file.type.startsWith("image/")) {
      const url = URL.createObjectURL(file);
      setPreviewUrl(url);
      return () => URL.revokeObjectURL(url);
    }
  }, [file]);

  useEffect(() => {
    if (startUpload && !hasStarted && status === "idle") {
      setHasStarted(true);
      upload(file, { quality })
        .then((result) => onComplete({ ...result, file }))
        .catch((err) => onError(err.message));
    }
  }, [startUpload, hasStarted, status, upload, file, onComplete, onError, quality]);

  const isImage = file.type.startsWith("image/");
  const isVideo = file.type.startsWith("video/");

  return (
    <motion.div 
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex items-center gap-4 rounded-2xl border border-zinc-800 bg-zinc-900/40 p-3"
    >
      <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-xl bg-zinc-800">
        {previewUrl ? (
          <img src={previewUrl} alt={file.name} className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-zinc-500">
            {isImage ? <ImageIcon size={20} /> : isVideo ? <VideoIcon size={20} /> : <FileIcon size={20} />}
          </div>
        )}
      </div>

      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex items-center justify-between mb-1">
          <span className="truncate text-sm font-medium text-zinc-200">
            {file.name}
          </span>
          <span className="text-xs text-zinc-500">
            {(file.size / (1024 * 1024)).toFixed(1)} MB
          </span>
        </div>

        <div className="flex items-center gap-3">
          <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-zinc-800">
            <motion.div
              className="h-full bg-white"
              initial={{ width: 0 }}
              animate={{ width: `${progress}%` }}
              transition={{ ease: "linear", duration: 0.2 }}
            />
          </div>
          <div className="flex w-6 shrink-0 items-center justify-center">
            {status === "success" ? (
              <CheckCircle2 className="h-4 w-4 text-emerald-500" />
            ) : status === "error" ? (
              <AlertCircle className="h-4 w-4 text-red-500" />
            ) : (status === "uploading" || status === "compressing" || status === "requesting_urls") ? (
              <Loader2 className="h-4 w-4 animate-spin text-zinc-400" />
            ) : null}
          </div>
        </div>
        
        {error && (
          <div className="mt-2 flex items-center gap-2">
            <span className="text-xs text-red-400 truncate flex-1">{error}</span>
            <button
              onClick={() => {
                reset();
                setHasStarted(true);
                upload(file, { quality })
                  .then((result) => onComplete({ ...result, file }))
                  .catch((err) => onError(err.message));
              }}
              className="flex items-center gap-1.5 text-xs font-medium text-zinc-300 hover:text-white transition-colors bg-zinc-800 hover:bg-zinc-700 px-3 py-1.5 rounded-lg shrink-0"
            >
              <RefreshCcw className="h-3 w-3" />
              Retry
            </button>
          </div>
        )}
      </div>
    </motion.div>
  );
}

