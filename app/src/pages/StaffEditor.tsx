import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { supabase } from '../lib/supabase';
import { uploadDocument, uploadImage } from '../lib/upload';
import { RichTextEditor, insertImageAtCaret } from '../components/RichTextEditor';
import type { Attachment, BlogCategory, BlogPost } from '../lib/types';

export function StaffEditor() {
  const { id } = useParams<{ id: string }>();
  const isNew = !id;
  const navigate = useNavigate();
  const { user, isAdmin } = useAuth();

  const [loading, setLoading] = useState(!isNew);
  const [title, setTitle] = useState('');
  const [excerpt, setExcerpt] = useState('');
  const [body, setBody] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [coverImage, setCoverImage] = useState<string | null>(null);
  const [images, setImages] = useState<string[]>([]);
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [authorId, setAuthorId] = useState<string>('');
  const [categories, setCategories] = useState<BlogCategory[]>([]);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [addingCategory, setAddingCategory] = useState(false);

  const [busy, setBusy] = useState<'draft' | 'publish' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const coverInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);
  const attachmentInputRef = useRef<HTMLInputElement>(null);
  const editorImageInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { document.title = `${isNew ? 'New' : 'Edit'} article | Bloem Consulting Services`; }, [isNew]);

  useEffect(() => {
    supabase.from('blog_categories').select('*').order('name').then(({ data }) => setCategories((data as BlogCategory[]) || []));
  }, []);

  useEffect(() => {
    if (isNew || !id) return;
    supabase.from('blog_posts').select('*').eq('id', id).maybeSingle().then(({ data, error }) => {
      if (error || !data) { setError(error?.message || 'Article not found.'); setLoading(false); return; }
      const post = data as BlogPost;
      setTitle(post.title);
      setExcerpt(post.excerpt);
      setBody(post.body);
      setCategoryId(post.category_id || '');
      setCoverImage(post.cover_image_url);
      setImages(post.images || []);
      setAttachments(post.attachments || []);
      setAuthorId(post.author_id);
      setLoading(false);
    });
  }, [id, isNew]);

  async function handleAddCategory() {
    const name = newCategoryName.trim();
    if (!name) return;
    setAddingCategory(true);
    const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
    const { data, error } = await supabase.from('blog_categories').insert({ name, slug }).select().single();
    setAddingCategory(false);
    if (error) { setUploadError(error.message); return; }
    setCategories((prev) => [...prev, data as BlogCategory].sort((a, b) => a.name.localeCompare(b.name)));
    setCategoryId((data as BlogCategory).id);
    setNewCategoryName('');
  }

  async function handleCoverUpload(file: File) {
    setUploadError(null);
    try {
      const uploaded = await uploadImage(file, 'covers');
      setCoverImage(uploaded.url);
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : 'Upload failed.');
    }
  }

  async function handleGalleryUpload(files: FileList) {
    setUploadError(null);
    for (const file of Array.from(files)) {
      try {
        const uploaded = await uploadImage(file, 'gallery');
        setImages((prev) => [...prev, uploaded.url]);
      } catch (err) {
        setUploadError(err instanceof Error ? err.message : 'Upload failed.');
      }
    }
  }

  async function handleAttachmentUpload(files: FileList) {
    setUploadError(null);
    for (const file of Array.from(files)) {
      try {
        const uploaded = await uploadDocument(file);
        setAttachments((prev) => [...prev, uploaded]);
      } catch (err) {
        setUploadError(err instanceof Error ? err.message : 'Upload failed.');
      }
    }
  }

  async function handleEditorImageUpload(file: File) {
    setUploadError(null);
    try {
      const uploaded = await uploadImage(file, 'editor');
      insertImageAtCaret(uploaded.url, '');
      setBody(document.querySelector('.editor-body')?.innerHTML || body);
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : 'Upload failed.');
    }
  }

  const canSave = body.replace(/<[^>]+>/g, '').trim().length > 0 || attachments.length > 0;

  async function save(status: 'draft' | 'published') {
    if (!title.trim()) { setError('Please give the article a title.'); return; }
    if (!canSave) { setError('Write something in the article, or attach at least one document, before saving.'); return; }
    setError(null);
    setBusy(status === 'published' ? 'publish' : 'draft');

    const { data, error } = await supabase.functions.invoke('posts-write', {
      body: {
        id: isNew ? undefined : id,
        title: title.trim(),
        excerpt: excerpt.trim() || undefined,
        body,
        category_id: categoryId || null,
        cover_image_url: coverImage,
        images,
        attachments,
        status,
      },
    });

    setBusy(null);
    if (error) {
      setError((data as { error?: string } | null)?.error || error.message);
      return;
    }
    navigate('/staff');
  }

  if (loading) return <div className="portal-wrap"><p>Loading…</p></div>;

  if (!isNew && user && authorId && authorId !== user.id && !isAdmin) {
    return (
      <div className="portal-wrap portal-narrow">
        <div className="portal-notice error">You can only edit your own articles.</div>
      </div>
    );
  }

  return (
    <div className="portal-wrap">
      <div className="portal-header-row">
        <h1 className="portal-title">{isNew ? 'New article' : 'Edit article'}</h1>
      </div>

      {error && <div className="portal-notice error" style={{ marginBottom: 24 }}>{error}</div>}
      {uploadError && <div className="portal-notice error" style={{ marginBottom: 24 }}>{uploadError}</div>}

      <div className="editor-grid">
        <div>
          <div className="field">
            <label htmlFor="title">Title</label>
            <input id="title" type="text" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Article title" />
          </div>

          <div className="field">
            <label htmlFor="excerpt">Summary (optional)</label>
            <textarea
              id="excerpt"
              value={excerpt}
              onChange={(e) => setExcerpt(e.target.value)}
              placeholder="Shown on the article cards. Leave blank to generate one automatically from the article."
            />
          </div>

          <div className="field">
            <label>Article</label>
            <RichTextEditor value={body} onChange={setBody} onInsertImage={() => editorImageInputRef.current?.click()} />
            <input
              ref={editorImageInputRef}
              type="file"
              accept="image/*"
              style={{ display: 'none' }}
              onChange={(e) => e.target.files?.[0] && handleEditorImageUpload(e.target.files[0])}
            />
          </div>
        </div>

        <div>
          <div className="editor-sidebar-card">
            <h4>Category</h4>
            <div className="field" style={{ marginBottom: 12 }}>
              <select value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
                <option value="">No category</option>
                {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div className="btn-row">
              <input
                type="text"
                placeholder="New category name"
                value={newCategoryName}
                onChange={(e) => setNewCategoryName(e.target.value)}
                style={{ flex: 1, border: '1px solid rgba(0,0,0,0.12)', borderRadius: 10, padding: '8px 12px', fontSize: 14 }}
              />
              <button type="button" className="btn btn-secondary" disabled={addingCategory || !newCategoryName.trim()} onClick={handleAddCategory}>
                Add
              </button>
            </div>
          </div>

          <div className="editor-sidebar-card">
            <h4>Cover image</h4>
            {coverImage && <div className="cover-preview"><img src={coverImage} alt="" /></div>}
            <input ref={coverInputRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={(e) => e.target.files?.[0] && handleCoverUpload(e.target.files[0])} />
            <button type="button" className="btn btn-secondary" onClick={() => coverInputRef.current?.click()} style={{ width: '100%' }}>
              {coverImage ? 'Replace cover image' : 'Choose an image'}
            </button>
          </div>

          <div className="editor-sidebar-card">
            <h4>Photo gallery</h4>
            <div className="upload-list">
              {images.map((src) => (
                <div className="upload-thumb" key={src}>
                  <img src={src} alt="" />
                  <button type="button" className="remove-btn" onClick={() => setImages((prev) => prev.filter((i) => i !== src))}>×</button>
                </div>
              ))}
            </div>
            <input ref={galleryInputRef} type="file" accept="image/*" multiple style={{ display: 'none' }} onChange={(e) => e.target.files && handleGalleryUpload(e.target.files)} />
            <button type="button" className="btn btn-secondary" onClick={() => galleryInputRef.current?.click()} style={{ width: '100%', marginTop: 12 }}>
              Add photos
            </button>
          </div>

          <div className="editor-sidebar-card">
            <h4>Attachments</h4>
            {attachments.map((a) => (
              <div className="attachment-row" key={a.url}>
                <span>{a.name}</span>
                <button type="button" className="link-btn" style={{ color: '#a1332a' }} onClick={() => setAttachments((prev) => prev.filter((x) => x.url !== a.url))}>Remove</button>
              </div>
            ))}
            <input ref={attachmentInputRef} type="file" multiple style={{ display: 'none' }} onChange={(e) => e.target.files && handleAttachmentUpload(e.target.files)} />
            <button type="button" className="btn btn-secondary" onClick={() => attachmentInputRef.current?.click()} style={{ width: '100%', marginTop: 12 }}>
              Add document
            </button>
          </div>

          <div className="btn-row" style={{ flexDirection: 'column', alignItems: 'stretch' }}>
            <button className="btn btn-primary" disabled={busy !== null} onClick={() => save('published')}>
              {busy === 'publish' ? 'Publishing…' : 'Publish'}
            </button>
            <button className="btn btn-secondary" disabled={busy !== null} onClick={() => save('draft')}>
              {busy === 'draft' ? 'Saving…' : 'Save as draft'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
