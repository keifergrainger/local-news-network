# Local News Network — Phase 1 Template
Stack: **Next.js (App Router) + Tailwind + Netlify**

## Quick Start
```bash
npm install
npm run dev
```
Visit http://localhost:3000

## Configure Cities
Edit `lib/cities.ts`. The site picks city config by the domain hostname (e.g., `saltlakeut.com`). When running locally it defaults to Salt Lake City.

## Weather
Uses **Open-Meteo** (no API key). Client-side fetch updates periodically.

## Forms (Phase 1)
The `/submit` page is pre-wired for **Netlify Forms**. If you deploy on Netlify, submissions will appear in your Netlify dashboard automatically.

## Deploy (Netlify)
1. Create a new Git repo, push this code.
2. On Netlify: **New Site from Git** → select repo → Framework: Next.js.
3. Build command: `npm run build` (auto-detected). Publish directory is auto-managed by Netlify adapter.
4. Add each custom domain (saltlakeut.com, irmosc.com, etc.) in the site settings and point DNS to Netlify.

## Pages
- `/` — hero, weather ticker, sections
- `/news` — placeholder list (manual now, automate later)
- `/events` — placeholders (embed Google Calendar if desired)
- `/submit` — Netlify form
- `/advertise` — pricing placeholders
- `/privacy`, `/contact` — stubs

## Phase 2 (Later)
- Auto-ingest news/events via APIs
- Admin approval dashboard
- Paid placements & multi-city bundles
