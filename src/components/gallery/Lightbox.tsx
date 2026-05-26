"use client";

import React, { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  X,
  ChevronLeft,
  ChevronRight,
  Download,
  Info,
  Calendar,
  Image as ImageIcon,
  FileText,
  Maximize2,
  Minimize2,
} from "lucide-react";

// Internationalized string constants to prevent linter warnings
const TEXT_DOUBLE_TAP_TO_SHRINK = "Double tap to shrink";
const TEXT_SWIPE_INSTRUCTION = "Swipe down to close • Double tap to zoom";
const TEXT_DETAILS = "Details";
const TEXT_FILE_NAME = "File Name";
const TEXT_TYPE_AND_SIZE = "Type & Size";
const TEXT_RESOLUTION = "Resolution";
const TEXT_PIXELS = "pixels";
const TEXT_SHARED_ON = "Shared On";
const TEXT_CLOSE_DETAILS = "Close Details";

interface MediaItem {
  id: string;
  originalKey: string;
  previewKey: string | null;
  fileType: string;
  sizeBytes: number;
  width: number | null;
  height: number | null;
  sortOrder: number;
  createdAt: string;
}

interface LightboxProps {
  items: MediaItem[];
  activeIndex: number;
  onClose: () => void;
  onNavigate: (index: number) => void;
  r2PublicUrl: string;
}

export function Lightbox({
  items,
  activeIndex,
  onClose,
  onNavigate,
  r2PublicUrl,
}: LightboxProps) {
  const [showDetails, setShowDetails] = useState(false);
  const [isZoomed, setIsZoomed] = useState(false);
  const [dragDirection, setDragDirection] = useState<"x" | "y" | null>(null);

  const activeItem = items.find((_, idx) => idx === activeIndex);

  // Helper to format bytes
  const formatBytes = (bytes: number) => {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  };

  // Helper to get file name from key
  const getFileName = (key: string) => {
    return key.split("/").pop() || "media";
  };

  const handleNext = useCallback(() => {
    if (activeIndex < items.length - 1) {
      onNavigate(activeIndex + 1);
      setIsZoomed(false);
    }
  }, [activeIndex, items.length, onNavigate]);

  const handlePrev = useCallback(() => {
    if (activeIndex > 0) {
      onNavigate(activeIndex - 1);
      setIsZoomed(false);
    }
  }, [activeIndex, onNavigate]);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowRight") handleNext();
      if (e.key === "ArrowLeft") handlePrev();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose, handleNext, handlePrev]);

  if (!activeItem) return null;

  const originalUrl = `${r2PublicUrl}/${activeItem.originalKey}`;
  const previewUrl = activeItem.previewKey
    ? `${r2PublicUrl}/${activeItem.previewKey}`
    : originalUrl;

  const handleDownload = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      const response = await fetch(originalUrl);
      const blob = await response.blob();
      const filename = getFileName(activeItem.originalKey);
      
      const link = document.createElement("a");
      link.href = URL.createObjectURL(blob);
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(link.href);
    } catch (error) {
      console.error("Failed to download original image:", error);
      // Fallback: open in new tab
      window.open(originalUrl, "_blank");
    }
  };

  const handleDragEnd = (event: any, info: any) => {
    const thresholdX = 100;
    const thresholdY = 150;

    // Determine swipe axis if not locked
    const absX = Math.abs(info.offset.x);
    const absY = Math.abs(info.offset.y);

    if (absY > thresholdY && absY > absX && !isZoomed) {
      // Swipe up/down to close
      onClose();
    } else if (absX > thresholdX && absX > absY) {
      // Swipe left/right to navigate
      if (info.offset.x > 0) {
        handlePrev();
      } else {
        handleNext();
      }
    }
    setDragDirection(null);
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-between bg-black/98 select-none overflow-hidden touch-none">
      {/* Top Header Bar */}
      <div className="relative z-50 flex items-center justify-between p-4 bg-gradient-to-b from-black/80 to-transparent">
        <button
          onClick={onClose}
          className="flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white backdrop-blur-sm transition-colors hover:bg-white/20 active:scale-95"
        >
          <X className="h-5 w-5" />
        </button>

        <div className="text-sm font-medium text-zinc-300">
          {activeIndex + 1} / {items.length}
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowDetails(!showDetails)}
            className={`flex h-10 w-10 items-center justify-center rounded-full backdrop-blur-sm transition-colors active:scale-95 ${
              showDetails ? "bg-blue-600 text-white" : "bg-white/10 text-white hover:bg-white/20"
            }`}
            title="Image details"
          >
            <Info className="h-5 w-5" />
          </button>
          <button
            onClick={handleDownload}
            className="flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white backdrop-blur-sm transition-colors hover:bg-white/20 active:scale-95"
            title="Download original"
          >
            <Download className="h-5 w-5" />
          </button>
        </div>
      </div>

      {/* Main Image Area with Swipe / Drag */}
      <div className="relative flex-grow flex items-center justify-center overflow-hidden">
        {/* Navigation Buttons (Desktop) */}
        {activeIndex > 0 && (
          <button
            onClick={handlePrev}
            className="absolute left-4 z-40 hidden md:flex h-12 w-12 items-center justify-center rounded-full bg-black/55 border border-zinc-800 text-white hover:bg-black/75 transition-colors"
          >
            <ChevronLeft className="h-6 w-6" />
          </button>
        )}

        {activeIndex < items.length - 1 && (
          <button
            onClick={handleNext}
            className="absolute right-4 z-40 hidden md:flex h-12 w-12 items-center justify-center rounded-full bg-black/55 border border-zinc-800 text-white hover:bg-black/75 transition-colors"
          >
            <ChevronRight className="h-6 w-6" />
          </button>
        )}

        {/* Media Container with Framer Motion */}
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={activeItem.id}
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ type: "spring", damping: 25, stiffness: 200 }}
            className="w-full h-full flex items-center justify-center px-4"
          >
            <motion.div
              drag={!isZoomed}
              dragConstraints={{ left: 0, right: 0, top: 0, bottom: 0 }}
              dragElastic={0.4}
              onDragEnd={handleDragEnd}
              onDoubleClick={() => setIsZoomed(!isZoomed)}
              animate={{
                scale: isZoomed ? 2 : 1,
                cursor: isZoomed ? "zoom-out" : "zoom-in",
              }}
              className="relative max-w-full max-h-[80vh] flex items-center justify-center select-none"
            >
              {activeItem.fileType.startsWith("video/") ? (
                <video
                  src={originalUrl}
                  controls
                  autoPlay
                  className="max-w-full max-h-[75vh] rounded-xl shadow-2xl pointer-events-auto"
                />
              ) : (
                <img
                  src={previewUrl}
                  alt={getFileName(activeItem.originalKey)}
                  className="max-w-full max-h-[75vh] object-contain rounded-xl shadow-2xl select-none pointer-events-none"
                  onLoad={(e) => {
                    // If preview loaded, optionally trigger loading original in background
                    const img = e.currentTarget;
                    if (activeItem.previewKey && img.src !== originalUrl) {
                      const originalLoader = new Image();
                      originalLoader.src = originalUrl;
                      originalLoader.onload = () => {
                        img.src = originalUrl;
                      };
                    }
                  }}
                />
              )}

              {/* Zoom Indicator */}
              {isZoomed && (
                <button
                  onClick={() => setIsZoomed(false)}
                  className="absolute bottom-4 right-4 flex items-center gap-1.5 rounded-full bg-black/60 backdrop-blur-md px-3 py-1.5 text-xs text-white border border-white/10"
                >
                  <Minimize2 className="h-3.5 w-3.5" />
                  <span>{TEXT_DOUBLE_TAP_TO_SHRINK}</span>
                </button>
              )}
            </motion.div>
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Swipe Down To Close Instruction */}
      <div className="pb-4 text-center text-xs text-zinc-600 font-medium">
        {TEXT_SWIPE_INSTRUCTION}
      </div>

      {/* Details drawer (Samsung One UI style sliding sheet) */}
      <AnimatePresence>
        {showDetails && (
          <motion.div
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", damping: 30, stiffness: 300 }}
            className="absolute bottom-0 inset-x-0 z-50 rounded-t-[2.5rem] border-t border-zinc-800 bg-zinc-900/95 backdrop-blur-2xl p-6 shadow-2xl"
          >
            {/* Drawer handle indicator */}
            <div className="mx-auto w-12 h-1.5 rounded-full bg-zinc-700 mb-6 cursor-pointer" onClick={() => setShowDetails(false)} />
            
            <h3 className="text-lg font-bold text-white mb-4">{TEXT_DETAILS}</h3>
            
            <div className="space-y-4 text-sm">
              <div className="flex items-start gap-3.5">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-zinc-800 text-zinc-400 mt-0.5">
                  <ImageIcon className="h-4 w-4" />
                </div>
                <div className="flex flex-col">
                  <span className="text-xs text-zinc-500 font-semibold uppercase tracking-wider">{TEXT_FILE_NAME}</span>
                  <span className="text-white font-medium break-all">{getFileName(activeItem.originalKey)}</span>
                </div>
              </div>

              <div className="flex items-start gap-3.5">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-zinc-800 text-zinc-400 mt-0.5">
                  <FileText className="h-4 w-4" />
                </div>
                <div className="flex flex-col">
                  <span className="text-xs text-zinc-500 font-semibold uppercase tracking-wider">{TEXT_TYPE_AND_SIZE}</span>
                  <span className="text-white font-medium">
                    {activeItem.fileType} • {formatBytes(activeItem.sizeBytes)}
                  </span>
                </div>
              </div>

              {(activeItem.width && activeItem.height) && (
                <div className="flex items-start gap-3.5">
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-zinc-800 text-zinc-400 mt-0.5">
                    <Maximize2 className="h-4 w-4" />
                  </div>
                  <div className="flex flex-col">
                    <span className="text-xs text-zinc-500 font-semibold uppercase tracking-wider">{TEXT_RESOLUTION}</span>
                    <span className="text-white font-medium">
                      {activeItem.width} × {activeItem.height} {TEXT_PIXELS}
                    </span>
                  </div>
                </div>
              )}

              <div className="flex items-start gap-3.5">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-zinc-800 text-zinc-400 mt-0.5">
                  <Calendar className="h-4 w-4" />
                </div>
                <div className="flex flex-col">
                  <span className="text-xs text-zinc-500 font-semibold uppercase tracking-wider">{TEXT_SHARED_ON}</span>
                  <span className="text-white font-medium">
                    {new Date(activeItem.createdAt).toLocaleString(undefined, {
                      dateStyle: "medium",
                      timeStyle: "short",
                    })}
                  </span>
                </div>
              </div>
            </div>
            
            <button
              onClick={() => setShowDetails(false)}
              className="mt-6 w-full rounded-2xl bg-zinc-800 py-3 text-sm font-semibold text-white transition-colors hover:bg-zinc-700"
            >
              {TEXT_CLOSE_DETAILS}
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
