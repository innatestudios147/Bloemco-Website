import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { supabase, supabaseConfigured } from '../lib/supabase';
import type { BlogPost } from '../lib/types';

function formatDate(iso: string | null) {
  if (!iso) return '';
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
}

function readingMinutes(html: string) {
  const text = html.replace(/<[^>]+>/g, ' ');
  const words = text.split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.round(words / 200));
}

export function BlogDetail() {
  const { slug } = useParams<{ slug: string }>();
  const [post, setPost] = useState<BlogPost | null | undefined>(undefined); // undefined = loading

  useEffect(() => {
    if (!supabaseConfigured || !slug) { setPost(null); return; }
    // RLS does the access control here: published posts are visible to
    // everyone, drafts only to their author or an admin — so a draft a
    // visitor isn't allowed to see simply isn't returned, same as a post
    // that doesn't exist at all. No separate 403 path needed.
    supabase
      .from('blog_posts')
      .select('*, blog_categories(id, name, slug)')
      .eq('slug', slug)
      .maybeSingle()
      .then(({ data }) => setPost((data as BlogPost) ?? null));
  }, [slug]);

  useEffect(() => {
    if (post) document.title = `${post.title} | Bloem Consulting Services`;
  }, [post]);

  if (post === undefined) {
    return <div className="portal-wrap"><p>Loading…</p></div>;
  }

  if (post === null) {
    return (
      <div className="portal-wrap portal-narrow">
        <h1 className="portal-title">Article not found</h1>
        <p className="portal-subtitle">This article doesn't exist, or isn't published.</p>
        <Link to="/blog" className="btn btn-primary">All articles</Link>
      </div>
    );
  }

  const meta = [
    post.author_name && `By ${post.author_name}`,
    formatDate(post.published_at),
    `${readingMinutes(post.body)} min read`,
  ].filter(Boolean);

  return (
    <>
      <section className="banner article-banner">
        {post.blog_categories && <span className="article-tag">{post.blog_categories.name}</span>}
        <h1>{post.title}</h1>
        <div className="article-meta">{meta.map((m, i) => <span key={i}>{m}</span>)}</div>
      </section>

      <main className="article-wrap">
        <Link to="/blog" className="back-link">&larr; All articles</Link>
        {post.cover_image_url && (
          <figure className="article-cover"><img src={post.cover_image_url} alt="" /></figure>
        )}
        {/* Body HTML is sanitized server-side (posts-write edge function) on
            every save, never trusted from the editor's raw output. */}
        <article className="article-body" dangerouslySetInnerHTML={{ __html: post.body }} />

        {post.images.length > 0 && (
          <section style={{ marginTop: 50 }}>
            <h2 className="section-title"><span>Gallery</span></h2>
            <div className="insights-grid">
              {post.images.map((src) => (
                <div className="insight-img" key={src} style={{ borderRadius: 20 }}>
                  <img src={src} alt="" loading="lazy" />
                </div>
              ))}
            </div>
          </section>
        )}

        {post.attachments.length > 0 && (
          <section style={{ marginTop: 50 }}>
            <h2 className="section-title"><span>Resources</span></h2>
            {post.attachments.map((a) => (
              <div className="attachment-row" key={a.url}>
                <span>{a.name}</span>
                <a className="btn btn-secondary" href={a.url} download target="_blank" rel="noopener noreferrer">Download</a>
              </div>
            ))}
          </section>
        )}

        <div className="article-footer">
          <span>{post.author_name ? <>Written by <strong>{post.author_name}</strong></> : 'Bloem Consulting Services'}</span>
          <Link to="/blog" className="back-link" style={{ margin: 0 }}>More articles &rarr;</Link>
        </div>
      </main>
    </>
  );
}
