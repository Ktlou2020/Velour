'use client';

import { useEffect, useState } from 'react';
import { Calendar, MapPin, User, Mail, Check, Trash2, Send, ShieldCheck } from 'lucide-react';

interface DatePlan {
  id: string;
  matchName: string;
  matchUsername: string | null;
  location: string;
  dateTime: string;
  friendName: string;
  friendEmail: string;
  notes: string | null;
  checkedInAt: string | null;
}

const EMPTY = {
  matchName: '',
  matchUsername: '',
  location: '',
  dateTime: '',
  friendName: '',
  friendEmail: '',
  notes: '',
};

function toLocalInput(d: Date) {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function formatWhen(iso: string) {
  return new Date(iso).toLocaleString('en-ZA', {
    weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
  });
}

export default function ShareDateClient() {
  const [form, setForm] = useState(EMPTY);
  const [plans, setPlans] = useState<DatePlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [bounds, setBounds] = useState<{ min: string; max: string } | null>(null);

  useEffect(() => {
    const now = new Date();
    setBounds({
      min: toLocalInput(now),
      max: toLocalInput(new Date(now.getTime() + 60 * 24 * 60 * 60 * 1000)),
    });
    fetch('/api/safety/date-plans')
      .then((r) => (r.ok ? r.json() : { plans: [] }))
      .then((d) => setPlans(d.plans ?? []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  function set<K extends keyof typeof EMPTY>(key: K, value: string) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setSuccess('');
    const when = new Date(form.dateTime);
    if (!form.dateTime || Number.isNaN(when.getTime())) {
      setError('Please choose a valid date and time.');
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch('/api/safety/date-plans', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, dateTime: when.toISOString() }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || 'Something went wrong. Please try again.');
        return;
      }
      setPlans((p) => [...p, data.plan].sort((a, b) => a.dateTime.localeCompare(b.dateTime)));
      setSuccess(
        data.emailed === false
          ? 'Plan saved, but we couldn’t email your friend just now. Please let them know yourself.'
          : `Done — we’ve emailed ${form.friendName}.`
      );
      setForm(EMPTY);
    } finally {
      setSubmitting(false);
    }
  }

  async function checkIn(id: string) {
    setBusyId(id);
    setError('');
    try {
      const res = await fetch(`/api/safety/date-plans/${id}`, { method: 'PATCH' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || 'Could not check in. Please try again.');
        return;
      }
      setPlans((p) => p.map((x) => (x.id === id ? data.plan : x)));
    } finally {
      setBusyId(null);
    }
  }

  async function remove(id: string) {
    if (!confirm('Delete this date plan?')) return;
    setBusyId(id);
    try {
      const res = await fetch(`/api/safety/date-plans/${id}`, { method: 'DELETE' });
      if (res.ok) setPlans((p) => p.filter((x) => x.id !== id));
    } finally {
      setBusyId(null);
    }
  }

  const label = 'text-gray-400 text-xs uppercase tracking-widest block mb-2';
  const input = 'input-dark w-full px-4 py-3 rounded-xl text-sm';

  return (
    <div className="space-y-6">
      {/* Upcoming plans */}
      {!loading && plans.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-white font-semibold">Your shared dates</h3>
          {plans.map((plan) => (
            <div key={plan.id} className="glass rounded-2xl p-5 flex flex-col sm:flex-row sm:items-center gap-4">
              <div className="flex-1 min-w-0 space-y-1">
                <p className="text-white font-medium">
                  {plan.matchName}
                  {plan.matchUsername && <span className="text-gray-400 text-sm"> · @{plan.matchUsername}</span>}
                </p>
                <p className="text-gray-400 text-sm flex items-center gap-2"><Calendar className="w-3.5 h-3.5 text-[#DC143C]" />{formatWhen(plan.dateTime)}</p>
                <p className="text-gray-400 text-sm flex items-center gap-2"><MapPin className="w-3.5 h-3.5 text-[#DC143C]" /><span className="truncate">{plan.location}</span></p>
                <p className="text-gray-400 text-xs">Shared with {plan.friendName} ({plan.friendEmail})</p>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                {plan.checkedInAt ? (
                  <span className="flex items-center gap-1.5 text-emerald-400 text-sm font-medium px-3 py-2">
                    <Check className="w-4 h-4" /> Checked in
                  </span>
                ) : (
                  <button
                    onClick={() => checkIn(plan.id)}
                    disabled={busyId === plan.id}
                    className="flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-2 rounded-xl text-sm font-semibold transition-colors disabled:opacity-60"
                  >
                    <ShieldCheck className="w-4 h-4" /> I&apos;m safe — check in
                  </button>
                )}
                <button
                  onClick={() => remove(plan.id)}
                  disabled={busyId === plan.id}
                  className="glass p-2 rounded-xl text-gray-400 hover:text-[#DC143C] transition-colors disabled:opacity-60"
                  aria-label="Delete date plan"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Form */}
      <form onSubmit={handleSubmit} className="glass rounded-2xl p-6 space-y-4">
        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <label htmlFor="sd-match" className={label}>Who you&apos;re meeting</label>
            <div className="relative">
              <User className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input id="sd-match" required maxLength={80} value={form.matchName} onChange={(e) => set('matchName', e.target.value)} placeholder="Their name" className={`${input} pl-9`} />
            </div>
          </div>
          <div>
            <label htmlFor="sd-username" className={label}>Hush username (optional)</label>
            <input id="sd-username" maxLength={31} value={form.matchUsername} onChange={(e) => set('matchUsername', e.target.value)} placeholder="@username" className={input} />
          </div>
          <div>
            <label htmlFor="sd-where" className={label}>Where</label>
            <div className="relative">
              <MapPin className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input id="sd-where" required maxLength={200} value={form.location} onChange={(e) => set('location', e.target.value)} placeholder="Venue and area" className={`${input} pl-9`} />
            </div>
          </div>
          <div>
            <label htmlFor="sd-when" className={label}>When</label>
            <input
              id="sd-when"
              type="datetime-local"
              required
              min={bounds?.min}
              max={bounds?.max}
              value={form.dateTime}
              onChange={(e) => set('dateTime', e.target.value)}
              className={`${input} [color-scheme:dark]`}
            />
          </div>
          <div>
            <label htmlFor="sd-friend" className={label}>Friend&apos;s name</label>
            <input id="sd-friend" required maxLength={80} value={form.friendName} onChange={(e) => set('friendName', e.target.value)} placeholder="Who should we tell?" className={input} />
          </div>
          <div>
            <label htmlFor="sd-email" className={label}>Friend&apos;s email</label>
            <div className="relative">
              <Mail className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input id="sd-email" type="email" required maxLength={254} value={form.friendEmail} onChange={(e) => set('friendEmail', e.target.value)} placeholder="friend@example.com" className={`${input} pl-9`} />
            </div>
          </div>
        </div>
        <div>
          <label htmlFor="sd-notes" className={label}>Notes (optional)</label>
          <textarea id="sd-notes" maxLength={1000} rows={3} value={form.notes} onChange={(e) => set('notes', e.target.value)} placeholder="e.g. I'll message you by 10pm. They drive a white Polo." className={`${input} resize-none`} />
        </div>

        {error && <p className="text-red-400 text-sm" role="alert">{error}</p>}
        {success && <p className="text-emerald-400 text-sm" role="status">{success}</p>}

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <p className="text-gray-400 text-xs">We only use your friend&apos;s email for this date. Up to 5 shares per day.</p>
          <button
            type="submit"
            disabled={submitting}
            className="flex items-center justify-center gap-2 bg-gradient-to-r from-[#DC143C] to-[#8F0D25] hover:from-[#FF1744] hover:to-[#DC143C] text-white px-6 py-2.5 rounded-xl text-sm font-semibold transition-all disabled:opacity-60"
          >
            {submitting ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <Send className="w-4 h-4" />}
            {submitting ? 'Sending…' : 'Share with my friend'}
          </button>
        </div>
      </form>
    </div>
  );
}
