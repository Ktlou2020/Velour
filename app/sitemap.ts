import { MetadataRoute } from 'next'

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { url: 'https://velour.dating', lastModified: new Date(), changeFrequency: 'daily', priority: 1 },
    { url: 'https://velour.dating/upgrade', lastModified: new Date(), changeFrequency: 'weekly', priority: 0.9 },
    { url: 'https://velour.dating/auth/signup', changeFrequency: 'monthly', priority: 0.8 },
    { url: 'https://velour.dating/auth/signin', changeFrequency: 'monthly', priority: 0.7 },
    { url: 'https://velour.dating/terms', changeFrequency: 'monthly', priority: 0.5 },
    { url: 'https://velour.dating/privacy', changeFrequency: 'monthly', priority: 0.5 },
  ]
}
