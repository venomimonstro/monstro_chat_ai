import { notFound } from 'next/navigation';
import ReactMarkdown from 'react-markdown';
import { getAllPosts, getPostBySlug } from '@/lib/blog';

export function generateStaticParams() {
  return getAllPosts().map((post) => ({ slug: post.slug }));
}

export function generateMetadata({ params }: { params: { slug: string } }) {
  const post = getPostBySlug(params.slug);
  if (!post) return {};
  return {
    title: post.title,
    description: post.description,
  };
}

export default function BlogPostPage({ params }: { params: { slug: string } }) {
  const post = getPostBySlug(params.slug);
  if (!post) notFound();

  return (
    <div className="bg-slate-50">
      <article className="prose mx-auto max-w-3xl px-4 py-16 md:py-24">
        <p className="text-sm text-slate-400">{post.date}</p>
        <h1 className="text-3xl font-bold text-slate-900 md:text-4xl">{post.title}</h1>
        <div className="mt-8 rounded-2xl bg-white p-6 shadow-card md:p-10">
          <ReactMarkdown>{post.content}</ReactMarkdown>
        </div>
      </article>
    </div>
  );
}
