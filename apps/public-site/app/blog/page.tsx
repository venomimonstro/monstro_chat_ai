import Link from 'next/link';
import { getAllPosts } from '@/lib/blog';

export const metadata = {
  title: 'Блог',
  description: 'Статьи об ИИ-консультантах, конверсии и автоматизации продаж',
};

export default function BlogIndexPage() {
  const posts = getAllPosts();

  return (
    <div className="bg-slate-50">
      <div className="mx-auto max-w-4xl px-4 py-16 md:py-24">
        <div className="text-center">
          <h1 className="text-4xl font-bold tracking-tight text-slate-900 md:text-5xl">Блог</h1>
          <p className="mt-4 text-lg text-slate-600">
            Практические материалы для маркетологов и владельцев бизнеса
          </p>
        </div>
        <div className="mt-12 space-y-6">
          {posts.map((post) => (
            <article
              key={post.slug}
              className="rounded-2xl border border-slate-100 bg-white p-6 shadow-card transition hover:shadow-soft"
            >
              <p className="text-sm text-slate-400">{post.date}</p>
              <h2 className="mt-2 text-2xl font-semibold">
                <Link href={`/blog/${post.slug}`} className="hover:text-brand-600">
                  {post.title}
                </Link>
              </h2>
              <p className="mt-2 text-slate-600">{post.description}</p>
              <Link
                href={`/blog/${post.slug}`}
                className="mt-4 inline-block text-sm font-medium text-brand-600 hover:underline"
              >
                Читать дальше →
              </Link>
            </article>
          ))}
        </div>
      </div>
    </div>
  );
}
