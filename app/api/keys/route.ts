import { NextResponse } from "next/server";
import { z } from "zod";
import { apiKeyPublicSelect, createApiKey } from "@/lib/apiKeys";
import { getUserId } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const MAX_ACTIVE_KEYS = 10;

export async function GET() {
  const userId = await getUserId();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const keys = await prisma.apiKey.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    select: apiKeyPublicSelect,
  });
  return NextResponse.json({ keys });
}

const createSchema = z.object({ name: z.string().trim().min(1).max(40).optional() });

export async function POST(req: Request) {
  const userId = await getUserId();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = createSchema.safeParse(await req.json().catch(() => ({})));
  if (!body.success) return NextResponse.json({ error: "invalid_payload" }, { status: 400 });

  const active = await prisma.apiKey.count({ where: { userId, revokedAt: null } });
  if (active >= MAX_ACTIVE_KEYS) {
    return NextResponse.json(
      { error: "too_many_keys", message: `Revoke a key first (max ${MAX_ACTIVE_KEYS} active).` },
      { status: 409 },
    );
  }

  const { key, record } = await createApiKey(userId, body.data.name);
  // The plaintext key is only ever returned here.
  return NextResponse.json({ key, record }, { status: 201 });
}
