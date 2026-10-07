import { asc, eq, sql } from "drizzle-orm";
import { redirect } from "next/navigation";
import { db, schema } from "@/db/client";
import { Crest } from "@/components/brand/crest";
import { PageTitle, Table, field } from "@/components/admin/ui";
import { Button } from "@/components/ui/button";
import { audit } from "@/server/audit";
import { requireAdmin } from "@/server/admin/auth";
import { importSchoolsCsv } from "@/server/admin/import-schools";

async function upload(formData: FormData) {
  "use server";
  const admin = await requireAdmin("moderator");
  const file = formData.get("file");
  const text = file instanceof File && file.size > 0 ? await file.text() : String(formData.get("csv") ?? "");
  if (text.length > 5_000_000) redirect("/admin/schools?msg=" + encodeURIComponent("File too large (max 5 MB)."));
  const r = await importSchoolsCsv(text);
  await audit({ actorType: "admin", actorId: admin.id, action: "schools.import", meta: { created: r.created, updated: r.updated, issues: r.issues.length } });
  const msg = `Imported: ${r.created} created, ${r.updated} updated.` + (r.issues.length ? ` ${r.issues.length} issue(s): ${r.issues.slice(0, 5).map((i) => `line ${i.line} ${i.message}`).join("; ")}` : "");
  redirect("/admin/schools?msg=" + encodeURIComponent(msg));
}

async function toggleVerified(formData: FormData) {
  "use server";
  const admin = await requireAdmin("moderator");
  const id = String(formData.get("id"));
  await db.update(schema.schools).set({ verified: sql`not ${schema.schools.verified}` }).where(eq(schema.schools.id, id));
  await audit({ actorType: "admin", actorId: admin.id, action: "schools.toggle_verified", targetType: "school", targetId: id });
  redirect("/admin/schools");
}

export default async function SchoolsAdmin({ searchParams }: { searchParams: Promise<{ msg?: string }> }) {
  await requireAdmin();
  const { msg } = await searchParams;
  const schools = await db
    .select({ s: schema.schools, district: schema.districts.name, region: schema.regions.name, color: schema.regions.color, students: sql<number>`(select count(*) from students st where st.school_id = ${schema.schools.id})`.mapWith(Number) })
    .from(schema.schools)
    .innerJoin(schema.districts, eq(schema.districts.id, schema.schools.districtId))
    .innerJoin(schema.regions, eq(schema.regions.id, schema.districts.regionId))
    .orderBy(asc(schema.regions.name), asc(schema.districts.name), asc(schema.schools.name));
  return (
    <div>
      <PageTitle sub="Import the official registry as CSV: reg_no,name,region,district,stage,enrolled. Idempotent on reg_no.">Schools</PageTitle>
      {msg ? <p className="mb-4 rounded-xl bg-info/10 px-4 py-3 text-sm text-info ring-1 ring-info/25">{msg}</p> : null}
      <form action={upload} className="surface mb-8 grid gap-3 rounded-2xl p-4 text-sm">
        <input type="file" name="file" accept=".csv,text/csv" className="text-sm" />
        <textarea name="csv" rows={3} placeholder="…or paste CSV here" className={`${field} h-auto py-2 font-mono text-xs`} />
        <Button type="submit" variant="gold" size="sm" className="justify-self-start">Import CSV</Button>
      </form>
      <Table>
        <thead><tr><th>School</th><th>Reg no.</th><th>District</th><th>Stage</th><th>Size</th><th>Students</th><th>Verified</th></tr></thead>
        <tbody>
          {schools.map(({ s, district, region, color, students }) => (
            <tr key={s.id}>
              <td><div className="flex items-center gap-2"><Crest name={s.name} regNo={s.regNo} color={color} size={24} /> {s.name}</div></td>
              <td className="font-mono text-xs">{s.regNo}</td>
              <td className="text-xs">{district}, {region}</td>
              <td className="text-xs">{s.stage}</td>
              <td className="num text-xs">{s.sizeBand} · {s.enrolledEstimate}</td>
              <td className="num">{students}</td>
              <td>
                <form action={toggleVerified}><input type="hidden" name="id" value={s.id} /><button className="text-xs font-semibold">{s.verified ? "✓ Verified" : "Verify"}</button></form>
              </td>
            </tr>
          ))}
        </tbody>
      </Table>
    </div>
  );
}
