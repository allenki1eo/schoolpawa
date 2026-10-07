import { NextResponse } from "next/server";
import { route } from "@/server/http";
import { requireGuardian } from "@/server/parent-session";
import { exportChild } from "@/server/privacy";

export const GET = route<{ params: Promise<{ studentId: string }> }>(async (_req, { params }) => {
  const { studentId } = await params;
  const data = await exportChild(await requireGuardian(), studentId);
  return new NextResponse(JSON.stringify(data, null, 2), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="schoolpawa-${studentId.slice(0, 8)}.json"`,
      "Cache-Control": "no-store",
    },
  });
});
