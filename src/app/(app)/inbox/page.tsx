import { InboxList } from "@/components/inbox/inbox-list";
import { inbox } from "@/server/notifications";
import { requireStudent } from "@/server/session";

export const metadata = { title: "Taarifa" };

export default async function InboxPage() {
  const student = await requireStudent();
  const items = await inbox(student.id);
  return <InboxList me={student.id} items={items} />;
}
