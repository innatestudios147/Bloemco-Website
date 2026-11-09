import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { supabase, supabaseConfigured } from '../lib/supabase';
import type { BlogCategory, BlogPost } from '../lib/types';

const ARROW = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <line x1="5" y1="12" x2="19" y2="12"></line>
    <polyline points="12 5 19 12 12 19"></polyline>
  </svg>
);

function formatDate(iso: string | null) {
  if (!iso) return '';
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
}

export function BlogList() {
  const [params, setParams] = useSearchParams();
  const activeCategory = params.get('category') || '';
  const [categories, setCategories] = useState<BlogCategory[]>([]);
  const [posts, setPosts] = useState<BlogPost[] | null>(null);

  useEffect(() => {
    document.title = 'Blog | Bloem Consulting Services';
  }, []);

  useEffect(() => {
    if (!supabaseConfigured) { setPosts([]); return; }
    supabase.from('blog_categories').select('*').order('name').then(({ data }) => setCategories((data as BlogCategory[]) || []));
  }, []);

  useEffect(() => {
    if (!supabaseConfigured) { setPosts([]); return; }
    let query = supabase
      .from('blog_posts')
      .select('*, blog_categories(id, name, slug)')
      .eq('status', 'published')
      .order('published_at', { ascending: false, nullsFirst: false })
      .order('created_at', { ascending: false });
    if (activeCategory) query = query.eq('blog_categories.slug', activeCategory);
    query.then(({ data }) => setPosts((data as BlogPost[]) || []));
  }, [activeCategory]);

  const visiblePosts = activeCategory ? (posts || []).filter((p) => p.blog_categories?.slug === activeCategory) : posts;

  return (
    <>
      <section className="banner">
        <img src="/wp-content/uploads/2026/05/bloem-co-star-01.svg" alt="" className="banner-star" />
        <h1>Latest <strong>Articles</strong></h1>
        <p>Perspectives from the Bloem-Co team on governance, policy and delivering complex programmes.</p>
      </section>

      <main className="insights-wrap">
        {categories.length > 0 && (
          <div className="category-tabs">
            <button
              className={`category-tab${!activeCategory ? ' active' : ''}`}
              onClick={() => setParams({})}
            >
              All
            </button>
            {categories.map((c) => (
              <button
                key={c.id}
                className={`category-tab${activeCategory === c.slug ? ' active' : ''}`}
                onClick={() => setParams({ category: c.slug })}
              >
                {c.name}
              </button>
            ))}
          </div>
        )}

        {!supabaseConfigured && (
          <div className="insights-empty"><p>The blog isn't connected to its backend yet — check back once it's set up.</p></div>
        )}
        {supabaseConfigured && posts === null && <div className="insights-empty"><p>Loading…</p></div>}
        {supabaseConfigured && posts !== null && visiblePosts!.length === 0 && (
          <div className="insights-empty"><p>New articles are on their way — check back soon.</p></div>
        )}
        {supabaseConfigured && visiblePosts && visiblePosts.length > 0 && (
          <div className="insights-grid">
            {visiblePosts.map((post) => (
              <Link to={`/blog/${post.slug}`} className="insight-card" key={post.id}>
                <div className="insight-img">
                  {post.cover_image_url && <img src={post.cover_image_url} alt="" loading="lazy" />}
                </div>
                <div className="insight-body">
                  <div className="insight-meta">
                    {[post.blog_categories?.name, formatDate(post.published_at)].filter(Boolean).join(' · ')}
                  </div>
                  <h2 className="insight-title">{post.title}</h2>
                  <p className="insight-summary">{post.excerpt}</p>
                  <span className="insight-link">Read Article {ARROW}</span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </main>
    </>
  );
}
