'use client';

import { useRef, useState } from 'react';
import Link from 'next/link';
import {
  Quote, Edit2, Trash2, Plus, Video, Upload, MapPin, LocateFixed, X,
  EyeOff, Image as ImageIcon, Star, Lock,
} from 'lucide-react';
import { useToast } from '@/lib/toast-context';
import { PROFILE_PROMPT_QUESTIONS, MAX_PROMPTS, MAX_PROMPT_ANSWER, type ProfilePrompt } from './prompts';

async function patchProfile(body: Record<string, unknown>): Promise<{ ok: boolean; error?: string }> {
  try {
    const res = await fetch('/api/profile', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (res.ok) return { ok: true };
    const d = await res.json().catch(() => ({})) as { error?: string };
    return { ok: false, error: d.error ?? 'Failed to save' };
  } catch {
    return { ok: false, error: 'Network error' };
  }
}

/* ─── Prompts ─────────────────────────────────────────────────────────── */

export function PromptsEditor({ initial }: { initial: ProfilePrompt[] }) {
  const { showToast } = useToast();
  const [prompts, setPrompts] = useState<ProfilePrompt[]>(initial);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<ProfilePrompt[]>(initial);
  const [saving, setSaving] = useState(false);

  const used = new Set(draft.map((d) => d.question));

  function startEdit() {
    setDraft(prompts.length ? prompts : [{ question: PROFILE_PROMPT_QUESTIONS[0], answer: '' }]);
    setEditing(true);
  }

  function addPrompt() {
    const q = PROFILE_PROMPT_QUESTIONS.find((x) => !used.has(x));
    if (q && draft.length < MAX_PROMPTS) setDraft([...draft, { question: q, answer: '' }]);
  }

  async function save() {
    const cleaned = draft.map((d) => ({ ...d, answer: d.answer.trim() })).filter((d) => d.answer);
    setSaving(true);
    const r = await patchProfile({ prompts: cleaned });
    setSaving(false);
    if (r.ok) {
      setPrompts(cleaned);
      setEditing(false);
      showToast('Prompts saved', 'success');
    } else {
      showToast(r.error ?? 'Failed to save prompts', 'error');
    }
  }

  return (
    <div className="glass rounded-2xl p-6 mb-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-white font-semibold flex items-center gap-2">
          <Quote size={16} className="text-[#DC143C]" />
          Prompts
          <span className="text-white/30 text-xs font-normal">({prompts.length}/{MAX_PROMPTS})</span>
        </h2>
        {!editing && (
          <button onClick={startEdit} className="text-white/30 hover:text-white/60 transition-colors" aria-label="Edit prompts">
            <Edit2 size={14} />
          </button>
        )}
      </div>

      {editing ? (
        <div className="space-y-4">
          {draft.map((d, i) => (
            <div key={i} className="glass rounded-xl p-4 border border-white/5">
              <div className="flex items-center gap-2 mb-2">
                <select
                  value={d.question}
                  onChange={(e) => setDraft(draft.map((x, j) => (j === i ? { ...x, question: e.target.value } : x)))}
                  className="input-dark text-sm px-3 py-1.5 rounded-lg flex-1"
                  aria-label="Prompt question"
                >
                  {PROFILE_PROMPT_QUESTIONS.filter((q) => q === d.question || !used.has(q)).map((q) => (
                    <option key={q} value={q}>{q}</option>
                  ))}
                </select>
                <button
                  onClick={() => setDraft(draft.filter((_, j) => j !== i))}
                  className="w-8 h-8 glass rounded-lg flex items-center justify-center text-white/40 hover:text-red-400"
                  aria-label="Remove prompt"
                >
                  <Trash2 size={14} />
                </button>
              </div>
              <textarea
                value={d.answer}
                onChange={(e) => setDraft(draft.map((x, j) => (j === i ? { ...x, answer: e.target.value.slice(0, MAX_PROMPT_ANSWER) } : x)))}
                className="input-dark w-full px-4 py-3 rounded-xl text-sm resize-none"
                rows={2}
                placeholder="Your answer…"
                aria-label="Prompt answer"
              />
              <p className="text-white/30 text-xs text-right mt-1">{d.answer.length}/{MAX_PROMPT_ANSWER}</p>
            </div>
          ))}
          <div className="flex items-center justify-between">
            {draft.length < MAX_PROMPTS ? (
              <button onClick={addPrompt} className="flex items-center gap-1.5 text-[#DC143C] text-sm hover:underline">
                <Plus size={14} /> Add prompt
              </button>
            ) : <span />}
            <div className="flex gap-2">
              <button onClick={() => setEditing(false)} className="glass px-3 py-1.5 rounded-lg text-white/50 hover:text-white text-xs transition-colors">Cancel</button>
              <button onClick={save} disabled={saving} className="bg-[#DC143C] hover:bg-[#FF1744] text-white px-4 py-1.5 rounded-lg text-xs font-semibold transition-colors disabled:opacity-60">
                {saving ? 'Saving...' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      ) : prompts.length > 0 ? (
        <div className="space-y-3">
          {prompts.map((p) => (
            <div key={p.question} className="glass rounded-xl p-4 border border-white/5">
              <p className="text-white/40 text-xs font-semibold uppercase tracking-wider mb-1">{p.question}</p>
              <p className="text-white/80 text-sm break-words">{p.answer}</p>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-white/30 text-sm italic">Answer up to {MAX_PROMPTS} prompts to give matches something to talk about.</p>
      )}
    </div>
  );
}

/* ─── Video profile ───────────────────────────────────────────────────── */

export function VideoProfileCard({ initialUrl, platinum }: { initialUrl: string | null; platinum: boolean }) {
  const { showToast } = useToast();
  const inputRef = useRef<HTMLInputElement>(null);
  const [videoUrl, setVideoUrl] = useState<string | null>(initialUrl);
  const [busy, setBusy] = useState(false);

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (inputRef.current) inputRef.current.value = '';
    if (!file) return;
    if (!file.type.startsWith('video/')) { showToast('Please choose a video file', 'error'); return; }
    if (file.size > 30 * 1024 * 1024) { showToast('Video must be under 30MB', 'error'); return; }
    setBusy(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      fd.append('kind', 'video');
      const up = await fetch('/api/upload', { method: 'POST', body: fd });
      const data = await up.json().catch(() => ({})) as { url?: string; error?: string };
      if (!up.ok || !data.url) { showToast(data.error ?? 'Upload failed', 'error'); return; }
      const r = await patchProfile({ videoUrl: data.url });
      if (r.ok) { setVideoUrl(data.url); showToast('Video profile saved', 'success'); }
      else showToast(r.error ?? 'Failed to save video', 'error');
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    setBusy(true);
    const r = await patchProfile({ videoUrl: null });
    setBusy(false);
    if (r.ok) { setVideoUrl(null); showToast('Video removed', 'success'); }
    else showToast(r.error ?? 'Failed to remove video', 'error');
  }

  return (
    <div className="glass rounded-2xl p-6 mb-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-white font-semibold flex items-center gap-2">
          <Video size={16} className="text-purple-400" />
          Video Profile
          <span className="flex items-center gap-1 text-purple-300 text-[10px] font-bold bg-purple-500/15 border border-purple-500/30 px-2 py-0.5 rounded-full"><Star size={9} /> Platinum</span>
        </h2>
      </div>

      {videoUrl && (
        <video src={videoUrl} controls playsInline preload="metadata" className="w-full max-h-[360px] rounded-xl bg-black mb-4" />
      )}

      {platinum ? (
        <>
          <p className="text-white/40 text-sm mb-4">Keep it short and sweet — 30 seconds max, under 30MB.</p>
          <div className="flex gap-2 flex-wrap">
            <button
              onClick={() => inputRef.current?.click()}
              disabled={busy}
              className="flex items-center gap-2 bg-purple-600 hover:bg-purple-500 text-white px-4 py-2.5 rounded-xl text-sm font-semibold transition-all disabled:opacity-60"
            >
              {busy ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <Upload size={14} />}
              {busy ? 'Working...' : videoUrl ? 'Replace Video' : 'Upload Video'}
            </button>
            {videoUrl && (
              <button
                onClick={remove}
                disabled={busy}
                className="flex items-center gap-1.5 glass border border-white/10 hover:border-red-500/30 text-white/50 hover:text-red-400 px-4 py-2.5 rounded-xl text-sm transition-all disabled:opacity-60"
              >
                <Trash2 size={14} /> Remove
              </button>
            )}
          </div>
          <input ref={inputRef} type="file" accept="video/*" className="hidden" onChange={onFile} />
        </>
      ) : (
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <p className="text-white/40 text-sm flex items-center gap-1.5"><Lock size={12} /> Add a 30-second video intro with Platinum.</p>
          {videoUrl && (
            <button onClick={remove} disabled={busy} className="text-white/50 hover:text-red-400 text-sm flex items-center gap-1"><Trash2 size={12} /> Remove video</button>
          )}
          <Link href="/upgrade" className="bg-gradient-to-r from-purple-600 to-purple-800 text-white font-semibold px-4 py-2 rounded-xl text-sm hover:from-purple-500 hover:to-purple-700 transition-all">Go Platinum</Link>
        </div>
      )}
    </div>
  );
}

/* ─── Location ────────────────────────────────────────────────────────── */

export function LocationCard({ initialHasLocation }: { initialHasLocation: boolean }) {
  const { showToast } = useToast();
  const [hasLocation, setHasLocation] = useState(initialHasLocation);
  const [busy, setBusy] = useState(false);

  function useCurrent() {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      showToast('Location is not supported by your browser', 'error');
      return;
    }
    setBusy(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const r = await patchProfile({ latitude: pos.coords.latitude, longitude: pos.coords.longitude });
        setBusy(false);
        if (r.ok) { setHasLocation(true); showToast('Location updated', 'success'); }
        else showToast(r.error ?? 'Failed to save location', 'error');
      },
      (err) => {
        setBusy(false);
        showToast(err.code === err.PERMISSION_DENIED ? 'Location permission denied' : 'Could not get your location', 'error');
      },
      { enableHighAccuracy: false, timeout: 15000, maximumAge: 10 * 60 * 1000 },
    );
  }

  async function clear() {
    setBusy(true);
    const r = await patchProfile({ latitude: null, longitude: null });
    setBusy(false);
    if (r.ok) { setHasLocation(false); showToast('Location cleared', 'success'); }
    else showToast(r.error ?? 'Failed to clear location', 'error');
  }

  return (
    <div className="glass rounded-2xl p-6 mb-6">
      <h2 className="text-white font-semibold flex items-center gap-2 mb-2">
        <MapPin size={16} className="text-[#DC143C]" />
        Distance &amp; Location
      </h2>
      <p className="text-white/40 text-sm mb-4">
        {hasLocation
          ? 'Your approximate location is saved. Others only ever see a rounded distance, never your exact position.'
          : 'Share your approximate location to show distance and appear in nearby searches. It is rounded to about 1 km and never shown to others.'}
      </p>
      <div className="flex gap-2 flex-wrap">
        <button
          onClick={useCurrent}
          disabled={busy}
          className="flex items-center gap-2 bg-[#DC143C]/20 hover:bg-[#DC143C]/30 border border-[#DC143C]/30 text-[#DC143C] px-4 py-2.5 rounded-xl text-sm font-medium transition-all disabled:opacity-60"
        >
          {busy ? <div className="w-4 h-4 border-2 border-[#DC143C] border-t-transparent rounded-full animate-spin" /> : <LocateFixed size={14} />}
          {hasLocation ? 'Update to my current location' : 'Use my current location'}
        </button>
        {hasLocation && (
          <button
            onClick={clear}
            disabled={busy}
            className="flex items-center gap-1.5 glass border border-white/10 hover:border-red-500/30 text-white/50 hover:text-red-400 px-4 py-2.5 rounded-xl text-sm transition-all disabled:opacity-60"
          >
            <X size={14} /> Clear location
          </button>
        )}
      </div>
    </div>
  );
}

/* ─── Privacy toggles ─────────────────────────────────────────────────── */

function Toggle({ checked, onChange, disabled, label }: { checked: boolean; onChange: () => void; disabled?: boolean; label: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={onChange}
      disabled={disabled}
      className={`relative w-11 h-6 rounded-full transition-colors flex-shrink-0 disabled:opacity-40 ${checked ? 'bg-[#DC143C]' : 'bg-white/15'}`}
    >
      <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${checked ? 'translate-x-5' : ''}`} />
    </button>
  );
}

export function PrivacySettingsCard({
  initialIncognito,
  initialShowChatImages,
  platinum,
}: {
  initialIncognito: boolean;
  initialShowChatImages: boolean;
  platinum: boolean;
}) {
  const { showToast } = useToast();
  const [incognito, setIncognito] = useState(initialIncognito);
  const [showChatImages, setShowChatImages] = useState(initialShowChatImages);
  const [busy, setBusy] = useState<string | null>(null);

  async function toggle(field: 'incognito' | 'showChatImages', value: boolean, set: (v: boolean) => void) {
    setBusy(field);
    set(value);
    const r = await patchProfile({ [field]: value });
    setBusy(null);
    if (!r.ok) { set(!value); showToast(r.error ?? 'Failed to save', 'error'); }
  }

  return (
    <div className="glass rounded-2xl p-6 mb-6">
      <h2 className="text-white font-semibold flex items-center gap-2 mb-4">
        <EyeOff size={16} className="text-[#DC143C]" />
        Privacy
      </h2>
      <div className="space-y-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-white text-sm font-medium flex items-center gap-2">
              Incognito browsing
              <span className="flex items-center gap-1 text-purple-300 text-[10px] font-bold bg-purple-500/15 border border-purple-500/30 px-2 py-0.5 rounded-full"><Star size={9} /> Platinum</span>
            </p>
            <p className="text-white/40 text-xs mt-0.5">View profiles without appearing in their &quot;Who viewed me&quot; list or adding to their view count.</p>
            {!platinum && !incognito && (
              <Link href="/upgrade" className="text-purple-300 text-xs hover:underline mt-1 inline-block">Upgrade to Platinum to enable</Link>
            )}
          </div>
          <Toggle
            label="Incognito browsing"
            checked={incognito}
            disabled={busy === 'incognito' || (!platinum && !incognito)}
            onChange={() => toggle('incognito', !incognito, setIncognito)}
          />
        </div>
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-white text-sm font-medium flex items-center gap-2">
              <ImageIcon size={13} className="text-white/50" />
              Show images in chats without blurring
            </p>
            <p className="text-white/40 text-xs mt-0.5">When off, photos you receive in messages stay blurred until you tap to reveal them.</p>
          </div>
          <Toggle
            label="Show images in chats without blurring"
            checked={showChatImages}
            disabled={busy === 'showChatImages'}
            onChange={() => toggle('showChatImages', !showChatImages, setShowChatImages)}
          />
        </div>
      </div>
    </div>
  );
}
