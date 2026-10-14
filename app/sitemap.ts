import { MetadataRoute } from 'next'

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { url: 'https://hush.dating', lastModified: new Date(), changeFrequency: 'daily', priority: 1 },
    { url: 'https://hush.dating/upgrade', lastModified: new Date(), changeFrequency: 'weekly', priority: 0.9 },
    { url: 'https://hush.dating/auth/signup', changeFrequency: 'monthly', priority: 0.8 },
    { url: 'https://hush.dating/auth/signin', changeFrequency: 'monthly', priority: 0.7 },
    { url: 'https://hush.dating/terms', changeFrequency: 'monthly', priority: 0.5 },
    { url: 'https://hush.dating/safety', changeFrequency: 'monthly', priority: 0.6 },
    { url: 'https://hush.dating/privacy', changeFrequency: 'monthly', priority: 0.5 },
  ]
}
