import { and, count, eq, isNull } from "drizzle-orm";
import { redirect } from "next/navigation";
import { db, schema } from "@/db/client";
import { BottomNav } from "@/components/app/bottom-nav";
import { TopBar } from "@/components/app/top-bar";
import { getDict } from "@/server/locale";
import { unreadCount } from "@/server/notifications";
import { currentStudent } from "@/server/session";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const student = await currentStudent();
  if (!student) redirect("/");
  const { t } = await getDict();
  const [waiting] = await db
    .select({ n: count() })
    .from(schema.challenges)
    .where(and(eq(schema.challenges.opponentId, student.id), eq(schema.challenges.status, "open"), isNull(schema.challenges.opponentSessionId)));
  const unread = await unreadCount(student.id);
  return (
    <div className="min-h-dvh pb-24">
      <TopBar avatar={student.avatar} streak={student.streakDays} xp={student.xp} xpLabel={t.common.xp} unread={unread} inboxLabel={t.nav.inbox} />
      <main className="mx-auto max-w-lg px-4 pt-5">{children}</main>
      <BottomNav challengeBadge={waiting?.n ?? 0} />
    </div>
  );
}
