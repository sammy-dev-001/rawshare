"use client";

import React, { useState, useEffect } from "react";
import { Share2, Check, Copy, X } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { QRCodeSVG } from "qrcode.react";
import { usePathname } from "next/navigation";
import { createPortal } from "react-dom";

interface ShareButtonProps {
  galleryTitle?: string;
}

export default function ShareButton({ galleryTitle }: ShareButtonProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [url, setUrl] = useState("");
  const pathname = usePathname();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    if (typeof window !== "undefined") {
      setUrl(window.location.origin + pathname);
    }
  }, [pathname]);

  const handleNativeShare = async () => {
    const title = galleryTitle ? `${galleryTitle} | RawShare` : "RawShare";
    const text = galleryTitle
      ? `Check out "${galleryTitle}" on RawShare`
      : "Check out this gallery on RawShare";

    if (navigator.share) {
      try {
        await navigator.share({ title, text, url });
      } catch (err) {
        if ((err as DOMException).name === "AbortError") return;
      }
    }
  };

  const handleCopy = async () => {
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(url);
      } else {
        const textArea = document.createElement("textarea");
        textArea.value = url;
        textArea.style.position = "absolute";
        textArea.style.left = "-999999px";
        document.body.prepend(textArea);
        textArea.select();
        try {
          document.execCommand("copy");
        } finally {
          textArea.remove();
        }
      }
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy link:", err);
    }
  };

  // Prevent background scrolling when modal is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [isOpen]);

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className="flex items-center justify-center gap-2 rounded-full bg-zinc-900 border border-zinc-800 px-4 py-2 text-sm font-semibold text-zinc-300 transition-colors hover:bg-zinc-800 hover:text-white"
      >
        <Share2 className="h-4 w-4" />
        <span>Share</span>
      </button>

      {mounted && createPortal(
        <AnimatePresence>
          {isOpen && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setIsOpen(false)}
                className="absolute inset-0 bg-black/80 backdrop-blur-md cursor-pointer"
              />
              
              <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 10 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 10 }}
                transition={{ type: "spring", damping: 25, stiffness: 300 }}
                className="relative w-full max-w-sm bg-zinc-900 border border-zinc-800 rounded-3xl sm:rounded-2xl overflow-hidden shadow-2xl z-10 flex flex-col max-h-[90vh]"
              >
                <div className="p-6 overflow-y-auto">
                  <div className="flex items-center justify-between mb-6">
                    <h3 className="text-xl font-bold text-white">Share Gallery</h3>
                    <button
                      onClick={() => setIsOpen(false)}
                      className="rounded-full p-2 text-zinc-400 hover:bg-zinc-800 hover:text-white transition-colors"
                    >
                      <X className="h-5 w-5" />
                    </button>
                  </div>

                  <div className="flex flex-col items-center justify-center bg-white p-6 rounded-2xl mb-6">
                    {url ? (
                      <QRCodeSVG
                        value={url}
                        size={160}
                        bgColor={"#ffffff"}
                        fgColor={"#000000"}
                        level={"Q"}
                        includeMargin={false}
                        className="w-[160px] h-[160px] sm:w-[200px] sm:h-[200px]"
                      />
                    ) : (
                      <div className="w-[160px] h-[160px] sm:w-[200px] sm:h-[200px] bg-zinc-200 animate-pulse rounded-lg" />
                    )}
                    <p className="mt-5 text-[10px] font-bold text-zinc-500 uppercase tracking-widest">
                      Scan to view on mobile
                    </p>
                  </div>

                  <div className="flex flex-col gap-3">
                    <button
                      onClick={handleCopy}
                      className="flex w-full items-center justify-center gap-2 rounded-xl bg-zinc-800 px-4 py-3.5 text-sm font-semibold text-white transition-all hover:bg-zinc-700 active:scale-95"
                    >
                      {copied ? (
                        <>
                          <Check className="h-4 w-4 text-emerald-400" />
                          <span className="text-emerald-400">Copied!</span>
                        </>
                      ) : (
                        <>
                          <Copy className="h-4 w-4" />
                          <span>Copy Link</span>
                        </>
                      )}
                    </button>
                    {typeof navigator !== "undefined" && !!navigator.share && (
                      <button
                        onClick={handleNativeShare}
                        className="flex w-full items-center justify-center gap-2 rounded-xl bg-teal-accent px-4 py-3.5 text-sm font-bold text-black transition-all hover:bg-teal-accent/90 active:scale-95 shadow-[0_0_15px_rgba(0,229,255,0.2)]"
                      >
                        <Share2 className="h-4 w-4" />
                        <span>Share via...</span>
                      </button>
                    )}
                  </div>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>,
        document.body
      )}
    </>
  );
}
