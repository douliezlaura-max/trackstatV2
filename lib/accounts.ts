import { ONLINE_WINDOW_MS, type Stats } from "./games";
import { prisma } from "./prisma";

/** Account shape sent to the dashboard (initial render and `account:update` events). */
export interface AccountDTO {
  id: string;
  game: string;
  robloxUserId: string;
  displayName: string;
  stats: Stats;
  lastSeenAt: string;
  online: boolean;
}

export interface AccountRow {
  id: string;
  game: string;
  robloxUserId: string;
  displayName: string;
  stats: unknown;
  lastSeenAt: Date;
}

export function isOnline(lastSeenAt: Date, now = Date.now()): boolean {
  return now - lastSeenAt.getTime() <= ONLINE_WINDOW_MS;
}

export function toAccountDTO(row: AccountRow, now = Date.now()): AccountDTO {
  return {
    id: row.id,
    game: row.game,
    robloxUserId: row.robloxUserId,
    displayName: row.displayName,
    stats: (row.stats ?? {}) as Stats,
    lastSeenAt: row.lastSeenAt.toISOString(),
    online: isOnline(row.lastSeenAt, now),
  };
}

export async function listAccounts(userId: string): Promise<AccountDTO[]> {
  const rows = await prisma.trackedAccount.findMany({
    where: { userId },
    orderBy: [{ lastSeenAt: "desc" }],
    select: { id: true, game: true, robloxUserId: true, displayName: true, stats: true, lastSeenAt: true },
  });
  const now = Date.now();
  return rows.map((r) => toAccountDTO(r, now));
}
