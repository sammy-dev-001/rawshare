"use client";

import { useEffect, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { toast } from "sonner";

function PwaFileLoaderInner({ onFilesLoaded }: { onFilesLoaded: (files: File[]) => void }) {
  const searchParams = useSearchParams();
  const router = useRouter();

  useEffect(() => {
    const isShared = searchParams.get("shared");
    if (isShared === "true") {
      const request = indexedDB.open("RawShare-PWA", 1);
      request.onsuccess = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        if (!db.objectStoreNames.contains("shared-files")) return;
        
        const transaction = db.transaction("shared-files", "readonly");
        const store = transaction.objectStore("shared-files");
        const getAllRequest = store.getAll();
        
        getAllRequest.onsuccess = () => {
          if (getAllRequest.result && getAllRequest.result.length > 0) {
            onFilesLoaded(getAllRequest.result);
            toast.success(`Loaded ${getAllRequest.result.length} files from Share Menu`);
            
            const deleteTx = db.transaction("shared-files", "readwrite");
            deleteTx.objectStore("shared-files").clear();
          }
          
          router.replace("/");
        };
      };
    } else if (isShared === "error") {
      toast.error("Failed to load files from Share Menu");
      router.replace("/");
    }
  }, [searchParams, router, onFilesLoaded]);

  return null;
}

export function PwaFileLoader({ onFilesLoaded }: { onFilesLoaded: (files: File[]) => void }) {
  return (
    <Suspense fallback={null}>
      <PwaFileLoaderInner onFilesLoaded={onFilesLoaded} />
    </Suspense>
  );
}
