import { useEffect, useRef } from 'react';

interface Props {
  value: string;
  onChange: (html: string) => void;
  onInsertImage?: () => void;
}

const BUTTONS: { label: string; title: string; cmd: string; arg?: string }[] = [
  { label: 'B', title: 'Bold', cmd: 'bold' },
  { label: 'I', title: 'Italic', cmd: 'italic' },
  { label: 'U', title: 'Underline', cmd: 'underline' },
  { label: 'H2', title: 'Heading', cmd: 'formatBlock', arg: 'h2' },
  { label: 'H3', title: 'Subheading', cmd: 'formatBlock', arg: 'h3' },
  { label: '¶', title: 'Paragraph', cmd: 'formatBlock', arg: 'p' },
  { label: '“”', title: 'Quote', cmd: 'formatBlock', arg: 'blockquote' },
  { label: '•', title: 'Bulleted list', cmd: 'insertUnorderedList' },
  { label: '1.', title: 'Numbered list', cmd: 'insertOrderedList' },
];

// A small contentEditable-backed editor producing plain HTML. Kept
// deliberately simple (no heavy editor library) — the body is always
// re-sanitized server-side on save, so this only needs to be a reasonable
// writing surface, not a source of trusted markup.
export function RichTextEditor({ value, onChange, onInsertImage }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const isFirstRender = useRef(true);

  useEffect(() => {
    if (ref.current && isFirstRender.current) {
      ref.current.innerHTML = value || '';
      isFirstRender.current = false;
    }
  }, [value]);

  function exec(cmd: string, arg?: string) {
    ref.current?.focus();
    document.execCommand(cmd, false, arg);
    onChange(ref.current?.innerHTML ?? '');
  }

  function addLink() {
    const url = window.prompt('Link URL (https://…)');
    if (url) exec('createLink', url);
  }

  return (
    <div>
      <div className="editor-toolbar">
        {BUTTONS.map((b) => (
          <button key={b.label} type="button" title={b.title} onClick={() => exec(b.cmd, b.arg)}>
            {b.label}
          </button>
        ))}
        <button type="button" title="Link" onClick={addLink}>🔗</button>
        {onInsertImage && (
          <button type="button" title="Insert image" onClick={onInsertImage}>🖼</button>
        )}
      </div>
      <div
        ref={ref}
        className="editor-body"
        contentEditable
        suppressContentEditableWarning
        onInput={() => onChange(ref.current?.innerHTML ?? '')}
        onBlur={() => onChange(ref.current?.innerHTML ?? '')}
      />
    </div>
  );
}

// Exposed so the editor page can insert an <img> at the caret after an
// upload finishes.
export function insertImageAtCaret(url: string, alt: string) {
  const img = `<img src="${url}" alt="${alt.replace(/"/g, '&quot;')}">`;
  document.execCommand('insertHTML', false, img);
}
