'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

export const MAX_VOICE_SEC = 60;
export const MAX_VOICE_BYTES = 5 * 1024 * 1024;
const MIN_VOICE_MS = 700;
const SAMPLE_MS = 100;

export type RecorderState = 'idle' | 'starting' | 'recording' | 'preview';

export interface VoiceClip {
  blob: Blob;
  url: string;
  mimeType: string;
  durationSec: number;
  waveform: number[];
}

/**
 * Pick a recording format the browser supports. AAC-in-MP4 first: it plays
 * everywhere incl. older iOS Safari (which is also what iOS records); then
 * WebM/Opus (Chrome/Android/Firefox); then whatever the browser defaults to.
 */
export function pickAudioMime(): string {
  if (typeof window === 'undefined' || typeof window.MediaRecorder === 'undefined') return '';
  const candidates = [
    'audio/mp4;codecs=mp4a.40.2',
    'audio/webm;codecs=opus',
    'audio/mp4',
    'audio/webm',
    'audio/ogg;codecs=opus',
  ];
  for (const c of candidates) {
    try { if (MediaRecorder.isTypeSupported(c)) return c; } catch { /* ignore */ }
  }
  return '';
}

/** Downsample levels (0–1) to `n` bars (0–100), normalised to the loudest. */
function toWaveform(levels: number[], n = 48): number[] {
  if (levels.length === 0) return [];
  const out: number[] = [];
  for (let i = 0; i < n; i++) {
    const a = Math.floor((i / n) * levels.length);
    const b = Math.max(a + 1, Math.floor(((i + 1) / n) * levels.length));
    let m = 0;
    for (let j = a; j < b && j < levels.length; j++) m = Math.max(m, levels[j]);
    out.push(m);
  }
  const peak = Math.max(...out, 0.01);
  return out.map((v) => Math.round(Math.min(1, v / peak) * 100));
}

export function useVoiceRecorder(onError: (msg: string) => void) {
  const [state, setState] = useState<RecorderState>('idle');
  const [elapsedMs, setElapsedMs] = useState(0);
  const [levels, setLevels] = useState<number[]>([]);
  const [clip, setClip] = useState<VoiceClip | null>(null);

  const recRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const ctxRef = useRef<AudioContext | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startedAtRef = useRef(0);
  const allLevelsRef = useRef<number[]>([]);
  const discardRef = useRef(false);
  const stateRef = useRef<RecorderState>('idle');
  const onErrorRef = useRef(onError);
  onErrorRef.current = onError;

  const set = (s: RecorderState) => { stateRef.current = s; setState(s); };

  const cleanup = useCallback(() => {
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    ctxRef.current?.close().catch(() => {});
    ctxRef.current = null;
  }, []);

  const stop = useCallback(() => {
    const rec = recRef.current;
    if (rec && rec.state !== 'inactive') {
      try { rec.requestData(); } catch { /* ignore */ }
      rec.stop();
    }
  }, []);

  const cancel = useCallback(() => {
    discardRef.current = true;
    if (recRef.current && recRef.current.state !== 'inactive') recRef.current.stop();
    else { cleanup(); set('idle'); }
  }, [cleanup]);

  const start = useCallback(async () => {
    if (stateRef.current !== 'idle') return;
    if (typeof window === 'undefined' || !navigator.mediaDevices?.getUserMedia || typeof window.MediaRecorder === 'undefined') {
      onErrorRef.current('Microphone not available on this device');
      return;
    }
    set('starting');
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } });
    } catch (e) {
      set('idle');
      const name = (e as { name?: string })?.name;
      onErrorRef.current(name === 'NotAllowedError' || name === 'SecurityError'
        ? 'Microphone not available — allow microphone access in your browser settings to send voice notes'
        : 'Microphone not available');
      return;
    }
    if ((stateRef.current as RecorderState) !== 'starting') { stream.getTracks().forEach((t) => t.stop()); return; } // cancelled meanwhile
    streamRef.current = stream;

    const mime = pickAudioMime();
    let rec: MediaRecorder;
    try {
      rec = new MediaRecorder(stream, { ...(mime ? { mimeType: mime } : {}), audioBitsPerSecond: 48000 });
    } catch {
      try { rec = new MediaRecorder(stream); } catch {
        cleanup(); set('idle');
        onErrorRef.current('Voice notes aren’t supported in this browser');
        return;
      }
    }
    recRef.current = rec;
    const chunks: Blob[] = [];
    discardRef.current = false;
    allLevelsRef.current = [];
    setLevels([]);
    setElapsedMs(0);

    rec.ondataavailable = (ev) => { if (ev.data && ev.data.size > 0) chunks.push(ev.data); };
    rec.onstop = () => {
      const ms = Date.now() - startedAtRef.current;
      cleanup();
      recRef.current = null;
      if (discardRef.current) { set('idle'); return; }
      if (ms < MIN_VOICE_MS) { set('idle'); onErrorRef.current('Hold a little longer to record a voice note'); return; }
      const type = (rec.mimeType || mime || 'audio/webm').split(';')[0];
      const blob = new Blob(chunks, { type });
      if (blob.size === 0) { set('idle'); onErrorRef.current('Nothing was recorded — try again'); return; }
      if (blob.size > MAX_VOICE_BYTES) { set('idle'); onErrorRef.current('That voice note is too large'); return; }
      setClip({
        blob,
        url: URL.createObjectURL(blob),
        mimeType: type,
        durationSec: Math.max(1, Math.min(MAX_VOICE_SEC, Math.round(ms / 1000))),
        waveform: toWaveform(allLevelsRef.current),
      });
      set('preview');
    };

    // Level meter (best effort — some browsers refuse an AudioContext here)
    let analyser: AnalyserNode | null = null;
    let buf: Uint8Array<ArrayBuffer> | null = null;
    try {
      const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (Ctx) {
        const ctx = new Ctx();
        ctxRef.current = ctx;
        ctx.resume?.().catch(() => {});
        const src = ctx.createMediaStreamSource(stream);
        analyser = ctx.createAnalyser();
        analyser.fftSize = 512;
        src.connect(analyser);
        buf = new Uint8Array(analyser.fftSize);
      }
    } catch { analyser = null; }

    rec.start(250);
    startedAtRef.current = Date.now();
    set('recording');
    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) navigator.vibrate?.(10);

    timerRef.current = setInterval(() => {
      const ms = Date.now() - startedAtRef.current;
      setElapsedMs(ms);
      let level = 0;
      if (analyser && buf) {
        analyser.getByteTimeDomainData(buf);
        let sum = 0;
        for (let i = 0; i < buf.length; i++) { const v = (buf[i] - 128) / 128; sum += v * v; }
        level = Math.min(1, Math.sqrt(sum / buf.length) * 3.2);
      }
      allLevelsRef.current.push(level);
      setLevels((prev) => [...prev.slice(-39), level]);
      if (ms >= MAX_VOICE_SEC * 1000) stop();
    }, SAMPLE_MS);
  }, [cleanup, stop]);

  const discard = useCallback(() => {
    setClip((c) => { if (c) URL.revokeObjectURL(c.url); return null; });
    set('idle');
  }, []);

  /** Hand the clip to the caller (who uploads it) and reset. */
  const take = useCallback((): VoiceClip | null => {
    const c = clip;
    setClip(null);
    set('idle');
    return c;
  }, [clip]);

  useEffect(() => () => {
    discardRef.current = true;
    try { if (recRef.current && recRef.current.state !== 'inactive') recRef.current.stop(); } catch { /* ignore */ }
    cleanup();
  }, [cleanup]);

  return { state, elapsedMs, levels, clip, start, stop, cancel, discard, take, stateRef };
}

export type VoiceRecorder = ReturnType<typeof useVoiceRecorder>;
