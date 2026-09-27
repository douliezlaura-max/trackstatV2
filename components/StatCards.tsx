"use client";

import { motion } from "framer-motion";
import type { AccountDTO } from "@/lib/accounts";
import { aggregate, cardFields, type GameDef } from "@/lib/games";
import { STAT_ICONS } from "./icons";

interface Card {
  key: string;
  label: string;
  value: string;
  sub?: string;
  Icon: (typeof STAT_ICONS)[keyof typeof STAT_ICONS];
}

/** Online/Total plus one card per registry stat. Lays out any number of cards. */
export function StatCards({ game, accounts }: { game: GameDef; accounts: AccountDTO[] }) {
  const online = accounts.filter((a) => a.online).length;
  const stats = accounts.map((a) => a.stats);
  const cards: Card[] = [
    { key: "online", label: "Online / Total", value: `${online}/${accounts.length}`, sub: "accounts", Icon: STAT_ICONS.users },
    ...cardFields(game).map((f) => ({ key: f.key, label: f.label, Icon: STAT_ICONS[f.icon], ...aggregate(f, stats) })),
  ];

  return (
    <div
      // 2 columns on phones; on lg, rows of up to 4 (6 cards -> 3+3); on xl, one row.
      style={{ "--cols": cards.length, "--cols-lg": cards.length <= 4 ? cards.length : Math.ceil(cards.length / 2) } as React.CSSProperties}
      className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-[repeat(var(--cols-lg),minmax(0,1fr))] xl:grid-cols-[repeat(var(--cols),minmax(0,1fr))]"
    >
      {cards.map((c, i) => (
        <motion.div
          key={`${game.slug}-${c.key}`}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.25, delay: i * 0.04 }}
          className="group relative min-w-0 overflow-hidden rounded-xl border border-line bg-ink-900 p-3.5 transition-colors hover:border-neon/50 sm:p-4"
        >
          <div className="pointer-events-none absolute -top-10 -right-10 size-28 rounded-full bg-neon/10 blur-2xl transition-opacity group-hover:bg-neon/20" />
          <div className="flex items-center justify-between">
            <p className="truncate text-[11px] font-medium tracking-wide text-neutral-400 uppercase sm:text-xs">{c.label}</p>
            <span className="grid size-8 shrink-0 place-items-center rounded-lg border border-neon/30 bg-neon/10 text-neon-soft shadow-neon">
              <c.Icon className="size-4 drop-shadow-neon" />
            </span>
          </div>
          <motion.p
            key={c.value}
            initial={{ opacity: 0.4 }}
            animate={{ opacity: 1 }}
            className="mt-3 truncate text-xl font-semibold tracking-tight text-white tabular-nums sm:text-2xl"
          >
            {c.value}
          </motion.p>
          {c.sub && <p className="mt-0.5 text-xs text-neutral-500">{c.sub}</p>}
        </motion.div>
      ))}
    </div>
  );
}
