// =====================================================================
// Client-side image compression helper.
// Shrinks photos in the browser BEFORE they leave for the backend, so a
// 10 MB phone photo travels as ~300 KB. Non-images and tiny files pass
// through unchanged.
// =====================================================================

import imageCompression from 'browser-image-compression';

const DEFAULT_OPTIONS = {
  maxSizeMB: 0.5,            // target file size after compression
  maxWidthOrHeight: 1920,    // resize so neither dimension exceeds this
  useWebWorker: true,        // do the work off the main thread
  initialQuality: 0.82,      // start quality for JPEG/WebP encoding
};

// Skip compression on files that aren't images, or are already small.
const shouldCompress = (file) => {
  if (!file || !(file instanceof File)) return false;
  if (!file.type.startsWith('image/')) return false;
  if (file.type === 'image/svg+xml') return false; // vector — no point
  if (file.size < 200 * 1024) return false;        // < 200 KB, leave alone
  return true;
};

/**
 * Compress a single File. Returns a new File with the same name.
 * On any error, returns the original file untouched so the upload
 * still goes through.
 */
export async function compressImage(file, options = {}) {
  if (!shouldCompress(file)) return file;

  try {
    const compressed = await imageCompression(file, { ...DEFAULT_OPTIONS, ...options });
    // imageCompression returns a Blob; rewrap as File so the original name
    // and lastModified are preserved end-to-end.
    return new File([compressed], file.name, {
      type: compressed.type || file.type,
      lastModified: file.lastModified,
    });
  } catch (err) {
    console.warn('[compressImage] failed, sending original:', err?.message || err);
    return file;
  }
}

/**
 * Compress an array (or FileList) of files in parallel.
 * Returns an array of compressed Files in the same order.
 */
export async function compressImages(files, options = {}) {
  const arr = Array.from(files || []);
  if (arr.length === 0) return [];
  return Promise.all(arr.map((f) => compressImage(f, options)));
}
