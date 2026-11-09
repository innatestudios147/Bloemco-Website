// Fetches the most recent published blog posts straight from Supabase's
// auto-generated REST API (PostgREST) and renders them into the home page's
// "Latest Articles" grid. No SDK needed for this simple a read, and the
// anon key below is the public, read-only key: safe to ship in the page.
(function () {
  var grid = document.getElementById('latest-articles-grid');
  if (!grid) return;

  var config = window.__SUPABASE_CONFIG__;
  if (!config || !config.url || !config.anonKey) {
    grid.innerHTML = '<p class="blog-empty" style="grid-column:1/-1;text-align:center;">New articles are on their way — check back soon.</p>';
    return;
  }

  var ARROW = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><line x1="5" y1="12" x2="19" y2="12"></line><polyline points="12 5 19 12 12 19"></polyline></svg>';

  function escapeHtml(value) {
    return String(value == null ? '' : value).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function card(post) {
    var meta = post.blog_categories && post.blog_categories.name
      ? post.blog_categories.name
      : new Date(post.published_at || post.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
    var img = post.cover_image_url
      ? '<img src="' + escapeHtml(post.cover_image_url) + '" alt="" loading="lazy">'
      : '';
    return '' +
      '<a href="/blog/' + encodeURIComponent(post.slug) + '/" class="blog-card">' +
      '  <div class="blog-img-box">' + img + '</div>' +
      '  <div class="blog-meta">' + escapeHtml(meta) + '</div>' +
      '  <h3 class="blog-title">' + escapeHtml(post.title) + '</h3>' +
      '  <div class="blog-arrow">Read Article ' + ARROW + '</div>' +
      '</a>';
  }

  var url = config.url.replace(/\/+$/, '')
    + '/rest/v1/blog_posts?select=slug,title,cover_image_url,published_at,created_at,blog_categories(name)'
    + '&status=eq.published&order=published_at.desc.nullslast,created_at.desc&limit=3';

  fetch(url, { headers: { apikey: config.anonKey, Authorization: 'Bearer ' + config.anonKey } })
    .then(function (res) { if (!res.ok) throw new Error('request failed'); return res.json(); })
    .then(function (posts) {
      if (!posts || !posts.length) {
        grid.innerHTML = '<p class="blog-empty" style="grid-column:1/-1;text-align:center;">New articles are on their way — check back soon.</p>';
        return;
      }
      grid.innerHTML = posts.map(card).join('\n');
    })
    .catch(function () {
      grid.innerHTML = '<p class="blog-empty" style="grid-column:1/-1;text-align:center;">New articles are on their way — check back soon.</p>';
    });
})();
