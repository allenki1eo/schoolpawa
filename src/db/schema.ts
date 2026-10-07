/**
 * School Pawa database schema — single source of truth for the data model (PRD §8).
 *
 * Privacy notes:
 *  - No table stores a child's real name, birthdate, photo, location or a raw phone number.
 *  - `guardians.phone_hash` is HMAC-SHA256(pepper, E.164) — see src/server/crypto.ts.
 *  - `points_ledger` is append-only (trigger in migrations/0001_ledger_guard.sql).
 */
import { sql } from "drizzle-orm";
import {
  bigserial,
  boolean,
  date,
  doublePrecision,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  primaryKey,
  smallint,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import type { CanonicalAnswer, QuestionType } from "@/lib/quiz/types";
import type { TemplateSpec } from "@/lib/quiz/template";

const id = () => uuid("id").primaryKey().defaultRandom();
const createdAt = () => timestamp("created_at", { withTimezone: true }).notNull().defaultNow();
const ts = (name: string) => timestamp(name, { withTimezone: true });

// ─── Enums ──────────────────────────────────────────────────────────────────────────────────

export const stageEnum = pgEnum("stage", ["primary", "secondary"]);
export const sizeBandEnum = pgEnum("size_band", ["S", "M", "L", "XL"]);
export const languageEnum = pgEnum("language", ["sw", "en"]);
export const studentStatusEnum = pgEnum("student_status", ["active", "suspended"]);
export const questionTypeEnum = pgEnum("question_type", ["mcq", "true_false", "number", "ordering"]);
export const contentStatusEnum = pgEnum("content_status", ["draft", "in_review", "approved", "retired"]);
export const sourceTypeEnum = pgEnum("source_type", ["original", "ai_draft", "teacher_submitted", "licensed"]);
export const sessionKindEnum = pgEnum("session_kind", ["practice", "daily", "challenge", "offline"]);
export const sessionStatusEnum = pgEnum("session_status", ["active", "completed", "abandoned"]);
export const challengeStatusEnum = pgEnum("challenge_status", ["open", "completed", "expired", "declined"]);
export const ledgerSourceEnum = pgEnum("ledger_source", [
  "quiz",
  "daily",
  "challenge",
  "challenge_bonus",
  "offline",
  "release",
  /** Resolution marker for a held entry that a moderator rejected. Never counted. */
  "void",
  "adjustment",
]);
export const ledgerStatusEnum = pgEnum("ledger_status", ["counted", "held"]);
export const reportTargetEnum = pgEnum("report_target", ["student", "group", "question"]);
export const reportStatusEnum = pgEnum("report_status", ["open", "actioned", "dismissed"]);
export const adminRoleEnum = pgEnum("admin_role", ["reviewer", "moderator", "superadmin"]);
export const otpPurposeEnum = pgEnum("otp_purpose", ["consent", "parent_login"]);
export const flagStatusEnum = pgEnum("flag_status", ["open", "resolved_ok", "resolved_void"]);
export const breachStatusEnum = pgEnum("breach_status", ["open", "contained", "notified", "closed"]);

// ─── Geography & schools ────────────────────────────────────────────────────────────────────

export const regions = pgTable("regions", {
  id: id(),
  code: text("code").notNull().unique(),
  name: text("name").notNull(),
  /** Crest colour for schools in this region. */
  color: text("color").notNull(),
});

export const districts = pgTable(
  "districts",
  {
    id: id(),
    regionId: uuid("region_id").notNull().references(() => regions.id),
    name: text("name").notNull(),
  },
  (t) => [uniqueIndex("districts_region_name").on(t.regionId, t.name)],
);

export const schools = pgTable(
  "schools",
  {
    id: id(),
    /** Official registration number (e.g. from the PO-RALG / NECTA registry). */
    regNo: text("reg_no").notNull().unique(),
    name: text("name").notNull(),
    districtId: uuid("district_id").notNull().references(() => districts.id),
    stage: stageEnum("stage").notNull(),
    sizeBand: sizeBandEnum("size_band").notNull(),
    enrolledEstimate: integer("enrolled_estimate").notNull(),
    verified: boolean("verified").notNull().default(false),
    active: boolean("active").notNull().default(true),
    createdAt: createdAt(),
  },
  (t) => [index("schools_district").on(t.districtId), index("schools_name_search").on(sql`lower(${t.name})`)],
);

/** Configurable grade structure (curriculum reform-proof). */
export const gradeLevels = pgTable("grade_levels", {
  id: text("id").primaryKey(), // e.g. "std7", "form4"
  stage: stageEnum("stage").notNull(),
  ordinal: smallint("ordinal").notNull(),
  labelSw: text("label_sw").notNull(),
  labelEn: text("label_en").notNull(),
  active: boolean("active").notNull().default(true),
});

// ─── People ─────────────────────────────────────────────────────────────────────────────────

export const devices = pgTable("devices", {
  id: id(),
  createdAt: createdAt(),
  lastSeenAt: ts("last_seen_at").notNull().defaultNow(),
  flagged: boolean("flagged").notNull().default(false),
});

export const guardians = pgTable("guardians", {
  id: id(),
  phoneHash: text("phone_hash").notNull().unique(),
  createdAt: createdAt(),
});

export const students = pgTable(
  "students",
  {
    id: id(),
    nickname: text("nickname").notNull(),
    discriminator: smallint("discriminator").notNull(),
    avatar: text("avatar").notNull(),
    gradeLevelId: text("grade_level_id").notNull().references(() => gradeLevels.id),
    schoolId: uuid("school_id").notNull().references(() => schools.id),
    guardianId: uuid("guardian_id").notNull().references(() => guardians.id),
    pinHash: text("pin_hash").notNull(),
    locale: languageEnum("locale").notNull().default("sw"),
    /** Denormalised from the ledger for fast display; the ledger remains authoritative. */
    xp: integer("xp").notNull().default(0),
    rating: integer("rating").notNull().default(1000),
    ratedGames: integer("rated_games").notNull().default(0),
    streakDays: integer("streak_days").notNull().default(0),
    lastActiveDate: date("last_active_date"),
    status: studentStatusEnum("status").notNull().default("active"),
    createdAt: createdAt(),
    lastSeenAt: ts("last_seen_at").notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("students_handle").on(sql`lower(${t.nickname})`, t.discriminator),
    index("students_school").on(t.schoolId),
    index("students_guardian").on(t.guardianId),
    index("students_last_seen").on(t.lastSeenAt),
  ],
);

export const deviceProfiles = pgTable(
  "device_profiles",
  {
    deviceId: uuid("device_id").notNull().references(() => devices.id, { onDelete: "cascade" }),
    studentId: uuid("student_id").notNull().references(() => students.id, { onDelete: "cascade" }),
    createdAt: createdAt(),
  },
  (t) => [primaryKey({ columns: [t.deviceId, t.studentId] })],
);

/** Proof of prior parental consent (PDPA). One row per child per grant. */
export const consents = pgTable("consents", {
  id: id(),
  guardianId: uuid("guardian_id").notNull().references(() => guardians.id),
  /** Nullable so the consent record survives erasure of the child (proof we had consent). */
  studentId: uuid("student_id").references(() => students.id, { onDelete: "set null" }),
  phoneHash: text("phone_hash").notNull(),
  policyVersion: text("policy_version").notNull(),
  method: text("method").notNull().default("sms_otp"),
  locale: languageEnum("locale").notNull(),
  grantedAt: ts("granted_at").notNull().defaultNow(),
  withdrawnAt: ts("withdrawn_at"),
});

export const otpRequests = pgTable(
  "otp_requests",
  {
    id: id(),
    purpose: otpPurposeEnum("purpose").notNull(),
    phoneHash: text("phone_hash").notNull(),
    codeHash: text("code_hash").notNull(),
    attempts: smallint("attempts").notNull().default(0),
    expiresAt: ts("expires_at").notNull(),
    consumedAt: ts("consumed_at"),
    createdAt: createdAt(),
  },
  (t) => [index("otp_phone").on(t.phoneHash, t.createdAt)],
);

export const admins = pgTable("admins", {
  id: id(),
  email: text("email").notNull().unique(),
  name: text("name").notNull(),
  passwordHash: text("password_hash").notNull(),
  role: adminRoleEnum("role").notNull(),
  /** Required to approve `ai_draft` content (PRD §4.2). */
  isQualifiedTeacher: boolean("is_qualified_teacher").notNull().default(false),
  active: boolean("active").notNull().default(true),
  createdAt: createdAt(),
});

// ─── Content ────────────────────────────────────────────────────────────────────────────────

export const subjects = pgTable("subjects", {
  id: id(),
  code: text("code").notNull().unique(),
  nameSw: text("name_sw").notNull(),
  nameEn: text("name_en").notNull(),
  stage: stageEnum("stage").notNull(),
  /** Official medium of instruction for this subject. */
  medium: languageEnum("medium").notNull(),
  accent: text("accent").notNull(),
  icon: text("icon").notNull(),
});

export const topics = pgTable(
  "topics",
  {
    id: id(),
    subjectId: uuid("subject_id").notNull().references(() => subjects.id),
    gradeLevelId: text("grade_level_id").notNull().references(() => gradeLevels.id),
    code: text("code").notNull().unique(),
    nameSw: text("name_sw").notNull(),
    nameEn: text("name_en").notNull(),
    syllabusRef: text("syllabus_ref").notNull(),
    sortOrder: smallint("sort_order").notNull().default(0),
    /** Recomputed by the pool-size rule; selection only serves live topics. */
    isLive: boolean("is_live").notNull().default(false),
  },
  (t) => [index("topics_grade").on(t.gradeLevelId)],
);

export const lessons = pgTable("lessons", {
  id: id(),
  topicId: uuid("topic_id").notNull().references(() => topics.id, { onDelete: "cascade" }),
  sortOrder: smallint("sort_order").notNull(),
  language: languageEnum("language").notNull(),
  title: text("title").notNull(),
  body: text("body").notNull(),
  example: text("example"),
});

/** Third-party / contributor licences. Required for `licensed` and `teacher_submitted` content. */
export const contentLicenses = pgTable("content_licenses", {
  id: id(),
  licensor: text("licensor").notNull(),
  kind: text("kind").notNull(), // "contributor_agreement" | "written_permission"
  scope: text("scope").notNull(),
  documentRef: text("document_ref").notNull(),
  signedAt: date("signed_at").notNull(),
  recordedBy: uuid("recorded_by").references(() => admins.id),
  createdAt: createdAt(),
});

const contentColumns = () => ({
  topicId: uuid("topic_id").notNull().references(() => topics.id),
  subTopic: text("sub_topic").notNull(),
  syllabusRef: text("syllabus_ref").notNull(),
  difficulty: smallint("difficulty").notNull().$type<1 | 2 | 3>(),
  language: languageEnum("language").notNull(),
  sourceType: sourceTypeEnum("source_type").notNull(),
  licenseId: uuid("license_id").references(() => contentLicenses.id),
  authorId: uuid("author_id").references(() => admins.id),
  authorLabel: text("author_label"),
  reviewerId: uuid("reviewer_id").references(() => admins.id),
  reviewNote: text("review_note"),
  status: contentStatusEnum("status").notNull().default("draft"),
  flagCount: integer("flag_count").notNull().default(0),
  timesShown: integer("times_shown").notNull().default(0),
  timesCorrect: integer("times_correct").notNull().default(0),
  totalTimeMs: doublePrecision("total_time_ms").notNull().default(0),
  createdAt: createdAt(),
  updatedAt: ts("updated_at").notNull().defaultNow(),
});

export const questions = pgTable(
  "questions",
  {
    id: id(),
    type: questionTypeEnum("type").notNull().$type<QuestionType>(),
    prompt: text("prompt").notNull(),
    /** Canonical option order. */
    options: jsonb("options").$type<string[]>().notNull().default([]),
    answer: jsonb("answer").$type<CanonicalAnswer>().notNull(),
    explanation: text("explanation").notNull(),
    ...contentColumns(),
  },
  (t) => [index("questions_topic_status").on(t.topicId, t.status)],
);

export const questionTemplates = pgTable(
  "question_templates",
  {
    id: id(),
    spec: jsonb("spec").$type<TemplateSpec>().notNull(),
    ...contentColumns(),
  },
  (t) => [index("templates_topic_status").on(t.topicId, t.status)],
);

// ─── Play ───────────────────────────────────────────────────────────────────────────────────

export const quizSessions = pgTable(
  "quiz_sessions",
  {
    id: id(),
    studentId: uuid("student_id").notNull().references(() => students.id, { onDelete: "cascade" }),
    kind: sessionKindEnum("kind").notNull(),
    topicId: uuid("topic_id").notNull().references(() => topics.id),
    /** 256-bit DRBG seed — logged for dispute review (PRD §4.1). */
    seed: text("seed").notNull(),
    questionCount: smallint("question_count").notNull(),
    status: sessionStatusEnum("status").notNull().default("active"),
    score: integer("score").notNull().default(0),
    correctCount: smallint("correct_count").notNull().default(0),
    totalTimeMs: integer("total_time_ms").notNull().default(0),
    held: boolean("held").notNull().default(false),
    challengeId: uuid("challenge_id"),
    dailyDate: date("daily_date"),
    startedAt: ts("started_at").notNull().defaultNow(),
    finishedAt: ts("finished_at"),
  },
  (t) => [
    index("sessions_student").on(t.studentId, t.startedAt),
    // One scored daily challenge per student per day.
    uniqueIndex("sessions_daily_once").on(t.studentId, t.dailyDate).where(sql`${t.kind} = 'daily'`),
  ],
);

/** One row per served question; answer columns are filled when the student submits. */
export const answers = pgTable(
  "answers",
  {
    id: id(),
    sessionId: uuid("session_id").notNull().references(() => quizSessions.id, { onDelete: "cascade" }),
    position: smallint("position").notNull(),
    questionId: uuid("question_id").references(() => questions.id),
    templateId: uuid("template_id").references(() => questionTemplates.id),
    /** Template parameter values, so the exact instance can be re-created. */
    params: jsonb("params").$type<Record<string, number>>(),
    /** order[displayIndex] = canonicalIndex */
    optionOrder: jsonb("option_order").$type<number[]>().notNull(),
    difficulty: smallint("difficulty").notNull().$type<1 | 2 | 3>(),
    servedAt: ts("served_at"),
    answeredAt: ts("answered_at"),
    submitted: jsonb("submitted"),
    isCorrect: boolean("is_correct"),
    timeMs: integer("time_ms"),
    points: integer("points"),
  },
  (t) => [uniqueIndex("answers_session_position").on(t.sessionId, t.position)],
);

export const seenQuestions = pgTable(
  "seen_questions",
  {
    studentId: uuid("student_id").notNull().references(() => students.id, { onDelete: "cascade" }),
    /** "q:<uuid>" or "t:<uuid>" */
    itemKey: text("item_key").notNull(),
    lastSeenAt: ts("last_seen_at").notNull().defaultNow(),
    timesSeen: integer("times_seen").notNull().default(1),
  },
  (t) => [primaryKey({ columns: [t.studentId, t.itemKey] })],
);

export const dailyChallenges = pgTable(
  "daily_challenges",
  {
    id: id(),
    date: date("date").notNull(),
    gradeLevelId: text("grade_level_id").notNull().references(() => gradeLevels.id),
    topicId: uuid("topic_id").notNull().references(() => topics.id),
  },
  (t) => [uniqueIndex("daily_date_grade").on(t.date, t.gradeLevelId)],
);

export const challenges = pgTable(
  "challenges",
  {
    id: id(),
    code: text("code").notNull().unique(),
    challengerId: uuid("challenger_id").notNull().references(() => students.id, { onDelete: "cascade" }),
    /** Null for open share-link challenges until someone accepts. */
    opponentId: uuid("opponent_id").references(() => students.id, { onDelete: "cascade" }),
    groupId: uuid("group_id").references(() => groups.id, { onDelete: "set null" }),
    topicId: uuid("topic_id").notNull().references(() => topics.id),
    seed: text("seed").notNull(),
    /** Shared question set: [{ key, params? }] — same IDs and template params for both players. */
    items: jsonb("items").$type<ChallengeItem[]>().notNull(),
    presetMessage: text("preset_message"),
    challengerSessionId: uuid("challenger_session_id"),
    opponentSessionId: uuid("opponent_session_id"),
    status: challengeStatusEnum("status").notNull().default("open"),
    winnerId: uuid("winner_id"),
    createdAt: createdAt(),
    expiresAt: ts("expires_at").notNull(),
    completedAt: ts("completed_at"),
  },
  (t) => [index("challenges_challenger").on(t.challengerId), index("challenges_opponent").on(t.opponentId)],
);

export interface ChallengeItem {
  key: string;
  difficulty: 1 | 2 | 3;
  params?: Record<string, number>;
}

/** Offline packs issued to a device; the server keeps the question list to re-grade on sync. */
export const offlinePacks = pgTable("offline_packs", {
  id: id(),
  studentId: uuid("student_id").references(() => students.id, { onDelete: "cascade" }),
  topicId: uuid("topic_id").notNull().references(() => topics.id),
  items: jsonb("items").$type<ChallengeItem[]>().notNull(),
  issuedAt: ts("issued_at").notNull().defaultNow(),
});

export const offlineResults = pgTable("offline_results", {
  clientResultId: text("client_result_id").primaryKey(),
  studentId: uuid("student_id").notNull().references(() => students.id, { onDelete: "cascade" }),
  packId: uuid("pack_id").notNull().references(() => offlinePacks.id, { onDelete: "cascade" }),
  points: integer("points").notNull(),
  syncedAt: ts("synced_at").notNull().defaultNow(),
});

// ─── Groups ─────────────────────────────────────────────────────────────────────────────────

export const groups = pgTable("groups", {
  id: id(),
  name: text("name").notNull(),
  emblem: text("emblem").notNull(),
  inviteCode: text("invite_code").notNull().unique(),
  creatorId: uuid("creator_id").references(() => students.id, { onDelete: "set null" }),
  streakDays: integer("streak_days").notNull().default(0),
  lastStreakDate: date("last_streak_date"),
  archived: boolean("archived").notNull().default(false),
  createdAt: createdAt(),
});

export const groupMembers = pgTable(
  "group_members",
  {
    groupId: uuid("group_id").notNull().references(() => groups.id, { onDelete: "cascade" }),
    studentId: uuid("student_id").notNull().references(() => students.id, { onDelete: "cascade" }),
    joinedAt: ts("joined_at").notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.groupId, t.studentId] }), index("group_members_student").on(t.studentId)],
);

/** Preset reactions/messages only — never free text (PRD §3.4). */
export const groupReactions = pgTable(
  "group_reactions",
  {
    id: id(),
    groupId: uuid("group_id").notNull().references(() => groups.id, { onDelete: "cascade" }),
    fromStudentId: uuid("from_student_id").notNull().references(() => students.id, { onDelete: "cascade" }),
    toStudentId: uuid("to_student_id").references(() => students.id, { onDelete: "cascade" }),
    presetKey: text("preset_key").notNull(),
    createdAt: createdAt(),
  },
  (t) => [index("group_reactions_group").on(t.groupId, t.createdAt)],
);

// ─── Points & rankings ──────────────────────────────────────────────────────────────────────

/** Append-only. Rankings are computed from here; never UPDATE. */
export const pointsLedger = pgTable(
  "points_ledger",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    studentId: uuid("student_id").notNull().references(() => students.id),
    /** School at the time the points were earned. */
    schoolId: uuid("school_id").notNull().references(() => schools.id),
    gradeLevelId: text("grade_level_id").notNull(),
    amount: integer("amount").notNull(),
    source: ledgerSourceEnum("source").notNull(),
    status: ledgerStatusEnum("status").notNull(),
    /** quiz_session id, challenge id, offline result id, or the held entry id for `release`. */
    refId: text("ref_id"),
    /** Monday of the week (Africa/Dar_es_Salaam) — for weekly boards. */
    weekStart: date("week_start").notNull(),
    createdAt: createdAt(),
  },
  (t) => [
    index("ledger_week_school").on(t.weekStart, t.schoolId),
    index("ledger_student").on(t.studentId, t.createdAt),
    // A held entry is resolved at most once: either released or voided.
    uniqueIndex("ledger_resolve_once").on(t.refId).where(sql`${t.source} in ('release', 'void')`),
  ],
);

export const rankingSnapshots = pgTable(
  "ranking_snapshots",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    scope: text("scope").notNull(), // "school" | "student" | "group"
    period: text("period").notNull(), // "weekly" | "all_time"
    periodStart: date("period_start").notNull(),
    league: text("league").notNull(), // e.g. "primary:S:region:SHY"
    entityId: uuid("entity_id").notNull(),
    rank: integer("rank").notNull(),
    score: doublePrecision("score").notNull(),
    meta: jsonb("meta").$type<Record<string, number>>(),
    createdAt: createdAt(),
  },
  (t) => [index("snapshots_lookup").on(t.scope, t.period, t.periodStart, t.league)],
);

// ─── Safety, moderation, compliance ─────────────────────────────────────────────────────────

export const reports = pgTable(
  "reports",
  {
    id: id(),
    reporterId: uuid("reporter_id").references(() => students.id, { onDelete: "set null" }),
    targetType: reportTargetEnum("target_type").notNull(),
    targetId: uuid("target_id").notNull(),
    reason: text("reason").notNull(),
    status: reportStatusEnum("status").notNull().default("open"),
    createdAt: createdAt(),
  },
  (t) => [
    index("reports_status").on(t.status, t.createdAt),
    uniqueIndex("reports_once").on(t.reporterId, t.targetType, t.targetId),
  ],
);

export const blocks = pgTable(
  "blocks",
  {
    blockerId: uuid("blocker_id").notNull().references(() => students.id, { onDelete: "cascade" }),
    blockedId: uuid("blocked_id").notNull().references(() => students.id, { onDelete: "cascade" }),
    createdAt: createdAt(),
  },
  (t) => [primaryKey({ columns: [t.blockerId, t.blockedId] })],
);

export const moderationActions = pgTable("moderation_actions", {
  id: id(),
  adminId: uuid("admin_id").notNull().references(() => admins.id),
  targetType: text("target_type").notNull(),
  targetId: text("target_id").notNull(),
  action: text("action").notNull(),
  note: text("note"),
  createdAt: createdAt(),
});

export const anomalyFlags = pgTable(
  "anomaly_flags",
  {
    id: id(),
    kind: text("kind").notNull(),
    entityType: text("entity_type").notNull(),
    entityId: text("entity_id").notNull(),
    detail: jsonb("detail").$type<Record<string, unknown>>(),
    status: flagStatusEnum("status").notNull().default("open"),
    createdAt: createdAt(),
    resolvedAt: ts("resolved_at"),
    resolvedBy: uuid("resolved_by").references(() => admins.id),
  },
  (t) => [index("anomaly_status").on(t.status, t.createdAt)],
);

export const auditLog = pgTable(
  "audit_log",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    actorType: text("actor_type").notNull(), // admin | student | guardian | system
    actorId: text("actor_id"),
    action: text("action").notNull(),
    targetType: text("target_type"),
    targetId: text("target_id"),
    meta: jsonb("meta").$type<Record<string, unknown>>(),
    createdAt: createdAt(),
  },
  (t) => [index("audit_created").on(t.createdAt)],
);

/** PDPA breach register: detection → containment → PDPC + guardian notification. */
export const breachIncidents = pgTable("breach_incidents", {
  id: id(),
  title: text("title").notNull(),
  description: text("description").notNull(),
  severity: text("severity").notNull(), // low | medium | high
  affectedCount: integer("affected_count"),
  detectedAt: ts("detected_at").notNull(),
  containedAt: ts("contained_at"),
  regulatorNotifiedAt: ts("regulator_notified_at"),
  guardiansNotifiedAt: ts("guardians_notified_at"),
  status: breachStatusEnum("status").notNull().default("open"),
  createdBy: uuid("created_by").references(() => admins.id),
  createdAt: createdAt(),
});
