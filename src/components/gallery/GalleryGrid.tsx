"use client";

import React, { useState, useCallback, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Check, Image as ImageIcon, Calendar, GripVertical, AlertTriangle, Loader2 } from "lucide-react";
import { ActionBar } from "./ActionBar";
import { Lightbox } from "./Lightbox";
import { useAuth } from "@clerk/nextjs";
import { toast } from "sonner";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  rectSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

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
  slug: string;
  ownerId?: string | null;
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

function ImageThumbnail({ src, alt, isSelected }: { src: string; alt: string; isSelected: boolean }) {
  const [loaded, setLoaded] = useState(false);
  return (
    <>
      {!loaded && <div className="absolute inset-0 bg-zinc-800 animate-pulse pointer-events-none" />}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt={alt}
        loading="lazy"
        onLoad={() => setLoaded(true)}
        className={`h-full w-full object-cover pointer-events-none select-none transition-all duration-700 ease-out ${
          !loaded ? "opacity-0 scale-105 blur-md" : isSelected ? "opacity-70 scale-95 blur-0" : "opacity-100 scale-100 blur-0 hover:opacity-100"
        }`}
      />
    </>
  );
}

function VideoThumbnail({ src, isSelected }: { src: string; isSelected: boolean }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  
  const handleMouseEnter = () => {
    if (videoRef.current) {
      videoRef.current.play().catch(() => {});
    }
  };
  
  const handleMouseLeave = () => {
    if (videoRef.current) {
      videoRef.current.pause();
    }
  };

  return (
    <div 
      className="absolute inset-0 h-full w-full"
      onMouseEnter={handleMouseEnter} 
      onMouseLeave={handleMouseLeave}
    >
      <video
        ref={videoRef}
        src={src}
        className={`h-full w-full object-cover transition-all duration-500 pointer-events-none select-none ${
          isSelected ? "opacity-70 scale-95" : "opacity-90 hover:opacity-100"
        }`}
        preload="metadata"
        muted
        playsInline
        loop
      />
      <div className="absolute bottom-2 right-2 rounded-md bg-black/60 px-1.5 py-0.5 text-[10px] font-bold text-white backdrop-blur-sm border border-white/5 pointer-events-none">
        VIDEO
      </div>
    </div>
  );
}

// --- Sortable Wrapper ---
function SortableMediaItem({
  item,
  imageUrl,
  isSelected,
  isSelectMode,
  isReorderMode,
  onClick,
  onLongPressStart,
  onLongPressClear,
  r2PublicUrl,
}: {
  item: MediaItem;
  imageUrl: string;
  isSelected: boolean;
  isSelectMode: boolean;
  isReorderMode: boolean;
  onClick: () => void;
  onLongPressStart: () => void;
  onLongPressClear: () => void;
  r2PublicUrl: string;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: item.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 50 : 1,
    flexGrow: item.width && item.height ? item.width / item.height : 1,
    width: `${(item.width && item.height ? item.width / item.height : 1) * 160}px`
  };

  return (
    <motion.div
      ref={setNodeRef}
      style={style}
      layoutId={item.id}
      initial={{ opacity: 0, y: 20, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      onClick={isReorderMode ? undefined : onClick}
      onMouseDown={isReorderMode ? undefined : onLongPressStart}
      onMouseUp={isReorderMode ? undefined : onLongPressClear}
      onMouseLeave={isReorderMode ? undefined : onLongPressClear}
      onTouchStart={isReorderMode ? undefined : onLongPressStart}
      onTouchEnd={isReorderMode ? undefined : onLongPressClear}
      whileHover={{ scale: isSelectMode || isReorderMode ? 0.98 : 1.02 }}
      whileTap={{ scale: 0.96 }}
      {...(isReorderMode ? { ...attributes, ...listeners } : {})}
      className={`relative cursor-pointer overflow-hidden rounded-xl border bg-slate-surface transition-all select-none h-[120px] sm:h-[160px] md:h-[200px] lg:h-[240px] flex-auto ${
        isSelected
          ? "border-teal-accent shadow-lg shadow-teal-accent/20 ring-2 ring-teal-accent/30"
          : isDragging
          ? "border-teal-accent/80 shadow-2xl scale-105 z-50 ring-4 ring-teal-accent/50"
          : "border-white/5 hover:border-teal-accent/50 hover:shadow-[0_0_20px_rgba(0,229,255,0.15)]"
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
              backgroundColor: isSelected ? "#00E5FF" : "rgba(40, 43, 48, 0.6)",
              borderColor: isSelected ? "#00E5FF" : "rgba(255, 255, 255, 0.2)",
            }}
          >
            {isSelected && (
              <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} className="text-white">
                <Check className="h-3.5 w-3.5 stroke-[3]" />
              </motion.div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Reorder Grip Overlay */}
      <AnimatePresence>
        {isReorderMode && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute top-2 right-2 z-20 bg-black/50 p-1.5 rounded-md backdrop-blur-sm text-white/70 pointer-events-none"
          >
            <GripVertical className="w-5 h-5" />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Video or Image Thumbnail */}
      {item.fileType.startsWith("video/") ? (
        <VideoThumbnail src={`${r2PublicUrl}/${item.originalKey}`} isSelected={isSelected} />
      ) : (
        <ImageThumbnail src={imageUrl} alt="Gallery thumbnail" isSelected={isSelected} />
      )}
    </motion.div>
  );
}

export function GalleryGrid({ items: initialItems, r2PublicUrl, galleryTitle, slug, ownerId }: GalleryGridProps) {
  // Sort state
  const [items, setItems] = useState<MediaItem[]>(initialItems);
  const [isReorderMode, setIsReorderMode] = useState(false);
  const [isSavingOrder, setIsSavingOrder] = useState(false);

  // Sync state if initialItems change (e.g. after upload)
  useEffect(() => {
    // Determine if custom order exists
    const hasCustomOrder = initialItems.some(i => i.sortOrder > 0);
    if (hasCustomOrder) {
      setItems([...initialItems].sort((a, b) => a.sortOrder - b.sortOrder));
    } else {
      setItems([...initialItems].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()));
    }
  }, [initialItems]);

  // Track gallery view
  useEffect(() => {
    fetch(`/api/galleries/${slug}/analytics`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: "view" }),
    }).catch(console.error);
  }, [slug]);

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

  const [isDeleting, setIsDeleting] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);

  // --- Auth State ---
  const { userId, isLoaded } = useAuth();
  const [isAuthorized, setIsAuthorized] = useState(false);

  useEffect(() => {
    if (!isLoaded) return;
    let authorized = false;
    if (ownerId && userId === ownerId) {
      authorized = true;
    }
    if (typeof window !== "undefined") {
      const token = localStorage.getItem(`admin_token_${slug}`);
      if (token) authorized = true;
    }
    setIsAuthorized(authorized);
  }, [userId, isLoaded, ownerId, slug]);

  // --- Long Press Logic ---
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isLongPressActive = useRef(false);

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

  const groupedItems = React.useMemo(() => {
    if (isReorderMode) return []; // Don't group in reorder mode
    
    const groups: DateGroup[] = [];
    const dateMap = new Map<string, MediaItem[]>();

    for (const item of items) {
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
  }, [items, isReorderMode]);

  // --- DND Handlers ---
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      setItems((items) => {
        const oldIndex = items.findIndex((i) => i.id === active.id);
        const newIndex = items.findIndex((i) => i.id === over.id);
        return arrayMove(items, oldIndex, newIndex);
      });
    }
  };

  const handleSaveOrder = async () => {
    setIsSavingOrder(true);
    try {
      const adminToken = localStorage.getItem(`admin_token_${slug}`);
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (adminToken) headers["x-admin-token"] = adminToken;

      const res = await fetch(`/api/galleries/${slug}/reorder`, {
        method: "PUT",
        headers,
        body: JSON.stringify({ itemIds: items.map(i => i.id) }),
      });

      if (!res.ok) throw new Error("Failed to save order");

      toast.success("Gallery order saved successfully!");
      setIsReorderMode(false);
    } catch (error) {
      console.error(error);
      toast.error("Failed to save the new order.");
    } finally {
      setIsSavingOrder(false);
    }
  };

  const handleCancelReorder = () => {
    // Revert to initial order
    const hasCustomOrder = initialItems.some(i => i.sortOrder > 0);
    if (hasCustomOrder) {
      setItems([...initialItems].sort((a, b) => a.sortOrder - b.sortOrder));
    } else {
      setItems([...initialItems].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()));
    }
    setIsReorderMode(false);
  };

  // --- Multi-Select Handlers ---
  const toggleSelect = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const handleItemClick = useCallback(
    (item: MediaItem, index: number) => {
      if (isSelectMode) {
        toggleSelect(item.id);
      } else {
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
        if (navigator.vibrate) navigator.vibrate(50);
      }, 600);
    },
    []
  );

  const clearLongPress = useCallback(() => {
    if (longPressTimer.current) clearTimeout(longPressTimer.current);
  }, []);

  const handleSelectAll = useCallback(() => {
    if (selectedIds.size === items.length) setSelectedIds(new Set());
    else setSelectedIds(new Set(items.map((i) => i.id)));
  }, [items, selectedIds.size]);

  const handleClearSelection = useCallback(() => {
    setSelectedIds(new Set());
    setIsSelectMode(false);
  }, []);

  // --- Downloader ---
  const handleDownloadSelected = async () => {
    if (selectedIds.size === 0 || isDownloading) return;
    setIsDownloading(true);

    const selectedItems = items.filter((item) => selectedIds.has(item.id));

    setDownloadProgress({
      phase: "downloading",
      progress: 0,
      currentFile: 0,
      totalFiles: selectedItems.length,
    });

    if ("showDirectoryPicker" in window) {
      try {
        const dirHandle = await (window as any).showDirectoryPicker({ mode: "readwrite", startIn: "downloads" });
        for (let i = 0; i < selectedItems.length; i++) {
          const item = selectedItems[i];
          try {
            const url = `${r2PublicUrl}/${item.originalKey}`;
            const response = await fetch(url);
            if (!response.ok) throw new Error(`Failed to fetch ${item.originalKey}`);
            const filename = item.originalKey.split("/").pop() || `file_${i + 1}`;
            const fileHandle = await dirHandle.getFileHandle(filename, { create: true });
            const writable = await fileHandle.createWritable();
            await response.body!.pipeTo(writable);
          } catch (err) {
            console.error("Failed to save", selectedItems[i].originalKey, err);
          }
          setDownloadProgress({
            phase: "downloading",
            progress: Math.round(((i + 1) / selectedItems.length) * 100),
            currentFile: i + 1,
            totalFiles: selectedItems.length,
          });
        }
      } catch (err) {
        console.info("Directory picker cancelled", err);
        setDownloadProgress({ phase: "idle", progress: 0, currentFile: 0, totalFiles: 0 });
        setIsDownloading(false);
        return;
      }
    } else {
      for (let i = 0; i < selectedItems.length; i++) {
        const item = selectedItems[i];
        try {
          const url = `${r2PublicUrl}/${item.originalKey}`;
          const response = await fetch(url);
          if (!response.ok) throw new Error(`Failed to fetch ${item.originalKey}`);
          const blob = await response.blob();
          const blobUrl = URL.createObjectURL(blob);
          const filename = item.originalKey.split("/").pop() || "file";
          const a = document.createElement("a");
          a.href = blobUrl;
          a.download = filename;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          setTimeout(() => URL.revokeObjectURL(blobUrl), 1000);
        } catch (err) {
          console.error("Download failed for", item.originalKey, err);
        }
        setDownloadProgress({
          phase: "downloading",
          progress: Math.round(((i + 1) / selectedItems.length) * 100),
          currentFile: i + 1,
          totalFiles: selectedItems.length,
        });
        if (i < selectedItems.length - 1) await new Promise((resolve) => setTimeout(resolve, 400));
      }
    }

    setDownloadProgress({ phase: "idle", progress: 100, currentFile: 0, totalFiles: 0 });
    setIsDownloading(false);
    handleClearSelection();
    toast.success(`Downloaded ${selectedItems.length} items successfully!`);

    // Track download
    fetch(`/api/galleries/${slug}/analytics`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: "download" }),
    }).catch(console.error);
  };

  // --- Delete Handler ---
  const executeDelete = async () => {
    setIsDeleting(true);
    try {
      const adminToken = localStorage.getItem(`admin_token_${slug}`);
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (adminToken) headers["x-admin-token"] = adminToken;

      const res = await fetch(`/api/galleries/${slug}`, {
        method: "DELETE",
        headers,
        body: JSON.stringify({ itemIds: Array.from(selectedIds) }),
      });

      if (!res.ok) throw new Error("Failed to delete items");

      setItems(items.filter(item => !selectedIds.has(item.id)));
      toast.success(`${selectedIds.size} item(s) deleted permanently.`);
      handleClearSelection();
    } catch (err) {
      console.error("Delete failed", err);
      toast.error("Failed to delete items.");
    } finally {
      setIsDeleting(false);
      setShowDeleteModal(false);
    }
  };

  return (
    <div className="relative">
      {/* Delete Confirmation Modal */}
      <AnimatePresence>
        {showDeleteModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-slate-bg border border-zinc-800 rounded-2xl w-full max-w-sm overflow-hidden flex flex-col p-6 shadow-2xl"
            >
              <div className="flex items-center gap-3 text-red-500 mb-4">
                <div className="p-2 bg-red-500/10 rounded-full">
                  <AlertTriangle className="w-6 h-6" />
                </div>
                <h2 className="text-xl font-bold text-white">Delete Items?</h2>
              </div>
              <p className="text-zinc-400 text-sm mb-6">
                Are you sure you want to permanently delete {selectedIds.size} selected item(s)? This action cannot be undone.
              </p>
              <div className="flex justify-end gap-3">
                <button
                  onClick={() => setShowDeleteModal(false)}
                  disabled={isDeleting}
                  className="px-4 py-2 rounded-lg font-semibold text-sm text-zinc-300 hover:text-white hover:bg-zinc-800 transition-colors disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  onClick={executeDelete}
                  disabled={isDeleting}
                  className="px-4 py-2 rounded-lg font-semibold text-sm bg-red-500 text-white hover:bg-red-600 transition-colors flex items-center gap-2 disabled:opacity-50"
                >
                  {isDeleting && <Loader2 className="w-4 h-4 animate-spin" />}
                  Yes, Delete
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Top action bar: standard selector toggling & Reorder Mode */}
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-2 text-zinc-400 text-xs font-semibold uppercase tracking-wider">
          <Calendar className="h-4 w-4" />
          <span>{isReorderMode ? "Custom Sort Order" : "Timeline View"}</span>
        </div>
        <div className="flex items-center gap-3">
          {isAuthorized && !isSelectMode && (
            <button
              onClick={() => {
                if (isReorderMode) handleCancelReorder();
                else setIsReorderMode(true);
              }}
              className={`rounded-full px-4 py-1.5 text-xs font-semibold border transition-all ${
                isReorderMode
                  ? "bg-zinc-800 border-zinc-700 text-white hover:bg-zinc-700"
                  : "bg-zinc-900/60 border-zinc-800 text-zinc-300 hover:bg-zinc-800 hover:text-white"
              }`}
            >
              {isReorderMode ? "Cancel Reorder" : "Reorder"}
            </button>
          )}

          {!isReorderMode && (
            <button
              onClick={() => {
                if (isSelectMode) handleClearSelection();
                else setIsSelectMode(true);
              }}
              className={`rounded-full px-4 py-1.5 text-xs font-semibold border transition-all ${
                isSelectMode
                  ? "bg-zinc-800 border-zinc-700 text-white hover:bg-zinc-700"
                  : "bg-zinc-900/60 border-zinc-800 text-zinc-300 hover:bg-zinc-800 hover:text-white"
              }`}
            >
              {isSelectMode ? "Cancel Select" : "Select"}
            </button>
          )}

          {isReorderMode && (
            <button
              onClick={handleSaveOrder}
              disabled={isSavingOrder}
              className="rounded-full px-4 py-1.5 text-xs font-bold border transition-all bg-teal-accent text-black hover:bg-teal-accent/90 border-teal-accent/20 flex items-center gap-2"
            >
              {isSavingOrder && <Loader2 className="w-3 h-3 animate-spin" />}
              Save Order
            </button>
          )}
        </div>
      </div>

      {items.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center text-zinc-500">
          <ImageIcon className="h-12 w-12 stroke-[1.5] mb-3 text-zinc-600" />
          <p className="text-sm font-medium">This gallery is empty.</p>
        </div>
      ) : (
        <div className="space-y-8">
          {isReorderMode ? (
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
              <SortableContext items={items.map((i) => i.id)} strategy={rectSortingStrategy}>
                <div className="flex flex-wrap gap-2 sm:gap-3 after:content-[''] after:grow-[1000000000]">
                  {items.map((item, index) => {
                    const imageUrl = item.previewKey ? `${r2PublicUrl}/${item.previewKey}` : `${r2PublicUrl}/${item.originalKey}`;
                    return (
                      <SortableMediaItem
                        key={item.id}
                        item={item}
                        imageUrl={imageUrl}
                        isSelected={selectedIds.has(item.id)}
                        isSelectMode={isSelectMode}
                        isReorderMode={isReorderMode}
                        onClick={() => handleItemClick(item, index)}
                        onLongPressStart={() => startLongPress(item.id)}
                        onLongPressClear={clearLongPress}
                        r2PublicUrl={r2PublicUrl}
                      />
                    );
                  })}
                </div>
              </SortableContext>
            </DndContext>
          ) : (
            groupedItems.map((group) => (
              <div key={group.dateLabel} className="space-y-3">
                <h2 className="sticky top-[68px] z-30 bg-slate-bg/90 py-2.5 backdrop-blur-md text-xs font-bold text-teal-accent uppercase tracking-widest pl-1">
                  {group.dateLabel}
                </h2>
                <div className="flex flex-wrap gap-2 sm:gap-3 after:content-[''] after:grow-[1000000000]">
                  {group.items.map((item, index) => {
                    const isSelected = selectedIds.has(item.id);
                    const imageUrl = item.previewKey ? `${r2PublicUrl}/${item.previewKey}` : `${r2PublicUrl}/${item.originalKey}`;
                    const ratio = item.width && item.height ? item.width / item.height : 1;

                    return (
                      <motion.div
                        key={item.id}
                        layoutId={item.id}
                        initial={{ opacity: 0, y: 20, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        onClick={() => handleItemClick(item, index)}
                        onMouseDown={() => startLongPress(item.id)}
                        onMouseUp={clearLongPress}
                        onMouseLeave={clearLongPress}
                        onTouchStart={() => startLongPress(item.id)}
                        onTouchEnd={clearLongPress}
                        whileHover={{ scale: isSelectMode ? 0.98 : 1.02 }}
                        whileTap={{ scale: 0.96 }}
                        className={`relative cursor-pointer overflow-hidden rounded-xl border bg-slate-surface transition-all select-none h-[120px] sm:h-[160px] md:h-[200px] lg:h-[240px] flex-auto ${
                          isSelected
                            ? "border-teal-accent shadow-lg shadow-teal-accent/20 ring-2 ring-teal-accent/30"
                            : "border-white/5 hover:border-teal-accent/50 hover:shadow-[0_0_20px_rgba(0,229,255,0.15)]"
                        }`}
                        style={{ flexGrow: ratio, width: `${ratio * 160}px` }}
                      >
                        <AnimatePresence>
                          {isSelectMode && (
                            <motion.div
                              initial={{ opacity: 0, scale: 0.8 }}
                              animate={{ opacity: 1, scale: 1 }}
                              exit={{ opacity: 0, scale: 0.8 }}
                              className="absolute top-2.5 left-2.5 z-20 flex h-6 w-6 items-center justify-center rounded-full border shadow-md transition-colors"
                              style={{
                                backgroundColor: isSelected ? "#00E5FF" : "rgba(40, 43, 48, 0.6)",
                                borderColor: isSelected ? "#00E5FF" : "rgba(255, 255, 255, 0.2)",
                              }}
                            >
                              {isSelected && (
                                <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} className="text-white">
                                  <Check className="h-3.5 w-3.5 stroke-[3]" />
                                </motion.div>
                              )}
                            </motion.div>
                          )}
                        </AnimatePresence>
                        {item.fileType.startsWith("video/") ? (
                          <VideoThumbnail src={`${r2PublicUrl}/${item.originalKey}`} isSelected={isSelected} />
                        ) : (
                          <ImageThumbnail src={imageUrl} alt="Gallery thumbnail" isSelected={isSelected} />
                        )}
                      </motion.div>
                    );
                  })}
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* Sticky Bottom Actions pill */}
      <ActionBar
        isSelectMode={isSelectMode}
        selectedCount={selectedIds.size}
        totalCount={items.length}
        onDownload={handleDownloadSelected}
        onSelectAll={handleSelectAll}
        onClearSelection={handleClearSelection}
        isDownloading={isDownloading}
        downloadProgress={downloadProgress}
        isAuthorized={isAuthorized}
        onDelete={() => setShowDeleteModal(true)}
        isDeleting={isDeleting}
      />

      {/* Full-Screen Swipeable Lightbox */}
      {activeLightboxIndex !== null && (
        <Lightbox
          items={items}
          activeIndex={activeLightboxIndex}
          onClose={() => setActiveLightboxIndex(null)}
          onNavigate={(idx) => setActiveLightboxIndex(idx)}
          r2PublicUrl={r2PublicUrl}
          slug={slug}
        />
      )}
    </div>
  );
}
