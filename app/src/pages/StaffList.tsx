import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { supabase } from '../lib/supabase';
import type { BlogCategory, BlogPost } from '../lib/types';

export function StaffList() {
  const { profile, isAdmin } = useAuth();
  const [posts, setPosts] = useState<BlogPost[] | null>(null);
  const [categories, setCategories] = useState<BlogCategory[]>([]);
  const [categoryFilter, setCategoryFilter] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => { document.title = 'Staff portal | Bloem Consulting Services'; }, []);

  async function load() {
    setError(null);
    const { data, error } = await supabase
      .from('blog_posts')
      .select('*, blog_categories(id, name, slug)')
      .order('updated_at', { ascending: false });
    if (error) { setError(error.message); return; }
    setPosts((data as BlogPost[]) || []);
  }

  useEffect(() => {
    load();
    supabase.from('blog_categories').select('*').order('name').then(({ data }) => setCategories((data as BlogCategory[]) || []));
  }, []);

  async function handleDelete(post: BlogPost) {
    if (!window.confirm(`Delete "${post.title}"? This can't be undone.`)) return;
    const { error } = await supabase.from('blog_posts').delete().eq('id', post.id);
    if (error) { setError(error.message); return; }
    setPosts((prev) => prev?.filter((p) => p.id !== post.id) ?? null);
  }

  const filtered = categoryFilter ? (posts || []).filter((p) => p.blog_categories?.slug === categoryFilter) : posts;
  const draftCount = (posts || []).filter((p) => p.status === 'draft').length;
  const publishedCount = (posts || []).filter((p) => p.status === 'published').length;

  return (
    <div className="portal-wrap">
      <div className="portal-header-row">
        <div>
          <h1 className="portal-title">{isAdmin ? 'All articles' : 'Your articles'}</h1>
          <p className="portal-subtitle">
            {publishedCount} published · {draftCount} draft{draftCount === 1 ? '' : 's'}
            {profile?.display_name ? ` · signed in as ${profile.display_name}` : ''}
          </p>
        </div>
        <div className="btn-row">
          {isAdmin && <Link to="/staff/users" className="btn btn-secondary">Manage staff</Link>}
          <Link to="/staff/new" className="btn btn-primary">New article</Link>
        </div>
      </div>

      {error && <div className="portal-notice error" style={{ marginBottom: 24 }}>{error}</div>}

      {categories.length > 0 && (
        <div className="category-tabs" style={{ justifyContent: 'flex-start', padding: 0, margin: '0 0 24px' }}>
          <button className={`category-tab${!categoryFilter ? ' active' : ''}`} onClick={() => setCategoryFilter('')}>All</button>
          {categories.map((c) => (
            <button key={c.id} className={`category-tab${categoryFilter === c.slug ? ' active' : ''}`} onClick={() => setCategoryFilter(c.slug)}>
              {c.name}
            </button>
          ))}
        </div>
      )}

      {posts === null ? (
        <p>Loading…</p>
      ) : filtered!.length === 0 ? (
        <div className="portal-card"><p>No articles yet. Click "New article" to write the first one.</p></div>
      ) : (
        <table className="portal-table">
          <thead>
            <tr><th>Title</th><th>Status</th><th>Category</th><th>Author</th><th>Updated</th><th></th></tr>
          </thead>
          <tbody>
            {filtered!.map((post) => (
              <tr key={post.id}>
                <td>{post.title}</td>
                <td><span className={`status-badge ${post.status}`}>{post.status}</span></td>
                <td>{post.blog_categories?.name || '—'}</td>
                <td>{post.author_name}</td>
                <td>{new Date(post.updated_at).toLocaleDateString('en-GB')}</td>
                <td className="actions">
                  <Link to={`/staff/edit/${post.id}`} className="link-btn">Edit</Link>
                  <button className="link-btn" style={{ color: '#a1332a' }} onClick={() => handleDelete(post)}>Delete</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
