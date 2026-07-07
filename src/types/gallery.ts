/**
 * src/types/gallery.ts
 *
 * Shared type definitions for gallery media items.
 * Used across GalleryGrid, Lightbox, and the gallery page.
 */

export interface MediaItem {
  id: string;
  originalKey: string;
  previewKey: string | null;
  fileType: string;
  /** Size in bytes (as a plain number — BigInt is serialized before passing to client) */
  sizeBytes: number;
  width: number | null;
  height: number | null;
  sortOrder: number;
  createdAt: string;
}
