# Bloem Consulting Services — website

Static HTML version of bloem-co.com (previously on WordPress), deployed with Netlify.
No build step, no frameworks: each page is a single HTML file with its own styles and script.

## Pages

| URL | File |
| --- | --- |
| `/` | `public/index.html` |
| `/services/` | `public/services/index.html` |
| `/projects/` | `public/projects/index.html` |
| `/team/` | `public/team/index.html` |
| `/contact/` | `public/contact/index.html` |
| any missing page | `public/404.html` |

Old WordPress addresses redirect permanently (see `netlify.toml`):
`/home/` → `/` and `/clients/` → `/projects/`.

## Deploying on Netlify

1. In Netlify: **Add new project → Import an existing project → GitHub**, pick this repo.
   Settings are read from `netlify.toml` (publish directory `public`, no build command).
2. **Turn on form detection:** Project configuration → Forms → **Enable form detection**,
   then trigger a redeploy (Deploys → Trigger deploy) so Netlify picks the form up.
3. **Get enquiries by email:** Project configuration → Notifications → Emails and webhooks →
   Form submission notifications → Add notification → Email → `info@bloem-co.com`, form `contact`.
4. **Before** pointing the bloem-co.com domain at Netlify, run the asset copy (below).
5. Domain management → Add a domain → `bloem-co.com`, then update DNS as Netlify instructs.

## Contact forms

The home page and contact page both submit to one Netlify form named **`contact`**
(fields: name, email, service, message, plus a `source` field saying which page it came from).
Submissions appear under the Netlify project's **Forms** tab. Spam is filtered with a
hidden honeypot field. Forms only work on the deployed Netlify site, not when the
files are opened locally.

## Images and fonts — do this before moving the domain

The pages still load their images and the Gully font from
`https://bloem-co.com/wp-content/uploads/...` on the WordPress server.
Once bloem-co.com points at Netlify, WordPress is no longer reachable there and
those files would break.

To copy them into this repo (one time, while WordPress is still live):

- **GitHub:** Actions tab → **Copy images and fonts from WordPress** → Run workflow.
  It downloads every file to `public/wp-content/uploads/` (same paths as WordPress),
  points the pages at the local copies and commits; Netlify redeploys on its own.
- **Or locally:** `python3 scripts/localize_assets.py`, then commit and push.

The run summary lists any file it couldn't download; those stay pointed at WordPress.

## Editing

Edit the HTML in `public/` and push to `main`; Netlify deploys automatically.
To preview locally: `python3 -m http.server -d public 8000` and open http://localhost:8000.
