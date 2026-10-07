import { and, count, eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import { db, schema } from "@/db/client";
import { Emblem } from "@/components/brand/emblem";
import { JoinButton } from "@/components/groups/join-button";
import { fmt } from "@/lib/i18n";
import { normalizeCode } from "@/lib/safety/codes";
import { getDict } from "@/server/locale";
import { requireStudent } from "@/server/session";

/** Invite landing. Joining is an explicit tap (never a GET side effect: link previews would join). */
export default async function GroupInvite({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  await requireStudent();
  const { t } = await getDict();
  const [group] = await db.select().from(schema.groups).where(and(eq(schema.groups.inviteCode, normalizeCode(code)), eq(schema.groups.archived, false)));
  if (!group) notFound();
  const [members] = await db.select({ n: count() }).from(schema.groupMembers).where(eq(schema.groupMembers.groupId, group.id));
  return (
    <div className="flex flex-col items-center pt-10 text-center">
      <Emblem emblem={group.emblem} size={96} />
      <h1 className="font-display mt-6 text-3xl font-black">{group.name}</h1>
      <p className="num mt-2 text-muted">{fmt(t.groups.members, { n: members?.n ?? 0 })}</p>
      <p className="mt-4 max-w-xs text-xs text-subtle">{t.groups.noChat}</p>
      <div className="mt-10 w-full">
        <JoinButton code={group.inviteCode} />
      </div>
    </div>
  );
}
