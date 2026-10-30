# Bloem Consulting Services — website

Static HTML version of bloem-co.com (previously on WordPress), deployed with Netlify,
plus an **Insights** blog that staff write in a browser-based editor at `/admin`.

## How it fits together

| Path | What it is |
| --- | --- |
| `public/` | The site's pages, exactly as visitors see them (edit HTML here) |
| `content/insights/*.md` | Blog articles. Written by staff through `/admin`; you never need to edit these by hand |
| `public/admin/` | The staff article editor ([Decap CMS](https://decapcms.org), pinned to v3.16.3) and its settings (`config.yml`) |
| `public/uploads/insights/` | Images staff upload with their articles |
| `public/assets/insights.css`, `templates/layout.html` | Look of the Insights listing and article pages |
| `scripts/build.mjs` | Netlify build: copies `public/` to `dist/` and turns articles into pages |
| `netlify.toml` | Build settings, redirects from old WordPress addresses, security headers |

On every push to `main`, Netlify runs `npm run build` and publishes `dist/`:

- Each article becomes `/insights/<article-name>/`. All of them are listed on `/insights/`, with an RSS feed at `/insights/feed.xml`.
- The three newest articles replace the placeholder cards in the home page's **Latest Insights**, followed by a "View all insights" button.
- An **Insights** link is added to the menu and footer of every page.

**Until the first article is published, the built site is identical to `public/`, so nothing changes for visitors.**

| URL | File |
| --- | --- |
| `/` | `public/index.html` |
| `/services/` | `public/services/index.html` |
| `/projects/` | `public/projects/index.html` |
| `/team/` | `public/team/index.html` |
| `/contact/` | `public/contact/index.html` |
| `/insights/…` | generated from `content/insights/` |
| `/admin/` | staff article editor |
| any missing page | `public/404.html` |

Old WordPress addresses redirect permanently: `/home/` → `/` and `/clients/` → `/projects/`.

## Setting up Netlify (one time)

1. **Link the repo.** In Netlify, open the `bloemco` project. Go to Project configuration → Build & deploy → **Link repository** → GitHub → `Bloemco-Website`.
   The build settings come from `netlify.toml`, so leave the fields as they are. The blog editor only works once the project is linked to this repo.
2. **Make the live site public.** Go to Project configuration → Access & security → Visitor access. Make sure team-login protection does **not** apply to the production site. Otherwise neither visitors nor staff can reach it. Keeping it on for deploy previews is fine.
3. **Forms.** Go to Project configuration → Forms and click **Enable form detection** (already on for `bloemco`). Then add an email notification for the `contact` form to info@bloem-co.com: Notifications → Emails and webhooks → Form submission notifications.
4. **Staff logins (Netlify Identity):**
   1. Go to Project configuration → Identity and click **Enable Identity**.
   2. Under **Registration preferences**, choose **Invite only**. ⚠️ This is the most important security setting. If it stays on Open, anyone could create an account.
   3. Optional: under **External providers**, add **Google**. Staff can then log in with their work Google account, including Google's 2-step verification. They still need an invite.
   4. Under **Services → Git Gateway**, click **Enable Git Gateway**. In **Roles**, enter `editor`. Now only staff you have given the `editor` role can save anything, even if an account is ever created by mistake.
5. **Invite staff.** Go to the Identity tab → **Invite users** and enter their email addresses. When someone has accepted, open their user → **Edit settings** → Roles: `editor`.

Invite and password-reset emails link to the home page, which forwards them to `/admin/` automatically.

## Writing and publishing (for staff)

1. Go to **bloem-co.com/admin** (or `bloemco.netlify.app/admin` until the domain moves) and log in.
2. Under **Insights**, click **+ Article** and fill in each field. Every field has a short hint, and the editor won't save until the required ones are filled. The right-hand pane shows how the article will look on the site.
3. Click **Save**. The article is now a **Draft** and is *not* on the website.
4. When it's ready for a colleague to check, set **Status → In review**. Everyone can see drafts and articles in review on the **Workflow** tab.
5. After review, set **Status → Ready**, then **Publish → Publish now**. The site updates within about a minute.

To edit a published article, open it, change it and publish again. To take an article down, open it and choose **Delete published entry**.

## Security

- **Invite-only accounts** (Netlify Identity), plus a second lock: only users with the `editor` role can save anything.
- **Drafts and review before anything goes live.** Saving never publishes. Publishing is a separate, deliberate step.
- **Full history.** Every save and publish is a commit in this GitHub repo. Any article or image can be restored to an earlier version, and nothing is ever lost.
- **Articles can't run code on the site.** The build strips scripts, styles, forms, event handlers and `javascript:` links from article content, and only allows YouTube and Vimeo video embeds. A misused or compromised staff account still can't inject code into the public website.
- **The editor only offers articles and their images.** Staff have no way to change the site's pages from `/admin`. Behind the scenes, Git Gateway does give logged-in editors write access to this repo, which is why accounts are invite-only and role-locked. Only invite people you trust.
- **Pinned editor version.** `/admin` loads one exact version of Decap CMS. Update it on purpose by changing the version in `public/admin/index.html`.
- **Security headers** on every page (`netlify.toml`); `/admin` is hidden from search engines.
- **Uploads capped at 2 MB** per image.
- **Removing someone:** Identity tab → their user → **Delete user**. Their access stops immediately.

Note: Netlify's Git Gateway (the piece that saves staff edits to GitHub) is deprecated. It keeps working and gets security fixes, but no new features. Netlify Identity itself remains supported. If Git Gateway is ever retired, switch `backend` in `public/admin/config.yml` to `github` (staff would then log in with GitHub accounts). The articles don't need to change.

## Contact forms

The home page and contact page both submit to one Netlify form named **`contact`**. Its fields are name, email, service and message, plus a `source` field saying which page it came from. Submissions appear under the Netlify project's **Forms** tab, and a hidden honeypot field filters spam. The forms only work on the deployed Netlify site, not when the files are opened locally.

## Images and fonts — do this before moving the domain

The pages still load their images and the Gully font from `https://bloem-co.com/wp-content/uploads/...` on the WordPress server. Once bloem-co.com points at Netlify, WordPress is no longer reachable there and those files would break.

To copy them into this repo (one time, while WordPress is still live), use either option:

- **GitHub:** Actions tab → **Copy images and fonts from WordPress** → Run workflow. It downloads every file to `public/wp-content/uploads/` (same paths as WordPress) and points the pages, styles, editor settings and template at the local copies. It then commits, and Netlify redeploys on its own.
- **Locally:** run `python3 scripts/localize_assets.py`, then commit and push.

The run summary lists any file it couldn't download. Those files stay pointed at WordPress.

## Working on the site locally

```sh
npm install
npm run build                          # builds dist/
python3 -m http.server -d dist 8000    # http://localhost:8000
```

To try the article editor locally without logging in:

1. Add `local_backend: true` to `public/admin/config.yml` (don't commit this).
2. In one terminal, run `npx decap-server`.
3. In another, run `python3 -m http.server -d public 8080` and open http://localhost:8080/admin/.
