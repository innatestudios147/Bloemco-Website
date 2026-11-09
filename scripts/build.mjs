// Builds the static marketing pages for Netlify:
//   1. Copies public/ to dist/.
//   2. Adds a "Blog" link to every page's menu, next to Team.
//   3. Writes dist/assets/supabase-config.js from the SUPABASE_URL and
//      SUPABASE_ANON_KEY environment variables, so the home page's
//      "Latest Articles" section (public/assets/latest-articles.js) and the
//      staff/blog app (built separately, see scripts/build-app.mjs) can talk
//      to Supabase. The anon key is the public, read-only key — safe to ship.
//
// The blog/staff portal itself (/blog, /login, /staff) is a separate React
// app under app/, built and copied into dist/ by scripts/build-app.mjs. Run
// both via `npm run build`.

import { cp, mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '..');
const SRC = path.join(ROOT, 'public');
const OUT = path.join(ROOT, 'dist');

const NAV_TEAM_LINK = /(\s*)(<li><a href="\/team\/"[^>]*>Team<\/a><\/li>)/g;

function addBlogLink(html, file) {
  let count = 0;
  const out = html.replace(NAV_TEAM_LINK, (match, space, teamLink) => {
    count += 1;
    return `${space}<li><a href="/blog/">Blog</a></li>${space}${teamLink}`;
  });
  if (count === 0 && file !== '404.html') console.warn(`! No menu found in ${file}; Blog link not added there.`);
  return out;
}

async function htmlFiles(dir) {
  const entries = await readdir(dir, { withFileTypes: true, recursive: true });
  return entries
    .filter((e) => e.isFile() && e.name.endsWith('.html'))
    .map((e) => path.join(e.parentPath ?? e.path, e.name));
}

async function main() {
  await rm(OUT, { recursive: true, force: true });
  await cp(SRC, OUT, { recursive: true });

  for (const file of await htmlFiles(OUT)) {
    const rel = path.relative(OUT, file);
    let html = await readFile(file, 'utf8');
    html = addBlogLink(html, rel);
    await writeFile(file, html);
  }

  const supabaseUrl = process.env.SUPABASE_URL || '';
  const supabaseAnonKey = process.env.SUPABASE_ANON_KEY || '';
  if (!supabaseUrl || !supabaseAnonKey) {
    console.warn('! SUPABASE_URL / SUPABASE_ANON_KEY not set: the home page "Latest Articles" section will show the empty state until these are set in Netlify.');
  }
  await mkdir(path.join(OUT, 'assets'), { recursive: true });
  await writeFile(
    path.join(OUT, 'assets', 'supabase-config.js'),
    `window.__SUPABASE_CONFIG__ = ${JSON.stringify({ url: supabaseUrl, anonKey: supabaseAnonKey })};\n`,
  );

  console.log('Static site built.');
}

await main();
