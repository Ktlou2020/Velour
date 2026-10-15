'use client';

import { useEffect, useState } from 'react';
import Modal from '@/components/albums/Modal';
import { Spinner, btnDanger, btnGhost } from '@/components/gallery/ui';
import { useToast } from '@/lib/toast-context';
import type { ExplorePhoto } from './types';

const REASONS = [
  'Explicit content in a public photo',
  'Not their photo / impersonation',
  'Shared my photos/videos outside Unbound',
  'May show someone under 18',
  'Harassment, hate or violence',
  'Spam, scam or advertising',
  'Something else',
];

export default function ReportPhotoDialog({ photo, onClose }: { photo: ExplorePhoto | null; onClose: () => void }) {
  const { showToast } = useToast();
  const [reason, setReason] = useState('');
  const [details, setDetails] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => { setReason(''); setDetails(''); }, [photo?.id]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!photo || !reason) return;
    setBusy(true);
    try {
      const res = await fetch('/api/reports', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          targetUsername: photo.poster.username,
          reason: `Photo: ${reason}`.slice(0, 100),
          note: `Explore photo ${photo.id} (/gallery/explore?photo=${photo.id})${details.trim() ? ` — ${details.trim()}` : ''}`,
        }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(d.error || 'Could not send report');
      showToast('Thanks — our team will review this photo.', 'success');
      onClose();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Could not send report', 'error');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal open={!!photo} onClose={onClose} title="Report photo" description="Reports are private. The member isn’t told who reported them.">
      <form onSubmit={submit} className="space-y-3">
        <fieldset>
          <legend className="sr-only">Reason</legend>
          <div className="space-y-1.5">
            {REASONS.map((r) => (
              <label key={r} className={`flex items-center gap-3 rounded-xl border px-3 py-2.5 cursor-pointer transition-colors ${reason === r ? 'border-[#DC143C]/60 bg-[#DC143C]/10' : 'border-white/10 hover:border-white/20'}`}>
                <input type="radio" name="report-reason" value={r} checked={reason === r} onChange={() => setReason(r)} className="accent-[#DC143C]" />
                <span className="text-sm text-white/85">{r}</span>
              </label>
            ))}
          </div>
        </fieldset>
        <div>
          <label htmlFor="report-details" className="block text-white/70 text-xs font-medium mb-1.5">Anything else? <span className="text-white/40">(optional)</span></label>
          <textarea id="report-details" value={details} onChange={(e) => setDetails(e.target.value.slice(0, 600))} rows={2} className="input-dark w-full resize-none" />
        </div>
        <div className="flex justify-end gap-2 pt-1">
          <button type="button" onClick={onClose} className={btnGhost}>Cancel</button>
          <button type="submit" disabled={!reason || busy} className={btnDanger}>{busy && <Spinner />} Send report</button>
        </div>
      </form>
    </Modal>
  );
}
