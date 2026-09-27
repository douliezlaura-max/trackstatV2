/**
 * Game registry: the single source of truth for supported games.
 *
 * The sidebar, stat cards, accounts table, ingest validation (lib/schemas.ts)
 * and the generated JSON Schema docs (docs/schemas/*.json) all derive from this
 * list. Adding a game means adding one entry here.
 *
 * This module is shared by the browser and the Node server, so keep it free of
 * React and Node imports. Icons are referenced by name (see components/icons.tsx).
 */

export type StatType = "int" | "number" | "boolean";

/**
 * How a stat card combines values across all of a user's accounts for a game.
 * - sum:       add the values (currencies, pet counts)
 * - max:       highest value (levels)
 * - countTrue: booleans shown as "N of M accounts"
 */
export type Aggregate = "sum" | "max" | "countTrue";

export type StatFormat = "compact" | "integer" | "boolean";

export type IconName =
  | "users"
  | "coins"
  | "paw"
  | "egg"
  | "gem"
  | "trending"
  | "fist"
  | "sword"
  | "droplet"
  | "star"
  | "crown"
  | "sparkles";

export interface StatField {
  /** Key inside the JSONB `stats` object and the ingest payload. */
  key: string;
  label: string;
  type: StatType;
  format: StatFormat;
  aggregate: Aggregate;
  icon: IconName;
  description: string;
  /** Show as a stat card above the accounts table. Defaults to true. */
  card?: boolean;
}

export interface GameDef {
  /** Stable identifier used in URLs, payloads, the DB and the JSON schema. */
  slug: string;
  name: string;
  /** Two-letter badge used in the sidebar. */
  badge: string;
  /**
   * True when the stat set was chosen by us rather than specified by the owner.
   * Placeholders are flagged in the UI and the README.
   */
  placeholder?: boolean;
  stats: StatField[];
}

export const GAMES = [
  {
    slug: "adopt_me",
    name: "Adopt Me",
    badge: "AM",
    stats: [
      { key: "bucks", label: "Bucks", type: "int", format: "compact", aggregate: "sum", icon: "coins", description: "Bucks balance" },
      { key: "pets", label: "Pets", type: "int", format: "integer", aggregate: "sum", icon: "paw", description: "Number of pets in inventory" },
      { key: "eggs", label: "Eggs", type: "int", format: "integer", aggregate: "sum", icon: "egg", description: "Number of unhatched eggs in inventory" },
    ],
  },
  {
    slug: "blox_fruits",
    name: "Blox Fruits",
    badge: "BF",
    stats: [
      { key: "beli", label: "Beli", type: "int", format: "compact", aggregate: "sum", icon: "coins", description: "Beli balance" },
      // Level is aggregated as the MAX across accounts: summing levels is meaningless
      // and an average hides your best account.
      { key: "level", label: "Top Level", type: "int", format: "integer", aggregate: "max", icon: "trending", description: "Player level (card shows the highest across accounts)" },
      { key: "god_human", label: "God Human", type: "boolean", format: "boolean", aggregate: "countTrue", icon: "fist", description: "Owns the Godhuman fighting style" },
      { key: "cdk", label: "CDK", type: "boolean", format: "boolean", aggregate: "countTrue", icon: "sword", description: "Owns Cursed Dual Katana" },
      { key: "sanguine_art", label: "Sanguine Art", type: "boolean", format: "boolean", aggregate: "countTrue", icon: "droplet", description: "Owns the Sanguine Art fighting style" },
    ],
  },
  {
    // PLACEHOLDER: the owner did not specify Pet Simulator 99 stats.
    slug: "pet_simulator_99",
    name: "Pet Simulator 99",
    badge: "PS",
    placeholder: true,
    stats: [
      { key: "diamonds", label: "Diamonds", type: "int", format: "compact", aggregate: "sum", icon: "gem", description: "Diamonds balance" },
      { key: "pets", label: "Pets", type: "int", format: "integer", aggregate: "sum", icon: "paw", description: "Number of pets in inventory" },
      { key: "huges", label: "Huges", type: "int", format: "integer", aggregate: "sum", icon: "crown", description: "Number of Huge pets" },
      { key: "rank", label: "Top Rank", type: "int", format: "integer", aggregate: "max", icon: "star", description: "Player rank (card shows the highest across accounts)" },
    ],
  },
  {
    // PLACEHOLDER: the owner did not specify Anime Adventures stats.
    slug: "anime_adventures",
    name: "Anime Adventures",
    badge: "AA",
    placeholder: true,
    stats: [
      { key: "gems", label: "Gems", type: "int", format: "compact", aggregate: "sum", icon: "gem", description: "Gems balance" },
      { key: "gold", label: "Gold", type: "int", format: "compact", aggregate: "sum", icon: "coins", description: "Gold balance" },
      { key: "level", label: "Top Level", type: "int", format: "integer", aggregate: "max", icon: "trending", description: "Player level (card shows the highest across accounts)" },
      { key: "units", label: "Units", type: "int", format: "integer", aggregate: "sum", icon: "sparkles", description: "Number of units owned" },
    ],
  },
] as const satisfies readonly GameDef[];

export type GameSlug = (typeof GAMES)[number]["slug"];

export const DEFAULT_GAME: GameSlug = "adopt_me";

export type Stats = Record<string, number | boolean>;

const bySlug = new Map<string, GameDef>(GAMES.map((g) => [g.slug, g]));

export function getGame(slug: string): GameDef | undefined {
  return bySlug.get(slug);
}

export function isGameSlug(slug: string): slug is GameSlug {
  return bySlug.has(slug);
}

export function cardFields(game: GameDef): StatField[] {
  return game.stats.filter((s) => s.card !== false);
}

/** An account counts as online if it posted within this window. Collectors should post every 30 s. */
export const ONLINE_WINDOW_MS = 90_000;
export const RECOMMENDED_POST_INTERVAL_S = 30;

// ---------------------------------------------------------------------------
// Aggregation and formatting (used by the stat cards and the accounts table)
// ---------------------------------------------------------------------------

export interface AggregateResult {
  /** Display string for the card's main value. */
  value: string;
  /** Optional secondary text, e.g. "of 4 accounts". */
  sub?: string;
}

export function aggregate(field: StatField, statsList: Stats[]): AggregateResult {
  const values = statsList.map((s) => s[field.key]).filter((v) => v !== undefined);
  switch (field.aggregate) {
    case "sum": {
      const total = values.reduce<number>((acc, v) => acc + (typeof v === "number" ? v : 0), 0);
      return { value: formatNumber(total, field.format) };
    }
    case "max": {
      const nums = values.filter((v): v is number => typeof v === "number");
      return { value: nums.length ? formatNumber(Math.max(...nums), field.format) : "—" };
    }
    case "countTrue": {
      const n = values.filter((v) => v === true).length;
      return { value: String(n), sub: `of ${statsList.length} account${statsList.length === 1 ? "" : "s"}` };
    }
  }
}

const compactFmt = new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 });
const intFmt = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 });

export function formatNumber(n: number, format: StatFormat): string {
  if (format === "compact") return n >= 10_000 ? compactFmt.format(n) : intFmt.format(n);
  return intFmt.format(n);
}

export function formatStat(field: StatField, value: number | boolean | undefined): string {
  if (value === undefined) return "—";
  if (typeof value === "boolean") return value ? "Yes" : "No";
  return formatNumber(value, field.format);
}

/** Example `stats` object for docs and the Connect Script modal. */
export function exampleStats(game: GameDef): Stats {
  return Object.fromEntries(
    game.stats.map((f, i) => [f.key, f.type === "boolean" ? i % 2 === 0 : f.aggregate === "max" ? 1500 + i * 25 : 1000 * (i + 1) + 250]),
  );
}

export function examplePayload(game: GameDef) {
  return {
    game: game.slug,
    account: { robloxUserId: "123456789", displayName: "CometPilot" },
    stats: exampleStats(game),
    sentAt: "2026-01-01T12:00:00Z",
  };
}
