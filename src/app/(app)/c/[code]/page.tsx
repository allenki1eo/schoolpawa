import { eq } from "drizzle-orm";
import { notFound, redirect } from "next/navigation";
import { db, schema } from "@/db/client";
import { Avatar } from "@/components/brand/avatar";
import { AcceptButton } from "@/components/challenges/accept-button";
import { fmt, pick } from "@/lib/i18n";
import { challengeByCode } from "@/server/challenges";
import { getDict } from "@/server/locale";
import { requireStudent } from "@/server/session";

export const metadata = { title: "Changamoto" };

export default async function ChallengeInvite({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const me = await requireStudent();
  const { t, locale } = await getDict();
  const c = await challengeByCode(code);
  if (!c) notFound();
  if (c.challengerId === me.id) redirect("/challenges");
  const [challenger] = await db.select().from(schema.students).where(eq(schema.students.id, c.challengerId));
  const [topic] = await db.select().from(schema.topics).where(eq(schema.topics.id, c.topicId));
  const topicName = topic ? pick(topic, "name", locale) : "";
  return (
    <div className="flex flex-col items-center pt-8 text-center">
      <div className="relative">
        <span aria-hidden className="absolute inset-0 rounded-full bg-danger/30 motion-safe:animate-burst" />
        <Avatar avatar={challenger?.avatar ?? "simba"} size={96} ring />
      </div>
      <h1 className="font-display mt-6 text-3xl font-black text-balance">{fmt(t.challenges.invitedTitle, { name: challenger?.nickname ?? "" })}</h1>
      <p className="mt-3 max-w-xs text-muted">{fmt(t.challenges.invitedSub, { topic: topicName })}</p>
      {c.presetMessage ? <p className="mt-5 rounded-2xl bg-white/5 px-4 py-3 text-lg">“{t.presets[c.presetMessage as keyof typeof t.presets]}”</p> : null}
      <div className="mt-10 w-full">
        <AcceptButton code={c.code} />
      </div>
    </div>
  );
}
