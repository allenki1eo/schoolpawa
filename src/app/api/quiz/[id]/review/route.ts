import { route } from "@/server/http";
import { sessionReview } from "@/server/quiz/engine";
import { requireStudent } from "@/server/session";

export const GET = route<{ params: Promise<{ id: string }> }>(async (_req, { params }) => {
  const { id } = await params;
  return { items: await sessionReview(await requireStudent(), id) };
});
