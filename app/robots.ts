import { MetadataRoute } from 'next'

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: ['/', '/upgrade', '/auth/signup', '/terms', '/privacy'],
        disallow: ['/members/', '/messages/', '/profile/', '/admin/', '/api/'],
      },
    ],
    sitemap: 'https://velour.dating/sitemap.xml',
  }
}
