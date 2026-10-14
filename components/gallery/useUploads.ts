'use client';

import { useCallback, useRef, useState } from 'react';
import { MAX_UPLOAD_BYTES, isHeic, prepareImage, uploadFile, type UploadResult } from './upload';

export interface UploadItem {
  key: string;
  name: string;
  preview: string | null;
  progress: number;
  status: 'queued' | 'uploading' | 'done' | 'error';
  error?: string;
}

const CONCURRENCY = 2;

/** Queue of photo uploads with per-file progress. */
export function useUploads(onUploaded: (r: UploadResult) => void) {
  const [items, setItems] = useState<UploadItem[]>([]);
  const queue = useRef<Array<{ key: string; file: File; fields: Record<string, string> }>>([]);
  const active = useRef(0);
  const onUploadedRef = useRef(onUploaded);
  onUploadedRef.current = onUploaded;

  const update = (key: string, patch: Partial<UploadItem>) =>
    setItems((list) => list.map((i) => (i.key === key ? { ...i, ...patch } : i)));

  const pump = useCallback(() => {
    while (active.current < CONCURRENCY && queue.current.length) {
      const job = queue.current.shift()!;
      active.current++;
      (async () => {
        update(job.key, { status: 'uploading', progress: 0.02 });
        try {
          const file = await prepareImage(job.file);
          if (file.size > MAX_UPLOAD_BYTES) throw new Error(`“${job.file.name}” is over 10MB`);
          const res = await uploadFile(file, job.fields, (p) => update(job.key, { progress: Math.max(0.02, p * 0.95) }));
          update(job.key, { status: 'done', progress: 1 });
          onUploadedRef.current(res);
        } catch (e) {
          update(job.key, { status: 'error', error: e instanceof Error ? e.message : 'Upload failed' });
        } finally {
          active.current--;
          pump();
        }
      })();
    }
  }, []);

  const add = useCallback((files: FileList | File[], fields: Record<string, string> = {}) => {
    const list = Array.from(files);
    const next: UploadItem[] = [];
    for (const file of list) {
      const key = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
      const looksLikeImage = file.type.startsWith('image/') || isHeic(file) || /\.(jpe?g|png|webp|gif|avif)$/i.test(file.name);
      if (!looksLikeImage) {
        next.push({ key, name: file.name, preview: null, progress: 0, status: 'error', error: `“${file.name}” isn’t a photo` });
        continue;
      }
      if (file.size > MAX_UPLOAD_BYTES && !isHeic(file)) {
        next.push({ key, name: file.name, preview: null, progress: 0, status: 'error', error: `“${file.name}” is over 10MB` });
        continue;
      }
      const preview = isHeic(file) ? null : URL.createObjectURL(file);
      next.push({ key, name: file.name, preview, progress: 0, status: 'queued' });
      queue.current.push({ key, file, fields: { purpose: 'gallery', ...fields } });
    }
    setItems((cur) => [...cur.filter((i) => i.status !== 'done'), ...next]);
    pump();
  }, [pump]);

  const dismiss = useCallback((key?: string) => {
    setItems((cur) => {
      const keep = key ? cur.filter((i) => i.key !== key) : cur.filter((i) => i.status === 'uploading' || i.status === 'queued');
      cur.filter((i) => !keep.includes(i)).forEach((i) => i.preview && URL.revokeObjectURL(i.preview));
      return keep;
    });
  }, []);

  const busy = items.some((i) => i.status === 'uploading' || i.status === 'queued');
  return { items, add, dismiss, busy };
}
