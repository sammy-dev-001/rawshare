"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { FileUploadItem } from "@/components/gallery/FileUploadItem";
import { UploadResult, UploadQuality } from "@/hooks/useUpload";
import { useRouter } from "next/navigation";
import { motion, Reorder } from "framer-motion";
import { ArrowRight, Loader2, RefreshCcw, Plus, Clock } from "lucide-react";
import { useAuth } from "@clerk/nextjs";

export interface UploadQueueItem {
  id: string;
  file: File;
}

interface UploadManagerProps {
  initialFiles: File[];
  onClear: () => void;
  existingSlug?: string;
  onUploadComplete?: () => void;
}

const QUALITY_OPTIONS: { id: UploadQuality; label: string; desc: string }[] = [
  { id: "standard", label: "Standard", desc: "Good balance, smaller sizes (~5MB max)" },
  { id: "high", label: "High", desc: "High quality retention (~10MB max)" },
  { id: "original", label: "Original", desc: "Raw untouched files (may consume more data)" },
];

export function UploadManager({ initialFiles, onClear, existingSlug, onUploadComplete }: UploadManagerProps) {
  const router = useRouter();
  
  // Wrap files with unique IDs for Reorder to work correctly
  const [items, setItems] = useState<UploadQueueItem[]>(() => 
    initialFiles.map(file => ({ id: Math.random().toString(36).slice(2, 9), file }))
  );
  
  const [title, setTitle] = useState("");
  const [password, setPassword] = useState("");
  const [isUploading, setIsUploading] = useState(false);
  const [isCreatingGallery, setIsCreatingGallery] = useState(false);
  const [globalError, setGlobalError] = useState<string | null>(null);
  const [quality, setQuality] = useState<UploadQuality>("original");
  
  const { isSignedIn } = useAuth();
  const [expiresInHours, setExpiresInHours] = useState<number | null>(120); // 5 days by default

  // State to track completed uploads map (id -> result)
  const [completedResults, setCompletedResults] = useState<Record<string, UploadResult>>({});
  
  // Manage concurrency
  const MAX_CONCURRENT_UPLOADS = 3;
  const [activeUploadIds, setActiveUploadIds] = useState<Set<string>>(new Set());
  const [failedUploadIds, setFailedUploadIds] = useState<Set<string>>(new Set());
  // retryCounters: bumping a file's counter signals FileUploadItem to reset and retry.
  // Initialised lazily from `items` to share the same IDs.
  const [retryCounters, setRetryCounters] = useState<Record<string, number>>({});
  const isCreatingGalleryRef = useRef(false);

  const createGallery = useCallback(async () => {
    if (isCreatingGalleryRef.current) return;
    isCreatingGalleryRef.current = true;
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

      const itemsWithDimensions = await Promise.all(
        orderedResults.map(async ({ item, result }) => {
          let width: number | undefined = undefined;
          let height: number | undefined = undefined;
          try {
            const url = URL.createObjectURL(item.file);
            if (item.file.type.startsWith("video/")) {
              const video = document.createElement("video");
              await new Promise((resolve, reject) => {
                video.onloadedmetadata = resolve;
                video.onerror = reject;
                video.src = url;
              });
              width = video.videoWidth;
              height = video.videoHeight;
            } else if (item.file.type.startsWith("image/")) {
              const img = new Image();
              await new Promise((resolve, reject) => {
                img.onload = resolve;
                img.onerror = reject;
                img.src = url;
              });
              width = img.width;
              height = img.height;
            }
            URL.revokeObjectURL(url);
          } catch {
            // gracefully degrade to undefined
          }

          return {
            originalKey: result.originalKey,
            previewKey: result.previewKey,
            fileType: item.file.type,
            sizeBytes: item.file.size,
            width,
            height,
            exifData: result.exifData,
          };
        })
      );

      let response;
      if (existingSlug) {
        // Appending to an existing gallery
        const adminToken = localStorage.getItem(`admin_token_${existingSlug}`);
        const headers: Record<string, string> = { "Content-Type": "application/json" };
        if (adminToken) headers["x-admin-token"] = adminToken;

        response = await fetch(`/api/galleries/${existingSlug}`, {
          method: "POST",
          headers,
          body: JSON.stringify({ items: itemsWithDimensions }),
        });
      } else {
        // Creating a new gallery
        response = await fetch("/api/galleries", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: title || `Gallery from ${new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}`,
            password: password || undefined,
            expiresInHours,
            items: itemsWithDimensions,
          }),
        });
      }

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to save gallery");
      }

      if (existingSlug) {
        // Refresh the page or call callback
        if (onUploadComplete) onUploadComplete();
        else window.location.reload();
      } else {
        const { slug, adminToken } = await response.json();
        if (adminToken) {
          localStorage.setItem(`admin_token_${slug}`, adminToken);
        }
        router.push(`/g/${slug}`);
      }
    } catch (err: unknown) {
      if (err instanceof Error) {
        setGlobalError(err.message);
      } else {
        setGlobalError("An unexpected error occurred.");
      }
      setIsCreatingGallery(false);
      setIsUploading(false);
    }
  }, [items, completedResults, title, isCreatingGallery, router, existingSlug, expiresInHours, onUploadComplete, password]);

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

  const handleUploadError = useCallback((id: string, _error?: string) => {
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

  const handleRetryAllFailed = useCallback(() => {
    const failedIds = Array.from(failedUploadIds);
    setFailedUploadIds(new Set());
    setGlobalError(null);
    // Increment each failed item's retry counter — FileUploadItem watches this
    // and will reset + re-upload when it changes.
    setRetryCounters(prev => {
      const next = { ...prev };
      failedIds.forEach(id => { next[id] = (next[id] ?? 0) + 1; });
      return next;
    });
    setIsUploading(true);
  }, [failedUploadIds]);

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
    setRetryCounters(prev => {
      const next = { ...prev };
      delete next[id];
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
        <div className="flex items-center gap-3">
          <h3 className="text-lg font-medium text-white">
            {items.length} {items.length === 1 ? "file" : "files"} selected
          </h3>
          <label className="cursor-pointer bg-white/10 hover:bg-white/20 text-white text-xs font-medium px-2.5 py-1.5 rounded-lg transition-colors flex items-center gap-1.5" title="Add more files">
            <Plus size={14} />
            <span className="hidden sm:inline">Add</span>
            <input 
              type="file" 
              multiple 
              accept="image/*,video/*"
              className="hidden" 
              onChange={(e) => {
                if (e.target.files) {
                  const newFiles = Array.from(e.target.files);
                  setItems(prev => [
                    ...prev,
                    ...newFiles.map(file => ({ id: Math.random().toString(36).slice(2, 9), file }))
                  ]);
                }
                e.target.value = "";
              }} 
            />
          </label>
        </div>
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
          {items.map((item) =>              <FileUploadItem
                key={item.id}
                item={item}
                quality={quality}
                startUpload={activeUploadIds.has(item.id)}
                isUploadingBatch={isUploading}
                retrySignal={retryCounters[item.id] ?? 0}
                onComplete={handleUploadComplete}
                onError={handleUploadError}
                onRemove={handleRemoveItem}
              />
          )}
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

      {!existingSlug && (
        <div className="pt-4 border-t border-zinc-800/50 space-y-4">
          <div>
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
          {/* Expiration Setting */}
          {!existingSlug && (
            <div className="flex flex-col gap-2">
              <label htmlFor="expiration" className="text-sm font-medium text-zinc-300 flex items-center gap-2">
                <Clock className="w-4 h-4" /> Link Expiration
              </label>
              <select
                id="expiration"
                value={expiresInHours === null ? "forever" : expiresInHours.toString()}
                onChange={(e) => setExpiresInHours(e.target.value === "forever" ? null : Number(e.target.value))}
                disabled={isUploading}
                className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-white/20 transition-all disabled:opacity-50"
              >
                <option value="1">1 Hour</option>
                <option value="24">24 Hours</option>
                <option value="120">5 Days</option>
                {isSignedIn && <option value="forever">Forever</option>}
              </select>
              {!isSignedIn && (
                <p className="text-xs text-zinc-500">Sign in to keep links forever.</p>
              )}
            </div>
          )}

          <div className="flex flex-col gap-2">
            <label htmlFor="password" className="text-sm font-medium text-zinc-300">
              Gallery Password <span className="text-zinc-600 font-normal">(Optional)</span>
            </label>
            <input
              id="password"
              type="password"
              placeholder="Leave blank for public access"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={isUploading}
              className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3 text-white placeholder-zinc-600 focus:outline-none focus:ring-2 focus:ring-white/20 transition-all disabled:opacity-50"
            />
          </div>
        </div>
      )}


      {globalError && (
        <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20 flex flex-col gap-3">
          <span className="text-red-400 text-sm">{globalError}</span>
          {failedUploadIds.size > 0 && (
            <button
              onClick={handleRetryAllFailed}
              className="flex items-center justify-center gap-2 bg-red-500/20 hover:bg-red-500/30 text-red-200 py-2 rounded-lg font-medium transition-colors text-sm"
            >
              <RefreshCcw className="w-4 h-4" />
              Retry All Failed ({failedUploadIds.size})
            </button>
          )}
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
            {existingSlug ? "Saving..." : "Finishing Gallery..."}
          </>
        ) : isUploading ? (
          <>
            <Loader2 className="w-5 h-5 animate-spin" />
            Uploading {completedCount} / {items.length}
          </>
        ) : (
          <>
            {existingSlug ? "Upload Images" : "Upload and Create Link"}
            <ArrowRight className="w-5 h-5" />
          </>
        )}
      </button>
    </motion.div>
  );
}
