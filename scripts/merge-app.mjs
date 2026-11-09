// Copies the built blog/staff portal app (app/dist/, built separately by
// `npm run build:app`) into the static site's dist/ output, and writes the
// SPA shell page that Netlify's redirects (see netlify.toml) point /blog,
// /login and /staff at.

import { cp, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '..');
const APP_DIST = path.join(ROOT, 'app', 'dist');
const OUT = path.join(ROOT, 'dist');

await cp(path.join(APP_DIST, 'app-assets'), path.join(OUT, 'app-assets'), { recursive: true });
const shellHtml = await readFile(path.join(APP_DIST, 'index.html'), 'utf8');
await writeFile(path.join(OUT, 'app-shell.html'), shellHtml);

console.log('Blog/staff portal app merged into dist/.');
