import { NextResponse } from "next/server";
import { getUserId } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

/** Revokes a key. Revoked keys are kept (for the audit trail) but rejected by /api/ingest. */
export async function DELETE(_req: Request, ctx: RouteContext<"/api/keys/[id]">) {
  const userId = await getUserId();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { id } = await ctx.params;
  const result = await prisma.apiKey.updateMany({
    where: { id, userId, revokedAt: null },
    data: { revokedAt: new Date() },
  });
  if (result.count === 0) return NextResponse.json({ error: "not_found" }, { status: 404 });
  return NextResponse.json({ ok: true });
}
