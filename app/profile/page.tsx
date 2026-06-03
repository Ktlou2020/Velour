'use client';

import { useState } from 'react';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import { Camera, Eye, Heart, MessageCircle, Users, ChevronDown, ChevronUp, Plus, Trash2, Crown, Shield, Bell, Lock, AlertTriangle } from 'lucide-react';

const INTERESTS_ALL = [
  'Travel', 'Fine Dining', 'Wine', 'Jazz', 'Photography', 'Fitness',
  'Art', 'Sailing', 'Skiing', 'Theatre', 'Literature', 'Yoga',
  'Cooking', 'Dancing', 'Architecture', 'Cinema', 'Fashion', 'Hiking',
  'Music', 'Meditation', 'Golf', 'Cycling', 'Painting', 'Surfing',
];

const STATS = [
  { icon: Eye, label: 'Profile Views', value: '1,247', color: 'text-blue-400' },
  { icon: Heart, label: 'Likes Received', value: '89', color: 'text-crimson-500' },
  { icon: Users, label: 'Matches', value: '34', color: 'text-emerald-400' },
  { icon: MessageCircle, label: 'Messages', value: '156', color: 'text-purple-400' },
];

const PHOTO_SLOTS = Array.from({ length: 6 }, (_, i) => i);

function AccordionSection({ title, icon: Icon, children }: { title: string; icon: React.ElementType; children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="glass rounded-2xl overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between p-5 text-left hover:bg-white/5 transition-colors"
        aria-expanded={open}
      >
        <div className="flex items-center gap-3">
          <Icon size={18} className="text-crimson-500" />
          <span className="text-white font-semibold">{title}</span>
        </div>
        {open ? <ChevronUp size={16} className="text-white/40" /> : <ChevronDown size={16} className="text-white/40" />}
      </button>
      {open && (
        <div className="px-5 pb-5 border-t border-white/5">
          {children}
        </div>
      )}
    </div>
  );
}

export default function ProfilePage() {
  const [selectedInterests, setSelectedInterests] = useState(['Travel', 'Wine', 'Jazz', 'Photography', 'Art']);

  function toggleInterest(interest: string) {
    setSelectedInterests((prev) =>
      prev.includes(interest) ? prev.filter((i) => i !== interest) : [...prev, interest]
    );
  }

  return (
    <div className="min-h-screen bg-[#0A0A0F]">
      <Navbar />

      <main className="pt-16">
        {/* Profile Header */}
        <div className="bg-gradient-to-b from-[#1A0007] to-[#0A0A0F] py-12 px-4 border-b border-white/5">
          <div className="max-w-4xl mx-auto flex flex-col sm:flex-row items-center sm:items-start gap-6">
            {/* Avatar Upload */}
            <div className="relative">
              <div className="w-28 h-28 rounded-2xl bg-gradient-to-br from-rose-900 to-red-700 flex items-center justify-center glow-crimson cursor-pointer hover:opacity-90 transition-opacity group">
                <span className="text-white text-4xl font-bold font-serif">SM</span>
                <div className="absolute inset-0 bg-black/60 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                  <Camera size={24} className="text-white" />
                </div>
              </div>
              <button className="absolute -bottom-2 -right-2 w-8 h-8 bg-crimson-500 rounded-full flex items-center justify-center hover:bg-crimson-400 transition-colors" aria-label="Change photo">
                <Camera size={14} className="text-white" />
              </button>
            </div>

            <div className="flex-1 text-center sm:text-left">
              <div className="flex flex-col sm:flex-row items-center sm:items-start gap-3 mb-1">
                <h1 className="font-serif text-3xl font-bold text-white">Sofia Mitchell</h1>
                <div className="flex items-center gap-1 bg-gold-600/20 border border-gold-500/30 px-3 py-1 rounded-full">
                  <Crown size={12} className="text-gold-400" />
                  <span className="text-gold-400 text-xs font-bold">Gold Member</span>
                </div>
                <div className="flex items-center gap-1 glass px-3 py-1 rounded-full">
                  <Shield size={12} className="text-emerald-400" />
                  <span className="text-emerald-400 text-xs font-semibold">Verified</span>
                </div>
              </div>
              <p className="text-white/50 text-sm mb-4">@Sofia_M · London, UK · Member since Jan 2024</p>

              {/* Completeness Bar */}
              <div>
                <div className="flex items-center justify-between text-xs mb-1.5">
                  <span className="text-white/50">Profile Completeness</span>
                  <span className="text-crimson-400 font-semibold">75%</span>
                </div>
                <div className="h-2 bg-white/10 rounded-full overflow-hidden">
                  <div className="h-full bg-gradient-to-r from-crimson-600 to-crimson-400 rounded-full" style={{ width: '75%' }} />
                </div>
                <p className="text-white/30 text-xs mt-1">Add your height and languages to reach 90%</p>
              </div>
            </div>
          </div>
        </div>

        <div className="max-w-4xl mx-auto px-4 py-8">
          {/* Stats Grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
            {STATS.map(({ icon: Icon, label, value, color }) => (
              <div key={label} className="glass rounded-2xl p-4 text-center">
                <Icon className={`${color} mx-auto mb-2`} size={20} />
                <div className="text-white text-2xl font-bold mb-0.5">{value}</div>
                <div className="text-white/40 text-xs">{label}</div>
              </div>
            ))}
          </div>

          {/* Editable Sections */}
          <div className="space-y-4 mb-8">
            {/* About Me */}
            <AccordionSection title="About Me" icon={MessageCircle}>
              <div className="pt-4">
                <textarea
                  className="input-dark w-full px-4 py-3 rounded-xl text-sm resize-none"
                  rows={5}
                  defaultValue="By day I work in fashion consulting, by night I'm exploring the city's hidden gems. Looking for genuine connection, great conversation, and someone as passionate about life as I am."
                  aria-label="About me"
                />
                <div className="flex justify-between items-center mt-2">
                  <span className="text-white/30 text-xs">Min. 50 characters recommended</span>
                  <button className="btn-crimson px-4 py-1.5 rounded-lg text-xs font-semibold">Save</button>
                </div>
              </div>
            </AccordionSection>

            {/* Looking For */}
            <AccordionSection title="Looking For" icon={Heart}>
              <div className="pt-4 space-y-4">
                <div>
                  <label className="text-white/50 text-xs uppercase tracking-widest block mb-2">Relationship Type</label>
                  <div className="flex flex-wrap gap-2">
                    {['Long-term', 'Casual', 'Friendship', 'Open Relationship', 'Activity Partner'].map((type) => (
                      <button
                        key={type}
                        className="glass px-3 py-1.5 rounded-full text-sm text-white/70 hover:text-white hover:border-crimson-500/40 transition-all"
                      >
                        {type}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="text-white/50 text-xs uppercase tracking-widest block mb-2" htmlFor="gender-pref">Gender Preference</label>
                  <select id="gender-pref" className="input-dark px-3 py-2 rounded-xl text-sm bg-[#0A0A0F] text-white/70 w-full md:w-auto">
                    <option>Men and Women</option>
                    <option>Men only</option>
                    <option>Women only</option>
                    <option>Non-binary / All genders</option>
                  </select>
                </div>
                <button className="btn-crimson px-4 py-1.5 rounded-lg text-xs font-semibold">Save Changes</button>
              </div>
            </AccordionSection>

            {/* Interests */}
            <AccordionSection title="Interests" icon={Users}>
              <div className="pt-4">
                <p className="text-white/40 text-xs mb-3">Select at least 5 interests. Selected: {selectedInterests.length}</p>
                <div className="flex flex-wrap gap-2 mb-4">
                  {INTERESTS_ALL.map((interest) => (
                    <button
                      key={interest}
                      onClick={() => toggleInterest(interest)}
                      className={`px-3 py-1.5 rounded-full text-sm font-medium transition-all ${
                        selectedInterests.includes(interest)
                          ? 'bg-crimson-500 text-white glow-crimson'
                          : 'glass text-white/60 hover:text-white'
                      }`}
                    >
                      {interest}
                    </button>
                  ))}
                </div>
                <button className="btn-crimson px-4 py-1.5 rounded-lg text-xs font-semibold">Save Interests</button>
              </div>
            </AccordionSection>

            {/* Privacy */}
            <AccordionSection title="Privacy Settings" icon={Lock}>
              <div className="pt-4 space-y-4">
                {[
                  { label: 'Who can see my profile', options: ['Everyone', 'Members only', 'Gold+ members'] },
                  { label: 'Who can message me', options: ['Everyone', 'Matches only', 'Nobody'] },
                  { label: 'Who can see my photos', options: ['Everyone', 'Members only', 'Approved only'] },
                ].map(({ label, options }) => (
                  <div key={label} className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <span className="text-white/70 text-sm">{label}</span>
                    <select className="input-dark px-3 py-2 rounded-lg text-sm bg-[#0A0A0F] text-white/70 w-full sm:w-48" aria-label={label}>
                      {options.map((o) => <option key={o}>{o}</option>)}
                    </select>
                  </div>
                ))}
                <div className="space-y-3 pt-2 border-t border-white/10">
                  {['Show online status', 'Allow profile in search results', 'Show last seen time'].map((label) => (
                    <label key={label} className="flex items-center justify-between cursor-pointer">
                      <span className="text-white/70 text-sm">{label}</span>
                      <div className="relative">
                        <input type="checkbox" defaultChecked className="sr-only peer" />
                        <div className="w-10 h-5 bg-white/10 rounded-full peer peer-checked:bg-crimson-500 transition-colors after:content-[''] after:absolute after:top-0.5 after:left-0.5 after:w-4 after:h-4 after:bg-white after:rounded-full after:transition-all peer-checked:after:translate-x-5" />
                      </div>
                    </label>
                  ))}
                </div>
                <button className="btn-crimson px-4 py-1.5 rounded-lg text-xs font-semibold">Save Settings</button>
              </div>
            </AccordionSection>

            {/* Notifications */}
            <AccordionSection title="Notification Settings" icon={Bell}>
              <div className="pt-4 space-y-3">
                {[
                  'New message received',
                  'Someone liked your profile',
                  'You have a new match',
                  'New event in your area',
                  'Weekly match digest',
                  'Profile viewed',
                  'Someone winked at you',
                ].map((label) => (
                  <label key={label} className="flex items-center justify-between cursor-pointer">
                    <span className="text-white/70 text-sm">{label}</span>
                    <div className="relative">
                      <input type="checkbox" defaultChecked className="sr-only peer" />
                      <div className="w-10 h-5 bg-white/10 rounded-full peer peer-checked:bg-crimson-500 transition-colors after:content-[''] after:absolute after:top-0.5 after:left-0.5 after:w-4 after:h-4 after:bg-white after:rounded-full after:transition-all peer-checked:after:translate-x-5" />
                    </div>
                  </label>
                ))}
                <button className="btn-crimson px-4 py-1.5 rounded-lg text-xs font-semibold mt-2">Save Preferences</button>
              </div>
            </AccordionSection>
          </div>

          {/* Photo Management */}
          <div className="glass rounded-2xl p-6 mb-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-white font-semibold flex items-center gap-2">
                <Camera size={16} className="text-crimson-500" />
                My Photos
              </h2>
              <span className="text-white/30 text-xs">{1}/6 photos uploaded</span>
            </div>
            <div className="grid grid-cols-3 gap-3">
              {PHOTO_SLOTS.map((slot) => (
                <div key={slot} className={`aspect-square rounded-xl border-2 border-dashed transition-all cursor-pointer flex flex-col items-center justify-center group ${slot === 0 ? 'bg-gradient-to-br from-rose-900 to-red-700 border-transparent' : 'border-white/10 hover:border-crimson-500/40 hover:bg-white/5'}`}>
                  {slot === 0 ? (
                    <div className="relative w-full h-full flex items-center justify-center">
                      <span className="text-white text-2xl font-bold font-serif">SM</span>
                      <button className="absolute top-2 right-2 w-6 h-6 bg-crimson-500 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity" aria-label="Delete photo">
                        <Trash2 size={10} className="text-white" />
                      </button>
                      <div className="absolute bottom-2 left-2 bg-gold-500/80 px-1.5 py-0.5 rounded text-xs text-white font-semibold">Main</div>
                    </div>
                  ) : (
                    <>
                      <Plus size={20} className="text-white/20 group-hover:text-white/50 transition-colors mb-1" />
                      <span className="text-white/20 group-hover:text-white/50 text-xs transition-colors">Add Photo</span>
                    </>
                  )}
                </div>
              ))}
            </div>
            <p className="text-white/30 text-xs mt-3">Max 6 photos. JPEG, PNG, WEBP accepted. Max 10MB each.</p>
          </div>

          {/* Danger Zone */}
          <div className="glass rounded-2xl p-6 border border-red-900/30">
            <h2 className="text-white font-semibold flex items-center gap-2 mb-3">
              <AlertTriangle size={16} className="text-red-500" />
              Danger Zone
            </h2>
            <p className="text-white/50 text-sm mb-4">Permanent actions that cannot be undone.</p>
            <div className="flex flex-col sm:flex-row gap-3">
              <button className="glass border border-white/10 hover:border-amber-500/40 px-4 py-2 rounded-xl text-white/60 hover:text-amber-400 text-sm font-medium transition-all">
                Pause Account
              </button>
              <button className="glass border border-red-900/30 hover:border-red-500/60 px-4 py-2 rounded-xl text-white/60 hover:text-red-400 text-sm font-medium transition-all">
                Delete Account
              </button>
            </div>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}
