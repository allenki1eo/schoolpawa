import { count, eq, sql } from "drizzle-orm";
import Link from "next/link";
import { revalidatePath } from "next/cache";
import { db, schema } from "@/db/client";
import { PageTitle, SmallButton } from "@/components/admin/ui";
import { audit } from "@/server/audit";
import { requireAdmin } from "@/server/admin/auth";
import { config } from "@/server/config";
import { rebuildStudentBoards } from "@/server/leaderboard";

async function rebuild() {
  "use server";
  const admin = await requireAdmin("moderator");
  await rebuildStudentBoards();
  await audit({ actorType: "admin", actorId: admin.id, action: "rankings.rebuild" });
  revalidatePath("/admin");
}

export default async function AdminHome() {
  await requireAdmin();
  const n = async (q: Promise<Array<{ n: number }>>) => (await q)[0]?.n ?? 0;
  const [review, reports, flags, students, schools, live, held] = await Promise.all([
    n(db.select({ n: count() }).from(schema.questions).where(eq(schema.questions.status, "in_review"))),
    n(db.select({ n: count() }).from(schema.reports).where(eq(schema.reports.status, "open"))),
    n(db.select({ n: count() }).from(schema.anomalyFlags).where(eq(schema.anomalyFlags.status, "open"))),
    n(db.select({ n: count() }).from(schema.students)),
    n(db.select({ n: count() }).from(schema.schools)),
    n(db.select({ n: count() }).from(schema.topics).where(eq(schema.topics.isLive, true))),
    db.execute<{ n: string }>(sql`select coalesce(sum(amount),0) as n from points_ledger h where status='held' and source<>'void' and not exists (select 1 from points_ledger r where r.source in ('release','void') and r.ref_id = h.id::text)`).then((r) => Number(r[0]?.n ?? 0)),
  ]);
  const cards = [
    { label: "Questions in review", value: review, href: "/admin/questions?status=in_review", alert: review > 0 },
    { label: "Open reports", value: reports, href: "/admin/moderation", alert: reports > 0 },
    { label: "Integrity flags", value: flags, href: "/admin/moderation#flags", alert: flags > 0 },
    { label: "Points held", value: held, href: "/admin/moderation#flags" },
    { label: "Students (consented)", value: students, href: "#" },
    { label: "Schools", value: schools, href: "/admin/schools" },
    { label: "Live topics", value: live, href: "/admin/questions" },
  ];
  return (
    <div>
      <PageTitle sub={`Data residency: ${config.DATA_RESIDENCY.toUpperCase()} · DB region ${config.DB_REGION} · Policy ${config.POLICY_VERSION}`}>Overview</PageTitle>
      {config.DATA_RESIDENCY.toLowerCase() !== "tz" ? (
        <p className="mb-6 rounded-2xl bg-danger/10 px-4 py-3 text-sm text-red-200 ring-1 ring-danger/30">
          Personal data is stored outside Tanzania. Confirm the PDPA cross-border adequacy basis is documented in docs/hosting-decision.md.
        </p>
      ) : null}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {cards.map((c) => (
          <Link key={c.label} href={c.href} className={`surface rounded-2xl p-4 ${c.alert ? "ring-1 ring-gold-400/40" : ""}`}>
            <p className="text-xs text-subtle">{c.label}</p>
            <p className="num font-display mt-1 text-3xl font-black">{c.value.toLocaleString("en-US")}</p>
          </Link>
        ))}
      </div>
      <form action={rebuild} className="mt-8">
        <SmallButton type="submit">Rebuild leaderboard cache from ledger</SmallButton>
      </form>
    </div>
  );
}
