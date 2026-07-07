"use client";

import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Download, X, CheckSquare, Square, Loader2, Trash2 } from "lucide-react";

interface ActionBarProps {
  isSelectMode: boolean;
  selectedCount: number;
  totalCount: number;
  onDownload: () => void;
  onSelectAll: () => void;
  onClearSelection: () => void;
  isDownloading: boolean;
  downloadProgress: {
    phase: "idle" | "downloading" | "zipping" | "saving" | "error";
    progress: number; // 0 to 100
    currentFile: number;
    totalFiles: number;
  };
  isAuthorized?: boolean;
  onDelete?: () => void;
  isDeleting?: boolean;
}

export function ActionBar({
  isSelectMode,
  selectedCount,
  totalCount,
  onDownload,
  onSelectAll,
  onClearSelection,
  isDownloading,
  downloadProgress,
  isAuthorized,
  onDelete,
  isDeleting,
}: ActionBarProps) {
  const allSelected = selectedCount === totalCount;

  return (
    <AnimatePresence>
      {isSelectMode && (
        <motion.div
          initial={{ y: 100, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 100, opacity: 0 }}
          transition={{ type: "spring", damping: 25, stiffness: 350 }}
          className="fixed bottom-6 left-0 right-0 z-50 flex justify-center pointer-events-none"
        >
          <div className="flex w-[90%] max-w-lg flex-col gap-2 rounded-3xl border border-zinc-800 bg-zinc-900/90 p-4 shadow-2xl backdrop-blur-xl md:p-5 pointer-events-auto">
            {/* Progress indicators when downloading */}
            {isDownloading && (
              <div className="mb-2 space-y-1.5 px-1">
                <div className="flex items-center justify-between text-xs text-zinc-300 font-medium">
                  <div className="flex items-center gap-1.5">
                    <Loader2 className="h-3.5 w-3.5 animate-spin text-blue-500" />
                    <span>
                      {downloadProgress.phase === "downloading" &&
                        `Downloading file ${downloadProgress.currentFile} of ${downloadProgress.totalFiles}...`}
                      {downloadProgress.phase === "zipping" && "Starting download stream..."}
                      {downloadProgress.phase === "saving" && "Saving download zip..."}
                    </span>
                  </div>
                  <span className="text-teal-accent font-semibold">{downloadProgress.progress}%</span>
                </div>
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-zinc-800">
                  <motion.div
                    className="h-full bg-teal-accent"
                    initial={{ width: 0 }}
                    animate={{ width: `${downloadProgress.progress}%` }}
                    transition={{ duration: 0.1 }}
                  />
                </div>
              </div>
            )}

            {/* Controls Row */}
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-3">
                <button
                  onClick={onClearSelection}
                  disabled={isDownloading}
                  className="flex h-9 w-9 items-center justify-center rounded-full bg-zinc-800 text-zinc-300 transition-colors hover:bg-zinc-700 hover:text-white disabled:opacity-50"
                  title="Cancel selection"
                >
                  <X className="h-4 w-4" />
                </button>
                <div className="flex flex-col">
                  <span className="text-sm font-semibold text-white">
                    {selectedCount} selected
                  </span>
                  <span className="text-[10px] text-zinc-500 font-medium">
                    out of {totalCount} items
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={onSelectAll}
                  disabled={isDownloading}
                  className="flex items-center gap-1.5 rounded-full bg-zinc-850 px-3 py-1.5 text-xs font-semibold text-zinc-300 border border-zinc-800 transition-colors hover:bg-zinc-800 hover:text-white disabled:opacity-50"
                >
                  {allSelected ? (
                    <>
                      <Square className="h-3.5 w-3.5 text-zinc-400" />
                      <span>Deselect All</span>
                    </>
                  ) : (
                    <>
                      <CheckSquare className="h-3.5 w-3.5 text-teal-accent" />
                      <span>Select All</span>
                    </>
                  )}
                </button>

                <button
                  onClick={onDownload}
                  disabled={isDownloading || selectedCount === 0}
                  className="flex items-center gap-2 rounded-full bg-teal-accent px-4 py-2 text-xs font-bold text-zinc-950 shadow-lg shadow-teal-accent/25 transition-all hover:bg-teal-accent/90 hover:shadow-teal-accent/40 active:scale-95 disabled:scale-100 disabled:opacity-50 disabled:shadow-none"
                >
                  {isDownloading ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      <span>Downloading...</span>
                    </>
                  ) : (
                    <>
                      <Download className="h-4 w-4" />
                      <span>Download ({selectedCount})</span>
                    </>
                  )}
                </button>

                {isAuthorized && onDelete && (
                  <button
                    onClick={onDelete}
                    disabled={isDeleting || isDownloading || selectedCount === 0}
                    className="flex items-center gap-2 rounded-full bg-red-500/10 px-4 py-2 text-xs font-bold text-red-500 border border-red-500/20 transition-all hover:bg-red-500/20 active:scale-95 disabled:scale-100 disabled:opacity-50"
                  >
                    {isDeleting ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        <span>Deleting...</span>
                      </>
                    ) : (
                      <>
                        <Trash2 className="h-4 w-4" />
                        <span>Delete</span>
                      </>
                    )}
                  </button>
                )}
              </div>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
