"use client";

import { useEffect, useState, useRef } from "react";
import { useUpload, UploadResult, UploadQuality, HIGH_QUALITY_OPTIONS, STANDARD_QUALITY_OPTIONS } from "@/hooks/useUpload";
import imageCompression from "browser-image-compression";
import { motion, Reorder } from "framer-motion";
import { CheckCircle2, AlertCircle, Loader2, FileIcon, ImageIcon, VideoIcon, RefreshCcw, X, GripVertical } from "lucide-react";
import { UploadQueueItem } from "./UploadManager";

interface FileUploadItemProps {
  item: UploadQueueItem;
  onComplete: (id: string, result: UploadResult) => void;
  onError: (id: string, error: string) => void;
  onRemove: (id: string) => void;
  startUpload: boolean;
  isUploadingBatch: boolean;
  quality: UploadQuality;
}

export function FileUploadItem({ item, onComplete, onError, onRemove, startUpload, isUploadingBatch, quality }: FileUploadItemProps) {
  const file = item.file;
  const { upload, status, progress, error, reset, abort, compressedSize } = useUpload();
  const [hasStarted, setHasStarted] = useState(false);
  
  // Preview URL for local display
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  const [precompressedBlob, setPrecompressedBlob] = useState<Blob | null>(null);
  const [isPrecompressing, setIsPrecompressing] = useState(false);

  useEffect(() => {
    if (!file.type.startsWith("image/")) return;
    if (quality === "original") {
      setPrecompressedBlob(null);
      return;
    }
    
    let isActive = true;
    const compute = async () => {
      setIsPrecompressing(true);
      try {
        const options = quality === "high" ? HIGH_QUALITY_OPTIONS : STANDARD_QUALITY_OPTIONS;
        const blob = await imageCompression(file, options);
        if (isActive) {
          setPrecompressedBlob(blob);
        }
      } catch (e) {
        // Ignore pre-compression errors
      } finally {
        if (isActive) setIsPrecompressing(false);
      }
    };
    compute();
    
    return () => { isActive = false; };
  }, [file, quality]);

  useEffect(() => {
    // Generate a local preview URL if it's an image
    if (file.type.startsWith("image/")) {
      const url = URL.createObjectURL(file);
      setTimeout(() => setPreviewUrl(url), 0);
      return () => URL.revokeObjectURL(url);
    }
    
    // Generate video thumbnail
    if (file.type.startsWith("video/")) {
      const url = URL.createObjectURL(file);
      const video = document.createElement("video");
      video.src = url;
      video.muted = true;
      video.playsInline = true;
      video.currentTime = 0.1; // Seek to first frame
      
      const onSeeked = () => {
        const canvas = document.createElement("canvas");
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        const ctx = canvas.getContext("2d");
        if (ctx) {
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
          const dataUrl = canvas.toDataURL("image/jpeg", 0.7);
          setTimeout(() => setPreviewUrl(dataUrl), 0);
        }
        URL.revokeObjectURL(url);
      };
      
      video.addEventListener("seeked", onSeeked);
      video.addEventListener("loadedmetadata", () => {
        if (video.duration >= 0.1) {
          video.currentTime = 0.1;
        }
      });
      video.load();

      return () => {
        video.removeEventListener("seeked", onSeeked);
        URL.revokeObjectURL(url);
      };
    }
  }, [file]);

  useEffect(() => {
    if (startUpload && !hasStarted && status === "idle") {
      setTimeout(() => setHasStarted(true), 0);
      upload(file, { quality, precompressedBlob: precompressedBlob || undefined })
        .then((result) => onComplete(item.id, result))
        .catch((err) => onError(item.id, err.message));
    }
  }, [startUpload, hasStarted, status, upload, file, onComplete, onError, quality, item.id, precompressedBlob]);

  const statusRef = useRef(status);
  useEffect(() => {
    statusRef.current = status;
  }, [status]);

  const isImage = file.type.startsWith("image/");
  const isVideo = file.type.startsWith("video/");

  const isWorking = status === "uploading" || status === "compressing" || status === "requesting_urls";

  return (
    <Reorder.Item 
      value={item}
      id={item.id}
      variants={{
        hidden: { opacity: 0, y: 10 },
        visible: { opacity: 1, y: 0 }
      }}
      initial="hidden"
      animate="visible"
      exit={{ opacity: 0, scale: 0.95 }}
      className="flex items-center gap-3 rounded-2xl border border-zinc-800 bg-zinc-900/40 p-3 relative group"
    >
      <div className="text-zinc-600 hover:text-zinc-400 cursor-grab active:cursor-grabbing px-1 touch-none">
        <GripVertical size={16} />
      </div>

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
        <div className="flex items-center justify-between mb-1 gap-2">
          <span className="truncate text-sm font-medium text-zinc-200">
            {file.name}
          </span>
          <span className="text-xs text-zinc-500 shrink-0">
            {isPrecompressing && !compressedSize && status === "idle" ? (
              <span className="flex items-center gap-1"><Loader2 className="w-3 h-3 animate-spin" /> calculating...</span>
            ) : (() => {
              const bytes = compressedSize || precompressedBlob?.size || file.size;
              if (bytes === 0) return '0 B';
              const k = 1024;
              const sizes = ['B', 'KB', 'MB', 'GB'];
              const i = Math.floor(Math.log(bytes) / Math.log(k));
              return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
            })()}
          </span>
        </div>

        <div className="flex items-center gap-3">
          <div className="h-1.5 flex-1 rounded-full bg-zinc-800/50">
            <motion.div
              className="h-full rounded-full bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 shadow-[0_0_10px_rgba(168,85,247,0.5)]"
              initial={{ width: 0 }}
              animate={{ width: `${progress}%` }}
              transition={{ ease: "linear", duration: 0.2 }}
            />
          </div>
          <div className="flex w-6 shrink-0 items-center justify-center">
            {status === "success" ? (
              <CheckCircle2 className="h-4 w-4 text-emerald-500" />
            ) : status === "error" || status === "aborted" ? (
              <AlertCircle className="h-4 w-4 text-red-500" />
            ) : isWorking ? (
              <Loader2 className="h-4 w-4 animate-spin text-zinc-400" />
            ) : null}
          </div>
        </div>
        
        {(error || status === "aborted") && (
          <div className="mt-2 flex items-center gap-2">
            <span className="text-xs text-red-400 truncate flex-1">{error}</span>
            <button
              onClick={() => {
                reset();
                setHasStarted(true);
                upload(file, { quality, precompressedBlob: precompressedBlob || undefined })
                  .then((result) => onComplete(item.id, result))
                  .catch((err) => onError(item.id, err.message));
              }}
              className="flex items-center gap-1.5 text-xs font-medium text-zinc-300 hover:text-white transition-colors bg-zinc-800 hover:bg-zinc-700 px-3 py-1.5 rounded-lg shrink-0"
            >
              <RefreshCcw className="h-3 w-3" />
              Retry
            </button>
          </div>
        )}
      </div>

      {(!isUploadingBatch || isWorking || status === "idle" || status === "error" || status === "aborted") && (
        <button
          onClick={() => {
            if (isWorking) abort();
            onRemove(item.id);
          }}
          className="absolute -top-2 -right-2 bg-zinc-800 text-zinc-400 hover:text-white hover:bg-zinc-700 rounded-full p-1 shadow-lg opacity-0 group-hover:opacity-100 transition-opacity focus:opacity-100"
          title="Remove file"
        >
          <X size={14} />
        </button>
      )}
    </Reorder.Item>
  );
}
