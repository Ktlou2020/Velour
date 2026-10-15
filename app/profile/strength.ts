/**
 * Profile strength — a friendlier, more complete take on completeness.
 * Pure: computed on the server for the first render and again on the client
 * as photos are added. The identity completeness fields (lib/identity) are the
 * base; photos, prompts, intentions and pronouns/partner details add the rest.
 */
import { COMPLETENESS_FIELDS, type CompletenessField } from '@/lib/identity';

export interface StrengthFacts {
  missing: CompletenessField[];
  publicPhotos: number;
  prompts: number;
  hasIntentions: boolean;
  isCouple: boolean;
  /** Singles: pronouns set. Couples: partner 2 details added or accounts linked. */
  hasPersonalTouch: boolean;
}

export interface StrengthStep {
  id: string;
  label: string;
  /** Percentage points this step adds (0 = a bonus suggestion). */
  gain: number;
  href: string;
}

const BASE = 65;
const PHOTOS = 15;
const PROMPTS = 10;
const INTENTIONS = 5;
const PERSONAL = 5;
const PHOTO_TARGET = 3;
const PROMPT_TARGET = 3;

const FIELD_STEPS: Record<CompletenessField, { label: string; href: string }> = {
  displayName: { label: 'Add a display name', href: '#profile-header' },
  bio: { label: 'Write a short bio', href: '#bio' },
  dateOfBirth: { label: 'Add your date of birth', href: '#identity' },
  gender: { label: 'Add your gender', href: '#identity' },
  orientation: { label: 'Add your orientation', href: '#identity' },
  interestedIn: { label: 'Choose who you’d like to meet', href: '#identity' },
  city: { label: 'Add your city', href: '#profile-header' },
  country: { label: 'Add your country', href: '#profile-header' },
  profilePhoto: { label: 'Choose a main photo', href: '#photos' },
};

export function profileStrength(f: StrengthFacts): { percent: number; steps: StrengthStep[] } {
  const perField = BASE / COMPLETENESS_FIELDS.length;
  const photos = Math.min(f.publicPhotos, PHOTO_TARGET);
  const prompts = Math.min(f.prompts, PROMPT_TARGET);
  const score =
    BASE - perField * f.missing.length +
    (PHOTOS * photos) / PHOTO_TARGET +
    (PROMPTS * prompts) / PROMPT_TARGET +
    (f.hasIntentions ? INTENTIONS : 0) +
    (f.hasPersonalTouch ? PERSONAL : 0);

  const steps: StrengthStep[] = []
  if (photos < PHOTO_TARGET) {
    const n = PHOTO_TARGET - photos;
    steps.push({ id: 'photos', label: `Add ${n} more photo${n === 1 ? '' : 's'}`, gain: Math.round((PHOTOS * n) / PHOTO_TARGET), href: '#photos' });
  }
  for (const field of f.missing) {
    // A main photo is covered by the photos step when there are none at all.
    if (field === 'profilePhoto' && f.publicPhotos === 0) continue;
    steps.push({ id: field, ...FIELD_STEPS[field], gain: Math.round(perField) });
  }
  if (prompts < PROMPT_TARGET) {
    const n = PROMPT_TARGET - prompts;
    steps.push({ id: 'prompts', label: prompts === 0 ? 'Answer a profile prompt or two' : `Answer ${n} more prompt${n === 1 ? '' : 's'}`, gain: Math.round((PROMPTS * n) / PROMPT_TARGET), href: '#prompts' });
  }
  if (!f.hasIntentions) steps.push({ id: 'intentions', label: 'Say what you’re here for', gain: INTENTIONS, href: '#identity' });
  if (!f.hasPersonalTouch) {
    steps.push(f.isCouple
      ? { id: 'partner', label: 'Add your partner’s details', gain: PERSONAL, href: '#identity' }
      : { id: 'pronouns', label: 'Add your pronouns', gain: PERSONAL, href: '#identity' });
  }
  steps.sort((a, b) => b.gain - a.gain);

  const percent = Math.max(0, Math.min(100, Math.round(score)));
  return { percent, steps };
}
