import type { MetadataRoute } from 'next';
import { getAllPosts } from '@/lib/blog';
import { siteConfig } from '@/lib/site';

export default function sitemap(): MetadataRoute.Sitemap {
  const posts = getAllPosts();
  const staticPages = ['', '/pricing', '/register', '/blog', '/legal/privacy', '/legal/terms', '/legal/consent'];

  return [
    ...staticPages.map((path) => ({
      url: `${siteConfig.url}${path}`,
      lastModified: new Date(),
      changeFrequency: 'weekly' as const,
      priority: path === '' ? 1 : 0.8,
    })),
    ...posts.map((post) => ({
      url: `${siteConfig.url}/blog/${post.slug}`,
      lastModified: new Date(post.date),
      changeFrequency: 'monthly' as const,
      priority: 0.6,
    })),
  ];
}
