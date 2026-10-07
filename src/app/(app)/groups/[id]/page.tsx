import { notFound } from "next/navigation";
import { GroupDetail } from "@/components/groups/group-detail";
import { config } from "@/server/config";
import { groupForMember, recentReactions, refreshGroupStreak } from "@/server/groups";
import { ApiError } from "@/server/http";
import { groupBoard } from "@/server/leaderboard";
import { requireStudent } from "@/server/session";

export default async function GroupPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ period?: string }> }) {
  const { id } = await params;
  const { period } = await searchParams;
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  const me = await requireStudent();
  let group;
  try {
    group = await groupForMember(me, id);
  } catch (e) {
    if (e instanceof ApiError) notFound();
    throw e;
  }
  const p = period === "all" ? "all" : "weekly";
  const [streak, board, reactions] = await Promise.all([refreshGroupStreak(id), groupBoard(id, p), recentReactions(me, id)]);
  return (
    <GroupDetail
      me={me.id}
      group={{ id: group.id, name: group.name, emblem: group.emblem, inviteCode: group.inviteCode, creatorId: group.creatorId, streak }}
      board={board}
      period={p}
      reactions={reactions.map((r) => ({ ...r, createdAt: r.createdAt.toISOString() }))}
      appUrl={config.APP_URL}
    />
  );
}
