'use client';

import { useId, useState } from 'react';
import { Check, EyeOff, Lock } from 'lucide-react';
import {
  BODY_TYPE_OPTIONS, DRINKING_OPTIONS, ETHNICITY_NOTE, ETHNICITY_SUGGESTIONS, GENDER_LABEL_SUGGESTIONS,
  GENDER_OPTIONS, INTENTION_OPTIONS, INTERESTED_IN_OPTIONS, LANGUAGE_OPTIONS, ORIENTATION_OPTIONS,
  SMOKING_OPTIONS, cmToFtIn, type PersonDetails,
} from '@/lib/identity';

// ── Primitives ──────────────────────────────────────────────────────────────

const chipBase = 'min-h-[44px] px-3.5 py-2 rounded-xl text-sm font-medium transition-all border text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D4AF37]';
const chipOn = 'bg-[#DC143C]/20 border-[#DC143C] text-white';
const chipOff = 'border-white/15 text-white/75 hover:text-white hover:border-white/30';

export function Label({ children, htmlFor, optional }: { children: React.ReactNode; htmlFor?: string; optional?: boolean }) {
  return (
    <label htmlFor={htmlFor} className="block text-white/80 text-sm font-medium mb-2">
      {children}{optional && <span className="text-white/45 font-normal"> · optional</span>}
    </label>
  );
}

export function FieldError({ id, children }: { id?: string; children?: React.ReactNode }) {
  if (!children) return null;
  return <p id={id} role="alert" className="text-[#FF8FA3] text-xs mt-1.5">{children}</p>;
}

interface ChipGroupProps<T extends string> {
  legend: string;
  options: { value: T; label: string }[];
  value: T | T[] | undefined | null;
  onChange: (v: T | T[] | undefined) => void;
  multiple?: boolean;
  optional?: boolean;
  hint?: string;
  error?: string;
  cols?: 2 | 3;
  /** Allow deselecting a single choice by tapping it again */
  clearable?: boolean;
}

/** Accessible group of toggle chips (single or multi select). */
export function ChipGroup<T extends string>({
  legend, options, value, onChange, multiple, optional, hint, error, cols = 2, clearable = true,
}: ChipGroupProps<T>) {
  const id = useId();
  const selected = Array.isArray(value) ? value : value ? [value] : [];
  function toggle(v: T) {
    if (multiple) {
      onChange(selected.includes(v) ? selected.filter((x) => x !== v) : [...selected, v]);
    } else {
      onChange(selected.includes(v) && clearable ? undefined : v);
    }
  }
  return (
    <fieldset aria-describedby={[hint ? `${id}-hint` : '', error ? `${id}-err` : ''].filter(Boolean).join(' ') || undefined}>
      <legend className="block text-white/80 text-sm font-medium mb-2">
        {legend}{optional && <span className="text-white/45 font-normal"> · optional</span>}
        {multiple && <span className="text-white/45 font-normal"> · choose any</span>}
      </legend>
      {hint && <p id={`${id}-hint`} className="text-white/55 text-xs -mt-1 mb-2">{hint}</p>}
      <div className={`grid gap-2 ${cols === 3 ? 'grid-cols-2 sm:grid-cols-3' : 'grid-cols-2'}`}>
        {options.map((o) => {
          const on = selected.includes(o.value);
          return (
            <button
              key={o.value}
              type="button"
              onClick={() => toggle(o.value)}
              aria-pressed={on}
              className={`${chipBase} ${on ? chipOn : chipOff} flex items-center gap-2`}
            >
              {multiple && (
                <span aria-hidden="true" className={`w-4 h-4 rounded border-2 flex items-center justify-center flex-shrink-0 ${on ? 'bg-[#DC143C] border-[#DC143C]' : 'border-white/30'}`}>
                  {on && <Check size={10} className="text-white" />}
                </span>
              )}
              <span className="min-w-0">{o.label}</span>
            </button>
          );
        })}
      </div>
      <FieldError id={`${id}-err`}>{error}</FieldError>
    </fieldset>
  );
}

export function Toggle({ checked, onChange, label, description }: {
  checked: boolean; onChange: (v: boolean) => void; label: string; description?: string;
}) {
  const id = useId();
  return (
    <div className="flex items-start justify-between gap-4">
      <div className="min-w-0">
        <label htmlFor={id} className="text-white/85 text-sm cursor-pointer">{label}</label>
        {description && <p id={`${id}-d`} className="text-white/55 text-xs mt-0.5 leading-relaxed">{description}</p>}
      </div>
      <button
        id={id}
        type="button"
        role="switch"
        aria-checked={checked}
        aria-describedby={description ? `${id}-d` : undefined}
        onClick={() => onChange(!checked)}
        className={`relative flex-shrink-0 w-11 h-6 rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D4AF37] ${checked ? 'bg-[#DC143C]' : 'bg-white/15'}`}
      >
        <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full transition-transform ${checked ? 'translate-x-5' : ''}`} />
      </button>
    </div>
  );
}

/** Chips plus a free-text "self-describe" option. */
function ChipsWithOther({
  legend, options, value, onChange, otherLabel, placeholder, optional, hint, error, maxLength = 40,
}: {
  legend: string; options: { value: string; label: string }[]; value?: string; onChange: (v: string | undefined) => void;
  otherLabel: string; placeholder: string; optional?: boolean; hint?: string; error?: string; maxLength?: number;
}) {
  const id = useId();
  const isKnown = !!value && options.some((o) => o.value === value);
  const [other, setOther] = useState(!!value && !isKnown);
  const opts = [...options, { value: '__other', label: otherLabel }];
  return (
    <div>
      <ChipGroup
        legend={legend}
        optional={optional}
        hint={hint}
        error={error}
        cols={3}
        options={opts}
        value={other ? '__other' : value}
        onChange={(v) => {
          if (v === '__other') { setOther(true); onChange(isKnown ? undefined : value); }
          else { setOther(false); onChange(v as string | undefined); }
        }}
      />
      {other && (
        <div className="mt-2">
          <label htmlFor={id} className="sr-only">{otherLabel}</label>
          <input
            id={id}
            type="text"
            maxLength={maxLength}
            value={isKnown ? '' : value ?? ''}
            onChange={(e) => onChange(e.target.value || undefined)}
            placeholder={placeholder}
            className="input-dark w-full"
            autoFocus
          />
        </div>
      )}
    </div>
  );
}

// ── Composite fields ────────────────────────────────────────────────────────

export interface PersonIdentityProps {
  value: PersonDetails;
  onChange: (patch: Partial<PersonDetails>) => void;
  /** Show name + date of birth (couple partner cards) */
  withName?: boolean;
  nameLabel?: string;
  withDob?: boolean;
  /** Read-only DOB note (account holder's DOB from sign-up) */
  lockedDob?: string | null;
  errors?: Partial<Record<'name' | 'gender' | 'dateOfBirth', string>>;
  idPrefix: string;
  /** "you" vs "they" wording */
  they?: boolean;
}

function maxAdultDob() {
  const d = new Date();
  d.setFullYear(d.getFullYear() - 18);
  return d.toISOString().slice(0, 10);
}

export function PersonIdentityFields({ value: v, onChange, withName, nameLabel = 'First name', withDob, lockedDob, errors = {}, idPrefix, they }: PersonIdentityProps) {
  return (
    <div className="space-y-5">
      {withName && (
        <div>
          <Label htmlFor={`${idPrefix}-name`}>{nameLabel}</Label>
          <input
            id={`${idPrefix}-name`}
            type="text"
            maxLength={40}
            value={v.name ?? ''}
            onChange={(e) => onChange({ name: e.target.value })}
            placeholder="e.g. Thandi"
            className="input-dark w-full"
            aria-invalid={!!errors.name}
            autoComplete="off"
          />
          <FieldError>{errors.name}</FieldError>
        </div>
      )}
      {withDob && (
        <div>
          <Label htmlFor={`${idPrefix}-dob`}>Date of birth</Label>
          <input
            id={`${idPrefix}-dob`}
            type="date"
            max={maxAdultDob()}
            min="1900-01-01"
            value={v.dateOfBirth ?? ''}
            onChange={(e) => onChange({ dateOfBirth: e.target.value || undefined })}
            className="input-dark w-full [color-scheme:dark]"
            aria-invalid={!!errors.dateOfBirth}
          />
          <p className="text-white/50 text-xs mt-1.5">Only their age is shown. Everyone on Unbound must be 18+.</p>
          <FieldError>{errors.dateOfBirth}</FieldError>
        </div>
      )}
      {lockedDob && (
        <p className="text-white/55 text-xs flex items-center gap-1.5">
          <Lock size={11} aria-hidden="true" /> Date of birth from sign-up: {new Date(`${lockedDob}T00:00:00`).toLocaleDateString('en-ZA', { day: 'numeric', month: 'long', year: 'numeric' })}
        </p>
      )}

      <div>
        <ChipGroup
          legend="Gender"
          options={GENDER_OPTIONS}
          value={v.gender === 'OTHER' ? 'NON_BINARY' : v.gender}
          onChange={(g) => onChange({ gender: g as PersonDetails['gender'] })}
          error={errors.gender}
          cols={3}
          clearable={false}
        />
        <div className="mt-2">
          <label htmlFor={`${idPrefix}-glabel`} className="block text-white/60 text-xs mb-1.5">
            Add more about {they ? 'their' : 'your'} gender <span className="text-white/40">· optional</span>
          </label>
          <input
            id={`${idPrefix}-glabel`}
            type="text"
            maxLength={40}
            list={`${idPrefix}-glabel-list`}
            value={v.genderLabel ?? ''}
            onChange={(e) => onChange({ genderLabel: e.target.value || undefined })}
            placeholder="e.g. Trans woman, Genderqueer, Two-spirit"
            className="input-dark w-full"
          />
          <datalist id={`${idPrefix}-glabel-list`}>
            {GENDER_LABEL_SUGGESTIONS.map((s) => <option key={s} value={s} />)}
          </datalist>
        </div>
      </div>

      <ChipsWithOther
        legend="Pronouns"
        optional
        options={[{ value: 'she/her', label: 'she/her' }, { value: 'he/him', label: 'he/him' }, { value: 'they/them', label: 'they/them' }]}
        value={v.pronouns}
        onChange={(p) => onChange({ pronouns: p })}
        otherLabel="Custom"
        placeholder="e.g. she/they, xe/xem"
        maxLength={30}
      />

      <ChipsWithOther
        legend="Orientation"
        optional
        options={ORIENTATION_OPTIONS}
        value={v.orientation}
        onChange={(o) => onChange({ orientation: o })}
        otherLabel="Self-describe"
        placeholder="In your own words"
      />

      <div className="rounded-xl border border-white/10 bg-white/[0.02] p-4 space-y-4">
        <Toggle
          checked={v.showGender !== false}
          onChange={(c) => onChange({ showGender: c })}
          label={`Show ${they ? 'their' : 'my'} gender on the profile`}
        />
        <Toggle
          checked={v.showOrientation !== false}
          onChange={(c) => onChange({ showOrientation: c })}
          label={`Show ${they ? 'their' : 'my'} orientation on the profile`}
        />
        <p className="text-white/55 text-xs leading-relaxed flex gap-2">
          <EyeOff size={13} className="flex-shrink-0 mt-0.5 text-white/45" aria-hidden="true" />
          Hidden details still help us match you with the right people, but are never shown to anyone.
          Some people hide them for safety or privacy, or because they&apos;re still exploring — that&apos;s completely fine.
        </p>
      </div>
    </div>
  );
}

export function MeetFields({ interestedIn, intentions, onChange, error, couple }: {
  interestedIn: string[]; intentions: string[];
  onChange: (patch: { interestedIn?: string[]; intentions?: string[] }) => void;
  error?: string; couple?: boolean;
}) {
  return (
    <div className="space-y-6">
      <ChipGroup
        legend={couple ? 'We’d like to meet' : 'I’d like to meet'}
        multiple
        options={INTERESTED_IN_OPTIONS}
        value={interestedIn as typeof INTERESTED_IN_OPTIONS[number]['value'][]}
        onChange={(v) => onChange({ interestedIn: (v as string[]) ?? [] })}
        hint="We only show you people who'd like to meet you too."
        error={error}
      />
      <ChipGroup
        legend={couple ? 'We’re here for' : 'I’m here for'}
        multiple
        optional
        options={INTENTION_OPTIONS}
        value={intentions}
        onChange={(v) => onChange({ intentions: (v as string[]) ?? [] })}
      />
    </div>
  );
}

export function PersonDetailsFields({ value: v, onChange, idPrefix, they }: {
  value: PersonDetails; onChange: (patch: Partial<PersonDetails>) => void; idPrefix: string; they?: boolean;
}) {
  const knownEth = !!v.ethnicity && ETHNICITY_SUGGESTIONS.includes(v.ethnicity);
  const [ethOther, setEthOther] = useState(!!v.ethnicity && !knownEth);
  const ft = cmToFtIn(v.heightCm);
  return (
    <div className="space-y-6">
      <div>
        <Label htmlFor={`${idPrefix}-height`} optional>Height</Label>
        <div className="flex items-center gap-3">
          <div className="relative w-32">
            <input
              id={`${idPrefix}-height`}
              type="number"
              inputMode="numeric"
              min={120}
              max={230}
              value={v.heightCm ?? ''}
              onChange={(e) => onChange({ heightCm: e.target.value ? Number(e.target.value) : undefined })}
              placeholder="170"
              className="input-dark w-full pr-10"
              aria-describedby={`${idPrefix}-height-ft`}
            />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-white/45 text-sm pointer-events-none">cm</span>
          </div>
          <span id={`${idPrefix}-height-ft`} className="text-white/60 text-sm" aria-live="polite">
            {ft && v.heightCm && v.heightCm >= 120 && v.heightCm <= 230 ? `≈ ${ft}` : ''}
          </span>
        </div>
      </div>

      <ChipGroup legend="Body type" optional cols={3} options={BODY_TYPE_OPTIONS} value={v.bodyType}
        onChange={(b) => onChange({ bodyType: b as string | undefined })} />

      <ChipGroup legend="Languages" multiple optional cols={3}
        options={LANGUAGE_OPTIONS.map((l) => ({ value: l, label: l }))}
        value={v.languages ?? []}
        onChange={(l) => onChange({ languages: (l as string[]) ?? [] })} />

      <ChipGroup legend="Drinking" optional cols={3} options={DRINKING_OPTIONS} value={v.drinking}
        onChange={(d) => onChange({ drinking: d as string | undefined })} />

      <ChipGroup legend="Smoking" optional cols={2} options={SMOKING_OPTIONS} value={v.smoking}
        onChange={(d) => onChange({ smoking: d as string | undefined })} />

      <div className="rounded-xl border border-white/10 bg-white/[0.02] p-4">
        <ChipGroup
          legend="Ethnicity"
          optional
          cols={2}
          hint={ETHNICITY_NOTE}
          options={[...ETHNICITY_SUGGESTIONS.map((e) => ({ value: e, label: e })), { value: '__other', label: 'Prefer to self-describe' }]}
          value={ethOther ? '__other' : v.ethnicity}
          onChange={(e) => {
            if (e === '__other') { setEthOther(true); onChange({ ethnicity: knownEth ? undefined : v.ethnicity }); }
            else { setEthOther(false); onChange({ ethnicity: e as string | undefined, ...(e ? {} : { showEthnicity: false }) }); }
          }}
        />
        {ethOther && (
          <div className="mt-2">
            <label htmlFor={`${idPrefix}-eth`} className="sr-only">Ethnicity, in your own words</label>
            <input
              id={`${idPrefix}-eth`}
              type="text"
              maxLength={40}
              value={knownEth ? '' : v.ethnicity ?? ''}
              onChange={(e) => onChange({ ethnicity: e.target.value || undefined })}
              placeholder="In your own words"
              className="input-dark w-full"
            />
          </div>
        )}
        {v.ethnicity && (
          <div className="mt-4">
            <Toggle
              checked={!!v.showEthnicity}
              onChange={(c) => onChange({ showEthnicity: c })}
              label={`Show ${they ? 'their' : 'my'} ethnicity on the profile`}
              description="Off by default. It's never used for search, filters or matching."
            />
          </div>
        )}
      </div>
    </div>
  );
}
