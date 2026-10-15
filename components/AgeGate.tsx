'use client'

import { useState, useEffect } from 'react'
import { LogoMark } from '@/components/Logo'

const STORAGE_KEY = 'velour_age_verified'

export default function AgeGate() {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    try {
      const verified = localStorage.getItem(STORAGE_KEY)
      if (!verified) {
        setVisible(true)
      }
    } catch {
      // localStorage unavailable — show gate
      setVisible(true)
    }
  }, [])

  function handleEnter() {
    try {
      localStorage.setItem(STORAGE_KEY, '1')
    } catch {
      // ignore
    }
    setVisible(false)
  }

  function handleExit() {
    window.location.href = 'https://www.google.com'
  }

  if (!visible) return null

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="age-gate-title"
      className="fixed inset-0 z-[9999] flex items-center justify-center px-4 py-8 overflow-y-auto"
      style={{ backgroundColor: '#0A0A0F' }}
    >
      {/* Background accents */}
      <div aria-hidden="true" className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 -left-40 w-[600px] h-[600px] bg-[#DC143C]/6 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 -right-40 w-[600px] h-[600px] bg-purple-900/6 rounded-full blur-3xl" />
      </div>

      <div className="relative z-10 max-w-md w-full text-center">
        {/* Logo */}
        <div className="flex items-center justify-center gap-3 mb-8">
          <LogoMark size="lg" />
          <span className="text-4xl font-serif font-bold tracking-widest text-white">UNBOUND</span>
        </div>

        {/* Gold divider */}
        <div className="flex items-center justify-center gap-3 mb-8">
          <div className="h-px w-16 bg-gradient-to-r from-transparent to-[#D4AF37]/50" />
          <div className="w-1.5 h-1.5 rounded-full bg-[#D4AF37]" />
          <div className="h-px w-16 bg-gradient-to-l from-transparent to-[#D4AF37]/50" />
        </div>

        {/* Card */}
        <div
          className="rounded-2xl p-8 mb-6"
          style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}
        >
          <div
            className="inline-flex items-center justify-center w-14 h-14 rounded-full mb-5"
            style={{ background: 'rgba(220,20,60,0.1)', border: '1px solid rgba(220,20,60,0.25)' }}
          >
            <span className="text-[#DC143C] text-xl font-bold">18+</span>
          </div>

          <h2 id="age-gate-title" className="text-2xl font-serif font-bold text-white mb-3">
            Welcome — adults only
          </h2>
          <p className="text-gray-400 text-base leading-relaxed mb-6">
            Unbound is a private dating community for singles and couples. You must be{' '}
            <span className="text-white font-semibold">18 years of age or older</span> to enter.
          </p>

          <div className="space-y-3">
            <button
              onClick={handleEnter}
              autoFocus
              className="w-full py-4 rounded-xl font-semibold text-white text-base transition-all shadow-lg shadow-[#DC143C]/20"
              style={{
                background: 'linear-gradient(135deg, #DC143C, #8F0D25)',
              }}
              onMouseEnter={e => {
                (e.currentTarget as HTMLButtonElement).style.background = 'linear-gradient(135deg, #FF1744, #DC143C)'
              }}
              onMouseLeave={e => {
                (e.currentTarget as HTMLButtonElement).style.background = 'linear-gradient(135deg, #DC143C, #8F0D25)'
              }}
            >
              I’m 18 or older — enter
            </button>
            <button
              onClick={handleExit}
              className="w-full py-4 rounded-xl font-semibold text-gray-400 text-base border border-white/10 hover:border-white/20 hover:text-white transition-all"
            >
              I’m under 18 — leave
            </button>
          </div>
        </div>

        <p className="text-gray-400 text-xs leading-relaxed">
          By entering, you confirm you are at least 18 years old and agree to our{' '}
          <a href="/terms" className="text-[#DC143C] hover:underline">Terms of Service</a>
          {' '}and{' '}
          <a href="/privacy" className="text-[#DC143C] hover:underline">Privacy Policy</a>.
        </p>
      </div>
    </div>
  )
}
