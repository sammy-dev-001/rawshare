"use client";

import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Download, X, CheckSquare, Square, Loader2 } from "lucide-react";

interface ActionBarProps {
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
}

export function ActionBar({
  selectedCount,
  totalCount,
  onDownload,
  onSelectAll,
  onClearSelection,
  isDownloading,
  downloadProgress,
}: ActionBarProps) {
  const allSelected = selectedCount === totalCount;

  return (
    <AnimatePresence>
      {selectedCount > 0 && (
        <motion.div
          initial={{ y: 100, x: "-50%", opacity: 0 }}
          animate={{ y: 0, x: "-50%", opacity: 1 }}
          exit={{ y: 100, x: "-50%", opacity: 0 }}
          transition={{ type: "spring", damping: 25, stiffness: 350 }}
          className="fixed bottom-6 left-1/2 z-50 w-[90%] max-w-lg -translate-x-1/2"
        >
          <div className="flex flex-col gap-2 rounded-3xl border border-zinc-800 bg-zinc-900/90 p-4 shadow-2xl backdrop-blur-xl md:p-5">
            {/* Progress indicators when downloading */}
            {isDownloading && (
              <div className="mb-2 space-y-1.5 px-1">
                <div className="flex items-center justify-between text-xs text-zinc-300 font-medium">
                  <div className="flex items-center gap-1.5">
                    <Loader2 className="h-3.5 w-3.5 animate-spin text-blue-500" />
                    <span>
                      {downloadProgress.phase === "downloading" &&
                        `Downloading file ${downloadProgress.currentFile} of ${downloadProgress.totalFiles}...`}
                      {downloadProgress.phase === "zipping" && "Compressing files in browser..."}
                      {downloadProgress.phase === "saving" && "Saving download zip..."}
                    </span>
                  </div>
                  <span className="text-blue-400 font-semibold">{downloadProgress.progress}%</span>
                </div>
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-zinc-800">
                  <motion.div
                    className="h-full bg-blue-500"
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
                      <CheckSquare className="h-3.5 w-3.5 text-blue-500" />
                      <span>Select All</span>
                    </>
                  )}
                </button>

                <button
                  onClick={onDownload}
                  disabled={isDownloading || selectedCount === 0}
                  className="flex items-center gap-2 rounded-full bg-blue-600 px-4 py-2 text-xs font-bold text-white shadow-lg shadow-blue-500/25 transition-all hover:bg-blue-500 hover:shadow-blue-500/40 active:scale-95 disabled:scale-100 disabled:opacity-50 disabled:shadow-none"
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
              </div>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
