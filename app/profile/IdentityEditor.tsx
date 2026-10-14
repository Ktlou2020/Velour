'use client';

import { useState } from 'react';
import { Edit2, EyeOff, Sparkles, Users, User } from 'lucide-react';
import {
  CHILDREN_OPTIONS, COUPLE_TYPE_OPTIONS, childrenLabelOf, coupleTypeBadge, deriveCoupleType, intentionLabelOf,
  interestedInLabelOf, isAdult, publicPerson, type CoupleType, type PersonDetails,
} from '@/lib/identity';
import { ChipGroup, FieldError, MeetFields, PersonDetailsFields, PersonIdentityFields } from './identity/fields';

export interface IdentityInitial {
  isCouple: boolean;
  linkedPartner: { username: string; displayName?: string | null } | null;
  dateOfBirth: string | null;
  person: PersonDetails;
  partner2: PersonDetails | null;
  coupleType: string | null;
  interestedIn: string[];
  intentions: string[];
  hasChildren: string | null;
}

function payloadPerson(p: PersonDetails) {
  return {
    name: p.name?.trim() || undefined, gender: p.gender, genderLabel: p.genderLabel, pronouns: p.pronouns,
    dateOfBirth: p.dateOfBirth, orientation: p.orientation, showGender: p.showGender !== false,
    showOrientation: p.showOrientation !== false, heightCm: p.heightCm, bodyType: p.bodyType,
    ethnicity: p.ethnicity, showEthnicity: !!p.showEthnicity && !!p.ethnicity, languages: p.languages ?? [],
    drinking: p.drinking, smoking: p.smoking,
  };
}

function Summary({ person, title }: { person: PersonDetails; title?: string }) {
  const pub = publicPerson(person);
  const rows: [string, string | undefined, boolean?][] = [
    ['Gender', [pub.gender, pub.genderLabel].filter(Boolean).join(' · ') || (person.showGender === false && person.gender ? 'Hidden' : undefined), person.showGender === false],
    ['Pronouns', pub.pronouns],
    ['Orientation', pub.orientation ?? (person.showOrientation === false && person.orientation ? 'Hidden' : undefined), person.showOrientation === false],
    ['Height', pub.height],
    ['Body type', pub.bodyType],
    ['Ethnicity', person.ethnicity ? `${person.ethnicity}${person.showEthnicity ? '' : ' (hidden)'}` : undefined, !person.showEthnicity],
    ['Languages', pub.languages?.join(', ')],
    ['Drinks', pub.drinking],
    ['Smokes', pub.smoking],
  ];
  const shown = rows.filter((r) => r[1]);
  return (
    <div className="min-w-0">
      {title && <p className="text-white font-medium text-sm mb-2">{title}{pub.age !== undefined ? <span className="text-white/60 font-normal">, {pub.age}</span> : null}</p>}
      {shown.length ? (
        <dl className="space-y-1.5">
          {shown.map(([label, value, hidden]) => (
            <div key={label} className="flex justify-between gap-3 text-sm">
              <dt className="text-white/55 flex-shrink-0">{label}</dt>
              <dd className="text-white/85 text-right min-w-0 break-words flex items-center gap-1 justify-end">
                {hidden && <EyeOff size={11} className="text-white/45" aria-label="Hidden from others" />}{value}
              </dd>
            </div>
          ))}
        </dl>
      ) : <p className="text-white/45 text-xs italic">Nothing added yet</p>}
    </div>
  );
}

export default function IdentityEditor({ initial }: { initial: IdentityInitial }) {
  const [saved, setSaved] = useState(initial);
  const [d, setD] = useState(initial);
  const [editing, setEditing] = useState(false);
  const [tab, setTab] = useState<0 | 1>(0);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const set = (patch: Partial<IdentityInitial>) => setD((prev) => ({ ...prev, ...patch }));
  const linked = !!d.linkedPartner;
  const hasP2 = d.isCouple && !linked && !!d.partner2;
  const derived = d.isCouple && hasP2 ? deriveCoupleType(d.person.gender, d.partner2?.gender) : null;

  async function save() {
    setError('');
    setNotice('');
    if (!d.person.gender) return setError(d.isCouple ? 'Please choose a gender for partner 1' : 'Please choose your gender');
    if (d.interestedIn.length === 0) return setError('Choose at least one kind of person you’d like to meet');
    if (hasP2) {
      if (!d.partner2?.name?.trim()) return setError('Please add partner 2’s first name');
      if (!d.partner2?.gender) return setError('Please choose a gender for partner 2');
      if (!d.partner2?.dateOfBirth || !isAdult(d.partner2.dateOfBirth)) return setError('Partner 2 needs a date of birth showing they are 18+');
    }
    const body: Record<string, unknown> = {
      interestedIn: d.interestedIn,
      intentions: d.intentions,
      hasChildren: d.hasChildren ?? null,
    };
    if (!linked) body.isCouple = d.isCouple;
    if (d.isCouple && !linked) {
      const p1 = payloadPerson(d.person);
      delete p1.dateOfBirth;
      body.coupleMembers = hasP2 ? [p1, payloadPerson(d.partner2!)] : [p1];
      body.coupleType = d.coupleType ?? derived ?? null;
    } else {
      const p = payloadPerson(d.person);
      Object.assign(body, {
        gender: p.gender, genderLabel: p.genderLabel ?? null, pronouns: p.pronouns ?? null, orientation: p.orientation ?? null,
        showGender: p.showGender, showOrientation: p.showOrientation, heightCm: p.heightCm ?? null, bodyType: p.bodyType ?? null,
        ethnicity: p.ethnicity ?? null, showEthnicity: p.showEthnicity, languages: p.languages, drinking: p.drinking ?? null,
        smoking: p.smoking ?? null,
      });
    }
    setSaving(true);
    try {
      const res = await fetch('/api/profile', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      const data = await res.json().catch(() => ({})) as { error?: string; profile?: { coupleType?: string | null } };
      if (!res.ok) { setError(data.error || 'Couldn’t save — please try again'); return; }
      const next = { ...d, coupleType: data.profile?.coupleType ?? d.coupleType };
      setD(next);
      setSaved(next);
      setEditing(false);
      setNotice('Saved');
    } finally {
      setSaving(false);
    }
  }

  const who = saved.interestedIn.map((v) => interestedInLabelOf(v)).filter(Boolean).join(', ');
  const why = saved.intentions.map((v) => intentionLabelOf(v)).filter(Boolean).join(', ');

  return (
    <section id="identity" className="glass rounded-2xl p-5 sm:p-6 mb-6 scroll-mt-20" aria-labelledby="identity-h">
      <div className="flex items-center justify-between gap-3 mb-4">
        <h2 id="identity-h" className="text-white font-semibold flex items-center gap-2">
          <Sparkles size={16} className="text-[#D4AF37]" aria-hidden="true" />
          {saved.isCouple ? 'About you two' : 'About me'}
        </h2>
        {!editing && (
          <button onClick={() => { setD(saved); setEditing(true); setNotice(''); }} className="min-h-[36px] flex items-center gap-1.5 text-white/65 hover:text-white text-sm" aria-label="Edit identity and preferences">
            <Edit2 size={13} aria-hidden="true" /> Edit
          </button>
        )}
      </div>

      {!editing ? (
        <div className="space-y-5">
          {saved.isCouple ? (
            <>
              {saved.coupleType && <span className="inline-block bg-[#D4AF37]/15 border border-[#D4AF37]/40 text-[#D4AF37] text-xs font-bold px-2.5 py-1 rounded-full">{coupleTypeBadge(saved.coupleType)}</span>}
              <div className="grid sm:grid-cols-2 gap-5">
                <Summary person={{ ...saved.person, dateOfBirth: saved.dateOfBirth ?? undefined }} title={saved.person.name || 'Partner 1'} />
                {saved.linkedPartner ? (
                  <p className="text-white/60 text-sm">Linked with <a className="text-[#FF4D6D] hover:underline" href={`/members/${saved.linkedPartner.username}`}>@{saved.linkedPartner.username}</a> — they manage their own details.</p>
                ) : saved.partner2 ? (
                  <Summary person={saved.partner2} title={saved.partner2.name || 'Partner 2'} />
                ) : (
                  <p className="text-white/50 text-sm italic">Partner 2 hasn’t been added yet.</p>
                )}
              </div>
            </>
          ) : (
            <Summary person={saved.person} />
          )}
          <dl className="space-y-1.5 border-t border-white/5 pt-4">
            <div className="flex justify-between gap-3 text-sm"><dt className="text-white/55">Would like to meet</dt><dd className="text-white/85 text-right">{who || <span className="text-[#FF8FA3]">Not set</span>}</dd></div>
            <div className="flex justify-between gap-3 text-sm"><dt className="text-white/55">Here for</dt><dd className="text-white/85 text-right">{why || '—'}</dd></div>
            {saved.hasChildren && <div className="flex justify-between gap-3 text-sm"><dt className="text-white/55">Children</dt><dd className="text-white/85 text-right">{childrenLabelOf(saved.hasChildren)}</dd></div>}
          </dl>
          {notice && <p role="status" className="text-emerald-400 text-xs">{notice}</p>}
        </div>
      ) : (
        <div className="space-y-6">
          {!linked && (
            <ChipGroup
              legend="Profile type"
              clearable={false}
              options={[{ value: 'SINGLE', label: 'Single' }, { value: 'COUPLE', label: 'A couple' }]}
              value={d.isCouple ? 'COUPLE' : 'SINGLE'}
              onChange={(v) => set({ isCouple: v === 'COUPLE', partner2: v === 'COUPLE' ? (d.partner2 ?? { showGender: true, showOrientation: true }) : d.partner2 })}
            />
          )}

          {d.isCouple && (
            <>
              <div role="tablist" aria-label="Partner" className="grid grid-cols-2 gap-2">
                {[0, 1].map((i) => (
                  <button
                    key={i}
                    role="tab"
                    type="button"
                    aria-selected={tab === i}
                    onClick={() => setTab(i as 0 | 1)}
                    className={`min-h-[44px] rounded-xl text-sm font-medium flex items-center justify-center gap-2 ${tab === i ? 'bg-[#DC143C] text-white' : 'glass text-white/70 hover:text-white'}`}
                  >
                    {i === 0 ? <User size={14} aria-hidden="true" /> : <Users size={14} aria-hidden="true" />}
                    <span className="truncate">{i === 0 ? (d.person.name || 'Partner 1') : (d.partner2?.name || 'Partner 2')}</span>
                  </button>
                ))}
              </div>
              {tab === 1 && (linked ? (
                <p className="text-white/65 text-sm">Your partner @{d.linkedPartner!.username} edits their own details on their profile.</p>
              ) : (
                <div className="space-y-6">
                  {!d.partner2 ? (
                    <button type="button" onClick={() => set({ partner2: { showGender: true, showOrientation: true } })} className="w-full min-h-[44px] rounded-xl border border-dashed border-white/20 text-white/70 hover:text-white text-sm">Add partner 2’s details</button>
                  ) : (
                    <>
                      <PersonIdentityFields idPrefix="pe-p2" they withName withDob value={d.partner2} onChange={(patch) => set({ partner2: { ...d.partner2!, ...patch } })} />
                      <PersonDetailsFields idPrefix="pe-d2" they value={d.partner2} onChange={(patch) => set({ partner2: { ...d.partner2!, ...patch } })} />
                      <button type="button" onClick={() => set({ partner2: null })} className="text-xs text-white/50 hover:text-red-400">Remove partner 2’s details (e.g. they’ll link their own account)</button>
                    </>
                  )}
                </div>
              ))}
            </>
          )}

          {(!d.isCouple || tab === 0) && (
            <div className="space-y-6">
              <PersonIdentityFields
                idPrefix="pe-p1"
                withName={d.isCouple && !linked}
                lockedDob={d.isCouple ? d.dateOfBirth : null}
                value={d.person}
                onChange={(patch) => set({ person: { ...d.person, ...patch } })}
              />
              <PersonDetailsFields idPrefix="pe-d1" value={d.person} onChange={(patch) => set({ person: { ...d.person, ...patch } })} />
            </div>
          )}

          {d.isCouple && !linked && (derived || d.coupleType) && (
            <div>
              <label htmlFor="pe-ctype" className="block text-white/80 text-sm font-medium mb-2">Couple type</label>
              <select id="pe-ctype" value={d.coupleType ?? derived ?? ''} onChange={(e) => set({ coupleType: (e.target.value || null) as CoupleType | null })} className="input-dark w-full">
                {COUPLE_TYPE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.badge} — {o.label}</option>)}
              </select>
            </div>
          )}

          <div className="border-t border-white/5 pt-5">
            <MeetFields couple={d.isCouple} interestedIn={d.interestedIn} intentions={d.intentions} onChange={(patch) => set(patch)} />
          </div>
          <ChipGroup legend="Children" optional options={CHILDREN_OPTIONS} value={d.hasChildren ?? undefined} onChange={(v) => set({ hasChildren: (v as string | undefined) ?? null })} />

          <FieldError>{error}</FieldError>
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => { setEditing(false); setError(''); }} className="glass min-h-[44px] px-4 rounded-xl text-white/70 hover:text-white text-sm">Cancel</button>
            <button type="button" onClick={save} disabled={saving} className="min-h-[44px] bg-[#DC143C] hover:bg-[#FF1744] text-white px-5 rounded-xl text-sm font-semibold disabled:opacity-60">
              {saving ? 'Saving…' : 'Save'}
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
