# Hosting decision (data residency)

**Status:** OPEN — decision required before the Shinyanga pilot.

The PDPA restricts transferring personal data outside Tanzania to countries/arrangements with adequate
protection. School Pawa processes children's data, so the default is **host in Tanzania**.

| Option | Residency | Notes |
|---|---|---|
| A. Tanzanian data centre / local cloud (preferred) | `DATA_RESIDENCY=tz` | Simplest legal position. Confirm managed Postgres + Redis + backups are also in-country. |
| B. Regional cloud (e.g. South Africa / Kenya region) | `DATA_RESIDENCY=za` / `ke` | Requires a documented adequacy basis or safeguards; app logs a compliance warning at boot and shows a banner in admin. |

What lives where:
- **PostgreSQL** — all personal data (pseudonymous profiles, consent records, ledger). Region = `DB_REGION`.
- **Redis** — leaderboard cache (student ids + scores) and rate-limit counters. Must be co-located with Postgres.
- **SMS provider (Africa's Talking)** — receives the guardian phone number in transit to deliver OTPs.
- **Backups** — must follow the same residency as the primary database.

Record the final decision here (provider, region, date, approver, legal basis).
