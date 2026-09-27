import { createHash, randomBytes } from "node:crypto";
import { prisma } from "./prisma";

const KEY_PREFIX = "ct_";

export function hashApiKey(key: string): string {
  return createHash("sha256").update(key, "utf8").digest("hex");
}

/** Creates a key for the user. The plaintext is returned once and never stored. */
export async function createApiKey(userId: string, name = "Collector") {
  const key = KEY_PREFIX + randomBytes(24).toString("base64url");
  const record = await prisma.apiKey.create({
    data: { userId, name, keyHash: hashApiKey(key), prefix: key.slice(0, 11) },
    select: apiKeyPublicSelect,
  });
  return { key, record };
}

export const apiKeyPublicSelect = {
  id: true,
  name: true,
  prefix: true,
  createdAt: true,
  lastUsedAt: true,
  revokedAt: true,
} as const;

/** Resolves an active (non-revoked) key to its id and owner, or null. */
export async function findActiveKey(key: string) {
  if (!key.startsWith(KEY_PREFIX) || key.length > 128) return null;
  const record = await prisma.apiKey.findUnique({
    where: { keyHash: hashApiKey(key) },
    select: { id: true, userId: true, revokedAt: true, lastUsedAt: true },
  });
  if (!record || record.revokedAt) return null;
  return record;
}
