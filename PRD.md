# School Pawa — Product Requirements Document

> **Status:** v1.0 (Phase 1 scope locked) · **Owner:** Product · **Last updated:** 2026-10-07
>
> Compliance statements in this document describe how the product is *engineered* to meet
> Tanzanian law. They are not legal advice. **A Tanzanian advocate must sign off before launch.**

---

## 1. Vision

Kids in Tanzania spend hours scrolling. School Pawa turns that time into short, competitive,
syllabus-aligned learning. Every correct answer earns points for the student **and for their
school**, so the motivation is not just "beat my friend" but "put my school on top of
Shinyanga". The tone is Kiswahili-first, energetic and proud.

**North-star metric:** weekly active learners who complete ≥ 3 quiz rounds.

**Guard-rail metrics:** consent completion rate, median time-to-first-quiz (< 60 s),
crash-free sessions, flagged-content rate, data used per round (< 40 KB).

---

## 2. Users and constraints

| Persona | Who | Constraints that drive design |
| --- | --- | --- |
| **Mwanafunzi (student)** — primary | Std 1–7, Form 1–6 | Low-end Android, often a **parent's or shared phone**, prepaid data, 2G/3G, intermittent power. |
| **Mzazi / Mlezi (parent/guardian)** | Owner of the phone or guardian of the child | Must give consent. May have a feature phone only → **SMS is the channel**, not email. |
| **Mwalimu (teacher)** — Phase 2 | Content reviewer / school verifier | Must be a qualified teacher to approve AI-drafted content. |
| **Admin / moderator** | School Pawa staff | Content pipeline, school registry, moderation, compliance logs. |

**Platform:** installable PWA (Android Chrome) first; wrapped as a Trusted Web Activity APK in
Phase 3. Budget: **< 1.5 MB initial JS** (target is far lower: ~150 KB gz), usable on 2G,
fully playable offline with downloaded packs.

**Language:** Kiswahili default, English toggle. Content language follows the official medium of
instruction per subject (primary mostly Kiswahili, secondary mostly English) — stored per
question, not inferred from UI language.

**Grade levels are data**, not enums (`grade_levels` table: `code`, `stage`, `ordinal`,
`label_sw`, `label_en`, `active`). The 2023 curriculum reform can be absorbed by adding rows
and deactivating others.

---

## 3. Feature specification

### 3.1 Onboarding (< 60 seconds)

```
Lugha (language) → Mkoa (region) → Wilaya (district) → Shule (searchable)
→ Darasa (class) → Jina la utani (nickname) + avatar → PIN (4 digits)
→ Mzazi (guardian consent: phone → SMS OTP → parent confirms) → first quiz
```

* **Data collected (complete list):** nickname, preset avatar key, school, class level,
  4-digit PIN (stored as a salted scrypt hash), parent phone number (stored only as a
  peppered HMAC hash after the SMS is sent).
* **Never collected:** full name, birthdate, photo, precise location, email, contacts.
* **Nickname handle:** `Nickname#1234` — a random 4-digit discriminator makes handles unique
  without forcing kids to pick identifying names.
* **Multi-profile per device:** up to `MAX_PROFILES_PER_DEVICE` (default 4). Quick switcher on the
  home screen; each profile protected by its PIN.
* **Before consent** the profile lives **only on the device** (IndexedDB). It can play the
  anonymous starter practice pack offline. Nothing about the child is uploaded.

### 3.2 Learn + Quiz

* Subjects → topics mapped to the TIE syllabus for each level (`syllabus_ref` on each topic and
  question).
* **Lesson cards** before a topic's quizzes: explanation + worked example, swipeable, 2–5 cards.
* **Quiz types:** `mcq`, `true_false`, `number` (fill in the number), `ordering`.
* **Round:** 10 questions, timed per question (MCQ/TF 25 s, number 45 s, ordering 50 s;
  configurable).
* **Delivery:** one question at a time. The server stamps `served_at` when it sends a
  question and `answered_at` when the answer arrives — the client clock is never trusted.
* **Feedback:** instant correct/incorrect, the correct answer, and a short explanation, returned
  in the same response that carries the next question (one round-trip per question).

### 3.3 Challenges

| Mode | Rules |
| --- | --- |
| **Daily Challenge (Changamoto ya Leo)** | One topic per grade level per day (rotates through live topics deterministically). Everyone gets *different randomized questions* from that topic. One scored attempt per day. Bonus points + streak. |
| **1v1 (Ana kwa Ana)** | Challenge by handle, from a group, or by share link (WhatsApp share card with a 6-char code). Async: both play the **same question IDs** in **different order** with **independently shuffled options**. Best score wins; ties broken by total answer time. Expires in 48 h. Elo updated on completion. |
| **School vs School** (Phase 2) | Weekly themed tournament per region, computed from the ledger with tournament tags. |

### 3.4 Groups (Vikundi)

* Create: name (filtered) + preset emblem. Invite with a **6-character code** (unambiguous
  alphabet, no `0/O/1/I`) or share link.
* Max **30 members**; a student can be in max **5 groups**. Cross-school membership allowed.
* Group leaderboard (weekly + all-time), group streak (days on which ≥ 50% of members played).
* Creator can remove members; anyone can leave; creator leaving transfers ownership to the
  longest-standing member (or archives an empty group).
* **No free-text chat.** Interaction = preset reactions (🔥 👏 💪 🏆 😂) and preset messages
  (e.g. *"Nakuja kwa ajili yako! 🔥"*, *"Hongera!"*). Preset keys are stored, never text.
* Group names and nicknames pass the Kiswahili + English abuse filter; every group and profile
  has **Report** and **Block**.
* Group vs group challenges: Phase 2.

### 3.5 Rankings

#### Student Power
* **XP** — from quiz points (all sources in the ledger with status `counted`).
* **Rating** — Elo from 1v1 results, start 1000.
  `E_a = 1 / (1 + 10^((R_b − R_a)/400))`, `R'_a = R_a + K (S_a − E_a)`, `K = 40` for the first
  10 games, then `24`; `S ∈ {1, 0.5, 0}`.
* **Student Power** shown on leaderboards = weekly XP (weekly board) or all-time XP; rating is
  shown on the profile and used for 1v1 matchmaking suggestions.
* Boards: class (school + grade), school, district, region, national; weekly and all-time.

#### Points per question
```
points = round( base(10) × difficultyMultiplier[1.0, 1.3, 1.6] + speedBonus )
speedBonus = round( 5 × max(0, 1 − timeMs / limitMs) )        // only when correct
incorrect = 0
```
Daily challenge: ×1.5. Offline practice: ×0.5, capped at `OFFLINE_DAILY_POINT_CAP` (150)/day.
1v1: points as above + **win bonus 30**, draw 15.

#### School Power (weekly reset + all-time)
Fair to small and rural schools via a **Bayesian-adjusted average**:

```
bayes  = (C × m + Σpoints) / (C + activeStudents)
bonus  = min(activeStudents / enrolledEstimate, 1) × 0.10        // ≤ +10 %
power  = bayes × (1 + bonus)
```

* `Σpoints` — counted ledger points earned by the school's students in the period.
* `activeStudents` — students with ≥ 1 counted ledger entry in the period.
* `m` — mean points per active student **across the comparison population** (computed
  separately for primary and secondary, since content differs).
* `C` — confidence constant, `SCHOOL_POWER_C`, default **20**.
* A school with no active students has `power = 0` and is hidden from the board.
* If `enrolledEstimate` is unknown it defaults to the size-band midpoint.

**Leagues:** stage (primary/secondary) × size band (`S` < 300, `M` 300–799, `L` 800–1499,
`XL` ≥ 1500 learners), viewable at region and national level.

#### Improvement rewards
* **Most Improved Student:** largest `thisWeekXP − lastWeekXP` among students with ≥ 3 rounds
  in both weeks (prevents rewarding "absent last week").
* **Most Improved School:** largest relative power gain `(P_now − P_prev) / max(P_prev, m)`
  among schools with ≥ 5 active students in both weeks.

#### Levels and badges
| Level | XP |
| --- | --- |
| Mwanafunzi | 0 |
| Shujaa | 500 |
| Bingwa | 2 000 |
| Gwiji | 6 000 |

Badges (Phase 1 set): first round, perfect round, 3/7/30-day streak, first 1v1 win, group founder,
daily-challenge week.

---

## 4. Question bank and randomness

### 4.1 Rules
1. **Pool size:** a topic goes live only when it has an **effective pool ≥ `TOPIC_LIVE_MIN`
   (60)** approved items with **≥ 10 at each of the 3 difficulties**. An approved parametric
   template counts as `min(distinctVariants, 10)` items. (The dev seed lowers the threshold via
   env; production must not.)
2. **Server-side selection & grading.** The client never receives `answer` before submitting.
3. **No repeats.** `seen_questions(student, question, last_seen_at, times_seen)`. Draw unseen
   first; recycle the **oldest-seen** only when the unseen pool is exhausted.
4. **Adaptive weighted draw.** Target difficulty mix interpolates from the student's last 30
   answers' accuracy `a`:
   `easy = 0.55 − 0.40a`, `hard = 0.10 + 0.40a`, `medium = 1 − easy − hard`.
   Within a difficulty, sub-topics are balanced (least-used sub-topic first, random tie-break).
5. **Option shuffling** per student per attempt; the permutation is stored on the answer row.
6. **Parametric templates** for maths/science: `{n}`-style placeholders, parameter ranges,
   constraints and an answer expression evaluated **server-side** by a whitelisted expression
   evaluator (no `eval`).
7. **1v1 fairness:** identical question IDs (and identical template parameters), different
   order and option shuffle per player.
8. **RNG:** each session gets a 256-bit seed from `crypto.randomBytes`. All draws come from an
   HMAC-SHA256 DRBG keyed by that seed, so a session is **reproducible for dispute review**
   while being unpredictable to clients. Seed is logged on `quiz_sessions.seed`.

### 4.2 Content pipeline

`draft → in_review → approved → retired` (and `in_review → draft` on rejection with a note).

| Source type | Rule enforced in code |
| --- | --- |
| `original` | Written by the School Pawa team. |
| `ai_draft` | Can only be approved by an admin with `is_qualified_teacher = true`. |
| `teacher_submitted` | Requires a recorded `content_licenses` row (contributor licence). |
| `licensed` | Requires a recorded `content_licenses` row (written permission). |

* **NECTA past papers / textbook text** may only be entered as `licensed` with a licence on file.
* **Student flags:** a question with ≥ `FLAG_THRESHOLD` (3) open reports is auto-moved back to
  `in_review` and removed from selection.
* **Per-question stats:** `times_shown`, `times_correct`, `total_time_ms`. Auto-flag for review
  when (after ≥ 50 shows) accuracy < 15 % (likely wrong key) or > 97 % (too easy).

---

## 5. Anti-cheat and integrity

| Control | Implementation |
| --- | --- |
| Rate limits | Sliding window per device and per profile (Redis), e.g. 30 answers/min, 5 OTP/hour/phone. |
| Accounts per device | `MAX_PROFILES_PER_DEVICE`; creation beyond is refused and logged. |
| Server timing | `served_at`/`answered_at` server stamps. Answers after `limit + 3 s grace` = timeout (0 pts). |
| Impossible rounds | Perfect round with median answer < 1.2 s (MCQ) → round points **held**. |
| Identical timing | Coefficient of variation of answer times < 0.05 over ≥ 8 answers → held. |
| School spikes | Weekly school points > 4× trailing 4-week mean and > 500 → anomaly flag. |
| Device farms | > 3 profiles created on one device in 24 h → anomaly flag. |
| Held points | Ledger entries written with `status = held`; excluded from rankings until a moderator releases (new `release` entry) or leaves them void. |

---

## 6. Design

* **Palette:** deep navy `#070D1A` / charcoal surfaces, **gold** `#F7C948` reserved for wins,
  ranks, trophies. One vivid accent per subject (stored on `subjects.accent`).
* Big touch targets (≥ 48 px), bold tabular numerals for scores/ranks.
* Micro-animations: rank-up burst, streak flame, crest glow — CSS transforms/opacity only,
  all disabled under `prefers-reduced-motion`.
* Haptics via `navigator.vibrate` where supported (and respecting reduced-motion).
* **Generated school crests:** shield SVG with school initials + region colour + a pattern
  derived from the reg. number hash. No real logos.
* **Accessibility:** WCAG AA contrast, rem-based type, correct/incorrect always shown with icon
  + text, not colour alone.
* **System font stack** (no web-font download — saves ~40–100 KB per first visit on 2G).

---

## 7. Compliance requirements (Tanzania)

Each requirement maps to an engineering control. Items marked **(Org)** are organisational and
tracked in `docs/compliance-checklist.md`.

### 7.1 Personal Data Protection Act, 2022 (PDPA)
| Requirement | Control |
| --- | --- |
| Register with PDPC as collector/processor; appoint DPO **(Org)** | DPO contact rendered in privacy policy from config `DPO_CONTACT`. |
| **Prior parental consent for children's data** | SMS OTP flow (§3.1). The child profile is created server-side *only inside the consent-confirm transaction*. `consents` row stores timestamp, `guardian.phone_hash`, `policy_version`, method. |
| Data minimisation | Fixed field list (§3.1); no free text except filtered nickname/group name. |
| Purpose limitation | Data used only for learning, rankings and safety. No ads, no profiling for marketing. |
| Retention limits | `RETENTION_INACTIVE_DAYS` (default 365): daily job erases inactive profiles. OTP requests deleted after 24 h. Audit logs kept 2 years, containing no child content. |
| Data subject rights | `/parent`: SMS login → view, **export (JSON)**, **delete** each linked child, **withdraw consent** (= delete). |
| Breach logging & notification | `breach_incidents` table + admin workflow with timestamps for PDPC and guardian notification (72-hour target clock shown in UI). |
| Cross-border transfer | `DB_REGION` / `DATA_RESIDENCY` config; boot warns when not `tz`. Hosting decision documented in `docs/hosting-decision.md`. |
| Phone numbers | Raw numbers never stored. `HMAC-SHA256(PHONE_HASH_PEPPER, E.164)` — peppered because the TZ phone space is small enough to brute-force a plain hash. |

### 7.2 Child safety (Law of the Child Act; duty of care)
No free chat, no photos (preset avatars only), no public real names (handles), no location
sharing, no contact between unconnected users beyond preset challenge messages, report + block
on every profile and group, moderation queue, blocked users cannot challenge or see each other's
reactions.

### 7.3 No gambling mechanics
No paid entry, no cash/airtime prizes, no loot boxes, no random rewards bought with anything.
Points have **no monetary value** (stated in Terms).

### 7.4 No payments or ads targeted at children
No ad SDKs, no payment code in the student app. Future payments only via verified parent/school
accounts.

### 7.5 Copyright
Source-type rules in §4.2 are enforced at approval time.

### 7.6 Cybercrimes Act 2015 & online content regulations
User-generated content limited to filtered nicknames/group names and preset messages; all admin
and moderation actions written to `audit_log`.

### 7.7 Policies
Privacy policy and Terms in **Kiswahili and English**, plain language, versioned
(`POLICY_VERSION`); consent records the version accepted.

### 7.8 Partnerships **(Org)**
TIE content alignment review; regional education office engagement before large rollouts.

---

## 8. Data model

```
regions ─< districts ─< schools ─< students >─ guardians ─< consents
                                   │  ├─< device_profiles >─ devices
                                   │  ├─< quiz_sessions ─< answers
                                   │  ├─< seen_questions
                                   │  ├─< points_ledger (append-only)
                                   │  └─< group_members >─ groups ─< group_reactions
grade_levels ─< topics >─ subjects
topics ─< lessons · questions · question_templates
challenges (challenger, opponent, question set, sessions)
daily_challenges (date × grade → topic)
ranking_snapshots · reports · blocks · moderation_actions · anomaly_flags
audit_log · admins · content_licenses · otp_requests · breach_incidents · offline_packs
```

**Ledger invariant:** `points_ledger` is append-only. A Postgres trigger rejects `UPDATE`
and rejects `DELETE` unless the transaction sets `schoolpawa.erasure = 'on'` (used only by the
lawful erasure path). Rankings are computed from the ledger; Redis sorted sets are a
rebuildable cache.

Full column-level definitions live in `src/db/schema.ts` (single source of truth).

---

## 9. Key user flows

### 9.1 Consent
1. Child completes profile locally → enters parent phone.
2. `POST /api/consent/request` → rate-limit → create `otp_requests` (phone hash, OTP hash,
   5-min expiry, 5 attempts) → SMS via Africa's Talking:
   *"School Pawa: Mtoto wako anaomba ruhusa kutumia School Pawa. Nambari ya ruhusa: 482913. Usimpe mtu yeyote isipokuwa kama unakubali."*
3. The device shows a **parent-facing screen** ("Mzazi, tafadhali soma") summarising what is
   collected, with a link to the full policy. Parent enters OTP and taps *Ninakubali*.
4. `POST /api/consent/confirm` → in one transaction: verify OTP, upsert guardian, create
   student, create consent, link device, audit log → session cookie.

### 9.2 Quiz round
`POST /api/quiz/start {topicId, kind}` → session + first question →
`POST /api/quiz/:id/answer {position, answer}` → feedback + next question → … →
final response includes summary, points, held flag, rank delta.

### 9.3 Offline
Download pack (`GET /api/packs/:topicId`, 30 questions with answers, signed pack id recorded
server-side) → play offline with local grading → results queued in IndexedDB → background /
on-reconnect `POST /api/sync` (idempotent by `clientResultId`) → server **re-grades against its
own copy**, applies offline multiplier and daily cap.

*Trade-off:* offline packs necessarily contain answers on-device. They therefore earn reduced,
capped points and never count toward Daily Challenge or 1v1.

---

## 10. Phase plan

| Phase | Scope |
| --- | --- |
| **0 — Foundations** | `CLAUDE.md`, `PRD.md`, architecture, compliance checklist. |
| **1 — Shinyanga pilot** (this build) | One region; schools via CSV import; Std 7 + Form 4, two subjects each; sw/en UI; onboarding + multi-profile + SMS consent; Learn → Quiz with full randomisation engine; Daily Challenge; 1v1; Groups (preset reactions, leaderboards, streaks); Student + School Power boards with improvement awards; admin (question pipeline, CSV import, moderation, held points, breach log, audit log); offline packs + sync queue; parent portal; retention job; unit tests for randomiser and ranking. |
| **2 — Scale content & competition** | All regions & grades; school-vs-school weekly tournaments; group-vs-group challenges; teacher accounts, verified schools; teacher content portal with licence e-signature; question stats dashboards; push notifications (opt-in, parent-controlled). |
| **3 — Distribution** | TWA/APK wrapper, Play Store listing (Families policy review), data-saver mode, USSD/SMS daily question for feature phones, AI drafting assistant (always teacher-approved). |
| **4 — Ecosystem** | School dashboards for teachers, regional education office reports (aggregate only), optional parent/school paid features via verified accounts. |
