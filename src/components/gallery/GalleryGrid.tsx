"use client";

import React, { useState, useCallback, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Check, Loader2, Image as ImageIcon, Calendar } from "lucide-react";
import JSZip from "jszip";
import { saveAs } from "file-saver";
import { ActionBar } from "./ActionBar";
import { Lightbox } from "./Lightbox";

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

interface GalleryGridProps {
  items: MediaItem[];
  r2PublicUrl: string;
  galleryTitle: string;
}

interface DateGroup {
  dateLabel: string;
  items: MediaItem[];
}

interface DownloadProgress {
  phase: "idle" | "downloading" | "zipping" | "saving" | "error";
  progress: number;
  currentFile: number;
  totalFiles: number;
}

export function GalleryGrid({ items, r2PublicUrl, galleryTitle }: GalleryGridProps) {
  // --- Selection State ---
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isSelectMode, setIsSelectMode] = useState(false);

  // --- Lightbox State ---
  const [activeLightboxIndex, setActiveLightboxIndex] = useState<number | null>(null);

  // --- Download State ---
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState<DownloadProgress>({
    phase: "idle",
    progress: 0,
    currentFile: 0,
    totalFiles: 0,
  });

  // --- Long Press Logic ---
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isLongPressActive = useRef(false);

  // Helper to format date label
  const getDateLabel = (dateStr: string) => {
    const date = new Date(dateStr);
    const today = new Date();
    const yesterday = new Date();
    yesterday.setDate(today.getDate() - 1);

    if (date.toDateString() === today.toDateString()) {
      return "Today";
    } else if (date.toDateString() === yesterday.toDateString()) {
      return "Yesterday";
    } else {
      return date.toLocaleDateString(undefined, {
        month: "long",
        day: "numeric",
        year: date.getFullYear() !== today.getFullYear() ? "numeric" : undefined,
      });
    }
  };

  // Group items by date, preserving chronological order (newest first)
  const groupedItems = React.useMemo(() => {
    const groups: DateGroup[] = [];
    const dateMap = new Map<string, MediaItem[]>();

    // Sort items newest first
    const sortedItems = [...items].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );

    for (const item of sortedItems) {
      const label = getDateLabel(item.createdAt);
      if (!dateMap.has(label)) {
        dateMap.set(label, []);
      }
      dateMap.get(label)!.push(item);
    }

    dateMap.forEach((groupItems, dateLabel) => {
      groups.push({ dateLabel, items: groupItems });
    });

    return groups;
  }, [items]);

  // --- Multi-Select Handlers ---
  const toggleSelect = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  const handleItemClick = useCallback(
    (item: MediaItem, index: number) => {
      if (isSelectMode) {
        toggleSelect(item.id);
      } else {
        // Find index in global items array
        const globalIndex = items.findIndex((i) => i.id === item.id);
        setActiveLightboxIndex(globalIndex >= 0 ? globalIndex : index);
      }
    },
    [isSelectMode, items, toggleSelect]
  );

  const startLongPress = useCallback(
    (id: string) => {
      isLongPressActive.current = false;
      longPressTimer.current = setTimeout(() => {
        isLongPressActive.current = true;
        setIsSelectMode(true);
        setSelectedIds(new Set([id]));
        // Play subtle vibration if supported
        if (navigator.vibrate) navigator.vibrate(50);
      }, 600); // 600ms long press
    },
    []
  );

  const clearLongPress = useCallback(() => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
    }
  }, []);

  const handleSelectAll = useCallback(() => {
    if (selectedIds.size === items.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(items.map((i) => i.id)));
    }
  }, [items, selectedIds.size]);

  const handleClearSelection = useCallback(() => {
    setSelectedIds(new Set());
    setIsSelectMode(false);
  }, []);

  // --- Client-side ZIP Downloader ---
  const handleDownloadSelected = async () => {
    if (selectedIds.size === 0) return;
    setIsDownloading(true);

    const selectedItems = items.filter((item) => selectedIds.has(item.id));
    const zip = new JSZip();
    const totalFiles = selectedItems.length;

    setDownloadProgress({
      phase: "downloading",
      progress: 0,
      currentFile: 0,
      totalFiles,
    });

    try {
      // Direct R2 fetch inside browser
      // Throttling downloads to max 4 concurrent requests to not overwhelm connection
      const concurrencyLimit = 4;
      const downloadResults: Array<{ blob: Blob; fileName: string }> = [];

      for (let i = 0; i < selectedItems.length; i += concurrencyLimit) {
        const chunk = selectedItems.slice(i, i + concurrencyLimit);
        const promises = chunk.map(async (item, chunkIndex) => {
          const fileIndex = i + chunkIndex;
          const originalUrl = `${r2PublicUrl}/${item.originalKey}`;
          const fileName = item.originalKey.split("/").pop() || `media-${item.id}`;

          // Fetch file binary
          const response = await fetch(originalUrl);
          if (!response.ok) {
            throw new Error(`Failed to download ${fileName} (HTTP ${response.status})`);
          }
          const blob = await response.blob();

          downloadResults.push({ blob, fileName });

          // Update progress
          setDownloadProgress((prev) => {
            const nextCurrent = prev.currentFile + 1;
            // 80% of progress allocated to downloading, 20% to compression
            const progressVal = Math.round((nextCurrent / totalFiles) * 80);
            return {
              ...prev,
              phase: "downloading",
              currentFile: nextCurrent,
              progress: progressVal,
            };
          });
        });

        await Promise.all(promises);
      }

      // Add downloaded blobs to zip structure
      downloadResults.forEach(({ blob, fileName }) => {
        zip.file(fileName, blob);
      });

      // Compress zip
      setDownloadProgress((prev) => ({
        ...prev,
        phase: "zipping",
        progress: 80,
      }));

      const zipBlob = await zip.generateAsync(
        { type: "blob" },
        (metadata: { percent: number }) => {
          // Map zip compression percentage from 80% to 98%
          const compressionProgress = 80 + Math.round(metadata.percent * 0.18);
          setDownloadProgress((prev) => ({
            ...prev,
            progress: compressionProgress,
          }));
        }
      );

      // Trigger client download
      setDownloadProgress((prev) => ({
        ...prev,
        phase: "saving",
        progress: 99,
      }));

      // Sanitize gallery title for filename
      const safeTitle = galleryTitle.replace(/[^a-z0-9]/gi, "_").toLowerCase();
      saveAs(zipBlob, `${safeTitle}_gallery.zip`);

      setDownloadProgress((prev) => ({
        ...prev,
        phase: "idle",
        progress: 100,
      }));

      // Reset selection mode upon successful download completion
      setTimeout(() => {
        setIsDownloading(false);
        handleClearSelection();
      }, 1000);
    } catch (error) {
      console.error("ZIP creation failed:", error);
      setDownloadProgress((prev) => ({
        ...prev,
        phase: "error",
        progress: 0,
      }));
      setIsDownloading(false);
      alert("Failed to download files. Please make sure the R2 CORS configuration is active.");
    }
  };

  return (
    <div className="relative">
      {/* Top action bar: standard selector toggling */}
      <div className="mb-6 flex items-center justify-between">
        <div className="flex items-center gap-2 text-zinc-400 text-xs">
          <Calendar className="h-4 w-4" />
          <span>Timeline View</span>
        </div>
        <button
          onClick={() => {
            if (isSelectMode) {
              handleClearSelection();
            } else {
              setIsSelectMode(true);
            }
          }}
          className={`rounded-full px-4 py-1.5 text-xs font-semibold border transition-all ${
            isSelectMode
              ? "bg-zinc-800 border-zinc-700 text-white hover:bg-zinc-700"
              : "bg-zinc-900/60 border-zinc-800 text-zinc-300 hover:bg-zinc-800 hover:text-white"
          }`}
        >
          {isSelectMode ? "Cancel" : "Select"}
        </button>
      </div>

      {items.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center text-zinc-500">
          <ImageIcon className="h-12 w-12 stroke-[1.5] mb-3 text-zinc-600" />
          <p className="text-sm font-medium">This gallery is empty.</p>
        </div>
      ) : (
        <div className="space-y-8">
          {groupedItems.map((group) => (
            <div key={group.dateLabel} className="space-y-3">
              {/* Sticky Date Header */}
              <h2 className="sticky top-[68px] z-30 bg-zinc-950/90 py-2.5 backdrop-blur-md text-xs font-bold text-zinc-400 uppercase tracking-widest pl-1">
                {group.dateLabel}
              </h2>

              {/* Grid Layout */}
              <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 sm:gap-3">
                {group.items.map((item, index) => {
                  const isSelected = selectedIds.has(item.id);
                  const imageUrl = item.previewKey
                    ? `${r2PublicUrl}/${item.previewKey}`
                    : `${r2PublicUrl}/${item.originalKey}`;

                  return (
                    <motion.div
                      key={item.id}
                      onClick={() => handleItemClick(item, index)}
                      onMouseDown={() => startLongPress(item.id)}
                      onMouseUp={clearLongPress}
                      onMouseLeave={clearLongPress}
                      onTouchStart={() => startLongPress(item.id)}
                      onTouchEnd={clearLongPress}
                      whileHover={{ scale: isSelectMode ? 0.98 : 1.02 }}
                      whileTap={{ scale: 0.96 }}
                      className={`relative aspect-square cursor-pointer overflow-hidden rounded-2xl border bg-zinc-900 transition-all select-none ${
                        isSelected
                          ? "border-blue-500 shadow-lg shadow-blue-500/10 ring-2 ring-blue-500/25"
                          : "border-zinc-900 hover:border-zinc-800"
                      }`}
                    >
                      {/* Checkbox Overlay */}
                      <AnimatePresence>
                        {isSelectMode && (
                          <motion.div
                            initial={{ opacity: 0, scale: 0.8 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.8 }}
                            className="absolute top-2.5 left-2.5 z-20 flex h-6 w-6 items-center justify-center rounded-full border shadow-md transition-colors"
                            style={{
                              backgroundColor: isSelected ? "#3b82f6" : "rgba(24, 24, 27, 0.6)",
                              borderColor: isSelected ? "#3b82f6" : "rgba(255, 255, 255, 0.2)",
                            }}
                          >
                            {isSelected && (
                              <motion.div
                                initial={{ scale: 0 }}
                                animate={{ scale: 1 }}
                                className="text-white"
                              >
                                <Check className="h-3.5 w-3.5 stroke-[3]" />
                              </motion.div>
                            )}
                          </motion.div>
                        )}
                      </AnimatePresence>

                      {/* Video or Image Thumbnail */}
                      {item.fileType.startsWith("video/") ? (
                        <video
                          src={`${r2PublicUrl}/${item.originalKey}`}
                          className={`h-full w-full object-cover transition-all duration-300 pointer-events-none select-none ${
                            isSelected ? "opacity-70 scale-95" : "opacity-90 hover:opacity-100"
                          }`}
                          preload="metadata"
                          muted
                          playsInline
                        />
                      ) : (
                        <img
                          src={imageUrl}
                          alt="Gallery thumbnail"
                          loading="lazy"
                          className={`h-full w-full object-cover transition-all duration-300 pointer-events-none select-none ${
                            isSelected ? "opacity-70 scale-95" : "opacity-90 hover:opacity-100"
                          }`}
                        />
                      )}

                      {/* Video Indicator */}
                      {item.fileType.startsWith("video/") && (
                        <div className="absolute bottom-2 right-2 rounded-md bg-black/60 px-1.5 py-0.5 text-[10px] font-bold text-white backdrop-blur-sm border border-white/5 pointer-events-none">
                          VIDEO
                        </div>
                      )}
                    </motion.div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Sticky Bottom Actions pill */}
      <ActionBar
        selectedCount={selectedIds.size}
        totalCount={items.length}
        onDownload={handleDownloadSelected}
        onSelectAll={handleSelectAll}
        onClearSelection={handleClearSelection}
        isDownloading={isDownloading}
        downloadProgress={downloadProgress}
      />

      {/* Full-Screen Swipeable Lightbox */}
      {activeLightboxIndex !== null && (
        <Lightbox
          items={items}
          activeIndex={activeLightboxIndex}
          onClose={() => setActiveLightboxIndex(null)}
          onNavigate={(idx) => setActiveLightboxIndex(idx)}
          r2PublicUrl={r2PublicUrl}
        />
      )}
    </div>
  );
}
