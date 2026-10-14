import type { MetadataRoute } from 'next'
import { SITE_URL } from './site'

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: ['/', '/auth/signup', '/safety', '/terms', '/privacy'],
        disallow: [
          '/api/', '/admin', '/members', '/discover', '/matches', '/messages', '/profile',
          '/account', '/notifications', '/views', '/gallery', '/onboarding', '/events', '/forums',
          '/upgrade', '/subscription', '/unsubscribe',
        ],
      },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  }
}
