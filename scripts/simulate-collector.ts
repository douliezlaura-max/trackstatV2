/**
 * Pretends to be in-game collectors: POSTs fake stats for a few accounts per game
 * so you can watch the dashboard update without running Roblox.
 *
 *   COMET_API_KEY=ct_... npm run simulate -- [--games adopt_me,blox_fruits] [--accounts 3]
 *                                           [--interval 5] [--once] [--drop 1]
 *
 * --drop N  stops posting for N accounts per game after two rounds, so you can watch
 *           them go offline (~90 s later).
 */
import "dotenv/config";
import { parseArgs } from "node:util";
import { GAMES, getGame, type GameDef, type Stats } from "../lib/games";

const { values: args } = parseArgs({
  options: {
    games: { type: "string", default: "adopt_me,blox_fruits" },
    accounts: { type: "string", default: "3" },
    interval: { type: "string", default: "5" },
    once: { type: "boolean", default: false },
    drop: { type: "string", default: "0" },
  },
});

const url = (process.env.COMET_URL ?? "http://localhost:3000").replace(/\/$/, "");
const key = process.env.COMET_API_KEY;
if (!key) {
  console.error("Set COMET_API_KEY (create one in the Connect Script modal, or run `npm run db:seed`).");
  process.exit(1);
}

const NAMES = ["NovaRider", "StarGazer_09", "OrbitKid", "LunarLynx", "PixelComet", "VoidWalker"];

interface SimAccount {
  game: GameDef;
  robloxUserId: string;
  displayName: string;
  stats: Stats;
  dropped: boolean;
}

function initialStats(game: GameDef, i: number): Stats {
  return Object.fromEntries(
    game.stats.map((f) => {
      if (f.type === "boolean") return [f.key, (i + f.key.length) % 2 === 0];
      if (f.aggregate === "max") return [f.key, 1200 + i * 350 + Math.floor(Math.random() * 100)];
      return [f.key, Math.floor((f.format === "compact" ? 250_000 : 40) * (1 + i) * (0.5 + Math.random()))];
    }),
  );
}

function step(game: GameDef, stats: Stats): Stats {
  const next: Stats = { ...stats };
  for (const f of game.stats) {
    const v = stats[f.key];
    if (typeof v === "boolean") {
      // Unlocks happen occasionally and are permanent.
      if (!v && Math.random() < 0.03) next[f.key] = true;
    } else if (f.aggregate === "max") {
      if (Math.random() < 0.3) next[f.key] = Math.min(2800, v + 1);
    } else {
      const delta = f.format === "compact" ? Math.floor(Math.random() * 25_000) - 5_000 : Math.floor(Math.random() * 3) - 1;
      next[f.key] = Math.max(0, v + delta);
    }
  }
  return next;
}

const games = args.games!.split(",").map((s) => {
  const g = getGame(s.trim());
  if (!g) throw new Error(`Unknown game "${s}". Known: ${GAMES.map((x) => x.slug).join(", ")}`);
  return g;
});
const perGame = Number(args.accounts);
const drop = Number(args.drop);

const sims: SimAccount[] = games.flatMap((game, gi) =>
  Array.from({ length: perGame }, (_, i) => ({
    game,
    robloxUserId: String(1_000_000 + gi * 1000 + i),
    displayName: NAMES[i % NAMES.length] + (i >= NAMES.length ? `_${i}` : ""),
    stats: initialStats(game, i),
    dropped: false,
  })),
);

async function post(a: SimAccount) {
  const res = await fetch(`${url}/api/ingest`, {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      game: a.game.slug,
      account: { robloxUserId: a.robloxUserId, displayName: a.displayName },
      stats: a.stats,
      sentAt: new Date().toISOString(),
    }),
  });
  if (!res.ok) console.error(`  ${a.game.slug}/${a.displayName}: HTTP ${res.status} ${await res.text()}`);
  return res.ok;
}

let round = 0;
async function tick() {
  round++;
  if (round === 3 && drop > 0) {
    for (const g of games) sims.filter((s) => s.game === g).slice(-drop).forEach((s) => (s.dropped = true));
    console.log(`Dropping ${drop} account(s) per game; they should go offline in ~90 s.`);
  }
  const live = sims.filter((s) => !s.dropped);
  for (const s of live) s.stats = step(s.game, s.stats);
  const results = await Promise.all(live.map(post));
  console.log(`[${new Date().toLocaleTimeString()}] round ${round}: ${results.filter(Boolean).length}/${live.length} ok`);
}

await tick();
if (!args.once) setInterval(() => void tick().catch((e) => console.error(e)), Number(args.interval) * 1000);
