// Makes the editor's preview pane look like the published article page.
/* global CMS, createClass, h */
(function () {
  if (!window.CMS) return;

  CMS.registerPreviewStyle('/assets/insights.css');

  function formatDate(value) {
    var date = value ? new Date(value) : null;
    if (!date || isNaN(date.getTime())) return '';
    return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });
  }

  var ArticlePreview = createClass({
    render: function () {
      var entry = this.props.entry;
      var get = function (field) { return entry.getIn(['data', field]); };
      var image = get('image');
      var imageUrl = image ? String(this.props.getAsset(image) || '') : '';
      var meta = [
        get('author') ? 'By ' + get('author') : '',
        formatDate(get('date'))
      ].filter(Boolean).join('  ·  ');

      return h('div', { className: 'cms-preview' },
        h('div', { className: 'cms-preview-note' }, 'Preview: this is how the article will look on the website.'),
        h('section', { className: 'banner article-banner' },
          get('category') ? h('span', { className: 'article-tag' }, get('category')) : null,
          h('h1', {}, get('title') || 'Untitled article'),
          h('div', { className: 'article-meta' }, h('span', {}, meta))
        ),
        h('main', { className: 'article-wrap' },
          imageUrl ? h('figure', { className: 'article-cover' }, h('img', { src: imageUrl, alt: get('image_alt') || '' })) : null,
          h('article', { className: 'article-body' }, this.props.widgetFor('body'))
        )
      );
    }
  });

  CMS.registerPreviewTemplate('insights', ArticlePreview);
})();
