import { and, asc, desc, eq, type SQL } from "drizzle-orm";
import Link from "next/link";
import { redirect } from "next/navigation";
import { db, schema } from "@/db/client";
import { PageTitle, SmallButton, StatusPill, Table, field } from "@/components/admin/ui";
import { questionHealth } from "@/lib/integrity/anomaly";
import { requireAdmin } from "@/server/admin/auth";
import { PipelineError, transition, type ContentKind, type Transition } from "@/server/admin/questions";
import { poolStats } from "@/server/quiz/content";

async function act(formData: FormData) {
  "use server";
  const admin = await requireAdmin("reviewer");
  const back = String(formData.get("back") ?? "/admin/questions");
  try {
    await transition(admin, formData.get("kind") as ContentKind, String(formData.get("id")), formData.get("action") as Transition, String(formData.get("note") ?? "") || undefined);
  } catch (e) {
    if (e instanceof PipelineError) redirect(`${back}${back.includes("?") ? "&" : "?"}error=${encodeURIComponent(e.message)}`);
    throw e;
  }
  redirect(back);
}

type SP = { status?: string; topic?: string; error?: string };
const STATUSES = ["in_review", "draft", "approved", "retired"] as const;

export default async function QuestionsAdmin({ searchParams }: { searchParams: Promise<SP> }) {
  const admin = await requireAdmin();
  const sp = await searchParams;
  const status = (STATUSES as readonly string[]).includes(sp.status ?? "") ? (sp.status as (typeof STATUSES)[number]) : "in_review";
  const topics = await db.select().from(schema.topics).orderBy(asc(schema.topics.code));
  const stats = await Promise.all(topics.map(async (t) => ({ topic: t, ...(await poolStats(t.id)) })));
  const qWhere: SQL[] = [eq(schema.questions.status, status)];
  const tWhere: SQL[] = [eq(schema.questionTemplates.status, status)];
  if (sp.topic) {
    qWhere.push(eq(schema.questions.topicId, sp.topic));
    tWhere.push(eq(schema.questionTemplates.topicId, sp.topic));
  }
  const [qs, ts] = await Promise.all([
    db.select().from(schema.questions).where(and(...qWhere)).orderBy(desc(schema.questions.flagCount), desc(schema.questions.updatedAt)).limit(200),
    db.select().from(schema.questionTemplates).where(and(...tWhere)).orderBy(desc(schema.questionTemplates.updatedAt)).limit(100),
  ]);
  const topicCode = new Map(topics.map((t) => [t.id, t.code]));
  const back = `/admin/questions?status=${status}${sp.topic ? `&topic=${sp.topic}` : ""}`;

  const rows = [
    ...qs.map((q) => ({ ...q, kind: "question" as const, extra: q.type })),
    ...ts.map((t) => ({ ...t, kind: "template" as const, prompt: t.spec.prompt, extra: `template · ${t.spec.type}` })),
  ];

  return (
    <div>
      <PageTitle sub="draft → in_review → approved → retired. AI drafts need a qualified teacher; licensed/teacher content needs a licence on file; nobody approves their own work.">Content pipeline</PageTitle>
      {sp.error ? <p className="mb-4 rounded-xl bg-danger/10 px-4 py-3 text-sm text-red-200 ring-1 ring-danger/30">{sp.error}</p> : null}

      <h2 className="mb-2 text-sm font-bold text-muted">Topic pools (live needs ≥ {stats[0]?.required ?? 60} effective items, ≥ {stats[0]?.perDifficultyMin ?? 10} per difficulty)</h2>
      <Table className="mb-8">
        <thead>
          <tr><th>Topic</th><th>Easy</th><th>Medium</th><th>Hard</th><th>Total</th><th>Live</th></tr>
        </thead>
        <tbody>
          {stats.map((s) => (
            <tr key={s.topic.id}>
              <td><Link href={`/admin/questions?status=${status}&topic=${s.topic.id}`} className="font-semibold hover:underline">{s.topic.code}</Link><div className="text-xs text-subtle">{s.topic.nameEn}</div></td>
              <td className="num">{s.byDifficulty[1]}</td>
              <td className="num">{s.byDifficulty[2]}</td>
              <td className="num">{s.byDifficulty[3]}</td>
              <td className="num font-bold">{s.total}</td>
              <td>{s.live ? <span className="text-success">● live</span> : <span className="text-subtle">○ not live</span>}</td>
            </tr>
          ))}
        </tbody>
      </Table>

      <div className="mb-4 flex flex-wrap items-center gap-2">
        {STATUSES.map((s) => (
          <Link key={s} href={`/admin/questions?status=${s}${sp.topic ? `&topic=${sp.topic}` : ""}`} className={`rounded-full px-3 py-1.5 text-sm font-semibold ring-1 ${s === status ? "bg-gold-400/15 text-gold-200 ring-gold-400/40" : "text-muted ring-line"}`}>
            {s.replace("_", " ")}
          </Link>
        ))}
        {sp.topic ? <Link href={`/admin/questions?status=${status}`} className="text-xs text-subtle underline">clear topic filter</Link> : null}
        <Link href="/admin/questions/new" className="ml-auto rounded-xl bg-gold-400 px-3 py-2 text-sm font-bold text-ink-950">+ New question</Link>
      </div>

      <Table>
        <thead>
          <tr><th>Item</th><th>Topic</th><th>Diff</th><th>Source</th><th>Stats</th><th>Status</th><th>Actions</th></tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr><td colSpan={7} className="py-8 text-center text-subtle">Nothing here.</td></tr>
          ) : null}
          {rows.map((r) => {
            const health = questionHealth(r.timesShown, r.timesCorrect);
            const acc = r.timesShown ? Math.round((r.timesCorrect / r.timesShown) * 100) : null;
            const blocked = r.sourceType === "ai_draft" && !admin.isQualifiedTeacher;
            return (
              <tr key={`${r.kind}:${r.id}`}>
                <td className="max-w-md">
                  <p className="font-medium">{r.prompt}</p>
                  <p className="text-xs text-subtle">{r.extra} · {r.subTopic} · {r.language}{r.reviewNote ? ` · note: ${r.reviewNote}` : ""}</p>
                </td>
                <td className="text-xs">{topicCode.get(r.topicId)}</td>
                <td className="num">{r.difficulty}</td>
                <td className="text-xs">{r.sourceType}{r.licenseId ? " · licence ✓" : ""}<div className="text-subtle">{r.authorLabel}</div></td>
                <td className="num text-xs">
                  {r.timesShown} shown{acc !== null ? ` · ${acc}%` : ""}
                  {r.flagCount ? <div className="text-danger">{r.flagCount} flags</div> : null}
                  {health !== "ok" ? <div className="text-gold-200">{health.replace("_", " ")}</div> : null}
                </td>
                <td><StatusPill status={r.status} /></td>
                <td>
                  <form action={act} className="flex flex-wrap gap-1">
                    <input type="hidden" name="kind" value={r.kind} />
                    <input type="hidden" name="id" value={r.id} />
                    <input type="hidden" name="back" value={back} />
                    {r.status === "draft" ? <SmallButton name="action" value="submit">Submit</SmallButton> : null}
                    {r.status === "in_review" ? (
                      <SmallButton name="action" value="approve" tone="good" disabled={blocked} title={blocked ? "Requires a qualified teacher" : undefined}>Approve</SmallButton>
                    ) : null}
                    {r.status === "in_review" || r.status === "approved" ? (
                      <>
                        <input name="note" placeholder="Rejection note" className={`${field} h-7 w-32 text-xs`} />
                        <SmallButton name="action" value="reject" tone="bad">Reject</SmallButton>
                      </>
                    ) : null}
                    {r.status !== "retired" ? <SmallButton name="action" value="retire">Retire</SmallButton> : <SmallButton name="action" value="restore">Restore</SmallButton>}
                  </form>
                </td>
              </tr>
            );
          })}
        </tbody>
      </Table>
    </div>
  );
}
