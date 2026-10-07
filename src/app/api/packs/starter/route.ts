import { ApiError, route } from "@/server/http";
import { starterPack } from "@/server/offline";

/** Anonymous practice for pre-consent profiles. Only the grade is sent — nothing about the child. */
export const GET = route(async (req) => {
  const grade = new URL(req.url).searchParams.get("grade") ?? "";
  if (!/^[a-z0-9]{2,10}$/.test(grade)) throw new ApiError(400, "grade_invalid");
  const pack = await starterPack(grade);
  if (!pack) throw new ApiError(404, "topic_unavailable");
  return pack;
});
