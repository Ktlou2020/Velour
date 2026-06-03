'use client'

import { signOut } from 'next-auth/react'
import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

export default function SignOutPage() {
  const router = useRouter()
  useEffect(() => {
    signOut({ redirect: false }).then(() => router.push('/'))
  }, [router])

  return (
    <div className="min-h-screen bg-[#0A0A0F] flex items-center justify-center">
      <p className="text-gray-400">Signing out...</p>
    </div>
  )
}
