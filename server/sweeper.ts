/**
 * Emits online -> offline transitions. An account is online while it has posted
 * within ONLINE_WINDOW_MS; the `online` column records what dashboards were last
 * told, so each transition is emitted exactly once.
 */
import type { Server } from "socket.io";
import { ONLINE_WINDOW_MS } from "@/lib/games";
import { prisma } from "@/lib/prisma";
import { userRoom, type ClientToServerEvents, type ServerToClientEvents } from "@/lib/realtime";

export const SWEEP_INTERVAL_MS = 10_000;

export async function sweepOffline(io: Server<ClientToServerEvents, ServerToClientEvents>) {
  const cutoff = new Date(Date.now() - ONLINE_WINDOW_MS);
  // A single UPDATE ... RETURNING, so an ingest racing the sweep can't be marked offline.
  const stale = await prisma.trackedAccount.updateManyAndReturn({
    where: { online: true, lastSeenAt: { lt: cutoff } },
    data: { online: false },
    select: { id: true, userId: true, game: true, lastSeenAt: true },
  });
  for (const a of stale) {
    io.to(userRoom(a.userId)).emit("account:offline", { id: a.id, game: a.game, lastSeenAt: a.lastSeenAt.toISOString() });
  }
  return stale.length;
}

export function startSweeper(io: Server<ClientToServerEvents, ServerToClientEvents>) {
  let running = false;
  const timer = setInterval(async () => {
    if (running) return;
    running = true;
    try {
      await sweepOffline(io);
    } catch (err) {
      console.error("[sweeper] failed", err);
    } finally {
      running = false;
    }
  }, SWEEP_INTERVAL_MS);
  timer.unref();
  return () => clearInterval(timer);
}
