'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, Wand2 } from 'lucide-react';

export default function SeedButton() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  async function seed() {
    setBusy(true); setMsg(null);
    try {
      const res = await fetch('/api/admin/store/seed', { method: 'POST' });
      const d = await res.json().catch(() => ({})) as { created?: { categories: number; products: number }; error?: string };
      setMsg(res.ok && d.created ? `Created ${d.created.categories} categories and ${d.created.products} sample products.` : d.error ?? 'Failed');
      router.refresh();
    } finally { setBusy(false); }
  }
  return (
    <div>
      <button type="button" onClick={seed} disabled={busy} className="inline-flex items-center gap-2 glass border border-[#D4AF37]/30 text-[#F5D77A] hover:bg-[#D4AF37]/10 px-4 py-2.5 rounded-xl text-sm font-medium disabled:opacity-50">
        {busy ? <Loader2 size={15} className="animate-spin" /> : <Wand2 size={15} />}Create sample catalogue
      </button>
      {msg && <p role="status" className="text-xs text-white/60 mt-2">{msg}</p>}
    </div>
  );
}
