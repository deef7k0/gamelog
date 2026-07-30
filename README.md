# GameLog

Track what you play, rate and review it, and see what the people you follow are
playing. A "Letterboxd for videogames", built with Expo + Supabase.

## Quick start

```bash
cp .env.example .env      # fill in your Supabase URL + anon key
npm install
npm start                 # then scan the QR code with Expo Go
```

Run [`supabase/migrations/0001_init.sql`](supabase/migrations/0001_init.sql) in
your Supabase project's SQL editor first — without it there are no tables and
every query fails.

Test on a phone or emulator rather than the browser: Steam's API sends no CORS
headers, so game search only works on native.

## Docs

- [PROJECT.md](PROJECT.md) — what is built, what is not, platform coverage, roadmap
- [CLAUDE.md](CLAUDE.md) — architecture, conventions and gotchas for contributors

## Stack

Expo SDK 57 · React Native 0.86 · React 19.2 · TypeScript · Expo Router ·
Supabase (Postgres + Auth) · TanStack Query · Zustand
