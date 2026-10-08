# CLAUDE.md — School Pawa

Swahili-first competitive quiz PWA for Tanzanian primary & secondary students. Read `PRD.md`
for product rules, ranking formulas and compliance requirements — **the PRD is the spec**.

## Commands

```bash
pnpm install
cp .env.example .env              # fill DATABASE_URL etc.
pnpm db:push                   # apply schema (drizzle-kit push) — dev
pnpm db:migrate                # apply SQL migrations incl. ledger trigger — prod
pnpm db:seed                   # grade levels, subjects, topics, lessons, questions, admin, sample schools
pnpm db:seed --demo            # …plus demo students + 2 weeks of ledger history (dev only)
pnpm import:schools data/schools/shinyanga.sample.csv
pnpm dev                       # http://localhost:3000
pnpm test                          # vitest (unit tests: randomiser, templates, ranking, safety)
pnpm typecheck                 # tsc --noEmit
pnpm lint
pnpm build                     # production build; check First Load JS in output
```

Dev without Redis: leave `REDIS_URL` empty → in-memory store (single process only).
Dev without Africa's Talking: `SMS_DRIVER=console` prints OTPs to the server log.
`APP_ENV=production` (not `NODE_ENV`) turns on deploy safety checks (no console SMS, `TOPIC_LIVE_MIN ≥ 60`).
Scripts run with `tsx --conditions=react-server` so `server-only` modules can be imported.
Cron (POST, `Authorization: Bearer $CRON_SECRET`): `/api/cron/retention` daily, `/api/cron/rebuild` nightly,
`/api/cron/snapshot` Mondays 00:05 EAT.

Next.js 16 notes: `params`/`searchParams`/`cookies()` are async; `next lint` is gone (use `pnpm lint`);
bundled docs live in `node_modules/next/dist/docs/`.

## Stack

Next.js (App Router) · TypeScript (strict) · Tailwind CSS v4 · shadcn-style primitives in
`src/components/ui` · PostgreSQL + Drizzle ORM · Redis (ioredis) · hand-written service worker +
IndexedDB · Africa's Talking SMS (REST via `fetch`) · Vitest.

## Folder structure

```
src/
  app/
    (app)/                 student app (home, learn, quiz, challenges, groups, rankings, profile)
    onboarding/            onboarding + consent wizard (works before any server profile exists)
    parent/                guardian portal (SMS login → view / export / delete)
    admin/                 admin panel (server actions)
    legal/                 privacy policy + terms (sw/en)
    api/                   route handlers — the student API (used by app, SW and future APK)
  components/
    ui/                    primitives (button, card, input, badge, sheet…)
    brand/                 crest, avatar, logo, rank badge, streak flame
    quiz/ onboarding/ …    feature components
  lib/                     PURE, framework-free logic — unit tested
    quiz/                  rng (HMAC-DRBG), selection, shuffle, templates (expr evaluator), grading, scoring
    ranking/               school-power, elo, improvement, levels
    game/                  quests, mastery stars, combo tiers, group-battle scoring
    safety/                profanity/abuse filter (sw + en), handle generation
    integrity/             anomaly heuristics
    i18n/                  dictionaries (sw default, en)
    offline/               client-side IndexedDB + sync queue (browser only)
  server/                  server-only services: db access, ledger, leaderboards, consent, sms, auth
  db/                      drizzle schema, client, migrations, seed
public/sw.js               service worker (app shell + pack cache + background sync)
data/                      seed CSV and content JSON
docs/                      compliance checklist, hosting decision, architecture notes
```

## Conventions

* **`src/lib` is pure.** No DB, no `next/*`, no `process.env`. Inject time, RNG and config.
  Everything with a formula or randomness lives here and has a `*.test.ts` next to it.
* **`src/server` is server-only.** Every file starts with `import "server-only"`.
* **Config** comes from `src/server/config.ts` (zod-validated env). Never read `process.env`
  elsewhere.
* **Quests, tournaments and battles add no scoring state** — they are views over the ledger.
  Quest rewards use `source = quest` and are excluded from School Power.
* **Notifications are in-app only** (`server/notifications.ts`): ids and preset keys in payloads.
* **Points only via `server/ledger.ts`.** Never `UPDATE` points. Never compute rankings from
  anything but the ledger (Redis is a cache; `rebuildLeaderboards()` restores it).
* **Answers never leave the server** before submission. API DTOs are built in
  `server/quiz/dto.ts`; do not return DB rows directly.
* **No free text from students** beyond nickname and group name, both through
  `lib/safety/profanity.ts`. New interactions must use preset keys.
* **i18n:** every user-facing string goes in `src/lib/i18n/{sw,en}.ts`. `sw.ts` is the source
  of truth; `en.ts` is typed against it so missing keys fail typecheck.
* **Audit:** admin actions, consent events, erasure and moderation call `audit()`.
* **Styling:** Tailwind utilities + design tokens in `src/app/globals.css` (`--color-gold`, …).
  Animations: transform/opacity only, wrapped in `motion-safe:`.
* **Bundle:** no heavy client libs (no moment, lodash, framer-motion, chart libs). Prefer server
  components; mark client components narrowly.
* **Naming:** files kebab-case, React components PascalCase, DB columns snake_case (drizzle maps
  to camelCase).
* **Tests:** Vitest, colocated `*.test.ts`. Randomness tests use fixed seeds.

## Compliance-sensitive code (read before editing)

| Area | File | Why |
| --- | --- | --- |
| Consent | `src/server/consent.ts` | Child record may only be created inside consent confirmation. |
| Phone hashing | `src/server/crypto.ts` | Peppered HMAC; raw numbers never persisted. |
| Erasure | `src/server/privacy.ts` | Only path allowed to delete ledger rows. |
| Retention | `src/app/api/cron/retention/route.ts` | Auto-deletes inactive profiles. |
| Content approval | `src/server/admin/questions.ts` | `ai_draft` needs qualified teacher; licensed/teacher content needs a licence row. |
| Ledger trigger | `src/db/sql/0001_ledger_guard.sql` | Append-only enforcement. |
| Data residency | `src/server/config.ts` | Warns when `DATA_RESIDENCY` ≠ `tz`. |
