// Builds the site for Netlify: copies public/ to dist/, then turns the
// articles in content/insights/*.md (written by staff in /admin) into pages.
//
//   npm run build        -> dist/ (what Netlify publishes)
//
// Until at least one article is published, dist/ is an exact copy of public/,
// so the live site looks the same as before the blog existed.

import { cp, mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import matter from 'gray-matter';
import { Marked } from 'marked';
import sanitizeHtml from 'sanitize-html';

const ROOT = path.resolve(import.meta.dirname, '..');
const SRC = path.join(ROOT, 'public');
const OUT = path.join(ROOT, 'dist');
const ARTICLES = path.join(ROOT, 'content', 'insights');
const LAYOUT = path.join(ROOT, 'templates', 'layout.html');

// Netlify sets URL to the site's main address (the custom domain once added).
const SITE_URL = (process.env.URL || 'https://bloem-co.com').replace(/\/+$/, '');
const BLOG_DESCRIPTION = 'Perspectives from the Bloem-Co team on governance, policy and delivering complex programmes.';
const HOME_CARD_COUNT = 3;

const ARROW = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><line x1="5" y1="12" x2="19" y2="12"></line><polyline points="12 5 19 12 12 19"></polyline></svg>';

// ---------------------------------------------------------------- helpers

const escapeHtml = (value) => String(value ?? '').replace(/[&<>"']/g, (c) => (
  { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
));

const formatDate = (date) => date.toLocaleDateString('en-GB', {
  day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC',
});

const absoluteUrl = (url) => (/^https?:\/\//i.test(url) ? url : SITE_URL + (url.startsWith('/') ? url : `/${url}`));

// Only allow ordinary web addresses or site paths for cover images.
const safeImageUrl = (url) => {
  const value = String(url ?? '').trim();
  return /^(https:\/\/|\/)[^\s"'<>]*$/i.test(value) ? value : '';
};

const isExternal = (href) => /^https?:\/\//i.test(href) && !href.startsWith(SITE_URL)
  && !/^https?:\/\/(www\.)?bloem-co\.com/i.test(href);

// ------------------------------------------------- markdown -> safe HTML

const markdown = new Marked({ gfm: true, breaks: false });

// Staff can only produce ordinary article markup. Scripts, styles, forms,
// event handlers and javascript: links are stripped, so even a misused or
// compromised editor account cannot inject code into the public site.
const SANITIZE = {
  allowedTags: [
    'h2', 'h3', 'h4', 'h5', 'h6', 'p', 'br', 'hr', 'blockquote', 'ul', 'ol', 'li',
    'strong', 'b', 'em', 'i', 'u', 's', 'del', 'sub', 'sup', 'mark', 'small', 'abbr', 'cite', 'q',
    'a', 'img', 'figure', 'figcaption', 'code', 'pre', 'span', 'div',
    'table', 'caption', 'thead', 'tbody', 'tfoot', 'tr', 'th', 'td', 'iframe',
  ],
  allowedAttributes: {
    a: ['href', 'title', 'target', 'rel'],
    img: ['src', 'alt', 'title', 'width', 'height', 'loading'],
    th: ['align', 'colspan', 'rowspan'],
    td: ['align', 'colspan', 'rowspan'],
    iframe: ['src', 'title', 'allow', 'allowfullscreen', 'loading'],
    abbr: ['title'],
  },
  allowedSchemes: ['https', 'http', 'mailto', 'tel'],
  allowedSchemesByTag: { img: ['https', 'http'], iframe: ['https'] },
  allowProtocolRelative: false,
  // Video embeds only from YouTube and Vimeo.
  allowedIframeHostnames: ['www.youtube.com', 'www.youtube-nocookie.com', 'player.vimeo.com'],
  transformTags: {
    // The page title is the only <h1>; demote any in the article body.
    h1: 'h2',
    a: (tagName, attribs) => {
      const attrs = { ...attribs };
      if (attrs.href && isExternal(attrs.href)) {
        attrs.target = '_blank';
        attrs.rel = 'noopener noreferrer';
      } else {
        delete attrs.target;
        delete attrs.rel;
      }
      return { tagName, attribs: attrs };
    },
    img: (tagName, attribs) => ({ tagName, attribs: { ...attribs, loading: 'lazy' } }),
    iframe: (tagName, attribs) => ({ tagName, attribs: { ...attribs, loading: 'lazy', allowfullscreen: '' } }),
  },
  exclusiveFilter: (frame) => frame.tag === 'iframe' && !frame.attribs.src,
};

const renderBody = (md) => sanitizeHtml(markdown.parse(md || ''), SANITIZE);

// ------------------------------------------------------------- articles

async function loadArticles() {
  let files = [];
  try {
    files = (await readdir(ARTICLES)).filter((f) => f.endsWith('.md'));
  } catch (err) {
    if (err.code !== 'ENOENT') throw err;
  }

  const articles = [];
  for (const file of files) {
    const slug = file.slice(0, -3).toLowerCase();
    if (!/^[a-z0-9][a-z0-9-]*$/.test(slug)) {
      console.warn(`! Skipping ${file}: file name must be lowercase letters, numbers and dashes.`);
      continue;
    }
    // A broken file stops the build on purpose: Netlify then keeps the
    // previous version of the site live instead of publishing a broken one.
    const { data, content } = matter(await readFile(path.join(ARTICLES, file), 'utf8'));

    const title = String(data.title ?? '').trim();
    const date = data.date instanceof Date ? data.date : new Date(data.date);
    if (!title || Number.isNaN(date.getTime())) {
      console.warn(`! Skipping ${file}: it needs a title and a valid publish date.`);
      continue;
    }

    const plain = content.replace(/[#>*_`~[\]()!|-]/g, ' ').replace(/\s+/g, ' ').trim();
    const summary = String(data.summary ?? '').trim()
      || (plain.length > 200 ? `${plain.slice(0, 197).replace(/\s+\S*$/, '')}…` : plain);

    articles.push({
      slug,
      title,
      date,
      author: String(data.author ?? '').trim(),
      category: String(data.category ?? '').trim(),
      summary,
      image: safeImageUrl(data.image),
      imageAlt: String(data.image_alt ?? '').trim(),
      readingMinutes: Math.max(1, Math.round(plain.split(' ').filter(Boolean).length / 200)),
      html: renderBody(content),
      url: `/insights/${slug}/`,
    });
  }
  // Newest first; same-day articles by title so the order is stable.
  return articles.sort((a, b) => b.date - a.date || a.title.localeCompare(b.title));
}

// ---------------------------------------------------------------- markup

const metaLine = (a) => [a.category, formatDate(a.date)].filter(Boolean).map(escapeHtml).join(' · ');

const imageTag = (a) => (a.image
  ? `<img src="${escapeHtml(a.image)}" alt="${escapeHtml(a.imageAlt)}" loading="lazy">`
  : '');

const listingCard = (a) => `
      <a href="${a.url}" class="insight-card">
        <div class="insight-img">${imageTag(a)}</div>
        <div class="insight-body">
          <div class="insight-meta">${metaLine(a)}</div>
          <h2 class="insight-title">${escapeHtml(a.title)}</h2>
          <p class="insight-summary">${escapeHtml(a.summary)}</p>
          <span class="insight-link">Read Article ${ARROW}</span>
        </div>
      </a>`;

// Same markup and classes as the home page's original "Latest Insights" cards.
const homeCard = (a) => `
            <a href="${a.url}" class="blog-card">
                <div class="blog-img-box">
                    ${imageTag(a)}
                </div>
                <div class="blog-meta">${escapeHtml(a.category || formatDate(a.date))}</div>
                <h3 class="blog-title">${escapeHtml(a.title)}</h3>
                <div class="blog-arrow">
                    Read Article
                    ${ARROW}
                </div>
            </a>`;

function renderLayout(layout, { title, description, canonical, ogType, ogTitle, ogImage, content }) {
  const values = {
    title: escapeHtml(title),
    description: escapeHtml(description),
    canonical: escapeHtml(canonical),
    og_type: ogType,
    og_title: escapeHtml(ogTitle),
    og_image: ogImage ? `<meta property="og:image" content="${escapeHtml(absoluteUrl(ogImage))}">` : '',
    year: String(new Date().getFullYear()),
    content,
  };
  return layout.replace(/\{\{(\w+)\}\}/g, (match, key) => (key in values ? values[key] : match));
}

const listingPage = (layout, articles) => renderLayout(layout, {
  title: 'Insights | Bloem Consulting Services',
  description: BLOG_DESCRIPTION,
  canonical: `${SITE_URL}/insights/`,
  ogType: 'website',
  ogTitle: 'Insights | Bloem Consulting Services',
  ogImage: articles[0]?.image,
  content: `
  <section class="banner">
    <img src="https://bloem-co.com/wp-content/uploads/2026/05/bloem-co-star-01.svg" alt="" class="banner-star">
    <h1>Latest <strong>Insights</strong></h1>
    <p>${escapeHtml(BLOG_DESCRIPTION)}</p>
  </section>

  <main class="insights-wrap">
    <div class="insights-grid">${articles.map(listingCard).join('')}
    </div>
  </main>`,
});

function articlePage(layout, article, articles) {
  const others = articles.filter((a) => a !== article).slice(0, 3);
  const meta = [
    article.author && `<span>By ${escapeHtml(article.author)}</span>`,
    `<span><time datetime="${article.date.toISOString().slice(0, 10)}">${formatDate(article.date)}</time></span>`,
    `<span>${article.readingMinutes} min read</span>`,
  ].filter(Boolean).join('');

  return renderLayout(layout, {
    title: `${article.title} | Bloem Consulting Services`,
    description: article.summary,
    canonical: SITE_URL + article.url,
    ogType: 'article',
    ogTitle: article.title,
    ogImage: article.image,
    content: `
  <section class="banner article-banner">
    ${article.category ? `<span class="article-tag">${escapeHtml(article.category)}</span>` : ''}
    <h1>${escapeHtml(article.title)}</h1>
    <div class="article-meta">${meta}</div>
  </section>

  <main class="article-wrap">
    <a href="/insights/" class="back-link">&larr; All insights</a>
    ${article.image ? `<figure class="article-cover"><img src="${escapeHtml(article.image)}" alt="${escapeHtml(article.imageAlt)}"></figure>` : ''}
    <article class="article-body">
${article.html}
    </article>
    <div class="article-footer">
      <span>${article.author ? `Written by <strong>${escapeHtml(article.author)}</strong>` : 'Bloem Consulting Services'}</span>
      <a href="/insights/" class="back-link" style="margin:0">More insights &rarr;</a>
    </div>
  </main>
${others.length ? `
  <section class="more-insights">
    <h2 class="section-title"><span>More insights</span></h2>
    <div class="insights-grid">${others.map(listingCard).join('')}
    </div>
  </section>` : ''}`,
  });
}

function rssFeed(articles) {
  const items = articles.slice(0, 30).map((a) => `
    <item>
      <title>${escapeHtml(a.title)}</title>
      <link>${SITE_URL}${a.url}</link>
      <guid isPermaLink="true">${SITE_URL}${a.url}</guid>
      <pubDate>${a.date.toUTCString()}</pubDate>
      ${a.category ? `<category>${escapeHtml(a.category)}</category>` : ''}
      <description>${escapeHtml(a.summary)}</description>
    </item>`).join('');
  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>Bloem Consulting Services – Insights</title>
    <link>${SITE_URL}/insights/</link>
    <description>${escapeHtml(BLOG_DESCRIPTION)}</description>
    <language>en-za</language>${items}
  </channel>
</rss>
`;
}

// ------------------------------------------------ existing pages changes

const NAV_TEAM_LINK = /(\s*)(<li><a href="\/team\/"[^>]*>Team<\/a><\/li>)/g;

function addInsightsLink(html, file) {
  let count = 0;
  const out = html.replace(NAV_TEAM_LINK, (match, space, teamLink) => {
    count += 1;
    return `${space}<li><a href="/insights/">Insights</a></li>${space}${teamLink}`;
  });
  if (count === 0 && file !== '404.html') console.warn(`! No menu found in ${file}; Insights link not added there.`);
  return out;
}

function updateHome(html, articles) {
  const start = html.indexOf('<!-- insights:start');
  const end = html.indexOf('<!-- insights:end -->');
  if (start === -1 || end === -1) {
    console.warn('! Home page markers missing; "Latest Insights" left unchanged.');
    return html;
  }
  const cards = articles.slice(0, HOME_CARD_COUNT).map(homeCard).join('\n');
  html = `${html.slice(0, start)}${cards.trimStart()}\n            ${html.slice(end)}`;
  return html.replace(
    '<!-- insights:view-all -->',
    '<div class="services-cta-wrap" style="margin-top:50px;"><a href="/insights/" class="services-cta-link">View all insights</a></div>',
  );
}

async function htmlFiles(dir) {
  const entries = await readdir(dir, { withFileTypes: true, recursive: true });
  return entries
    .filter((e) => e.isFile() && e.name.endsWith('.html'))
    .map((e) => path.join(e.parentPath ?? e.path, e.name));
}

// ------------------------------------------------------------------ main

async function main() {
  await rm(OUT, { recursive: true, force: true });
  await cp(SRC, OUT, { recursive: true });

  const articles = await loadArticles();
  if (articles.length === 0) {
    console.log('No published articles yet: site built unchanged.');
    return;
  }

  // Link the blog from every page's menu and footer, and fill the home cards.
  for (const file of await htmlFiles(OUT)) {
    const rel = path.relative(OUT, file);
    if (rel.startsWith(`admin${path.sep}`)) continue;
    let html = await readFile(file, 'utf8');
    html = addInsightsLink(html, rel);
    if (rel === 'index.html') html = updateHome(html, articles);
    await writeFile(file, html);
  }

  const layout = await readFile(LAYOUT, 'utf8');
  const blogDir = path.join(OUT, 'insights');
  await mkdir(blogDir, { recursive: true });
  await writeFile(path.join(blogDir, 'index.html'), listingPage(layout, articles));
  await writeFile(path.join(blogDir, 'feed.xml'), rssFeed(articles));
  for (const article of articles) {
    const dir = path.join(blogDir, article.slug);
    await mkdir(dir, { recursive: true });
    await writeFile(path.join(dir, 'index.html'), articlePage(layout, article, articles));
  }
  console.log(`Built ${articles.length} article${articles.length === 1 ? '' : 's'}: ${articles.map((a) => a.slug).join(', ')}`);
}

await main();
