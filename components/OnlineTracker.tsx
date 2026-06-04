'use client'

import { useEffect } from 'react'
import { useSession } from 'next-auth/react'

export default function OnlineTracker() {
  const { data: session } = useSession()

  useEffect(() => {
    if (!session?.user?.id) return

    async function ping() {
      try {
        await fetch('/api/ping', { method: 'POST' })
      } catch {
        // silent — network issues shouldn't surface to user
      }
    }

    async function goOffline() {
      try {
        await fetch('/api/offline', { method: 'POST', keepalive: true })
      } catch {
        // silent
      }
    }

    // Ping immediately on mount
    void ping()

    // Then ping every 60 seconds
    const interval = setInterval(() => { void ping() }, 60_000)

    // Go offline when tab closes
    function handleBeforeUnload() {
      // Use keepalive fetch so the request completes even as the page unloads
      navigator.sendBeacon?.('/api/offline') ?? goOffline()
    }

    window.addEventListener('beforeunload', handleBeforeUnload)

    return () => {
      clearInterval(interval)
      window.removeEventListener('beforeunload', handleBeforeUnload)
    }
  }, [session?.user?.id])

  return null
}
