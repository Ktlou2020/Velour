'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { signIn } from 'next-auth/react'
import { ArrowLeft, ArrowRight, Check, Upload, Eye, EyeOff, User, MapPin, Heart, Camera } from 'lucide-react'

const INTERESTS = [
  'Travel','Fine Dining','Wine & Cocktails','Music','Art & Culture',
  'Fitness','Yoga','Dancing','Photography','Cinema',
  'Reading','Cooking','Hiking','Swimming','Cycling',
  'Theatre','Fashion','Technology','Business','Spirituality',
  'Mindfulness','Festivals','Nightlife','Beach Life','Skiing',
  'Sailing','Golf','Tennis','Motorsport','Volunteering',
]
const GENDERS = ['Man','Woman','Non-binary','Other']
const LOOKING_FOR = ['Men','Women','Non-binary','Couples (MF)','Couples (MM)','Couples (FF)','A male third','A female third','Everyone']
const RELATIONSHIP_TYPES = ['Single (Man)','Single (Woman)','Couple seeking man','Couple seeking woman','Couple seeking couple','Polyamorous','Married / Open','Other']

export default function SignupPage() {
  const router = useRouter()
  const [step, setStep] = useState(1)
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  // Step 1 fields
  const [username, setUsername] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [dateOfBirth, setDateOfBirth] = useState('')
  const [ageConfirmed, setAgeConfirmed] = useState(false)

  // Step 2 fields
  const [selectedGender, setSelectedGender] = useState('')
  const [selectedLookingFor, setSelectedLookingFor] = useState<string[]>([])
  const [selectedRelationship, setSelectedRelationship] = useState('')

  // Step 3 fields
  const [selectedInterests, setSelectedInterests] = useState<string[]>([])

  const toggleInterest = (i: string) =>
    setSelectedInterests(prev => prev.includes(i) ? prev.filter(x => x !== i) : [...prev, i])
  const toggleLookingFor = (i: string) =>
    setSelectedLookingFor(prev => prev.includes(i) ? prev.filter(x => x !== i) : [...prev, i])

  function validateStep1(): string | null {
    if (!username.trim()) return 'Username is required'
    if (!email.trim()) return 'Email is required'
    if (!password) return 'Password is required'
    if (password.length < 8) return 'Password must be at least 8 characters'
    if (password !== confirmPassword) return 'Passwords do not match'
    if (!dateOfBirth) return 'Date of birth is required'
    if (!ageConfirmed) return 'You must confirm you are at least 18 years old'
    return null
  }

  function handleNextStep() {
    setError('')
    if (step === 1) {
      const err = validateStep1()
      if (err) { setError(err); return }
    }
    setStep(s => s + 1)
  }

  async function handleSubmit() {
    setError('')
    setLoading(true)
    try {
      const res = await fetch('/api/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, email, password, dateOfBirth }),
      })
      const data = await res.json() as { success?: boolean; error?: string }
      if (!res.ok) {
        setError(data.error ?? 'Registration failed. Please try again.')
        setLoading(false)
        return
      }
      // Auto sign in after successful registration
      const result = await signIn('credentials', { email, password, redirect: false })
      if (result?.error) {
        setError('Account created but sign-in failed. Please sign in manually.')
        setLoading(false)
        return
      }
      router.push('/members')
    } catch {
      setError('An unexpected error occurred. Please try again.')
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen animated-gradient flex items-center justify-center px-4 py-12">
      <div className="fixed top-20 left-20 w-64 h-64 bg-[#DC143C]/10 rounded-full blur-3xl pointer-events-none" />
      <div className="fixed bottom-20 right-20 w-64 h-64 bg-purple-800/10 rounded-full blur-3xl pointer-events-none" />
      <div className="w-full max-w-lg">
        <div className="text-center mb-8">
          <Link href="/" className="inline-flex items-center gap-2">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#DC143C] to-[#8F0D25] flex items-center justify-center">
              <span className="text-white font-serif font-bold text-xl">V</span>
            </div>
            <span className="text-2xl font-serif font-bold tracking-wide text-white">VELOUR</span>
          </Link>
          <p className="mt-2 text-gray-400 text-sm">Create your profile — it only takes a moment</p>
        </div>

        <div className="flex items-center justify-between mb-8 px-2">
          {[1,2,3,4].map(s => (
            <div key={s} className="flex items-center flex-1">
              <div className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-semibold transition-all ${
                s < step ? 'bg-gradient-to-br from-[#DC143C] to-[#8F0D25] text-white' :
                s === step ? 'bg-gradient-to-br from-[#DC143C] to-[#8F0D25] text-white ring-4 ring-[#DC143C]/20' :
                'bg-white/5 text-gray-500 border border-white/10'}`}>
                {s < step ? <Check className="w-4 h-4" /> : s}
              </div>
              {s < 4 && <div className={`flex-1 h-0.5 mx-2 transition-all ${s < step ? 'bg-[#DC143C]' : 'bg-white/10'}`} />}
            </div>
          ))}
        </div>

        <div className="glass rounded-2xl p-8">
          {error && (
            <div className="mb-5 p-3 rounded-lg bg-[#DC143C]/10 border border-[#DC143C]/30 text-[#DC143C] text-sm">
              {error}
            </div>
          )}

          {step === 1 && (
            <div>
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 rounded-xl bg-[#DC143C]/10 flex items-center justify-center">
                  <User className="w-5 h-5 text-[#DC143C]" />
                </div>
                <div>
                  <h2 className="text-xl font-serif font-bold text-white">Your Account</h2>
                  <p className="text-gray-400 text-sm">Step 1 of 4 — Basic details</p>
                </div>
              </div>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm text-gray-300 mb-1.5">Username</label>
                  <input
                    type="text"
                    placeholder="Choose a unique username"
                    className="input-dark"
                    value={username}
                    onChange={e => setUsername(e.target.value)}
                    autoComplete="username"
                  />
                  <p className="text-xs text-gray-500 mt-1">This is how others will find you</p>
                </div>
                <div>
                  <label className="block text-sm text-gray-300 mb-1.5">Email Address</label>
                  <input
                    type="email"
                    placeholder="your@email.com"
                    className="input-dark"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    autoComplete="email"
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-300 mb-1.5">Password</label>
                  <div className="relative">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      placeholder="Min. 8 characters"
                      className="input-dark pr-12"
                      value={password}
                      onChange={e => setPassword(e.target.value)}
                      autoComplete="new-password"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
                <div>
                  <label className="block text-sm text-gray-300 mb-1.5">Confirm Password</label>
                  <input
                    type="password"
                    placeholder="Repeat your password"
                    className="input-dark"
                    value={confirmPassword}
                    onChange={e => setConfirmPassword(e.target.value)}
                    autoComplete="new-password"
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-300 mb-1.5">Date of Birth</label>
                  <input
                    type="date"
                    className="input-dark"
                    value={dateOfBirth}
                    onChange={e => setDateOfBirth(e.target.value)}
                  />
                </div>
                <label className="flex items-start gap-3 cursor-pointer">
                  <div
                    className={`w-5 h-5 mt-0.5 rounded border flex-shrink-0 flex items-center justify-center transition-all ${ageConfirmed ? 'bg-[#DC143C] border-[#DC143C]' : 'border-white/20'}`}
                    onClick={() => setAgeConfirmed(!ageConfirmed)}
                  >
                    {ageConfirmed && <Check className="w-3 h-3 text-white" />}
                  </div>
                  <span className="text-sm text-gray-400 leading-relaxed">
                    I confirm I am at least <span className="text-white font-semibold">18 years of age</span> and agree to the{' '}
                    <Link href="/terms" className="text-[#DC143C] hover:underline">Terms</Link> and{' '}
                    <Link href="/privacy" className="text-[#DC143C] hover:underline">Privacy Policy</Link>
                  </span>
                </label>
              </div>
            </div>
          )}

          {step === 2 && (
            <div>
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 rounded-xl bg-[#DC143C]/10 flex items-center justify-center">
                  <MapPin className="w-5 h-5 text-[#DC143C]" />
                </div>
                <div>
                  <h2 className="text-xl font-serif font-bold text-white">About You</h2>
                  <p className="text-gray-400 text-sm">Step 2 of 4 — Your profile</p>
                </div>
              </div>
              <div className="space-y-5">
                <div>
                  <label className="block text-sm text-gray-300 mb-2">I am a...</label>
                  <div className="grid grid-cols-2 gap-2">
                    {GENDERS.map(g => (
                      <button key={g} type="button" onClick={() => setSelectedGender(g)}
                        className={`py-2.5 px-4 rounded-lg border text-sm font-medium transition-all ${selectedGender === g ? 'bg-[#DC143C]/20 border-[#DC143C] text-white' : 'border-white/10 text-gray-400 hover:border-white/30 hover:text-white'}`}>
                        {g}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="block text-sm text-gray-300 mb-2">Looking for... <span className="text-gray-500 text-xs">(select all that apply)</span></label>
                  <div className="grid grid-cols-2 gap-2">
                    {LOOKING_FOR.map(item => (
                      <button key={item} type="button" onClick={() => toggleLookingFor(item)}
                        className={`py-2.5 px-4 rounded-lg border text-sm font-medium transition-all flex items-center justify-between ${selectedLookingFor.includes(item) ? 'bg-[#DC143C]/20 border-[#DC143C] text-white' : 'border-white/10 text-gray-400 hover:border-white/30 hover:text-white'}`}>
                        {item}
                        {selectedLookingFor.includes(item) && <Check className="w-3 h-3" />}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="block text-sm text-gray-300 mb-2">Relationship status</label>
                  <div className="grid grid-cols-2 gap-2">
                    {RELATIONSHIP_TYPES.map(r => (
                      <button key={r} type="button" onClick={() => setSelectedRelationship(r)}
                        className={`py-2.5 px-4 rounded-lg border text-sm font-medium transition-all ${selectedRelationship === r ? 'bg-[#DC143C]/20 border-[#DC143C] text-white' : 'border-white/10 text-gray-400 hover:border-white/30 hover:text-white'}`}>
                        {r}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {step === 3 && (
            <div>
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 rounded-xl bg-[#DC143C]/10 flex items-center justify-center">
                  <Heart className="w-5 h-5 text-[#DC143C]" />
                </div>
                <div>
                  <h2 className="text-xl font-serif font-bold text-white">Your Interests</h2>
                  <p className="text-gray-400 text-sm">Step 3 of 4 — Select at least 5</p>
                </div>
              </div>
              <div className="flex flex-wrap gap-2 mb-3">
                {INTERESTS.map(interest => (
                  <button key={interest} type="button" onClick={() => toggleInterest(interest)}
                    className={`px-3 py-1.5 rounded-full text-sm border transition-all ${selectedInterests.includes(interest) ? 'bg-[#DC143C]/20 border-[#DC143C] text-white' : 'border-white/10 text-gray-400 hover:border-white/30 hover:text-white'}`}>
                    {interest}
                  </button>
                ))}
              </div>
              <p className="text-xs text-gray-500">{selectedInterests.length} selected{selectedInterests.length < 5 && <span className="text-[#DC143C]"> — please select at least 5</span>}</p>
            </div>
          )}

          {step === 4 && (
            <div>
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 rounded-xl bg-[#DC143C]/10 flex items-center justify-center">
                  <Camera className="w-5 h-5 text-[#DC143C]" />
                </div>
                <div>
                  <h2 className="text-xl font-serif font-bold text-white">Profile Photo</h2>
                  <p className="text-gray-400 text-sm">Step 4 of 4 — Optional but recommended</p>
                </div>
              </div>
              <div className="border-2 border-dashed border-white/15 rounded-2xl p-10 text-center hover:border-[#DC143C]/40 transition-colors cursor-pointer group mb-6">
                <div className="w-16 h-16 rounded-full bg-white/5 flex items-center justify-center mx-auto mb-4 group-hover:bg-[#DC143C]/10 transition-colors">
                  <Upload className="w-7 h-7 text-gray-400 group-hover:text-[#DC143C] transition-colors" />
                </div>
                <p className="text-white font-medium mb-1">Drop your photo here</p>
                <p className="text-gray-400 text-sm mb-4">or click to browse your files</p>
                <p className="text-gray-500 text-xs">JPG, PNG or WebP · Max 10MB</p>
              </div>
              <div className="bg-[#DC143C]/5 border border-[#DC143C]/20 rounded-xl p-4 text-sm text-gray-300 space-y-1.5">
                <p className="font-medium text-white">Photo tips for more matches:</p>
                <p>• Use a clear, recent photo of your face</p>
                <p>• Natural lighting makes a big difference</p>
                <p>• Smiling profiles get 3× more engagement</p>
              </div>
            </div>
          )}

          <div className="flex items-center justify-between mt-8">
            {step > 1 ? (
              <button
                type="button"
                onClick={() => { setError(''); setStep(s => s - 1) }}
                className="flex items-center gap-2 text-gray-400 hover:text-white transition-colors"
              >
                <ArrowLeft className="w-4 h-4" /> Back
              </button>
            ) : (
              <Link href="/auth/signin" className="text-gray-400 hover:text-white transition-colors text-sm">Already a member?</Link>
            )}
            {step < 4 ? (
              <button
                type="button"
                onClick={handleNextStep}
                className="flex items-center gap-2 bg-gradient-to-r from-[#DC143C] to-[#8F0D25] hover:from-[#FF1744] hover:to-[#DC143C] text-white px-6 py-2.5 rounded-lg font-semibold transition-all"
              >
                Continue <ArrowRight className="w-4 h-4" />
              </button>
            ) : (
              <button
                type="button"
                onClick={handleSubmit}
                disabled={loading}
                className="flex items-center gap-2 bg-gradient-to-r from-[#DC143C] to-[#8F0D25] hover:from-[#FF1744] hover:to-[#DC143C] disabled:opacity-60 disabled:cursor-not-allowed text-white px-6 py-2.5 rounded-lg font-semibold transition-all"
              >
                {loading ? (
                  <span className="inline-block w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <>Complete Profile <Check className="w-4 h-4" /></>
                )}
              </button>
            )}
          </div>
          {step === 4 && (
            <div className="text-center mt-4">
              <button
                type="button"
                onClick={handleSubmit}
                disabled={loading}
                className="text-gray-500 hover:text-gray-300 text-sm transition-colors disabled:cursor-not-allowed"
              >
                Skip — add a photo later
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
