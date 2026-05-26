"use client";

import React, { useState } from "react";
import { Share2, Check } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

export default function ShareButton() {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(window.location.href);
      } else {
        // Fallback for older browsers or when document is not focused (like in some dev tools)
        const textArea = document.createElement("textarea");
        textArea.value = window.location.href;
        textArea.style.position = "absolute";
        textArea.style.left = "-999999px";
        document.body.prepend(textArea);
        textArea.select();
        try {
          document.execCommand("copy");
        } catch (error) {
          console.error("Fallback copy failed", error);
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

  return (
    <button
      onClick={handleCopy}
      className="flex items-center justify-center gap-2 rounded-full bg-zinc-900 border border-zinc-800 px-4 py-2 text-sm font-semibold text-zinc-300 transition-colors hover:bg-zinc-800 hover:text-white"
    >
      <AnimatePresence mode="wait" initial={false}>
        {copied ? (
          <motion.div
            key="check"
            initial={{ opacity: 0, scale: 0.5 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.5 }}
            transition={{ duration: 0.15 }}
          >
            <Check className="h-4 w-4 text-green-500" />
          </motion.div>
        ) : (
          <motion.div
            key="share"
            initial={{ opacity: 0, scale: 0.5 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.5 }}
            transition={{ duration: 0.15 }}
          >
            <Share2 className="h-4 w-4" />
          </motion.div>
        )}
      </AnimatePresence>
      <span>{copied ? "Copied!" : "Share"}</span>
    </button>
  );
}
