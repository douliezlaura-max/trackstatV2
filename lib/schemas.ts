/**
 * Zod schemas derived from the game registry. These validate ingest payloads
 * and are the source for the generated JSON Schema (scripts/generate-json-schema.ts).
 */
import { z } from "zod";
import { GAMES, type GameDef, type StatField } from "./games";

function fieldSchema(field: StatField) {
  switch (field.type) {
    case "int":
      return z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER).describe(field.description);
    case "number":
      return z.number().nonnegative().describe(field.description);
    case "boolean":
      return z.boolean().describe(field.description);
  }
}

/** Stats object for one game, e.g. { bucks, pets, eggs } for adopt_me. Unknown keys are rejected. */
export function gameStatsSchema(game: GameDef) {
  const shape = Object.fromEntries(game.stats.map((f) => [f.key, fieldSchema(f)]));
  return z.strictObject(shape).describe(`${game.name} stats`);
}

export const statsSchemas = Object.fromEntries(GAMES.map((g) => [g.slug, gameStatsSchema(g)])) as Record<
  string,
  ReturnType<typeof gameStatsSchema>
>;

const accountSchema = z.strictObject({
  // Lua collectors often send numbers; accept both and normalize to a string.
  robloxUserId: z
    .union([z.string().regex(/^\d{1,20}$/, "must be a numeric Roblox user id"), z.number().int().positive()])
    .transform(String)
    .describe("Roblox UserId of the account running the collector"),
  displayName: z.string().trim().min(1).max(64).describe("Name shown on the dashboard"),
});

const sentAtSchema = z
  .union([z.iso.datetime({ offset: true }), z.number().nonnegative()])
  .optional()
  .describe("When the collector took the reading: ISO 8601 string or Unix seconds. Informational only.");

/** Body of POST /api/ingest. Discriminated on `game` so `stats` is validated against that game's fields. */
export const ingestPayloadSchema = z.discriminatedUnion(
  "game",
  GAMES.map((g) =>
    z.strictObject({
      game: z.literal(g.slug),
      account: accountSchema,
      stats: gameStatsSchema(g),
      sentAt: sentAtSchema,
    }),
  ) as unknown as [z.ZodObject, ...z.ZodObject[]],
);

export interface IngestPayload {
  game: string;
  account: { robloxUserId: string; displayName: string };
  stats: Record<string, number | boolean>;
  sentAt?: string | number;
}

/**
 * The per-user profile document the owner asked for: every game's stats under
 * one user, keyed by game slug and then by Roblox user id, e.g.
 * { adopt_me: { "123": { bucks, pets, eggs } }, blox_fruits: { "123": { beli, level, cdk, ... } } }.
 * In Postgres each leaf is one TrackedAccount row whose `stats` JSONB matches the game schema.
 */
export const profileStatsSchema = z
  .strictObject(
    Object.fromEntries(
      GAMES.map((g) => [
        g.slug,
        z.record(z.string().regex(/^\d+$/), gameStatsSchema(g)).optional().describe(`${g.name} accounts keyed by Roblox user id`),
      ]),
    ),
  )
  .describe("All tracked game stats for one Comet Tracker user");
