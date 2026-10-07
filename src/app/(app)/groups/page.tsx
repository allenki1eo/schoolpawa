import { GroupsView } from "@/components/groups/groups-view";
import { myGroups } from "@/server/groups";
import { requireStudent } from "@/server/session";

export const metadata = { title: "Vikundi" };

export default async function GroupsPage() {
  const student = await requireStudent();
  const groups = await myGroups(student);
  return <GroupsView groups={groups.map((g) => ({ id: g.id, name: g.name, emblem: g.emblem, members: g.members, streakDays: g.streakDays }))} />;
}
