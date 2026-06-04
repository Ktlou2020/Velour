'use client';

import { useState } from 'react';
import { X, Calendar, MapPin, Users, FileText, Tag } from 'lucide-react';

interface Props {
  onClose: () => void;
  onCreated: () => void;
}

const CATEGORIES = ['PARTY', 'MEETUP', 'WORKSHOP', 'TRAVEL', 'OTHER'];

export default function CreateEventModal({ onClose, onCreated }: Props) {
  const [form, setForm] = useState({
    title: '',
    description: '',
    date: '',
    endDate: '',
    location: '',
    city: '',
    country: '',
    maxAttendees: '',
    category: 'PARTY',
    isPrivate: false,
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  function set(key: string, value: string | boolean) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.title || !form.description || !form.date || !form.location) {
      setError('Title, description, date and location are required.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          maxAttendees: form.maxAttendees ? parseInt(form.maxAttendees, 10) : undefined,
          endDate: form.endDate || undefined,
        }),
      });
      if (res.ok) {
        onCreated();
      } else {
        const data = await res.json();
        setError(data.error || 'Failed to create event');
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center px-4" onClick={onClose}>
      <div
        className="glass-dark border border-white/10 rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-6 border-b border-white/10">
          <h2 className="text-white font-bold text-lg font-serif">Create Event</h2>
          <button onClick={onClose} className="text-white/40 hover:text-white transition-colors">
            <X size={20} />
          </button>
        </div>

        <form onSubmit={submit} className="p-6 space-y-4">
          {error && (
            <div className="bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3 text-red-400 text-sm">
              {error}
            </div>
          )}

          <div>
            <label className="text-white/50 text-xs uppercase tracking-widest mb-1.5 block">Title *</label>
            <div className="relative">
              <FileText size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30" />
              <input
                value={form.title}
                onChange={(e) => set('title', e.target.value)}
                placeholder="Event title"
                className="w-full glass border border-white/10 rounded-xl pl-9 pr-4 py-2.5 text-white text-sm placeholder-white/20 focus:outline-none focus:border-[#DC143C]/50 bg-transparent"
              />
            </div>
          </div>

          <div>
            <label className="text-white/50 text-xs uppercase tracking-widest mb-1.5 block">Description *</label>
            <textarea
              value={form.description}
              onChange={(e) => set('description', e.target.value)}
              placeholder="Tell people what this event is about..."
              rows={3}
              className="w-full glass border border-white/10 rounded-xl px-4 py-2.5 text-white text-sm placeholder-white/20 focus:outline-none focus:border-[#DC143C]/50 bg-transparent resize-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-white/50 text-xs uppercase tracking-widest mb-1.5 block">Start Date *</label>
              <div className="relative">
                <Calendar size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30" />
                <input
                  type="datetime-local"
                  value={form.date}
                  onChange={(e) => set('date', e.target.value)}
                  className="w-full glass border border-white/10 rounded-xl pl-9 pr-3 py-2.5 text-white text-sm focus:outline-none focus:border-[#DC143C]/50 bg-transparent"
                />
              </div>
            </div>
            <div>
              <label className="text-white/50 text-xs uppercase tracking-widest mb-1.5 block">End Date</label>
              <input
                type="datetime-local"
                value={form.endDate}
                onChange={(e) => set('endDate', e.target.value)}
                className="w-full glass border border-white/10 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-[#DC143C]/50 bg-transparent"
              />
            </div>
          </div>

          <div>
            <label className="text-white/50 text-xs uppercase tracking-widest mb-1.5 block">Location *</label>
            <div className="relative">
              <MapPin size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30" />
              <input
                value={form.location}
                onChange={(e) => set('location', e.target.value)}
                placeholder="Venue or address"
                className="w-full glass border border-white/10 rounded-xl pl-9 pr-4 py-2.5 text-white text-sm placeholder-white/20 focus:outline-none focus:border-[#DC143C]/50 bg-transparent"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-white/50 text-xs uppercase tracking-widest mb-1.5 block">City</label>
              <input
                value={form.city}
                onChange={(e) => set('city', e.target.value)}
                placeholder="City"
                className="w-full glass border border-white/10 rounded-xl px-4 py-2.5 text-white text-sm placeholder-white/20 focus:outline-none focus:border-[#DC143C]/50 bg-transparent"
              />
            </div>
            <div>
              <label className="text-white/50 text-xs uppercase tracking-widest mb-1.5 block">Max Attendees</label>
              <div className="relative">
                <Users size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30" />
                <input
                  type="number"
                  value={form.maxAttendees}
                  onChange={(e) => set('maxAttendees', e.target.value)}
                  placeholder="Unlimited"
                  min={1}
                  className="w-full glass border border-white/10 rounded-xl pl-9 pr-4 py-2.5 text-white text-sm placeholder-white/20 focus:outline-none focus:border-[#DC143C]/50 bg-transparent"
                />
              </div>
            </div>
          </div>

          <div>
            <label className="text-white/50 text-xs uppercase tracking-widest mb-1.5 block">Category</label>
            <div className="relative">
              <Tag size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30" />
              <select
                value={form.category}
                onChange={(e) => set('category', e.target.value)}
                className="w-full glass border border-white/10 rounded-xl pl-9 pr-4 py-2.5 text-white text-sm focus:outline-none focus:border-[#DC143C]/50 bg-[#0A0A0F] appearance-none"
              >
                {CATEGORIES.map((c) => (
                  <option key={c} value={c}>{c.charAt(0) + c.slice(1).toLowerCase()}</option>
                ))}
              </select>
            </div>
          </div>

          <label className="flex items-center gap-3 cursor-pointer">
            <div
              className={`w-10 h-5 rounded-full transition-colors ${form.isPrivate ? 'bg-[#D4AF37]' : 'bg-white/10'}`}
              onClick={() => set('isPrivate', !form.isPrivate)}
            >
              <div className={`w-5 h-5 rounded-full bg-white shadow transition-transform ${form.isPrivate ? 'translate-x-5' : 'translate-x-0'}`} />
            </div>
            <span className="text-white/70 text-sm">Gold members only</span>
          </label>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-gradient-to-r from-[#DC143C] to-[#8F0D25] hover:from-[#FF1744] hover:to-[#DC143C] text-white py-3 rounded-xl font-semibold text-sm transition-all disabled:opacity-70 flex items-center justify-center gap-2"
          >
            {loading ? (
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : 'Create Event'}
          </button>
        </form>
      </div>
    </div>
  );
}
