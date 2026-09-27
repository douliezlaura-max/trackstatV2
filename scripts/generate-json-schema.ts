/**
 * Writes JSON Schema files generated from the same zod definitions that validate ingest:
 *   docs/schemas/game-stats.schema.json      per-user profile: { adopt_me: {...}, blox_fruits: {...} }
 *   docs/schemas/ingest-payload.schema.json  body of POST /api/ingest
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { z } from "zod";
import { ingestPayloadSchema, profileStatsSchema } from "../lib/schemas";

const outDir = join(import.meta.dirname, "..", "docs", "schemas");
mkdirSync(outDir, { recursive: true });

const files = {
  "game-stats.schema.json": { title: "Comet Tracker profile stats", schema: profileStatsSchema },
  "ingest-payload.schema.json": { title: "Comet Tracker ingest payload", schema: ingestPayloadSchema },
};

for (const [name, { title, schema }] of Object.entries(files)) {
  const json = { title, ...z.toJSONSchema(schema, { io: "input", target: "draft-2020-12" }) };
  writeFileSync(join(outDir, name), JSON.stringify(json, null, 2) + "\n");
  console.log(`wrote docs/schemas/${name}`);
}
