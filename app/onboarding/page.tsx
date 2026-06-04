'use client';

import { useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { ChevronRight, ChevronLeft, Check, Upload, X, Camera } from 'lucide-react';

type Gender = 'MAN' | 'WOMAN' | 'NON_BINARY' | 'OTHER';
type Orientation = 'STRAIGHT' | 'GAY' | 'BISEXUAL' | 'OTHER';
type LookingFor = 'MAN' | 'WOMAN' | 'COUPLE' | 'ANY';
type RelationshipStatus = 'SINGLE' | 'IN_RELATIONSHIP' | 'COMPLICATED';

interface FormData {
  displayName: string;
  dateOfBirth: string;
  gender: Gender | '';
  orientation: Orientation | '';
  lookingFor: LookingFor[];
  relationshipStatus: RelationshipStatus | '';
  city: string;
  country: string;
  bio: string;
}

interface UploadedPhoto {
  id: string;
  url: string;
  filename: string;
}

const STEPS = ['About You', 'Your Preferences', 'Your Location', 'Add Photos'];

export default function OnboardingPage() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [photos, setPhotos] = useState<UploadedPhoto[]>([]);
  const [errors, setErrors] = useState<Partial<Record<keyof FormData, string>>>({});

  const [form, setForm] = useState<FormData>({
    displayName: '',
    dateOfBirth: '',
    gender: '',
    orientation: '',
    lookingFor: [],
    relationshipStatus: '',
    city: '',
    country: '',
    bio: '',
  });

  function updateForm(field: keyof FormData, value: FormData[typeof field]) {
    setForm((prev) => ({ ...prev, [field]: value }));
    setErrors((prev) => ({ ...prev, [field]: undefined }));
  }

  function toggleLookingFor(val: LookingFor) {
    setForm((prev) => ({
      ...prev,
      lookingFor: prev.lookingFor.includes(val)
        ? prev.lookingFor.filter((v) => v !== val)
        : [...prev.lookingFor, val],
    }));
  }

  function validateStep(): boolean {
    const newErrors: Partial<Record<keyof FormData, string>> = {};
    if (step === 0) {
      if (!form.displayName.trim()) newErrors.displayName = 'Display name is required';
      if (!form.dateOfBirth) newErrors.dateOfBirth = 'Date of birth is required';
      if (!form.gender) newErrors.gender = 'Please select your gender';
    } else if (step === 1) {
      if (!form.orientation) newErrors.orientation = 'Please select your orientation';
      if (form.lookingFor.length === 0) newErrors.lookingFor = 'Please select at least one option';
      if (!form.relationshipStatus) newErrors.relationshipStatus = 'Please select your relationship status';
    } else if (step === 2) {
      if (!form.city.trim()) newErrors.city = 'City is required';
      if (!form.country.trim()) newErrors.country = 'Country is required';
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }

  async function handleNext() {
    if (!validateStep()) return;
    setLoading(true);
    try {
      await fetch('/api/onboarding', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          displayName: form.displayName,
          dateOfBirth: form.dateOfBirth,
          gender: form.gender || undefined,
          orientation: form.orientation || undefined,
          lookingFor: form.lookingFor,
          relationshipStatus: form.relationshipStatus || undefined,
          city: form.city,
          country: form.country,
          bio: form.bio,
        }),
      });
    } catch {
      // continue even if API fails
    } finally {
      setLoading(false);
    }
    if (step < STEPS.length - 1) {
      setStep((s) => s + 1);
    }
  }

  async function handleFinish() {
    setLoading(true);
    try {
      await fetch('/api/onboarding', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          displayName: form.displayName,
          dateOfBirth: form.dateOfBirth,
          gender: form.gender || undefined,
          orientation: form.orientation || undefined,
          lookingFor: form.lookingFor,
          relationshipStatus: form.relationshipStatus || undefined,
          city: form.city,
          country: form.country,
          bio: form.bio,
        }),
      });
    } catch {
      // continue
    } finally {
      setLoading(false);
    }
    router.push('/members');
  }

  async function handlePhotoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    const file = files[0];
    setUploadingPhoto(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const uploadRes = await fetch('/api/upload', { method: 'POST', body: formData });
      if (!uploadRes.ok) throw new Error('Upload failed');
      const uploadData = await uploadRes.json();

      const photoRes = await fetch('/api/photos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: uploadData.url, filename: file.name }),
      });
      const photoData = await photoRes.json();
      setPhotos((prev) => [...prev, { id: photoData.id || Date.now().toString(), url: uploadData.url, filename: file.name }]);
    } catch {
      // silently fail on upload errors
    } finally {
      setUploadingPhoto(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }

  function removePhoto(id: string) {
    setPhotos((prev) => prev.filter((p) => p.id !== id));
  }

  const progress = ((step) / (STEPS.length - 1)) * 100;

  const genderOptions: { value: Gender; label: string }[] = [
    { value: 'MAN', label: 'Man' },
    { value: 'WOMAN', label: 'Woman' },
    { value: 'NON_BINARY', label: 'Non-Binary' },
    { value: 'OTHER', label: 'Other' },
  ];

  const orientationOptions: { value: Orientation; label: string }[] = [
    { value: 'STRAIGHT', label: 'Straight' },
    { value: 'GAY', label: 'Gay' },
    { value: 'BISEXUAL', label: 'Bisexual' },
    { value: 'OTHER', label: 'Other' },
  ];

  const lookingForOptions: { value: LookingFor; label: string }[] = [
    { value: 'MAN', label: 'Men' },
    { value: 'WOMAN', label: 'Women' },
    { value: 'COUPLE', label: 'Couples' },
    { value: 'ANY', label: 'Anyone' },
  ];

  const relationshipOptions: { value: RelationshipStatus; label: string }[] = [
    { value: 'SINGLE', label: 'Single' },
    { value: 'IN_RELATIONSHIP', label: 'In a Relationship' },
    { value: 'COMPLICATED', label: "It's Complicated" },
  ];

  return (
    <div className="min-h-screen bg-[#0A0A0F] flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-lg">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 mb-2">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#DC143C] to-[#8F0D25] flex items-center justify-center shadow-lg shadow-[#DC143C]/25">
              <span className="text-white font-bold text-xl font-serif">V</span>
            </div>
            <span className="text-white font-bold text-2xl tracking-widest font-serif">VELOUR</span>
          </div>
          <p className="text-white/40 text-sm">Complete your profile to get started</p>
        </div>

        {/* Progress Bar */}
        <div className="mb-8">
          <div className="flex justify-between text-xs text-white/40 mb-2">
            <span>Step {step + 1} of {STEPS.length}</span>
            <span>{STEPS[step]}</span>
          </div>
          <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-[#DC143C] to-[#8F0D25] rounded-full transition-all duration-500"
              style={{ width: `${progress}%` }}
            />
          </div>
          <div className="flex justify-between mt-3">
            {STEPS.map((s, i) => (
              <div key={s} className="flex flex-col items-center gap-1">
                <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
                  i < step ? 'bg-[#DC143C] text-white' :
                  i === step ? 'bg-[#DC143C]/20 border-2 border-[#DC143C] text-[#DC143C]' :
                  'bg-white/5 text-white/20'
                }`}>
                  {i < step ? <Check size={12} /> : i + 1}
                </div>
                <span className={`text-xs hidden sm:block ${i === step ? 'text-white/70' : 'text-white/20'}`}>{s}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Card */}
        <div className="glass rounded-3xl p-8">
          <h2 className="font-serif text-2xl font-bold text-white mb-1">{STEPS[step]}</h2>
          <p className="text-white/40 text-sm mb-8">
            {step === 0 && 'Tell us a bit about yourself'}
            {step === 1 && 'Who are you looking to meet?'}
            {step === 2 && 'Where are you based?'}
            {step === 3 && 'Show your best self — photos increase matches by 10×'}
          </p>

          {/* Step 1: About You */}
          {step === 0 && (
            <div className="space-y-6">
              <div>
                <label className="text-white/60 text-xs uppercase tracking-widest block mb-2" htmlFor="displayName">
                  Display Name
                </label>
                <input
                  id="displayName"
                  type="text"
                  value={form.displayName}
                  onChange={(e) => updateForm('displayName', e.target.value)}
                  placeholder="How should we call you?"
                  className="input-dark w-full px-4 py-3 rounded-xl text-sm"
                />
                {errors.displayName && <p className="text-red-400 text-xs mt-1">{errors.displayName}</p>}
              </div>

              <div>
                <label className="text-white/60 text-xs uppercase tracking-widest block mb-2" htmlFor="dateOfBirth">
                  Date of Birth
                </label>
                <input
                  id="dateOfBirth"
                  type="date"
                  value={form.dateOfBirth}
                  onChange={(e) => updateForm('dateOfBirth', e.target.value)}
                  className="input-dark w-full px-4 py-3 rounded-xl text-sm"
                />
                {errors.dateOfBirth && <p className="text-red-400 text-xs mt-1">{errors.dateOfBirth}</p>}
              </div>

              <div>
                <label className="text-white/60 text-xs uppercase tracking-widest block mb-3">Gender</label>
                <div className="grid grid-cols-2 gap-3">
                  {genderOptions.map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => updateForm('gender', opt.value)}
                      className={`px-4 py-3 rounded-xl text-sm font-medium transition-all border ${
                        form.gender === opt.value
                          ? 'bg-[#DC143C]/20 border-[#DC143C] text-white'
                          : 'border-white/10 text-white/60 hover:text-white hover:border-white/30'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
                {errors.gender && <p className="text-red-400 text-xs mt-1">{errors.gender}</p>}
              </div>
            </div>
          )}

          {/* Step 2: Preferences */}
          {step === 1 && (
            <div className="space-y-6">
              <div>
                <label className="text-white/60 text-xs uppercase tracking-widest block mb-3">Sexual Orientation</label>
                <div className="grid grid-cols-2 gap-3">
                  {orientationOptions.map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => updateForm('orientation', opt.value)}
                      className={`px-4 py-3 rounded-xl text-sm font-medium transition-all border ${
                        form.orientation === opt.value
                          ? 'bg-[#DC143C]/20 border-[#DC143C] text-white'
                          : 'border-white/10 text-white/60 hover:text-white hover:border-white/30'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
                {errors.orientation && <p className="text-red-400 text-xs mt-1">{errors.orientation}</p>}
              </div>

              <div>
                <label className="text-white/60 text-xs uppercase tracking-widest block mb-3">
                  I&apos;m Looking For <span className="text-white/30">(select all that apply)</span>
                </label>
                <div className="grid grid-cols-2 gap-3">
                  {lookingForOptions.map((opt) => (
                    <label
                      key={opt.value}
                      className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium cursor-pointer transition-all border ${
                        form.lookingFor.includes(opt.value)
                          ? 'bg-[#DC143C]/20 border-[#DC143C] text-white'
                          : 'border-white/10 text-white/60 hover:text-white hover:border-white/30'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={form.lookingFor.includes(opt.value)}
                        onChange={() => toggleLookingFor(opt.value)}
                        className="sr-only"
                      />
                      <div className={`w-4 h-4 rounded border-2 flex items-center justify-center flex-shrink-0 ${
                        form.lookingFor.includes(opt.value) ? 'bg-[#DC143C] border-[#DC143C]' : 'border-white/30'
                      }`}>
                        {form.lookingFor.includes(opt.value) && <Check size={10} className="text-white" />}
                      </div>
                      {opt.label}
                    </label>
                  ))}
                </div>
                {errors.lookingFor && <p className="text-red-400 text-xs mt-1">{errors.lookingFor}</p>}
              </div>

              <div>
                <label className="text-white/60 text-xs uppercase tracking-widest block mb-3">Relationship Status</label>
                <div className="space-y-2">
                  {relationshipOptions.map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => updateForm('relationshipStatus', opt.value)}
                      className={`w-full px-4 py-3 rounded-xl text-sm font-medium text-left transition-all border ${
                        form.relationshipStatus === opt.value
                          ? 'bg-[#DC143C]/20 border-[#DC143C] text-white'
                          : 'border-white/10 text-white/60 hover:text-white hover:border-white/30'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
                {errors.relationshipStatus && <p className="text-red-400 text-xs mt-1">{errors.relationshipStatus}</p>}
              </div>
            </div>
          )}

          {/* Step 3: Location */}
          {step === 2 && (
            <div className="space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-white/60 text-xs uppercase tracking-widest block mb-2" htmlFor="city">City</label>
                  <input
                    id="city"
                    type="text"
                    value={form.city}
                    onChange={(e) => updateForm('city', e.target.value)}
                    placeholder="e.g. London"
                    className="input-dark w-full px-4 py-3 rounded-xl text-sm"
                  />
                  {errors.city && <p className="text-red-400 text-xs mt-1">{errors.city}</p>}
                </div>
                <div>
                  <label className="text-white/60 text-xs uppercase tracking-widest block mb-2" htmlFor="country">Country</label>
                  <input
                    id="country"
                    type="text"
                    value={form.country}
                    onChange={(e) => updateForm('country', e.target.value)}
                    placeholder="e.g. UK"
                    className="input-dark w-full px-4 py-3 rounded-xl text-sm"
                  />
                  {errors.country && <p className="text-red-400 text-xs mt-1">{errors.country}</p>}
                </div>
              </div>

              <div>
                <label className="text-white/60 text-xs uppercase tracking-widest block mb-2" htmlFor="bio">
                  About You <span className="text-white/30 normal-case">(optional)</span>
                </label>
                <textarea
                  id="bio"
                  value={form.bio}
                  onChange={(e) => updateForm('bio', e.target.value.slice(0, 500))}
                  placeholder="Tell potential matches a bit about yourself, your lifestyle, and what you're looking for..."
                  className="input-dark w-full px-4 py-3 rounded-xl text-sm resize-none"
                  rows={5}
                />
                <p className="text-white/30 text-xs mt-1 text-right">{form.bio.length}/500</p>
              </div>
            </div>
          )}

          {/* Step 4: Photos */}
          {step === 3 && (
            <div className="space-y-6">
              <div className="grid grid-cols-3 gap-3">
                {photos.map((photo) => (
                  <div key={photo.id} className="relative aspect-square rounded-xl overflow-hidden group">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={photo.url} alt="Profile" className="w-full h-full object-cover" />
                    <button
                      onClick={() => removePhoto(photo.id)}
                      className="absolute top-2 right-2 w-6 h-6 bg-black/70 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                      aria-label="Remove photo"
                    >
                      <X size={12} className="text-white" />
                    </button>
                  </div>
                ))}

                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploadingPhoto}
                  className="aspect-square rounded-xl border-2 border-dashed border-white/20 hover:border-[#DC143C]/60 flex flex-col items-center justify-center gap-2 transition-all hover:bg-white/5 cursor-pointer"
                  aria-label="Add photo"
                >
                  {uploadingPhoto ? (
                    <div className="w-6 h-6 border-2 border-[#DC143C] border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <>
                      <Upload size={20} className="text-white/30" />
                      <span className="text-white/30 text-xs">Add Photo</span>
                    </>
                  )}
                </button>
              </div>

              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="hidden"
                onChange={handlePhotoUpload}
              />

              <div className="flex items-center gap-3 glass rounded-xl p-4">
                <Camera size={20} className="text-[#DC143C] flex-shrink-0" />
                <p className="text-white/50 text-xs leading-relaxed">
                  Members with photos get 10× more matches. Add at least one clear face photo. Max 10MB per photo.
                </p>
              </div>
            </div>
          )}

          {/* Navigation */}
          <div className="flex items-center justify-between mt-8 pt-6 border-t border-white/10">
            {step > 0 ? (
              <button
                type="button"
                onClick={() => setStep((s) => s - 1)}
                className="flex items-center gap-2 text-white/50 hover:text-white text-sm transition-colors"
              >
                <ChevronLeft size={16} />
                Back
              </button>
            ) : (
              <div />
            )}

            <div className="flex items-center gap-3">
              {step === STEPS.length - 1 && (
                <button
                  type="button"
                  onClick={handleFinish}
                  className="text-white/40 hover:text-white/70 text-sm transition-colors"
                >
                  Skip for now
                </button>
              )}

              <button
                type="button"
                onClick={step === STEPS.length - 1 ? handleFinish : handleNext}
                disabled={loading}
                className="flex items-center gap-2 bg-gradient-to-r from-[#DC143C] to-[#8F0D25] hover:from-[#FF1744] hover:to-[#DC143C] text-white px-6 py-3 rounded-xl font-semibold text-sm transition-all disabled:opacity-60"
              >
                {loading ? (
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : null}
                {step === STEPS.length - 1 ? 'Complete Profile' : 'Continue'}
                {step !== STEPS.length - 1 && !loading && <ChevronRight size={16} />}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
