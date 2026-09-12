import type { MetadataRoute } from 'next';
import { publicOrigin } from '@/content/site';

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { url: publicOrigin, changeFrequency: 'monthly', priority: 1 },
    { url: `${publicOrigin}/app`, changeFrequency: 'monthly', priority: 0.8 },
    { url: `${publicOrigin}/tools`, changeFrequency: 'monthly', priority: 0.5 },
  ];
}
