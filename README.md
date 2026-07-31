# Rejestr zwierząt

A small, mobile-first web app for logging rescued/impounded animals per
_gmina_ (municipality). Replaces the ever-growing Excel file that stops
opening on phones.

- **Admin** (the operator) adds, edits and deletes entries, uploads photos,
  assigns each animal to a gmina, and manages gmina access codes.
- **Each gmina** logs in with a short code and sees **only its own** animals —
  read-only. Access is enforced on the server, so one gmina cannot fetch
  another's data.
- Grid / list views, live search, status + reporter filters, dark/light mode.
- UI is in Polish (the end users are Polish municipal staff).

Stack: **Next.js (App Router)** + **Supabase** (Postgres + Storage). All data
access runs server-side through Server Actions using the Supabase
`service_role` key — that key never reaches the browser.

---

## 1. Create the Supabase project

1. Create a project at https://supabase.com (free tier is fine), or self-host
   Supabase with Docker.
2. Open the **SQL editor** and run the contents of
   [`supabase/schema.sql`](supabase/schema.sql). This creates the tables,
   turns on Row Level Security, creates the public `animal-photos` storage
   bucket, and seeds gmina Legionowo with the entries from the original list.
   (Delete the seed block at the bottom of the file for an empty start.)
3. In **Project Settings → API**, copy:
   - the **Project URL** → `SUPABASE_URL`
   - the **service_role** key (under "Project API keys") → `SUPABASE_SERVICE_ROLE_KEY`

## 2. Configure environment

```bash
cp .env.local.example .env.local
```

Fill in `.env.local`:

| Variable | What it is |
| --- | --- |
| `SUPABASE_URL` | Project URL from Supabase |
| `SUPABASE_SERVICE_ROLE_KEY` | service_role key (server-only, keep secret) |
| `ADMIN_CODE` | the operator's login code (e.g. a memorable phrase) |
| `SESSION_SECRET` | long random string; `openssl rand -base64 32` |

## 3. Run it

```bash
npm install
npm run dev
```

Open http://localhost:3000.

**Seeded login codes:**

- `ADMIN` — the value of `ADMIN_CODE` (admin: add / edit / delete, all gminy)
- `LEG1` — Gmina Legionowo (read-only, pre-filled)
- `JAB1`, `NIE1` — Jabłonna, Nieporęt (empty)

Change these before going live: edit `ADMIN_CODE` in `.env.local`, and edit the
gmina codes in-app via the **Ustawienia** (Settings) panel.

---

## Deploying

**Vercel (easiest):** push to GitHub, import the repo, add the four
environment variables in the project settings, deploy. Supabase runs
independently.

**Self-hosted:** `npm run build && npm run start` behind a reverse proxy.
Supabase can also be self-hosted with Docker if you'd rather keep all data on
your own infrastructure.

---

## Automatic email backups (every 5 days)

The app emails the client a CSV **and** an Excel copy of the whole register
every 5 days, so there's always a fresh backup outside the database. It's sent
from an ordinary email account you already have — no new address, no domain, no
extra service. The client just receives it in their normal inbox.

How it works: Vercel Cron calls `/api/cron/export` once a day; the endpoint
sends the email only if 5+ days have passed since the last one (cron can't
express "every 5 days" cleanly across months, so the interval is checked in
code). After sending, a red dot appears on the Settings icon. The client logs
in, saves the files, and clicks **Potwierdzam kopię** to clear it. They can
also download the CSV/Excel on demand from Settings at any time.

**Setup:**

1. Already ran the old `schema.sql`? Run `supabase/migration-backup.sql` once to
   add the tracking table. (Fresh installs get it from `schema.sql`.)
2. Pick a mailbox to send from — your own is fine. Add its SMTP settings as
   environment variables (locally in `.env.local`, and in Vercel):
   - `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`
   - `MAIL_FROM` — optional friendly sender (defaults to `SMTP_USER`)
   - `CLIENT_EMAIL` — the client's normal inbox (the recipient)
   - `CRON_SECRET` — long random string; Vercel uses it to authorise the cron call

   Common presets:
   | Provider | SMTP_HOST | SMTP_PORT |
   | --- | --- | --- |
   | Gmail | `smtp.gmail.com` | `587` |
   | Outlook / Microsoft 365 | `smtp.office365.com` | `587` |

   **Gmail note:** Google blocks your normal password over SMTP. Turn on
   2-Step Verification, then create an **App Password**
   (Google Account → Security → App passwords) and use that as `SMTP_PASS`.
   It's a one-time, two-minute step — and only *you* do it; the client never
   touches any of this.
3. Deploy. Vercel picks up `vercel.json` and schedules the job automatically.
   (Cron runs only on the deployed app, not locally. On Vercel's Hobby plan cron
   fires once a day, which is exactly what this needs.)

Test it anytime by visiting
`https://your-app.vercel.app/api/cron/export?force=1` with the header
`Authorization: Bearer YOUR_CRON_SECRET`.

---

## How access control works

- The browser never holds any database credentials. Every read and write goes
  through Next.js Server Actions (`app/actions.js`) running on the server.
- Login validates a code: the admin code is checked against `ADMIN_CODE`; gmina
  codes are checked against the `gminas` table. On success the server sets a
  **signed, httpOnly cookie** describing the session (`role`, and for a gmina,
  its id). The browser can't read or forge it.
- On every page load the server reads that cookie and, for a gmina session,
  filters the query with `.eq('gmina_id', …)`. A gmina literally cannot request
  another gmina's rows.
- Photos live in a public Storage bucket (URLs are unguessable UUIDs). If you
  want them private, switch the bucket to non-public and serve signed URLs —
  see the note in `supabase/schema.sql`.

## Data model

`animals`: `data`, `gmina_id`, `gmina_name`, `miejsce`, `zglaszajacy`, `opis`,
`chip`, `dostarczenie`, `los`, `status`, `zdjecie`, `photo_path`.
`gminas`: `name`, `code`.

## Project layout

```
app/
  layout.js        root layout, fonts, no-flash theme
  page.js          server: session gate + scoped data fetch
  actions.js       server actions (login, CRUD, gminy) — all admin-guarded
components/
  Login.jsx        code entry screen
  AppShell.jsx     the whole dashboard UI
lib/
  session.js       signed cookie helpers
  supabase.js      server-only service_role client
  auth.js          code validation
supabase/
  schema.sql       tables, RLS, storage, seed
```
