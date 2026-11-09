import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Built as a static SPA shell that Netlify rewrites /blog, /login and
// /staff (see netlify.toml) to. SUPABASE_URL / SUPABASE_ANON_KEY come from
// the same two Netlify env vars the static-site build uses (see
// scripts/build.mjs), so there is only one pair of values to set up.
export default defineConfig({
  plugins: [react()],
  define: {
    'import.meta.env.VITE_SUPABASE_URL': JSON.stringify(process.env.SUPABASE_URL || ''),
    'import.meta.env.VITE_SUPABASE_ANON_KEY': JSON.stringify(process.env.SUPABASE_ANON_KEY || ''),
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    // Keep this build's JS/CSS out of the static site's own dist/assets/
    // (supabase-config.js, latest-articles.js) once the two are merged.
    assetsDir: 'app-assets',
  },
});
