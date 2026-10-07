# Compliance checklist — School Pawa (Tanzania)

> Engineering controls are implemented in code. **(Org)** items are organisational and must be completed
> by the operating company. **Everything here must be confirmed by a Tanzanian advocate before launch.**

## Personal Data Protection Act, 2022 (PDPA)

| # | Requirement | Status | Where |
|---|---|---|---|
| 1 | Register with the Personal Data Protection Commission (PDPC) as data collector/processor | **(Org)** ☐ | — |
| 2 | Appoint a Data Protection Officer; publish contact | **(Org)** ☐ / code ✅ | `DPO_CONTACT` → privacy policy, admin |
| 3 | Prior parental consent before processing a child's data | ✅ | `src/server/consent.ts` — child row is created only inside the OTP-verified consent transaction |
| 4 | Consent record (timestamp, phone hash, policy version, method) | ✅ | `consents` table |
| 5 | Nothing uploaded before consent | ✅ | Pending profiles live in IndexedDB (`src/lib/offline/db.ts`); starter pack is an anonymous GET carrying only the grade |
| 6 | Data minimisation | ✅ | Nickname, preset avatar, school, class, PIN hash, phone **hash**. No names, DOB, photos, location, email |
| 7 | Phone numbers not stored in recoverable form | ✅ | Peppered HMAC-SHA256 (`src/server/crypto.ts`); raw number only in memory while sending the SMS |
| 8 | Purpose limitation / no marketing | ✅ | No ad or analytics SDKs; policy text |
| 9 | Retention limits | ✅ | `POST /api/cron/retention` (daily): inactive profiles (`RETENTION_INACTIVE_DAYS`), OTPs > 24 h, audit > 2 years |
| 10 | Right of access / portability | ✅ | `/parent` → JSON export (`exportChild`) |
| 11 | Right to erasure / withdraw consent | ✅ | `/parent` → delete (`eraseStudent`; only path allowed to delete ledger rows) |
| 12 | Breach logging & notification workflow | ✅ / **(Org)** | Admin → Compliance → Breach register with 72 h clock; confirm statutory deadline with counsel |
| 13 | Cross-border transfer | ✅ / **(Org)** | `DATA_RESIDENCY`, `DB_REGION`; boot + admin warnings; `docs/hosting-decision.md` |
| 14 | Security of processing | ✅ | scrypt PINs/passwords, signed httpOnly cookies, rate limits, no-store API responses, security headers |

## Child safety (Law of the Child Act; duty of care)

| Control | Where |
|---|---|
| No free-text chat — preset reactions/messages only | `src/lib/safety/presets.ts`, `groups.react()` validates keys |
| Filtered nicknames & group names (sw + en, leetspeak, contact info, identity hints) | `src/lib/safety/profanity.ts` (+ `BLOCKED_TERMS_EXTRA`) |
| No photos, no real names, no location | Preset avatars; `Permissions-Policy` denies camera/mic/geolocation |
| No contact between unconnected users beyond preset challenge messages | Challenges by handle/link/group only, preset message keys |
| Report + block on every profile and group | Group member sheet; `/api/report`, `/api/block`; blocks hide reactions and cancel challenges |
| Moderation queue | Admin → Moderation |

## No gambling · no ads/payments to children · copyright · online content

- No paid entry, cash/airtime prizes, loot boxes; Terms state points have no monetary value. No payment code exists.
- Content approval rules in `src/server/admin/questions.ts`: `ai_draft` needs a qualified teacher; `licensed` /
  `teacher_submitted` need a recorded licence; no self-approval. NECTA/textbook text only under licence.
- Student flags auto-pull a question at `FLAG_THRESHOLD`.
- Audit log is append-only (DB trigger) and records admin, consent, erasure and moderation actions.

## Before launch (Org)
- [ ] Advocate review of privacy policy, terms and consent wording (sw + en)
- [ ] PDPC registration certificate number added to the privacy policy
- [ ] Hosting decision signed off (see `hosting-decision.md`)
- [ ] TIE content-alignment review of seed syllabus references
- [ ] Regional education office engagement for the Shinyanga pilot
- [ ] Qualified-teacher review of all seed content (seed loads it as `in_review` unless `SEED_APPROVE_CONTENT=true`)
- [ ] Replace `data/schools/shinyanga.sample.csv` with the official registry export
