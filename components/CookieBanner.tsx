'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { Cookie, X } from 'lucide-react'
import { useSession } from 'next-auth/react'

const STORAGE_KEY = 'velour_cookie_consent'

export default function CookieBanner() {
  const [visible, setVisible] = useState(false)
  const { status } = useSession()

  useEffect(() => {
    try {
      const consent = localStorage.getItem(STORAGE_KEY)
      if (!consent) {
        setVisible(true)
      }
    } catch {
      // localStorage unavailable
    }
  }, [])

  function accept(type: 'accepted' | 'essential') {
    try {
      localStorage.setItem(STORAGE_KEY, type)
    } catch {
      // ignore
    }
    setVisible(false)
  }

  if (!visible) return null

  return (
    // Sits above the mobile tab bar when it is showing (signed-in, < md).
    <div
      role="region"
      aria-label="Cookie consent"
      className={`fixed left-0 right-0 z-[9000] px-4 pb-4 ${status === 'authenticated' ? 'bottom-16 md:bottom-0' : 'bottom-0'}`}
    >
      <div
        className="max-w-4xl mx-auto rounded-2xl p-4 sm:p-5"
        style={{
          background: 'rgba(18, 18, 26, 0.95)',
          border: '1px solid rgba(255,255,255,0.08)',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
        }}
      >
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
          {/* Icon + text */}
          <div className="flex items-start gap-3 flex-1 min-w-0">
            <div className="flex-shrink-0 w-9 h-9 rounded-lg bg-[#DC143C]/10 flex items-center justify-center mt-0.5">
              <Cookie className="w-4 h-4 text-[#DC143C]" />
            </div>
            <p className="text-gray-300 text-sm leading-relaxed">
              We use essential cookies to keep you signed in and secure, and optional ones to improve Hush. See our{' '}
              <Link href="/privacy" className="text-[#DC143C] hover:underline font-medium">
                Privacy Policy
              </Link>
              .
            </p>
          </div>

          {/* Buttons */}
          <div className="flex items-center gap-2 flex-shrink-0 w-full sm:w-auto">
            <button
              onClick={() => accept('essential')}
              className="flex-1 sm:flex-none px-4 py-2 rounded-lg border border-white/10 text-gray-400 hover:border-white/25 hover:text-white text-sm font-medium transition-all"
            >
              Essential only
            </button>
            <button
              onClick={() => accept('accepted')}
              className="flex-1 sm:flex-none px-5 py-2 rounded-lg text-white text-sm font-semibold transition-all shadow-lg shadow-[#DC143C]/20"
              style={{ background: 'linear-gradient(135deg, #DC143C, #8F0D25)' }}
            >
              Accept all
            </button>
            <button
              onClick={() => accept('essential')}
              className="p-2 text-gray-400 hover:text-white transition-colors"
              aria-label="Dismiss (essential cookies only)"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
