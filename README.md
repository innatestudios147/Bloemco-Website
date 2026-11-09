# Bloem Consulting Services — website

Static marketing pages (`public/`) plus a **Blog** with a private staff
portal, backed by [Supabase](https://supabase.com) (database, auth, file
storage), deployed together on Netlify.

## How it fits together

| Path | What it is |
| --- | --- |
| `public/` | The marketing pages — home, services, projects, team, contact, 404 (edit HTML here) |
| `app/` | The Blog + staff portal: a React app served at `/blog`, `/login` and `/staff` |
| `supabase/migrations/` | The database schema, roles and access rules (SQL) |
| `supabase/functions/` | Two small server-side functions: `posts-write` (sanitizes every article save) and `staff-users` (admin-only staff management) |
| `scripts/build.mjs` | Builds the marketing pages into `dist/` |
| `scripts/merge-app.mjs` | Copies the built app into `dist/` alongside them |
| `netlify.toml` | Build command, routing, security headers |

On every push to `main`, Netlify runs `npm run build`, which:

1. Builds the marketing pages into `dist/` (unchanged from before).
2. Builds the React app in `app/`.
3. Merges the two together — `/blog`, `/blog/<slug>`, `/login`, `/staff` and
   `/staff/*` are all served by the app; everything else is a plain page.

## Setting up Supabase (one time)

The blog doesn't work until this is done — until then, `/blog` shows "not
connected yet" instead of erroring.

1. **Create a project** at [supabase.com](https://supabase.com) (or reuse
   one you already have set aside for Bloem-Co — not one shared with another
   client).
2. **Run the migration.** In the Supabase SQL editor, paste and run
   `supabase/migrations/0001_init.sql`. This creates the tables, the default
   categories, the storage bucket for images/documents, and all the access
   rules described below.
3. **Set the bootstrap admin.** That migration grants admin automatically to
   `fowzia@salo.org.za` the first time that email signs in — it's the one
   consistently used for this project so far. To use a different email (or
   add more), run in the SQL editor:
   ```sql
   insert into public.bootstrap_admins (email) values ('someone@bloem-co.com');
   ```
4. **Deploy the two edge functions** (`posts-write`, `staff-users`) — via the
   Supabase CLI from this repo:
   ```sh
   supabase link --project-ref <your-project-ref>
   supabase functions deploy posts-write
   supabase functions deploy staff-users
   supabase secrets set SITE_URL=https://bloem-co.com
   ```
5. **Point email links at the site.** In Supabase → Authentication → URL
   Configuration, set the Site URL to `https://bloem-co.com` and add
   `https://bloem-co.com/login` and `https://bloemco.netlify.app/login` as
   redirect URLs. This is what makes invite and password-reset emails land
   on the login page instead of Supabase's own domain.
6. **Set the site's environment variables.** In Netlify → Project
   configuration → Environment variables, add:
   - `SUPABASE_URL` — Project Settings → API → Project URL
   - `SUPABASE_ANON_KEY` — Project Settings → API → anon/public key

   (Never put the **service role** key here — it only belongs in the two
   edge functions' own environment, which Supabase manages for you.)
7. **Redeploy** the site (Netlify → Deploys → Trigger deploy) so the build
   picks up the new environment variables.

That's it — no separate sign-up step for staff beyond inviting them (next
section).

## Staff accounts and roles

Three roles: **pending** (just signed up, can't do anything yet), **editor**
(writes and manages their own articles), **admin** (manages every article,
plus staff access).

**To invite someone:** sign in at `/login` as an admin, go to **Manage
staff** in the staff portal, and invite by email with a starting role. They
get an email to set a password; once they do, they can sign in and start
writing (if invited as editor) immediately — no separate approval step for
an invited account.

**If someone signs themselves up** (via "Create an account" on the login
page, without being invited first), they start as **pending** and can't
write anything until an admin changes their role to editor in **Manage
staff**.

**Removing someone:** Manage staff → Remove. Their access stops immediately.
An admin can't demote or remove their own account (on purpose, so the
portal can never be accidentally locked).

## Writing and publishing (for staff)

1. Go to **bloem-co.com/staff** and sign in.
2. Click **New article**. Fill in the title, write the body in the editor,
   optionally add a summary (one is generated automatically from the body
   if you leave it blank), pick or create a category, add a cover image, a
   photo gallery, and any documents to attach (press releases, reports,
   newsletters).
3. **Save as draft** to keep working on it without it going live, or
   **Publish** to put it on the site immediately.
4. To edit a published article, open it from your article list, make
   changes, and save again — its original publish date doesn't change.
5. Only you (or an admin) can edit or delete your own articles.

## Security

- **Every article's HTML is sanitized on the server on every save** — the
  `posts-write` function strips scripts, styles, event handlers and
  anything outside a small safe tag set before it's stored, regardless of
  what the editor produced. The database itself also has no direct write
  path for articles (see below), so this can't be bypassed by calling the
  API directly.
- **Role-based access**, enforced in the database (Postgres row-level
  security), not just in the app: a pending account can read nothing extra,
  an editor can only touch their own articles, and only an admin can manage
  staff or every article.
- **Drafts stay private.** A draft is visible only to its author and admins
  — to anyone else, it behaves exactly like a page that doesn't exist (a
  plain "not found", never an error that reveals it's there).
- **Uploads are capped at 20MB** per file and restricted to image types
  (covers, gallery) or common document types (attachments); files go
  straight from the browser to Supabase's storage, not through a function
  with a smaller limit.
- **Full audit trail.** Supabase keeps every row's history in its own
  database backups; who authored and last updated each article is always
  on the record itself.

## Why uploads bypass a server function

A plain serverless function (the kind Netlify and Vercel run by default)
typically caps request bodies around 6MB — easy to hit with a phone photo or
a multi-page PDF, and the failure shows up as a vague, unhelpful error.
Rather than build a custom upload endpoint and run into that wall, uploads
go directly from the browser to Supabase Storage using the visitor's own
(role-checked) session — no proxy, no size surprise, and the same
database-enforced rule (only signed-in staff can upload) applies regardless.

## Local development

```sh
npm run build:site   # marketing pages only, into dist/
cd app
npm install
npm run dev           # the blog/staff app at localhost:5173, against your Supabase project
```

Create `app/.env.local` with your own project's values to develop against:
```
SUPABASE_URL=https://xxxx.supabase.co
SUPABASE_ANON_KEY=xxxx
```
(these are read by `vite.config.ts`, which maps them into the app.)

## Contact form

The home page and contact page both submit to one Netlify form named
**`contact`**, unrelated to the blog — unchanged from before. Submissions
appear under the Netlify project's **Forms** tab.
