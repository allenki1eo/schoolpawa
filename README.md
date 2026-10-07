# School Pawa ⚡

Kiswahili-first competitive quiz PWA for Tanzanian primary and secondary students. Learn, take quizzes,
challenge friends, and push your school up the **School Power** rankings.

- **Spec:** [`PRD.md`](PRD.md) — features, ranking formulas, data model, compliance, phase plan
- **Engineering guide:** [`CLAUDE.md`](CLAUDE.md) — architecture, conventions, commands
- **Compliance:** [`docs/compliance-checklist.md`](docs/compliance-checklist.md), [`docs/hosting-decision.md`](docs/hosting-decision.md)

## Quick start

```bash
pnpm install
cp .env.example .env          # set DATABASE_URL, secrets; SMS_DRIVER=console prints OTPs to the log
pnpm db:push                  # schema + append-only ledger trigger
SEED_APPROVE_CONTENT=true TOPIC_LIVE_MIN=12 pnpm db:seed --demo   # dev content + demo leaderboard data
pnpm dev                      # http://localhost:3000   ·   admin: /admin
pnpm test                     # unit tests (randomiser, templates, ranking, safety, import)
```

Phase 1 = Shinyanga pilot: Std 7 + Form 4, two subjects each.
