import { desc, eq, inArray } from "drizzle-orm";
import { redirect } from "next/navigation";
import { db, schema } from "@/db/client";
import { PageTitle, SmallButton, StatusPill, Table } from "@/components/admin/ui";
import { requireAdmin } from "@/server/admin/auth";
import { reinstateStudent, resolveFlag, resolveReport } from "@/server/admin/moderation";

async function onReport(formData: FormData) {
  "use server";
  const admin = await requireAdmin("moderator");
  await resolveReport(admin, String(formData.get("id")), formData.get("action") as "dismiss" | "suspend_student" | "archive_group");
  redirect("/admin/moderation");
}
async function onFlag(formData: FormData) {
  "use server";
  const admin = await requireAdmin("moderator");
  await resolveFlag(admin, String(formData.get("id")), formData.get("decision") as "release" | "void");
  redirect("/admin/moderation#flags");
}
async function onReinstate(formData: FormData) {
  "use server";
  const admin = await requireAdmin("moderator");
  await reinstateStudent(admin, String(formData.get("id")));
  redirect("/admin/moderation");
}

export default async function Moderation() {
  await requireAdmin();
  const [reports, flags, suspended] = await Promise.all([
    db.select().from(schema.reports).where(eq(schema.reports.status, "open")).orderBy(desc(schema.reports.createdAt)).limit(200),
    db.select().from(schema.anomalyFlags).where(eq(schema.anomalyFlags.status, "open")).orderBy(desc(schema.anomalyFlags.createdAt)).limit(200),
    db.select().from(schema.students).where(eq(schema.students.status, "suspended")).limit(100),
  ]);
  const studentIds = reports.filter((r) => r.targetType === "student").map((r) => r.targetId);
  const groupIds = reports.filter((r) => r.targetType === "group").map((r) => r.targetId);
  const [students, groups] = await Promise.all([
    studentIds.length ? db.select({ id: schema.students.id, nickname: schema.students.nickname, d: schema.students.discriminator }).from(schema.students).where(inArray(schema.students.id, studentIds)) : [],
    groupIds.length ? db.select({ id: schema.groups.id, name: schema.groups.name }).from(schema.groups).where(inArray(schema.groups.id, groupIds)) : [],
  ]);
  const label = (type: string, id: string) =>
    type === "student" ? (students.find((s) => s.id === id)?.nickname ?? "(erased)") : type === "group" ? (groups.find((g) => g.id === id)?.name ?? "(deleted)") : id.slice(0, 8);

  return (
    <div className="space-y-10">
      <section>
        <PageTitle sub="Students can only produce filtered names and preset messages; reports target names, behaviour and questions. Question flags are handled in Content.">Reports</PageTitle>
        <Table>
          <thead><tr><th>Target</th><th>Reason</th><th>When</th><th>Actions</th></tr></thead>
          <tbody>
            {reports.length === 0 ? <tr><td colSpan={4} className="py-6 text-center text-subtle">Queue is empty 🎉</td></tr> : null}
            {reports.map((r) => (
              <tr key={r.id}>
                <td><span className="text-xs text-subtle">{r.targetType}</span><div className="font-semibold">{label(r.targetType, r.targetId)}</div></td>
                <td>{r.reason}</td>
                <td className="text-xs text-subtle">{r.createdAt.toISOString().slice(0, 16).replace("T", " ")}</td>
                <td>
                  <form action={onReport} className="flex flex-wrap gap-1">
                    <input type="hidden" name="id" value={r.id} />
                    <SmallButton name="action" value="dismiss">Dismiss</SmallButton>
                    {r.targetType === "student" ? <SmallButton name="action" value="suspend_student" tone="bad">Suspend</SmallButton> : null}
                    {r.targetType === "group" ? <SmallButton name="action" value="archive_group" tone="bad">Archive group</SmallButton> : null}
                  </form>
                </td>
              </tr>
            ))}
          </tbody>
        </Table>
      </section>

      <section id="flags">
        <PageTitle sub="Points from flagged rounds are written as HELD and excluded from rankings until a moderator releases or voids them (append-only ledger).">Integrity flags</PageTitle>
        <Table>
          <thead><tr><th>Kind</th><th>Entity</th><th>Detail</th><th>Status</th><th>Decision</th></tr></thead>
          <tbody>
            {flags.length === 0 ? <tr><td colSpan={5} className="py-6 text-center text-subtle">No open flags.</td></tr> : null}
            {flags.map((f) => (
              <tr key={f.id}>
                <td className="font-semibold">{f.kind}</td>
                <td className="text-xs">{f.entityType}<div className="font-mono text-subtle">{f.entityId.slice(0, 13)}</div></td>
                <td className="max-w-xs font-mono text-[0.7rem] break-all text-subtle">{JSON.stringify(f.detail)}</td>
                <td><StatusPill status={f.status} /></td>
                <td>
                  <form action={onFlag} className="flex gap-1">
                    <input type="hidden" name="id" value={f.id} />
                    <SmallButton name="decision" value="release" tone="good">Release</SmallButton>
                    <SmallButton name="decision" value="void" tone="bad">Void</SmallButton>
                  </form>
                </td>
              </tr>
            ))}
          </tbody>
        </Table>
      </section>

      <section>
        <PageTitle>Suspended students</PageTitle>
        <Table>
          <tbody>
            {suspended.length === 0 ? <tr><td className="py-6 text-center text-subtle">None.</td></tr> : null}
            {suspended.map((s) => (
              <tr key={s.id}>
                <td className="font-semibold">{s.nickname}#{String(s.discriminator).padStart(4, "0")}</td>
                <td className="text-right">
                  <form action={onReinstate}><input type="hidden" name="id" value={s.id} /><SmallButton tone="good">Reinstate</SmallButton></form>
                </td>
              </tr>
            ))}
          </tbody>
        </Table>
      </section>
    </div>
  );
}
