"use client";

import React, { useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

// WhatsApp icon SVG
const WhatsappIcon = ({ className }: { className?: string }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 24 24"
    fill="currentColor"
    className={className}
  >
    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51a12.8 12.8 0 0 0-.57-.01c-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413Z"/>
  </svg>
);

interface WhatsAppStatusButtonProps {
  originalUrl: string;
  fileType: string;
  fileName: string;
  className?: string;
}

export function WhatsAppStatusButton({
  originalUrl,
  fileType,
  fileName,
  className = "",
}: WhatsAppStatusButtonProps) {
  const [isProcessing, setIsProcessing] = useState(false);
  const isVideo = fileType.startsWith("video/");

  // Function to optimize image using canvas
  const prepareImageForWhatsApp = async (imageUrl: string): Promise<Blob> => {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.onload = () => {
        const canvas = document.createElement("canvas");
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          reject(new Error("Could not get canvas context"));
          return;
        }

        // Target WhatsApp Status Dimensions (9:16 portrait)
        const targetWidth = 1080;
        const targetHeight = 1920;

        canvas.width = targetWidth;
        canvas.height = targetHeight;

        // Fill with black background (letterboxing)
        ctx.fillStyle = "#000000";
        ctx.fillRect(0, 0, targetWidth, targetHeight);

        // Calculate aspect ratio and dimensions for the image to fit within the canvas
        const imgRatio = img.width / img.height;
        const targetRatio = targetWidth / targetHeight;

        let drawWidth, drawHeight, offsetX, offsetY;

        if (imgRatio > targetRatio) {
          // Image is wider than target
          drawWidth = targetWidth;
          drawHeight = targetWidth / imgRatio;
          offsetX = 0;
          offsetY = (targetHeight - drawHeight) / 2;
        } else {
          // Image is taller than target
          drawHeight = targetHeight;
          drawWidth = targetHeight * imgRatio;
          offsetX = (targetWidth - drawWidth) / 2;
          offsetY = 0;
        }

        // Draw image
        ctx.drawImage(img, offsetX, offsetY, drawWidth, drawHeight);

        // Export as JPEG with 0.8 quality (sweet spot for WhatsApp)
        canvas.toBlob(
          (blob) => {
            if (blob) {
              resolve(blob);
            } else {
              reject(new Error("Failed to create blob from canvas"));
            }
          },
          "image/jpeg",
          0.8
        );
      };
      img.onerror = () => reject(new Error("Failed to load image for processing"));
      img.src = imageUrl;
    });
  };

  const handleShare = async (e: React.MouseEvent) => {
    e.stopPropagation();
    
    // Check if Web Share API with files is supported
    const isShareSupported = navigator.canShare && navigator.canShare({ files: [new File([], "test.jpg", { type: "image/jpeg" })] });
    
    setIsProcessing(true);
    
    try {
      let shareBlob: Blob;
      let shareFileName: string;

      if (isVideo) {
        // For video, just pass the raw file
        const response = await fetch(originalUrl);
        shareBlob = await response.blob();
        shareFileName = fileName;
      } else {
        // For images, apply the pre-optimization trick
        shareBlob = await prepareImageForWhatsApp(originalUrl);
        shareFileName = "status_ready.jpg";
      }

      const fileToShare = new File([shareBlob], shareFileName, { type: shareBlob.type });

      if (isShareSupported) {
        await navigator.share({
          files: [fileToShare],
          title: "Share to WhatsApp Status",
        });
        // Note: The native share sheet will open. The user still has to pick WhatsApp.
      } else {
        // Fallback for desktop/unsupported browsers: trigger a download of the optimized file
        toast.info("Browser doesn't support direct sharing. Downloading optimized file for manual share.", { duration: 4000 });
        
        const blobUrl = URL.createObjectURL(shareBlob);
        const a = document.createElement("a");
        a.href = blobUrl;
        a.download = shareFileName;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        setTimeout(() => URL.revokeObjectURL(blobUrl), 1000);
      }
    } catch (error: unknown) {
      if (error instanceof Error && error.name === "AbortError") { 
        // Ignore if user just cancelled the share sheet
      } else {
        console.error("Failed to share to WhatsApp:", error);
        toast.error("Failed to prepare file for WhatsApp");
      }
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="relative group">
      <button
        onClick={handleShare}
        disabled={isProcessing}
        className={`flex items-center justify-center transition-colors active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed ${className}`}
        aria-label="Share optimized for WhatsApp Status"
      >
        {isProcessing ? (
          <Loader2 className="h-5 w-5 animate-spin" />
        ) : (
          <WhatsappIcon className="h-5 w-5 text-[#25D366]" />
        )}
      </button>
      <div className="absolute right-0 top-full mt-2 w-48 p-2 bg-zinc-900 border border-white/10 rounded-lg shadow-xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-50 text-xs text-zinc-300 pointer-events-none">
        Share to Status without losing quality
      </div>
    </div>
  );
}
