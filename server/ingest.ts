/**
 * The "connector bridge" HTTP side: in-game collectors POST stats here.
 *
 *   POST /api/ingest
 *   Authorization: Bearer ct_...
 *   { "game": "adopt_me", "account": { "robloxUserId": "1", "displayName": "x" }, "stats": {...}, "sentAt": "..." }
 *
 * Order of checks: API key (401) -> rate limit (429) -> body size (413) / JSON (400) -> schema (400).
 * On success the account is upserted and `account:update` is emitted to the owner's room.
 */
import express, { type ErrorRequestHandler, type Request, type RequestHandler, type Router } from "express";
import type { Server } from "socket.io";
import { toAccountDTO } from "@/lib/accounts";
import { findActiveKey } from "@/lib/apiKeys";
import { RECOMMENDED_POST_INTERVAL_S } from "@/lib/games";
import { prisma } from "@/lib/prisma";
import { userRoom, type ClientToServerEvents, type ServerToClientEvents } from "@/lib/realtime";
import { ingestPayloadSchema, type IngestPayload } from "@/lib/schemas";
import { TokenBucketLimiter } from "./rateLimit";

export const MAX_BODY_BYTES = 16 * 1024;
/** Keep at most one history snapshot per account per this interval. */
export const SNAPSHOT_INTERVAL_MS = 5 * 60_000;
/** Per API key: bursts of 60, sustained 2 req/s (enough for ~60 accounts posting every 30 s). */
const limiter = new TokenBucketLimiter(60, 2);

type AuthedRequest = Request & { apiKey?: { id: string; userId: string; lastUsedAt: Date | null } };

const authenticate: RequestHandler = async (req: AuthedRequest, res, next) => {
  const match = /^Bearer\s+(\S+)$/i.exec(req.get("authorization") ?? "");
  const key = match ? await findActiveKey(match[1]) : null;
  if (!key) {
    res.set("WWW-Authenticate", 'Bearer realm="comet-ingest"');
    res.status(401).json({ error: "unauthorized", message: "Missing, unknown or revoked API key." });
    return;
  }
  req.apiKey = key;
  next();
};

const rateLimit: RequestHandler = (req: AuthedRequest, res, next) => {
  const wait = limiter.take(req.apiKey!.id);
  if (wait > 0) {
    res.set("Retry-After", String(wait));
    res.status(429).json({ error: "rate_limited", message: `Too many requests; retry in ${wait}s.` });
    return;
  }
  next();
};

const rejectLargeBodies: RequestHandler = (req, res, next) => {
  // Fast path for honest Content-Length; express.json's limit still covers chunked bodies.
  if (Number(req.get("content-length") ?? 0) > MAX_BODY_BYTES) {
    res.status(413).json({ error: "payload_too_large", message: `Body must be at most ${MAX_BODY_BYTES} bytes.` });
    return;
  }
  next();
};

const bodyErrors: ErrorRequestHandler = (err, _req, res, next) => {
  if (err?.type === "entity.too.large") {
    res.status(413).json({ error: "payload_too_large", message: `Body must be at most ${MAX_BODY_BYTES} bytes.` });
  } else if (err?.type === "entity.parse.failed") {
    res.status(400).json({ error: "invalid_json", message: "Body is not valid JSON." });
  } else {
    next(err);
  }
};

export function createIngestRouter(io: Server<ClientToServerEvents, ServerToClientEvents>): Router {
  const router = express.Router();

  router.post(
    "/api/ingest",
    authenticate,
    rateLimit,
    rejectLargeBodies,
    express.json({ limit: MAX_BODY_BYTES }),
    bodyErrors,
    async (req: AuthedRequest, res: express.Response, next: express.NextFunction) => {
      try {
        if (req.body === undefined || !req.is("application/json")) {
          res.status(400).json({ error: "invalid_payload", message: "Send a JSON body with Content-Type: application/json." });
          return;
        }
        const parsed = ingestPayloadSchema.safeParse(req.body);
        if (!parsed.success) {
          res.status(400).json({
            error: "invalid_payload",
            issues: parsed.error.issues.map((i) => ({ path: i.path.join("."), message: i.message })),
          });
          return;
        }
        const payload = parsed.data as unknown as IngestPayload;
        const { userId, id: keyId, lastUsedAt } = req.apiKey!;
        const now = new Date();

        const account = await prisma.trackedAccount.upsert({
          where: {
            userId_game_robloxUserId: { userId, game: payload.game, robloxUserId: payload.account.robloxUserId },
          },
          create: {
            userId,
            game: payload.game,
            robloxUserId: payload.account.robloxUserId,
            displayName: payload.account.displayName,
            stats: payload.stats,
            lastSeenAt: now,
            online: true,
          },
          update: { displayName: payload.account.displayName, stats: payload.stats, lastSeenAt: now, online: true },
          select: { id: true, game: true, robloxUserId: true, displayName: true, stats: true, lastSeenAt: true },
        });

        io.to(userRoom(userId)).emit("account:update", toAccountDTO(account, now.getTime()));
        res.status(202).json({ ok: true, accountId: account.id, nextPostInSeconds: RECOMMENDED_POST_INTERVAL_S });

        // Bookkeeping after the response so collectors aren't kept waiting.
        void afterIngest(account.id, payload.stats, keyId, lastUsedAt, now).catch((err) =>
          console.error("[ingest] post-response bookkeeping failed", err),
        );
      } catch (err) {
        next(err);
      }
    },
  );

  return router;
}

async function afterIngest(
  accountId: string,
  stats: IngestPayload["stats"],
  keyId: string,
  lastUsedAt: Date | null,
  now: Date,
) {
  // Claim the snapshot slot atomically so concurrent posts can't both write one.
  const cutoff = new Date(now.getTime() - SNAPSHOT_INTERVAL_MS);
  const claimed = await prisma.trackedAccount.updateMany({
    where: { id: accountId, OR: [{ lastSnapshotAt: null }, { lastSnapshotAt: { lte: cutoff } }] },
    data: { lastSnapshotAt: now },
  });
  if (claimed.count === 1) {
    await prisma.statSnapshot.create({ data: { trackedAccountId: accountId, stats, capturedAt: now } });
  }
  // lastUsedAt only needs minute precision; skip most writes.
  if (!lastUsedAt || now.getTime() - lastUsedAt.getTime() > 60_000) {
    await prisma.apiKey.update({ where: { id: keyId }, data: { lastUsedAt: now } });
  }
}
