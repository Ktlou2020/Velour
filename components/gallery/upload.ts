'use client';

/** Client side of POST /api/upload: HEIC handling + progress. */

export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;
const SERVER_DECODABLE = /^image\/(jpeg|png|webp|gif|avif)$/;

export function isHeic(file: File): boolean {
  return /^image\/hei[cf]/i.test(file.type) || /\.(heic|heif)$/i.test(file.name);
}

/**
 * The server can't decode HEIC (iPhone) photos. Browsers that can (Safari)
 * render it to a canvas and we upload a JPEG instead. Other images pass through.
 */
export async function prepareImage(file: File): Promise<File> {
  if (!isHeic(file) && (SERVER_DECODABLE.test(file.type) || file.type === '')) return file;
  if (!isHeic(file) && !file.type.startsWith('image/')) {
    throw new Error(`“${file.name}” isn’t a photo. Please choose a JPG or PNG.`);
  }
  try {
    const url = URL.createObjectURL(file);
    try {
      const img = new Image();
      img.decoding = 'async';
      img.src = url;
      await img.decode();
      const scale = Math.min(1, 2048 / Math.max(img.naturalWidth, img.naturalHeight));
      const canvas = document.createElement('canvas');
      canvas.width = Math.round(img.naturalWidth * scale);
      canvas.height = Math.round(img.naturalHeight * scale);
      canvas.getContext('2d')!.drawImage(img, 0, 0, canvas.width, canvas.height);
      const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, 'image/jpeg', 0.9));
      if (!blob) throw new Error('encode');
      return new File([blob], file.name.replace(/\.[^.]+$/, '') + '.jpg', { type: 'image/jpeg' });
    } finally {
      URL.revokeObjectURL(url);
    }
  } catch {
    if (isHeic(file)) {
      throw new Error(`“${file.name}” is a HEIC photo this browser can’t convert. Please choose a JPG or PNG (iPhone: Settings → Camera → Formats → Most Compatible).`);
    }
    return file; // let the server decide (e.g. TIFF)
  }
}

export interface UploadResult {
  id: string;
  url: string;
  thumbnailUrl?: string;
  photo?: Record<string, unknown>;
}

/** Upload with progress (0–1). `fields` are extra form fields (purpose, albumId). */
export function uploadFile(file: File, fields: Record<string, string>, onProgress?: (p: number) => void, signal?: AbortSignal): Promise<UploadResult> {
  return new Promise((resolve, reject) => {
    const form = new FormData();
    form.append('file', file);
    Object.entries(fields).forEach(([k, v]) => form.append(k, v));
    const xhr = new XMLHttpRequest();
    xhr.open('POST', '/api/upload');
    xhr.responseType = 'json';
    xhr.upload.onprogress = (e) => { if (e.lengthComputable) onProgress?.(e.loaded / e.total); };
    xhr.onload = () => {
      const data = (xhr.response ?? {}) as UploadResult & { error?: string };
      if (xhr.status >= 200 && xhr.status < 300 && data.url) resolve(data);
      else reject(new Error(data.error || (xhr.status === 413 ? 'That file is too large (max 10MB)' : 'Upload failed — please try again')));
    };
    xhr.onerror = () => reject(new Error('Network error — check your connection and try again'));
    xhr.onabort = () => reject(new Error('Upload cancelled'));
    signal?.addEventListener('abort', () => xhr.abort());
    xhr.send(form);
  });
}
