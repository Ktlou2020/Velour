'use client';

import { useEffect, useState } from 'react';
import { MessageCircle, ChevronRight } from 'lucide-react';
import { useToast } from '@/lib/toast-context';

type Policy = 'EVERYONE' | 'VERIFIED' | 'LIKED';

const OPTIONS: { value: Policy; label: string; hint: string }[] = [
  { value: 'EVERYONE', label: 'Everyone', hint: 'Any member can start a chat with you.' },
  { value: 'VERIFIED', label: 'Verified members only', hint: 'Only members who passed photo verification.' },
  { value: 'LIKED', label: 'Only people I’ve liked', hint: 'Like or wink at someone to let them message you.' },
];

/** Settings row: who can start a new conversation with me (lib/message-policy.ts). */
export default function MessagePolicyRow() {
  const { showToast } = useToast();
  const [policy, setPolicy] = useState<Policy | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch('/api/settings/message-policy').then((r) => r.json()).then((d) => setPolicy(d.policy ?? 'EVERYONE')).catch(() => setPolicy('EVERYONE'));
  }, []);

  async function choose(next: Policy) {
    if (next === policy || saving) return;
    const prev = policy;
    setPolicy(next);
    setSaving(true);
    try {
      const res = await fetch('/api/settings/message-policy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ policy: next }),
      });
      if (!res.ok) throw new Error();
      showToast('Saved', 'success');
    } catch {
      setPolicy(prev);
      showToast('Couldn’t save — please try again', 'error');
    } finally {
      setSaving(false);
    }
  }

  const current = OPTIONS.find((o) => o.value === policy);

  return (
    <details className="group glass rounded-2xl">
      <summary className="flex items-center gap-3 p-5 cursor-pointer list-none [&::-webkit-details-marker]:hidden">
        <MessageCircle size={18} className="text-[#FF4D6D]" />
        <span className="min-w-0">
          <span className="block text-white font-semibold text-sm">Who can message me</span>
          {current && <span className="block text-white/55 text-xs">{current.label}</span>}
        </span>
        <ChevronRight size={16} className="text-white/60 ml-auto transition-transform group-open:rotate-90" aria-hidden="true" />
      </summary>
      <div className="px-5 pb-5">
        <fieldset disabled={policy === null || saving} className="space-y-2">
          <legend className="text-white/65 text-sm mb-3">Choose who can start a new chat with you. Conversations you already have aren&apos;t affected.</legend>
          {OPTIONS.map((o) => (
            <label
              key={o.value}
              className={`flex items-start gap-3 rounded-xl border px-4 py-3 cursor-pointer transition-colors ${policy === o.value ? 'border-[#DC143C]/60 bg-[#DC143C]/10' : 'border-white/10 hover:border-white/20'}`}
            >
              <input
                type="radio"
                name="message-policy"
                value={o.value}
                checked={policy === o.value}
                onChange={() => choose(o.value)}
                className="mt-1 accent-[#DC143C]"
              />
              <span>
                <span className="block text-white text-sm font-medium">{o.label}</span>
                <span className="block text-white/55 text-xs">{o.hint}</span>
              </span>
            </label>
          ))}
        </fieldset>
      </div>
    </details>
  );
}
