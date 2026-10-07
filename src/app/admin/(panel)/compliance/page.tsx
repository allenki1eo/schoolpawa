import { desc, eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { db, schema } from "@/db/client";
import { PageTitle, SmallButton, StatusPill, Table, field } from "@/components/admin/ui";
import { Button } from "@/components/ui/button";
import { audit } from "@/server/audit";
import { requireAdmin } from "@/server/admin/auth";
import { config } from "@/server/config";

const NOTIFY_HOURS = 72;

function hoursSince(d: Date) {
  return Math.round((Date.now() - d.getTime()) / 3_600_000);
}

async function logBreach(formData: FormData) {
  "use server";
  const admin = await requireAdmin("superadmin");
  const [b] = await db
    .insert(schema.breachIncidents)
    .values({
      title: String(formData.get("title")),
      description: String(formData.get("description")),
      severity: String(formData.get("severity")),
      affectedCount: Number(formData.get("affected") || 0) || null,
      detectedAt: new Date(String(formData.get("detectedAt")) || Date.now()),
      createdBy: admin.id,
    })
    .returning({ id: schema.breachIncidents.id });
  await audit({ actorType: "admin", actorId: admin.id, action: "breach.logged", targetType: "breach", targetId: b!.id });
  redirect("/admin/compliance");
}

async function advanceBreach(formData: FormData) {
  "use server";
  const admin = await requireAdmin("superadmin");
  const id = String(formData.get("id"));
  const step = String(formData.get("step"));
  const now = new Date();
  const patch =
    step === "contained" ? { containedAt: now, status: "contained" as const }
    : step === "regulator" ? { regulatorNotifiedAt: now, status: "notified" as const }
    : step === "guardians" ? { guardiansNotifiedAt: now }
    : { status: "closed" as const };
  await db.update(schema.breachIncidents).set(patch).where(eq(schema.breachIncidents.id, id));
  await audit({ actorType: "admin", actorId: admin.id, action: `breach.${step}`, targetType: "breach", targetId: id });
  redirect("/admin/compliance");
}

async function addLicense(formData: FormData) {
  "use server";
  const admin = await requireAdmin("moderator");
  const [l] = await db
    .insert(schema.contentLicenses)
    .values({
      licensor: String(formData.get("licensor")),
      kind: String(formData.get("kind")),
      scope: String(formData.get("scope")),
      documentRef: String(formData.get("documentRef")),
      signedAt: String(formData.get("signedAt")),
      recordedBy: admin.id,
    })
    .returning({ id: schema.contentLicenses.id });
  await audit({ actorType: "admin", actorId: admin.id, action: "license.recorded", targetType: "license", targetId: l!.id });
  redirect("/admin/compliance#licences");
}

export default async function Compliance() {
  await requireAdmin();
  const [breaches, licenses, log] = await Promise.all([
    db.select().from(schema.breachIncidents).orderBy(desc(schema.breachIncidents.detectedAt)),
    db.select().from(schema.contentLicenses).orderBy(desc(schema.contentLicenses.createdAt)),
    db.select().from(schema.auditLog).orderBy(desc(schema.auditLog.id)).limit(100),
  ]);
  return (
    <div className="space-y-12">
      <section>
        <PageTitle sub={`PDPA breach register. Target: notify the PDPC and affected guardians within ${NOTIFY_HOURS} h of detection (confirm the statutory deadline with counsel). Residency: ${config.DATA_RESIDENCY} / ${config.DB_REGION}. DPO: ${config.DPO_CONTACT}.`}>Breach register</PageTitle>
        <form action={logBreach} className="surface mb-4 grid gap-3 rounded-2xl p-4 text-sm md:grid-cols-2">
          <input name="title" placeholder="Title" required className={field} />
          <select name="severity" className={field}><option>low</option><option>medium</option><option>high</option></select>
          <textarea name="description" placeholder="What happened, which data, how detected" required rows={2} className={`${field} h-auto py-2 md:col-span-2`} />
          <input name="affected" type="number" min={0} placeholder="Affected profiles (estimate)" className={field} />
          <input name="detectedAt" type="datetime-local" className={field} />
          <Button type="submit" variant="danger" size="sm" className="justify-self-start">Log incident</Button>
        </form>
        <Table>
          <thead><tr><th>Incident</th><th>Detected</th><th>Clock</th><th>Status</th><th>Next step</th></tr></thead>
          <tbody>
            {breaches.length === 0 ? <tr><td colSpan={5} className="py-6 text-center text-subtle">No incidents recorded.</td></tr> : null}
            {breaches.map((b) => {
              const hours = hoursSince(b.detectedAt);
              const overdue = !b.regulatorNotifiedAt && hours > NOTIFY_HOURS;
              return (
                <tr key={b.id}>
                  <td><p className="font-semibold">{b.title}</p><p className="text-xs text-subtle">{b.severity} · {b.affectedCount ?? "?"} affected</p></td>
                  <td className="text-xs">{b.detectedAt.toISOString().slice(0, 16).replace("T", " ")}</td>
                  <td className={`num text-xs ${overdue ? "font-bold text-danger" : ""}`}>{b.regulatorNotifiedAt ? "notified" : `${hours} h / ${NOTIFY_HOURS} h`}</td>
                  <td><StatusPill status={b.status} /></td>
                  <td>
                    <form action={advanceBreach} className="flex flex-wrap gap-1">
                      <input type="hidden" name="id" value={b.id} />
                      {!b.containedAt ? <SmallButton name="step" value="contained">Contained</SmallButton> : null}
                      {!b.regulatorNotifiedAt ? <SmallButton name="step" value="regulator" tone="bad">PDPC notified</SmallButton> : null}
                      {!b.guardiansNotifiedAt ? <SmallButton name="step" value="guardians">Guardians notified</SmallButton> : null}
                      {b.status !== "closed" ? <SmallButton name="step" value="closed" tone="good">Close</SmallButton> : null}
                    </form>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </Table>
      </section>

      <section id="licences">
        <PageTitle sub="Required before approving 'licensed' or 'teacher_submitted' content. Keep the signed document in the legal drive; record its reference here.">Content licences</PageTitle>
        <form action={addLicense} className="surface mb-4 grid gap-3 rounded-2xl p-4 text-sm md:grid-cols-3">
          <input name="licensor" placeholder="Licensor (person or organisation)" required className={field} />
          <select name="kind" className={field}><option value="contributor_agreement">Contributor agreement</option><option value="written_permission">Written permission</option></select>
          <input name="signedAt" type="date" required className={field} />
          <input name="scope" placeholder="Scope (e.g. Form 4 Biology questions)" required className={`${field} md:col-span-2`} />
          <input name="documentRef" placeholder="Document reference" required className={field} />
          <Button type="submit" variant="gold" size="sm" className="justify-self-start">Record licence</Button>
        </form>
        <Table>
          <thead><tr><th>Licensor</th><th>Kind</th><th>Scope</th><th>Signed</th><th>Ref</th></tr></thead>
          <tbody>
            {licenses.map((l) => (
              <tr key={l.id}><td className="font-semibold">{l.licensor}</td><td className="text-xs">{l.kind}</td><td className="text-xs">{l.scope}</td><td className="num text-xs">{l.signedAt}</td><td className="font-mono text-xs">{l.documentRef}</td></tr>
            ))}
          </tbody>
        </Table>
      </section>

      <section>
        <PageTitle sub="Append-only (DB trigger). IDs only — no personal data in audit entries. Purged after 2 years by the retention job.">Audit log (latest 100)</PageTitle>
        <Table>
          <thead><tr><th>When</th><th>Actor</th><th>Action</th><th>Target</th></tr></thead>
          <tbody>
            {log.map((a) => (
              <tr key={a.id}>
                <td className="num text-xs whitespace-nowrap">{a.createdAt.toISOString().slice(0, 19).replace("T", " ")}</td>
                <td className="text-xs">{a.actorType}<span className="font-mono text-subtle"> {a.actorId?.slice(0, 8)}</span></td>
                <td className="font-semibold">{a.action}</td>
                <td className="text-xs">{a.targetType} <span className="font-mono text-subtle">{a.targetId?.slice(0, 8)}</span></td>
              </tr>
            ))}
          </tbody>
        </Table>
      </section>
    </div>
  );
}
