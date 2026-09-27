"use client";

import { Plug, Search } from "lucide-react";
import { useMemo, useState } from "react";
import { formatStat, getGame } from "@/lib/games";
import { AccountsTable } from "./AccountsTable";
import { ConnectScriptModal } from "./ConnectScriptModal";
import { useDashboard } from "./DashboardProvider";
import { EmptyState } from "./EmptyState";
import { StatCards } from "./StatCards";

export function GameDashboard({ slug }: { slug: string }) {
  const game = getGame(slug)!;
  const { accounts, user } = useDashboard();
  const [query, setQuery] = useState("");
  const [connectOpen, setConnectOpen] = useState(false);

  const gameAccounts = useMemo(
    () =>
      accounts
        .filter((a) => a.game === slug)
        .sort((a, b) => Number(b.online) - Number(a.online) || a.displayName.localeCompare(b.displayName)),
    [accounts, slug],
  );

  // Matches account name, Roblox id, or a stat ("pets", "cdk", "bucks 1.2M", ...).
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return gameAccounts;
    return gameAccounts.filter((a) => {
      const haystack = [
        a.displayName,
        a.robloxUserId,
        ...game.stats.map((f) => {
          const v = a.stats[f.key];
          // Booleans only match by label when true ("cdk" finds accounts that own CDK).
          if (f.type === "boolean") return v ? f.label : "";
          return `${f.label} ${formatStat(f, v)}`;
        }),
      ]
        .join(" ")
        .toLowerCase();
      return haystack.includes(q);
    });
  }, [gameAccounts, game, query]);

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <h1 className="text-xl font-semibold text-white md:hidden">{game.name}</h1>

      <StatCards game={game} accounts={gameAccounts} />

      <div className="flex flex-col gap-3 sm:flex-row">
        <label className="relative flex-1">
          <span className="sr-only">Search</span>
          <Search className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-neutral-500" />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search accounts, pets, eggs..."
            className="h-11 w-full rounded-lg border border-line bg-ink-900 pr-4 pl-10 text-sm text-white placeholder:text-neutral-500 focus:border-neon/60 focus:shadow-neon focus:outline-none"
          />
        </label>
        <button
          type="button"
          onClick={() => setConnectOpen(true)}
          className="flex h-11 items-center justify-center gap-2 rounded-lg bg-neon px-5 text-sm font-semibold text-white shadow-neon transition hover:bg-[#a855f7] hover:shadow-neon-lg"
        >
          <Plug className="size-4" />
          Connect Script
        </button>
      </div>

      {gameAccounts.length === 0 ? (
        <EmptyState signedIn={!!user} onConnect={() => setConnectOpen(true)} />
      ) : filtered.length === 0 ? (
        <div className="rounded-xl border border-line bg-ink-900 px-6 py-12 text-center text-sm text-neutral-400">
          No accounts match “{query}”.
        </div>
      ) : (
        <AccountsTable game={game} accounts={filtered} />
      )}

      <ConnectScriptModal open={connectOpen} onClose={() => setConnectOpen(false)} game={game} />
    </div>
  );
}
