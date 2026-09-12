import type { MetadataRoute } from 'next';
import { publicOrigin } from '@/content/site';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: ['/api/', '/preview', '/tokenized-stocks'],
    },
    sitemap: `${publicOrigin}/sitemap.xml`,
    host: publicOrigin,
  };
}
