import { asc, desc, eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { db, schema } from "@/db/client";
import { PageTitle, SmallButton, Table, field } from "@/components/admin/ui";
import { Button } from "@/components/ui/button";
import { requireAdmin } from "@/server/admin/auth";
import { cancelTournament, createTournament, tournamentBoard, tournamentPhase } from "@/server/tournaments";

async function create(formData: FormData) {
  "use server";
  const admin = await requireAdmin("moderator");
  // datetime-local inputs are entered in East Africa Time.
  const at = (v: FormDataEntryValue | null) => new Date(`${String(v)}:00+03:00`);
  try {
    await createTournament(admin, {
      titleSw: String(formData.get("titleSw")),
      titleEn: String(formData.get("titleEn")),
      stage: formData.get("stage") === "secondary" ? "secondary" : "primary",
      regionId: String(formData.get("regionId") ?? "") || null,
      topicIds: formData.getAll("topicIds").map(String),
      startsAt: at(formData.get("startsAt")),
      endsAt: at(formData.get("endsAt")),
    });
  } catch (e) {
    redirect(`/admin/tournaments?error=${encodeURIComponent((e as Error).message)}`);
  }
  redirect("/admin/tournaments");
}

async function cancel(formData: FormData) {
  "use server";
  const admin = await requireAdmin("moderator");
  await cancelTournament(admin, String(formData.get("id")));
  redirect("/admin/tournaments");
}

export default async function TournamentsAdmin({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  await requireAdmin();
  const { error } = await searchParams;
  const [list, regions, topics] = await Promise.all([
    db.select().from(schema.tournaments).orderBy(desc(schema.tournaments.startsAt)).limit(50),
    db.select().from(schema.regions).orderBy(asc(schema.regions.name)),
    db.select({ id: schema.topics.id, code: schema.topics.code, nameEn: schema.topics.nameEn, live: schema.topics.isLive }).from(schema.topics).where(eq(schema.topics.isLive, true)).orderBy(asc(schema.topics.code)),
  ]);
  const leaders = await Promise.all(list.map(async (t) => ({ id: t.id, top: (await tournamentBoard(t))[0] })));
  const leader = new Map(leaders.map((l) => [l.id, l.top]));

  return (
    <div>
      <PageTitle sub="Weekly themed School vs School events. Scored from the ledger with the School Power formula; no prizes with monetary value.">Tournaments</PageTitle>
      {error ? <p className="mb-4 rounded-xl bg-danger/10 px-4 py-3 text-sm text-red-200 ring-1 ring-danger/30">{error}</p> : null}
      <form action={create} className="surface mb-8 grid gap-3 rounded-2xl p-4 text-sm md:grid-cols-2">
        <input name="titleSw" placeholder="Jina (Kiswahili) — mf. Wiki ya Hisabati" required className={field} />
        <input name="titleEn" placeholder="Title (English) — e.g. Maths Week" required className={field} />
        <select name="stage" className={field}><option value="primary">Primary</option><option value="secondary">Secondary</option></select>
        <select name="regionId" className={field}><option value="">National</option>{regions.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}</select>
        <label className="grid gap-1 text-xs text-muted">Starts (EAT)<input name="startsAt" type="datetime-local" required className={field} /></label>
        <label className="grid gap-1 text-xs text-muted">Ends (EAT)<input name="endsAt" type="datetime-local" required className={field} /></label>
        <fieldset className="md:col-span-2">
          <legend className="mb-2 text-xs text-muted">Theme topics</legend>
          <div className="flex flex-wrap gap-2">
            {topics.map((t) => (
              <label key={t.id} className="flex items-center gap-2 rounded-lg bg-white/5 px-2.5 py-1.5 text-xs ring-1 ring-line">
                <input type="checkbox" name="topicIds" value={t.id} /> {t.code} <span className="text-subtle">{t.nameEn}</span>
              </label>
            ))}
          </div>
        </fieldset>
        <Button type="submit" variant="gold" size="sm" className="justify-self-start">Create tournament</Button>
      </form>
      <Table>
        <thead><tr><th>Tournament</th><th>Stage</th><th>Window (UTC)</th><th>Phase</th><th>Leader</th><th></th></tr></thead>
        <tbody>
          {list.length === 0 ? <tr><td colSpan={6} className="py-6 text-center text-subtle">No tournaments yet.</td></tr> : null}
          {list.map((t) => {
            const phase = tournamentPhase(t);
            const top = leader.get(t.id);
            return (
              <tr key={t.id}>
                <td><p className="font-semibold">{t.titleEn}</p><p className="text-xs text-subtle">{t.titleSw} · {t.topicIds.length} topics</p></td>
                <td className="text-xs">{t.stage}{t.regionId ? " · regional" : " · national"}</td>
                <td className="num text-xs">{t.startsAt.toISOString().slice(0, 16).replace("T", " ")} → {t.endsAt.toISOString().slice(0, 16).replace("T", " ")}</td>
                <td className="text-xs font-semibold">{phase}</td>
                <td className="text-xs">{top ? `${top.name} (${top.power.toFixed(1)})` : "—"}</td>
                <td>{phase !== "cancelled" && phase !== "finished" ? <form action={cancel}><input type="hidden" name="id" value={t.id} /><SmallButton tone="bad">Cancel</SmallButton></form> : null}</td>
              </tr>
            );
          })}
        </tbody>
      </Table>
    </div>
  );
}
