// POST /functions/v1/posts-write
// Staff only. The sole write path for articles: sanitizes the HTML body
// server-side on every save (never trusts the rich-text editor's raw
// output), generates and dedupes the slug, auto-builds the excerpt from the
// sanitized body when none is supplied, and keeps published_at stable once
// an article has been published once. Direct table writes to blog_posts are
// blocked by RLS (see supabase/migrations/0001_init.sql) specifically so
// this is the only way in.
import sanitizeHtml from 'npm:sanitize-html@2.18.1';
import { handleOptions, json } from '../_shared/cors.ts';
import { getCaller, serviceClient } from '../_shared/caller.ts';

// deno-lint-ignore no-explicit-any
const SANITIZE_OPTIONS: any = {
  allowedTags: [
    'p', 'br', 'hr', 'strong', 'b', 'em', 'i', 'u', 's', 'blockquote',
    'h1', 'h2', 'h3', 'h4', 'ul', 'ol', 'li', 'a', 'img', 'figure', 'figcaption', 'code', 'pre', 'span',
  ],
  allowedAttributes: {
    a: ['href', 'title'],
    img: ['src', 'alt', 'title'],
  },
  allowedSchemes: ['https', 'http', 'mailto'],
  transformTags: {
    // The article title is the page's own h1; demote any in the body.
    h1: 'h2',
    a: (tagName, attribs) => ({
      tagName,
      attribs: { ...attribs, target: '_blank', rel: 'noopener noreferrer' },
    }),
  },
};

function slugify(input: string): string {
  return input
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '') // strip accents
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80)
    .replace(/-+$/g, '') || 'article';
}

function buildExcerpt(html: string): string {
  const text = html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  if (text.length <= 220) return text;
  return `${text.slice(0, 217).replace(/\s+\S*$/, '')}…`;
}

async function uniqueSlug(svc: ReturnType<typeof serviceClient>, base: string, excludeId?: string): Promise<string> {
  let slug = base;
  let n = 2;
  // Small table, small loop — fine to check one at a time.
  // eslint-disable-next-line no-constant-condition
  while (true) {
    let query = svc.from('blog_posts').select('id').eq('slug', slug).limit(1);
    if (excludeId) query = query.neq('id', excludeId);
    const { data } = await query;
    if (!data || data.length === 0) return slug;
    slug = `${base}-${n}`;
    n += 1;
  }
}

Deno.serve(async (req) => {
  const preflight = handleOptions(req);
  if (preflight) return preflight;
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  const caller = await getCaller(req);
  if (!caller || (caller.role !== 'editor' && caller.role !== 'admin')) {
    return json({ error: 'Staff access required.' }, 403);
  }

  let payload: Record<string, unknown>;
  try {
    payload = await req.json();
  } catch {
    return json({ error: 'Invalid request body.' }, 400);
  }

  const title = String(payload.title ?? '').trim();
  if (!title) return json({ error: 'Title is required.' }, 400);

  const status = payload.status === 'published' ? 'published' : 'draft';
  const rawBody = String(payload.body ?? '');
  const sanitizedBody = sanitizeHtml(rawBody, SANITIZE_OPTIONS);
  const excerptInput = typeof payload.excerpt === 'string' ? payload.excerpt.trim() : '';
  const excerpt = excerptInput || buildExcerpt(sanitizedBody);

  const svc = serviceClient();
  const id = typeof payload.id === 'string' ? payload.id : undefined;

  let existing: { author_id: string; title: string; published_at: string | null } | null = null;
  if (id) {
    const { data, error } = await svc
      .from('blog_posts')
      .select('author_id, title, published_at')
      .eq('id', id)
      .maybeSingle();
    if (error || !data) return json({ error: 'Article not found.' }, 404);
    existing = data;
    if (existing.author_id !== caller.userId && caller.role !== 'admin') {
      return json({ error: 'You can only edit your own articles.' }, 403);
    }
  }

  const needsNewSlug = !existing || existing.title !== title;
  const slug = needsNewSlug ? await uniqueSlug(svc, slugify(title), id) : undefined;

  // published_at is set the first time a post is published, and never
  // changes after that — including if it's later unpublished and
  // republished.
  const publishedAtValue = existing
    ? (existing.published_at ?? (status === 'published' ? new Date().toISOString() : null))
    : (status === 'published' ? new Date().toISOString() : null);

  const row = {
    title,
    excerpt,
    body: sanitizedBody,
    category_id: payload.category_id ?? null,
    cover_image_url: payload.cover_image_url ?? null,
    images: Array.isArray(payload.images) ? payload.images : [],
    attachments: Array.isArray(payload.attachments) ? payload.attachments : [],
    status,
    published_at: publishedAtValue,
    ...(slug ? { slug } : {}),
  };

  if (id) {
    const { data, error } = await svc.from('blog_posts').update(row).eq('id', id).select().single();
    if (error) return json({ error: error.message }, 400);
    return json({ post: data }, 200);
  }

  const { data: profile } = await svc
    .from('staff_profiles')
    .select('display_name, email')
    .eq('id', caller.profileId)
    .maybeSingle();

  const { data, error } = await svc
    .from('blog_posts')
    .insert({
      ...row,
      author_id: caller.userId,
      author_name: profile?.display_name || profile?.email || caller.email,
    })
    .select()
    .single();
  if (error) return json({ error: error.message }, 400);
  return json({ post: data }, 201);
});
