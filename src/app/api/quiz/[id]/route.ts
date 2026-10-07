import { route } from "@/server/http";
import { sessionState } from "@/server/quiz/engine";
import { requireStudent } from "@/server/session";

export const GET = route<{ params: Promise<{ id: string }> }>(async (_req, { params }) => {
  const { id } = await params;
  return sessionState(await requireStudent(), id);
});
