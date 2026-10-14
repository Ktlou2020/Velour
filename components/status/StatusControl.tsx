'use client';

import { useEffect, useState } from 'react';
import { Plus } from 'lucide-react';
import StatusPill from './StatusPill';
import StatusSheet from './StatusSheet';
import { statusTimeLeft, type ActiveStatus } from './status';

/** Own-profile status: shows the current status (or a prompt to set one) and opens the status sheet. */
export default function StatusControl({ initial, className = '' }: { initial: ActiveStatus | null; className?: string }) {
  const [status, setStatus] = useState<ActiveStatus | null>(initial);
  const [open, setOpen] = useState(false);
  const [left, setLeft] = useState<string | null>(null);

  // Time-left text is computed after mount (avoids hydration mismatches) and expires the pill client-side.
  useEffect(() => {
    if (!status) { setLeft(null); return; }
    const tick = () => {
      if (new Date(status.until).getTime() <= Date.now()) { setStatus(null); return; }
      setLeft(statusTimeLeft(status.until));
    };
    tick();
    const id = setInterval(tick, 60_000);
    return () => clearInterval(id);
  }, [status]);

  return (
    <div className={className}>
      {status ? (
        <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2">
          <StatusPill status={status} />
          {left && <span className="text-white/45 text-xs">{left}</span>}
          <button type="button" onClick={() => setOpen(true)} className="text-xs text-white/60 hover:text-white underline-offset-2 hover:underline">
            Change
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="inline-flex items-center gap-1.5 rounded-full border border-dashed border-white/20 px-3 py-1 text-sm text-white/65 hover:text-white hover:border-[#D4AF37]/50 transition-colors"
        >
          <Plus size={14} /> Set a status
        </button>
      )}
      <StatusSheet open={open} current={status} onClose={() => setOpen(false)} onSaved={setStatus} />
    </div>
  );
}
