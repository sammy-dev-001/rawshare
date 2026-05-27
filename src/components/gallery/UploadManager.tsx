"use client";

import { useEffect, useState, useCallback } from "react";
import { FileUploadItem } from "@/components/gallery/FileUploadItem";
import { UploadResult, UploadQuality } from "@/hooks/useUpload";
import { useRouter } from "next/navigation";
import { motion, Reorder } from "framer-motion";
import { ArrowRight, Loader2, RefreshCcw } from "lucide-react";

export interface UploadQueueItem {
  id: string;
  file: File;
}

interface UploadManagerProps {
  initialFiles: File[];
  onClear: () => void;
}

const QUALITY_OPTIONS: { id: UploadQuality; label: string; desc: string }[] = [
  { id: "standard", label: "Standard", desc: "Fast upload, smaller sizes (~1.5MB max)" },
  { id: "high", label: "High", desc: "Great balance of quality and size (~3MB max)" },
  { id: "original", label: "Original", desc: "Raw untouched files" },
];

export function UploadManager({ initialFiles, onClear }: UploadManagerProps) {
  const router = useRouter();
  
  // Wrap files with unique IDs for Reorder to work correctly
  const [items, setItems] = useState<UploadQueueItem[]>(() => 
    initialFiles.map(file => ({ id: Math.random().toString(36).slice(2, 9), file }))
  );
  
  const [title, setTitle] = useState("");
  const [isUploading, setIsUploading] = useState(false);
  const [isCreatingGallery, setIsCreatingGallery] = useState(false);
  const [globalError, setGlobalError] = useState<string | null>(null);
  const [quality, setQuality] = useState<UploadQuality>("high");

  // State to track completed uploads map (id -> result)
  const [completedResults, setCompletedResults] = useState<Record<string, UploadResult>>({});
  
  // Manage concurrency
  const MAX_CONCURRENT_UPLOADS = 3;
  const [activeUploadIds, setActiveUploadIds] = useState<Set<string>>(new Set());
  const [failedUploadIds, setFailedUploadIds] = useState<Set<string>>(new Set());

  const createGallery = useCallback(async () => {
    if (isCreatingGallery) return;
    setIsCreatingGallery(true);
    setGlobalError(null);

    try {
      // Order the completed items based on the current sorted `items` state
      const orderedResults = items
        .map(item => ({ item, result: completedResults[item.id] }))
        .filter(x => x.result !== undefined);

      if (orderedResults.length === 0) {
        throw new Error("No files uploaded.");
      }

      const response = await fetch("/api/galleries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title || `Gallery from ${new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}`,
          items: orderedResults.map(({ item, result }) => ({
            originalKey: result.originalKey,
            previewKey: result.previewKey,
            fileType: item.file.type,
            sizeBytes: item.file.size,
          })),
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to create gallery");
      }

      const { slug } = await response.json();
      router.push(`/g/${slug}`);
    } catch (err: unknown) {
      if (err instanceof Error) {
        setGlobalError(err.message);
      } else {
        setGlobalError("An unexpected error occurred.");
      }
      setIsCreatingGallery(false);
      setIsUploading(false);
    }
  }, [items, completedResults, title, isCreatingGallery, router]);

  // Upload Orchestration
  useEffect(() => {
    if (!isUploading) return;

    const pendingItems = items.filter(
      item => !completedResults[item.id] && !activeUploadIds.has(item.id) && !failedUploadIds.has(item.id)
    );

    if (pendingItems.length === 0 && activeUploadIds.size === 0) {
      // All done! (except maybe failed ones)
      if (failedUploadIds.size === 0) {
        // Schedule it after render to avoid state updates in effect
        setTimeout(() => createGallery(), 0);
      } else {
        setTimeout(() => {
          setIsUploading(false);
          setGlobalError("Some uploads failed. Please retry them before creating the gallery.");
        }, 0);
      }
      return;
    }

    // Start more uploads if we have capacity
    if (activeUploadIds.size < MAX_CONCURRENT_UPLOADS && pendingItems.length > 0) {
      const slotsAvailable = MAX_CONCURRENT_UPLOADS - activeUploadIds.size;
      const itemsToStart = pendingItems.slice(0, slotsAvailable);
      
      setTimeout(() => {
        setActiveUploadIds(prev => {
          const next = new Set(prev);
          itemsToStart.forEach(item => next.add(item.id));
          return next;
        });
      }, 0);
    }
  }, [isUploading, items, completedResults, activeUploadIds, failedUploadIds, createGallery]);

  const handleUploadComplete = useCallback((id: string, result: UploadResult) => {
    setCompletedResults(prev => ({ ...prev, [id]: result }));
    setActiveUploadIds(prev => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
    setFailedUploadIds(prev => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
  }, []);

  const handleUploadError = useCallback((id: string, _error: string) => {
    setActiveUploadIds(prev => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
    setFailedUploadIds(prev => {
      const next = new Set(prev);
      next.add(id);
      return next;
    });
  }, []);

  const handleRemoveItem = useCallback((id: string) => {
    setItems(prev => prev.filter(item => item.id !== id));
    setCompletedResults(prev => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
    setActiveUploadIds(prev => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
    setFailedUploadIds(prev => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
  }, []);



  const handleStartUpload = () => {
    if (items.length === 0) return;
    setIsUploading(true);
    setFailedUploadIds(new Set());
    setGlobalError(null);
  };

  const completedCount = Object.keys(completedResults).length;

  return (
    <motion.div
      key="upload-form"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="flex flex-col space-y-6"
    >
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-medium text-white">
          {items.length} {items.length === 1 ? "file" : "files"} selected
        </h3>
        {!isUploading && (
          <button 
            onClick={onClear}
            className="text-sm text-zinc-500 hover:text-white transition-colors"
          >
            Clear all
          </button>
        )}
      </div>

      <div className="max-h-[40vh] overflow-y-auto space-y-2 pr-2 scrollbar-thin scrollbar-thumb-zinc-800">
        <Reorder.Group 
          axis="y" 
          values={items} 
          onReorder={setItems} 
          className="space-y-2"
          initial="hidden"
          animate="visible"
          variants={{
            hidden: { opacity: 0 },
            visible: {
              opacity: 1,
              transition: { staggerChildren: 0.05 }
            }
          }}
        >
          {items.map((item) => (
            <FileUploadItem
              key={item.id}
              item={item}
              quality={quality}
              startUpload={activeUploadIds.has(item.id)}
              isUploadingBatch={isUploading}
              onComplete={handleUploadComplete}
              onError={handleUploadError}
              onRemove={handleRemoveItem}
            />
          ))}
        </Reorder.Group>
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
        <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20 flex flex-col gap-3">
          <span className="text-red-400 text-sm">{globalError}</span>
          {failedUploadIds.size === 0 && completedCount === items.length && (
            <button
              onClick={createGallery}
              disabled={isCreatingGallery}
              className="flex items-center justify-center gap-2 bg-red-500/20 hover:bg-red-500/30 text-red-200 py-2 rounded-lg font-medium transition-colors text-sm"
            >
              {isCreatingGallery ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <RefreshCcw className="w-4 h-4" />
              )}
              Retry Gallery Creation
            </button>
          )}
        </div>
      )}

      <button
        onClick={handleStartUpload}
        disabled={isUploading || isCreatingGallery || items.length === 0}
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
            Uploading {completedCount} / {items.length}
          </>
        ) : (
          <>
            Upload and Create Link
            <ArrowRight className="w-5 h-5" />
          </>
        )}
      </button>
    </motion.div>
  );
}
