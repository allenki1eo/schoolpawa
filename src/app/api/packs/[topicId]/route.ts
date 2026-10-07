import { route } from "@/server/http";
import { issuePack } from "@/server/offline";
import { requireStudent } from "@/server/session";

export const GET = route<{ params: Promise<{ topicId: string }> }>(async (_req, { params }) => {
  const { topicId } = await params;
  const student = await requireStudent();
  return issuePack(student.id, student.gradeLevelId, topicId);
});
