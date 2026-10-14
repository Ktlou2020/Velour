'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { ChevronLeft, ChevronRight, Check, Upload, X, Camera, User, Users, Plus, Trash2, Link2, Info } from 'lucide-react';
import { LogoMark } from '@/components/Logo';
import { useToast } from '@/lib/toast-context';
import { CITIES_BY_COUNTRY, COUNTRIES } from '@/lib/cities';
import {
  CHILDREN_OPTIONS, COUPLE_TYPE_OPTIONS, deriveCoupleType, isAdult,
  type CoupleType, type PersonDetails,
} from '@/lib/identity';
import { PROFILE_PROMPT_QUESTIONS, MAX_PROMPTS, MAX_PROMPT_ANSWER, type ProfilePrompt } from '@/app/profile/prompts';
import {
  ChipGroup, FieldError, Label, MeetFields, PersonDetailsFields, PersonIdentityFields,
} from '@/app/profile/identity/fields';

interface UploadedPhoto { id: string; url: string }

interface State {
  isCouple: boolean;
  linkedPartner: string | null;
  dateOfBirth: string | null;
  displayName: string;
  country: string;
  city: string;
  person: PersonDetails;      // individual, or partner 1
  partner2: PersonDetails;
  partnerOwnAccount: boolean;
  inviteUsername: string;
  coupleTypeOverride: CoupleType | null;
  interestedIn: string[];
  intentions: string[];
  hasChildren?: string;
  bio: string;
  prompts: ProfilePrompt[];
}

type Errors = Partial<Record<
  'displayName' | 'city' | 'gender' | 'p1name' | 'p1gender' | 'p2name' | 'p2gender' | 'p2dob' | 'invite' | 'interestedIn',
  string
>>;

const STEP_KEYS = ['about', 'meet', 'details', 'photos', 'bio'] as const;
const OPTIONAL_STEPS = new Set([2, 3, 4]);

function stepTitles(couple: boolean) {
  return couple
    ? ['About you two', 'Who you’d like to meet', 'About you both', 'Photos', 'Your story']
    : ['About you', 'Who you’d like to meet', 'About me', 'Photos', 'Your story'];
}

function storageKey(uid: string) { return `hush_onboarding:${uid}`; }
function readSaved(uid: string): { step?: number; partnerOwnAccount?: boolean } {
  try { return JSON.parse(localStorage.getItem(storageKey(uid)) || '{}'); } catch { return {}; }
}
function writeSaved(uid: string, v: { step?: number; partnerOwnAccount?: boolean }) {
  try { localStorage.setItem(storageKey(uid), JSON.stringify({ ...readSaved(uid), ...v })); } catch { /* private mode */ }
}
function clearSaved(uid: string) {
  try { localStorage.removeItem(storageKey(uid)); } catch { /* ignore */ }
}

/** Person → API shape; undefined becomes null so cleared fields are cleared. */
function personPayload(p: PersonDetails): Record<string, unknown> {
  return {
    name: p.name?.trim() || undefined, gender: p.gender, genderLabel: p.genderLabel, pronouns: p.pronouns,
    dateOfBirth: p.dateOfBirth, orientation: p.orientation, showGender: p.showGender !== false,
    showOrientation: p.showOrientation !== false, heightCm: p.heightCm, bodyType: p.bodyType,
    ethnicity: p.ethnicity, showEthnicity: !!p.showEthnicity && !!p.ethnicity, languages: p.languages ?? [],
    drinking: p.drinking, smoking: p.smoking,
  };
}

export default function OnboardingPage() {
  const router = useRouter();
  const { data: session, status } = useSession();
  const { showToast } = useToast();
  const uid = (session?.user as { id?: string } | undefined)?.id ?? '';
  const fileInputRef = useRef<HTMLInputElement>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);

  const [loaded, setLoaded] = useState(false);
  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [errors, setErrors] = useState<Errors>({});
  const [photos, setPhotos] = useState<UploadedPhoto[]>([]);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [inviteSentTo, setInviteSentTo] = useState<string | null>(null);
  const [s, setS] = useState<State>({
    isCouple: false, linkedPartner: null, dateOfBirth: null, displayName: '', country: 'South Africa', city: '',
    person: { showGender: true, showOrientation: true }, partner2: { showGender: true, showOrientation: true },
    partnerOwnAccount: false, inviteUsername: '', coupleTypeOverride: null,
    interestedIn: [], intentions: [], bio: '', prompts: [],
  });

  const set = useCallback((patch: Partial<State>) => setS((prev) => ({ ...prev, ...patch })), []);
  const titles = stepTitles(s.isCouple);

  // ── Load saved profile & resume ───────────────────────────────────────────
  useEffect(() => {
    if (status !== 'authenticated' || !uid) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/onboarding');
        if (!res.ok) throw new Error();
        const { profile: p, photos: ph } = await res.json() as {
          profile: Record<string, unknown> & { coupleMembers: PersonDetails[]; prompts: ProfilePrompt[] };
          photos: UploadedPhoto[];
        };
        if (cancelled) return;
        const saved = readSaved(uid);
        const base: PersonDetails = {
          name: undefined,
          gender: (p.gender as PersonDetails['gender']) ?? undefined,
          genderLabel: (p.genderLabel as string) || undefined,
          pronouns: (p.pronouns as string) || undefined,
          orientation: (p.orientation as string) || undefined,
          showGender: p.showGender !== false,
          showOrientation: p.showOrientation !== false,
          heightCm: (p.heightCm as number) ?? undefined,
          bodyType: (p.bodyType as string) ?? undefined,
          ethnicity: (p.ethnicity as string) || undefined,
          showEthnicity: !!p.showEthnicity,
          languages: (p.languages as string[]) ?? [],
          drinking: (p.drinking as string) ?? undefined,
          smoking: (p.smoking as string) ?? undefined,
        };
        const members = p.coupleMembers ?? [];
        const isCouple = !!p.isCouple;
        const person = isCouple && members[0] ? { ...base, ...members[0] } : base;
        const partner2 = members[1] ?? { showGender: true, showOrientation: true };
        const linkedPartner = (p.partnerUsername as string) ?? null;
        const country = (p.country as string) || 'South Africa';
        setS({
          isCouple, linkedPartner, dateOfBirth: (p.dateOfBirth as string) ?? null,
          displayName: (p.displayName as string) ?? '', country, city: (p.city as string) ?? '',
          person, partner2,
          partnerOwnAccount: !!linkedPartner || !!saved.partnerOwnAccount,
          inviteUsername: '', coupleTypeOverride: (p.coupleType as CoupleType) ?? null,
          interestedIn: (p.interestedIn as string[]) ?? [], intentions: (p.intentions as string[]) ?? [],
          hasChildren: (p.hasChildren as string) ?? undefined,
          bio: (p.bio as string) ?? '', prompts: p.prompts ?? [],
        });
        setPhotos(ph ?? []);
        // Resume: where they left off, or the first required step that's missing.
        const firstMissing = !p.displayName || (!p.gender && !isCouple) ? 0 : !(p.interestedIn as string[])?.length ? 1 : 2;
        const resumeAt = firstMissing < 2 ? Math.min(firstMissing, saved.step ?? firstMissing) : (saved.step ?? 2);
        setStep(Math.max(0, Math.min(STEP_KEYS.length - 1, resumeAt)));
      } catch {
        setSaveError('We couldn’t load your details. Please refresh the page.');
      } finally {
        if (!cancelled) setLoaded(true);
      }
    })();
    return () => { cancelled = true; };
  }, [status, uid]);

  // Move focus to the step heading for keyboard & screen-reader users.
  useEffect(() => {
    if (loaded) headingRef.current?.focus();
    if (loaded && uid) writeSaved(uid, { step });
  }, [step, loaded, uid]);

  const derivedType = useMemo(
    () => (s.isCouple && !s.partnerOwnAccount ? deriveCoupleType(s.person.gender, s.partner2.gender) : null),
    [s.isCouple, s.partnerOwnAccount, s.person.gender, s.partner2.gender],
  );
  const coupleType = s.coupleTypeOverride ?? derivedType;

  // ── Validation & payloads ─────────────────────────────────────────────────
  function validate(): Errors {
    const e: Errors = {};
    if (step === 0) {
      if (!s.displayName.trim()) e.displayName = s.isCouple ? 'Add a name for the two of you, e.g. “Thandi & Sipho”' : 'Please add a display name';
      if (!s.city.trim()) e.city = 'Please choose your city';
      if (s.isCouple) {
        if (!s.person.name?.trim()) e.p1name = 'Please add a first name';
        if (!s.person.gender) e.p1gender = 'Please choose a gender';
        if (!s.partnerOwnAccount) {
          if (!s.partner2.name?.trim()) e.p2name = 'Please add your partner’s first name';
          if (!s.partner2.gender) e.p2gender = 'Please choose a gender';
          if (!s.partner2.dateOfBirth) e.p2dob = 'Please add your partner’s date of birth';
          else if (!isAdult(s.partner2.dateOfBirth)) e.p2dob = 'Both of you need to be 18 or older';
        }
      } else if (!s.person.gender) e.gender = 'Please choose the option that fits best';
    }
    if (step === 1 && s.interestedIn.length === 0) e.interestedIn = 'Choose at least one';
    return e;
  }

  function coupleMembersPayload() {
    const p1 = personPayload(s.person);
    delete p1.dateOfBirth; // set server-side from sign-up
    return s.partnerOwnAccount ? [p1] : [p1, personPayload(s.partner2)];
  }

  function payloadFor(i: number): Record<string, unknown> | null {
    if (i === 0) {
      const common = { displayName: s.displayName.trim(), country: s.country, city: s.city.trim(), isCouple: s.isCouple };
      if (s.isCouple) return { ...common, coupleMembers: coupleMembersPayload(), coupleType: coupleType ?? null };
      const p = personPayload(s.person);
      return {
        ...common, gender: p.gender, genderLabel: p.genderLabel ?? null, pronouns: p.pronouns ?? null,
        orientation: p.orientation ?? null, showGender: p.showGender, showOrientation: p.showOrientation,
      };
    }
    if (i === 1) return { interestedIn: s.interestedIn, intentions: s.intentions };
    if (i === 2) {
      if (s.isCouple) return { coupleMembers: coupleMembersPayload(), coupleType: coupleType ?? null, hasChildren: s.hasChildren ?? null };
      const p = personPayload(s.person);
      return {
        heightCm: p.heightCm ?? null, bodyType: p.bodyType ?? null, languages: p.languages,
        drinking: p.drinking ?? null, smoking: p.smoking ?? null, ethnicity: p.ethnicity ?? null,
        showEthnicity: p.showEthnicity, hasChildren: s.hasChildren ?? null,
      };
    }
    if (i === 4) {
      return {
        bio: s.bio.trim() || null,
        prompts: s.prompts.filter((p) => p.answer.trim()).map((p) => ({ question: p.question, answer: p.answer.trim() })),
      };
    }
    return null;
  }

  async function save(i: number) {
    const body = payloadFor(i);
    if (!body) return;
    const res = await fetch('/api/onboarding', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const d = await res.json().catch(() => ({})) as { error?: string };
      throw new Error(d.error || 'Couldn’t save — please try again');
    }
  }

  async function sendInviteIfNeeded(): Promise<boolean> {
    const u = s.inviteUsername.trim().replace(/^@/, '');
    if (!s.isCouple || !s.partnerOwnAccount || s.linkedPartner || !u || inviteSentTo === u) return true;
    const res = await fetch('/api/couple/invite', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ partnerUsername: u }),
    });
    if (!res.ok) {
      const d = await res.json().catch(() => ({})) as { error?: string };
      setErrors((prev) => ({ ...prev, invite: d.error || 'Couldn’t send the invitation' }));
      return false;
    }
    setInviteSentTo(u);
    return true;
  }

  function finish() {
    if (uid) clearSaved(uid);
    const first = s.isCouple ? s.displayName.trim() : (s.displayName.trim().split(' ')[0] || '');
    showToast(`Welcome to Hush${first ? `, ${first}` : ''}! Here are people who'd like to meet you too.`, 'success');
    router.push('/discover');
    router.refresh();
  }

  async function next(e?: React.FormEvent) {
    e?.preventDefault();
    const errs = validate();
    setErrors(errs);
    if (Object.keys(errs).length) {
      const firstKey = Object.keys(errs)[0];
      document.querySelector<HTMLElement>(`[data-err="${firstKey}"] input, [data-err="${firstKey}"] button, [data-err="${firstKey}"] select`)?.focus();
      return;
    }
    setSaveError('');
    setSaving(true);
    try {
      await save(step);
      if (step === 0 && !(await sendInviteIfNeeded())) return;
      if (step < STEP_KEYS.length - 1) setStep(step + 1);
      else finish();
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Couldn’t save — please try again');
    } finally {
      setSaving(false);
    }
  }

  function skip() {
    setErrors({});
    setSaveError('');
    if (step < STEP_KEYS.length - 1) setStep(step + 1);
    else finish();
  }

  // ── Photos (request contract unchanged: /api/upload then /api/photos) ────
  async function handlePhotoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setSaveError('');
    setUploadingPhoto(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const uploadRes = await fetch('/api/upload', { method: 'POST', body: formData });
      if (!uploadRes.ok) throw new Error('Upload failed — please try another photo');
      const uploadData = await uploadRes.json();
      const photoRes = await fetch('/api/photos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: uploadData.url, filename: file.name }),
      });
      if (!photoRes.ok) throw new Error('Failed to save photo');
      const photoData = await photoRes.json();
      const id = photoData.id || photoData.photo?.id || Date.now().toString();
      setPhotos((prev) => [...prev, { id, url: uploadData.url }]);
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Photo upload failed');
    } finally {
      setUploadingPhoto(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }

  // ── Render ────────────────────────────────────────────────────────────────
  const progress = ((step + 1) / STEP_KEYS.length) * 100;
  const cities = CITIES_BY_COUNTRY[s.country] ?? [];
  const isLast = step === STEP_KEYS.length - 1;

  if (!loaded) {
    return (
      <div className="min-h-screen bg-[#0A0A0F] flex items-center justify-center px-4" aria-busy="true">
        <div className="w-full max-w-lg space-y-4">
          <div className="h-2 rounded-full skeleton" />
          <div className="glass rounded-3xl p-6 space-y-4">
            <div className="h-6 w-1/2 rounded skeleton" />
            <div className="h-12 rounded-xl skeleton" />
            <div className="h-12 rounded-xl skeleton" />
            <div className="h-12 rounded-xl skeleton" />
          </div>
          <span className="sr-only">Loading your profile…</span>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0A0A0F] px-4 py-8 sm:py-12">
      <div className="w-full max-w-lg mx-auto">
        <div className="text-center mb-6">
          <div className="inline-flex items-center gap-2 mb-2">
            <LogoMark size="md" />
            <span className="text-white font-bold text-2xl tracking-widest font-serif">HUSH</span>
          </div>
          <p className="text-white/65 text-sm">A few details and you’re in. You can change everything later.</p>
        </div>

        {/* Progress */}
        <div className="mb-6">
          <div className="flex justify-between text-xs text-white/60 mb-2">
            <span>Step {step + 1} of {STEP_KEYS.length}</span>
            <span>{OPTIONAL_STEPS.has(step) ? 'Optional' : 'Required'}</span>
          </div>
          <div className="h-1.5 bg-white/10 rounded-full overflow-hidden" role="progressbar" aria-label="Onboarding progress" aria-valuenow={step + 1} aria-valuemin={1} aria-valuemax={STEP_KEYS.length} aria-valuetext={`Step ${step + 1} of ${STEP_KEYS.length}: ${titles[step]}`}>
            <div className="h-full bg-gradient-to-r from-[#DC143C] to-[#8F0D25] rounded-full transition-all duration-500" style={{ width: `${progress}%` }} />
          </div>
        </div>

        <form onSubmit={next} noValidate className="glass rounded-3xl p-5 sm:p-8">
          <h1 ref={headingRef} tabIndex={-1} className="font-serif text-2xl font-bold text-white mb-1 focus:outline-none">{titles[step]}</h1>
          <p className="text-white/65 text-sm mb-7">
            {step === 0 && (s.isCouple ? 'Tell members a little about each of you.' : 'Just the basics to get you started.')}
            {step === 1 && 'We’ll only show you people who’d like to meet you too.'}
            {step === 2 && 'All optional — share what you’re comfortable with.'}
            {step === 3 && (s.isCouple ? 'A clear photo of you both makes saying hello easier.' : 'A clear photo makes saying hello easier.')}
            {step === 4 && 'Say hello in your own words. Optional — you can add this later.'}
          </p>

          {/* ── Step 1: About you / About you two ── */}
          {step === 0 && (
            <div className="space-y-6">
              {!s.linkedPartner && (
                <ChipGroup
                  legend="Joining as"
                  cols={2}
                  clearable={false}
                  options={[{ value: 'SINGLE', label: 'Single' }, { value: 'COUPLE', label: 'A couple' }]}
                  value={s.isCouple ? 'COUPLE' : 'SINGLE'}
                  onChange={(v) => set({ isCouple: v === 'COUPLE' })}
                />
              )}

              <div data-err="displayName">
                <Label htmlFor="ob-name">{s.isCouple ? 'Couple display name' : 'Display name'}</Label>
                <input
                  id="ob-name"
                  type="text"
                  maxLength={50}
                  value={s.displayName}
                  onChange={(e) => { set({ displayName: e.target.value }); setErrors((p) => ({ ...p, displayName: undefined })); }}
                  placeholder={s.isCouple ? 'e.g. Thandi & Sipho' : 'How should we call you?'}
                  className="input-dark w-full"
                  aria-invalid={!!errors.displayName}
                  autoComplete="nickname"
                />
                <FieldError>{errors.displayName}</FieldError>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4" data-err="city">
                <div>
                  <Label htmlFor="ob-country">Country</Label>
                  <select id="ob-country" value={s.country} onChange={(e) => set({ country: e.target.value, city: '' })} className="input-dark w-full">
                    {COUNTRIES.map((c) => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div>
                  <Label htmlFor="ob-city">City</Label>
                  {cities.length ? (
                    <select id="ob-city" value={s.city} onChange={(e) => { set({ city: e.target.value }); setErrors((p) => ({ ...p, city: undefined })); }} className="input-dark w-full" aria-invalid={!!errors.city}>
                      <option value="">Choose your city</option>
                      {cities.map((c) => <option key={c} value={c}>{c}</option>)}
                      {s.city && !cities.includes(s.city) && <option value={s.city}>{s.city}</option>}
                    </select>
                  ) : (
                    <input id="ob-city" type="text" maxLength={60} value={s.city} onChange={(e) => set({ city: e.target.value })} className="input-dark w-full" placeholder="Your city" aria-invalid={!!errors.city} />
                  )}
                  <FieldError>{errors.city}</FieldError>
                </div>
              </div>

              {!s.isCouple ? (
                <div data-err="gender">
                  <PersonIdentityFields
                    idPrefix="ob-me"
                    value={s.person}
                    onChange={(patch) => { set({ person: { ...s.person, ...patch } }); setErrors((p) => ({ ...p, gender: undefined })); }}
                    errors={{ gender: errors.gender }}
                  />
                </div>
              ) : (
                <>
                  <section className="rounded-2xl border border-white/10 p-4 sm:p-5" aria-labelledby="ob-p1-h" data-err="p1name">
                    <h2 id="ob-p1-h" className="text-white font-semibold mb-4 flex items-center gap-2"><User size={16} className="text-[#FF4D6D]" aria-hidden="true" />Partner 1 <span className="text-white/45 font-normal text-sm">(you)</span></h2>
                    <PersonIdentityFields
                      idPrefix="ob-p1"
                      value={s.person}
                      onChange={(patch) => { set({ person: { ...s.person, ...patch } }); setErrors((p) => ({ ...p, p1name: undefined, p1gender: undefined })); }}
                      withName
                      lockedDob={s.dateOfBirth}
                      errors={{ name: errors.p1name, gender: errors.p1gender }}
                    />
                  </section>

                  <section className="rounded-2xl border border-white/10 p-4 sm:p-5" aria-labelledby="ob-p2-h" data-err="p2name">
                    <h2 id="ob-p2-h" className="text-white font-semibold mb-4 flex items-center gap-2"><Users size={16} className="text-[#D4AF37]" aria-hidden="true" />Partner 2</h2>
                    {s.linkedPartner ? (
                      <p className="text-white/70 text-sm flex items-center gap-2"><Link2 size={14} className="text-emerald-400" aria-hidden="true" />Linked with @{s.linkedPartner} — their details come from their own profile.</p>
                    ) : (
                      <>
                        <label className="flex items-start gap-3 cursor-pointer mb-5">
                          <input
                            type="checkbox"
                            checked={s.partnerOwnAccount}
                            onChange={(e) => { set({ partnerOwnAccount: e.target.checked }); if (uid) writeSaved(uid, { partnerOwnAccount: e.target.checked }); }}
                            className="mt-1 w-4 h-4 accent-[#DC143C]"
                          />
                          <span className="text-sm text-white/80">
                            My partner will join with their own account
                            <span className="block text-white/50 text-xs mt-0.5">You’ll link your profiles so you appear as a couple. Each of you keeps your own login.</span>
                          </span>
                        </label>
                        {s.partnerOwnAccount ? (
                          <div data-err="invite">
                            <Label htmlFor="ob-invite" optional>Partner’s Hush username</Label>
                            <input
                              id="ob-invite"
                              type="text"
                              value={s.inviteUsername}
                              onChange={(e) => { set({ inviteUsername: e.target.value }); setErrors((p) => ({ ...p, invite: undefined })); }}
                              placeholder="e.g. sipho_j"
                              className="input-dark w-full"
                              autoCapitalize="none"
                              spellCheck={false}
                              aria-invalid={!!errors.invite}
                            />
                            <FieldError>{errors.invite}</FieldError>
                            {inviteSentTo ? (
                              <p className="text-emerald-400 text-xs mt-1.5" role="status">Invitation sent to @{inviteSentTo}.</p>
                            ) : (
                              <p className="text-white/50 text-xs mt-1.5">We’ll send them an invitation to link. Not on Hush yet? Ask them to sign up, then invite them from your profile.</p>
                            )}
                          </div>
                        ) : (
                          <div data-err="p2gender">
                            <PersonIdentityFields
                              idPrefix="ob-p2"
                              value={s.partner2}
                              onChange={(patch) => { set({ partner2: { ...s.partner2, ...patch } }); setErrors((p) => ({ ...p, p2name: undefined, p2gender: undefined, p2dob: undefined })); }}
                              withName
                              withDob
                              they
                              errors={{ name: errors.p2name, gender: errors.p2gender, dateOfBirth: errors.p2dob }}
                            />
                          </div>
                        )}
                      </>
                    )}
                  </section>

                  {(derivedType || s.coupleTypeOverride) && (
                    <div>
                      <Label htmlFor="ob-ctype">Couple type</Label>
                      <select
                        id="ob-ctype"
                        value={coupleType ?? ''}
                        onChange={(e) => set({ coupleTypeOverride: (e.target.value || null) as CoupleType | null })}
                        className="input-dark w-full"
                      >
                        {COUPLE_TYPE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.badge} — {o.label}</option>)}
                      </select>
                      <p className="text-white/50 text-xs mt-1.5">Worked out from your genders — change it if another label fits you better.</p>
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          {/* ── Step 2: Who you'd like to meet ── */}
          {step === 1 && (
            <div data-err="interestedIn">
              <MeetFields
                couple={s.isCouple}
                interestedIn={s.interestedIn}
                intentions={s.intentions}
                onChange={(patch) => { set(patch); setErrors((p) => ({ ...p, interestedIn: undefined })); }}
                error={errors.interestedIn}
              />
            </div>
          )}

          {/* ── Step 3: About me details ── */}
          {step === 2 && (
            <div className="space-y-6">
              {s.isCouple ? (
                <>
                  <section className="rounded-2xl border border-white/10 p-4 sm:p-5" aria-labelledby="ob-d1-h">
                    <h2 id="ob-d1-h" className="text-white font-semibold mb-4">{s.person.name || 'Partner 1'}</h2>
                    <PersonDetailsFields idPrefix="ob-d1" value={s.person} onChange={(patch) => set({ person: { ...s.person, ...patch } })} />
                  </section>
                  {!s.partnerOwnAccount && (
                    <section className="rounded-2xl border border-white/10 p-4 sm:p-5" aria-labelledby="ob-d2-h">
                      <h2 id="ob-d2-h" className="text-white font-semibold mb-4">{s.partner2.name || 'Partner 2'}</h2>
                      <PersonDetailsFields idPrefix="ob-d2" they value={s.partner2} onChange={(patch) => set({ partner2: { ...s.partner2, ...patch } })} />
                    </section>
                  )}
                </>
              ) : (
                <PersonDetailsFields idPrefix="ob-d" value={s.person} onChange={(patch) => set({ person: { ...s.person, ...patch } })} />
              )}
              <ChipGroup
                legend="Children"
                optional
                cols={2}
                options={CHILDREN_OPTIONS}
                value={s.hasChildren}
                onChange={(v) => set({ hasChildren: v as string | undefined })}
              />
            </div>
          )}

          {/* ── Step 4: Photos ── */}
          {step === 3 && (
            <div className="space-y-6">
              <div className="grid grid-cols-3 gap-3">
                {photos.map((photo) => (
                  <div key={photo.id} className="relative aspect-square rounded-xl overflow-hidden group">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={photo.url} alt="Your uploaded photo" className="w-full h-full object-cover" />
                    <button
                      type="button"
                      onClick={() => setPhotos((prev) => prev.filter((p) => p.id !== photo.id))}
                      className="absolute top-1.5 right-1.5 w-8 h-8 bg-black/70 rounded-full flex items-center justify-center sm:opacity-0 sm:group-hover:opacity-100 focus:opacity-100 transition-opacity"
                      aria-label="Hide photo from this list"
                    >
                      <X size={14} className="text-white" />
                    </button>
                  </div>
                ))}
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploadingPhoto}
                  className="aspect-square rounded-xl border-2 border-dashed border-white/20 hover:border-[#DC143C]/60 flex flex-col items-center justify-center gap-2 transition-all hover:bg-white/5"
                  aria-label="Add photo"
                >
                  {uploadingPhoto
                    ? <div className="w-6 h-6 border-2 border-[#DC143C] border-t-transparent rounded-full animate-spin" />
                    : <><Upload size={20} className="text-white/55" /><span className="text-white/55 text-xs">Add photo</span></>}
                </button>
              </div>
              <input ref={fileInputRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={handlePhotoUpload} />
              <div className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/[0.02] p-4">
                <Camera size={20} className="text-[#DC143C] flex-shrink-0" aria-hidden="true" />
                <p className="text-white/65 text-xs leading-relaxed">
                  {s.isCouple ? 'One of you both works well. ' : ''}JPEG, PNG or WebP, up to 10MB each. You can mark photos private on your profile.
                </p>
              </div>
            </div>
          )}

          {/* ── Step 5: Bio + prompts ── */}
          {step === 4 && (
            <div className="space-y-6">
              <div>
                <Label htmlFor="ob-bio" optional>{s.isCouple ? 'About us' : 'About me'}</Label>
                <textarea
                  id="ob-bio"
                  value={s.bio}
                  onChange={(e) => set({ bio: e.target.value.slice(0, 500) })}
                  placeholder={s.isCouple ? 'Who are you two, and what are you hoping to find here?' : 'A little about you, your lifestyle and what you’re hoping to find…'}
                  className="input-dark w-full resize-none"
                  rows={5}
                  aria-describedby="ob-bio-count"
                />
                <p id="ob-bio-count" className="text-white/50 text-xs mt-1 text-right">{s.bio.length}/500</p>
              </div>

              <div>
                <p className="text-white/80 text-sm font-medium mb-1">Prompts <span className="text-white/45 font-normal">· optional</span></p>
                <p className="text-white/55 text-xs mb-3">Answer up to {MAX_PROMPTS} — they make great conversation starters.</p>
                <div className="space-y-3">
                  {s.prompts.map((pr, i) => {
                    const used = new Set(s.prompts.map((x) => x.question));
                    return (
                      <div key={i} className="rounded-xl border border-white/10 p-3 space-y-2">
                        <div className="flex gap-2">
                          <label htmlFor={`ob-pq-${i}`} className="sr-only">Prompt {i + 1}</label>
                          <select
                            id={`ob-pq-${i}`}
                            value={pr.question}
                            onChange={(e) => set({ prompts: s.prompts.map((x, j) => (j === i ? { ...x, question: e.target.value } : x)) })}
                            className="input-dark flex-1 min-w-0 text-sm"
                          >
                            {PROFILE_PROMPT_QUESTIONS.filter((q) => q === pr.question || !used.has(q)).map((q) => <option key={q} value={q}>{q}</option>)}
                          </select>
                          <button
                            type="button"
                            onClick={() => set({ prompts: s.prompts.filter((_, j) => j !== i) })}
                            className="w-11 h-11 flex-shrink-0 rounded-xl border border-white/10 flex items-center justify-center text-white/55 hover:text-red-400"
                            aria-label={`Remove prompt ${i + 1}`}
                          >
                            <Trash2 size={15} />
                          </button>
                        </div>
                        <label htmlFor={`ob-pa-${i}`} className="sr-only">Your answer</label>
                        <textarea
                          id={`ob-pa-${i}`}
                          value={pr.answer}
                          maxLength={MAX_PROMPT_ANSWER}
                          onChange={(e) => set({ prompts: s.prompts.map((x, j) => (j === i ? { ...x, answer: e.target.value } : x)) })}
                          className="input-dark w-full resize-none text-sm"
                          rows={2}
                          placeholder="Your answer"
                        />
                      </div>
                    );
                  })}
                  {s.prompts.length < MAX_PROMPTS && (
                    <button
                      type="button"
                      onClick={() => {
                        const used = new Set(s.prompts.map((x) => x.question));
                        const q = PROFILE_PROMPT_QUESTIONS.find((x) => !used.has(x));
                        if (q) set({ prompts: [...s.prompts, { question: q, answer: '' }] });
                      }}
                      className="w-full min-h-[44px] rounded-xl border border-dashed border-white/20 text-white/70 hover:text-white hover:border-white/40 text-sm flex items-center justify-center gap-2"
                    >
                      <Plus size={15} aria-hidden="true" /> Add a prompt
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}

          {saveError && (
            <div role="alert" className="mt-5 px-4 py-3 bg-red-500/10 border border-red-500/30 rounded-xl text-red-300 text-sm">{saveError}</div>
          )}

          {step === 0 && (
            <p className="mt-6 text-white/45 text-xs flex gap-2"><Info size={13} className="flex-shrink-0 mt-0.5" aria-hidden="true" />Women, men, non-binary people and couples of every kind are welcome on Hush.</p>
          )}

          {/* Navigation */}
          <div className="flex items-center justify-between gap-3 mt-7 pt-5 border-t border-white/10">
            {step > 0 ? (
              <button type="button" onClick={() => { setErrors({}); setStep(step - 1); }} className="min-h-[44px] flex items-center gap-1.5 text-white/65 hover:text-white text-sm px-1">
                <ChevronLeft size={16} aria-hidden="true" /> Back
              </button>
            ) : <span />}
            <div className="flex items-center gap-2 sm:gap-3">
              {OPTIONAL_STEPS.has(step) && (
                <button type="button" onClick={skip} className="min-h-[44px] text-white/60 hover:text-white text-sm px-2">
                  {step === 3 ? 'Add photos later' : 'Skip for now'}
                </button>
              )}
              <button
                type="submit"
                disabled={saving || uploadingPhoto}
                className="min-h-[44px] flex items-center gap-2 bg-gradient-to-r from-[#DC143C] to-[#8F0D25] hover:from-[#FF1744] hover:to-[#DC143C] text-white px-5 sm:px-6 py-3 rounded-xl font-semibold text-sm transition-all disabled:opacity-60"
              >
                {saving && <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" aria-hidden="true" />}
                {isLast ? 'Finish' : 'Continue'}
                {!isLast && !saving && <ChevronRight size={16} aria-hidden="true" />}
                {isLast && !saving && <Check size={16} aria-hidden="true" />}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
