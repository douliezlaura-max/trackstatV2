"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useState } from "react";
import type { AccountDTO } from "@/lib/accounts";
import { formatStat, type GameDef } from "@/lib/games";

function useNow(intervalMs: number) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(t);
  }, [intervalMs]);
  return now;
}

function timeAgo(iso: string, now: number) {
  const s = Math.max(0, Math.round((now - Date.parse(iso)) / 1000));
  if (s < 5) return "just now";
  if (s < 60) return `${s}s ago`;
  const m = Math.round(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 48) return `${h}h ago`;
  return `${Math.round(h / 24)}d ago`;
}

export function AccountsTable({ game, accounts }: { game: GameDef; accounts: AccountDTO[] }) {
  const now = useNow(5_000);

  return (
    <div className="overflow-x-auto rounded-xl border border-line bg-ink-900">
      <table className="w-full min-w-[640px] text-left text-sm">
        <thead>
          <tr className="border-b border-line text-[11px] tracking-wider text-neutral-500 uppercase">
            <th className="px-4 py-3 font-medium">Account</th>
            <th className="px-4 py-3 font-medium">Status</th>
            {game.stats.map((f) => (
              <th key={f.key} className="px-4 py-3 text-right font-medium">
                {f.label.replace(/^Top /, "")}
              </th>
            ))}
            <th className="px-4 py-3 text-right font-medium">Last seen</th>
          </tr>
        </thead>
        <tbody>
          <AnimatePresence initial={false}>
            {accounts.map((a) => (
              <motion.tr
                key={a.id}
                layout
                initial={{ opacity: 0, backgroundColor: "rgba(147,51,234,0.18)" }}
                animate={{ opacity: 1, backgroundColor: "rgba(147,51,234,0)" }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.6 }}
                className="border-b border-line/70 last:border-0 hover:bg-ink-850"
              >
                <td className="px-4 py-3">
                  <p className="font-medium text-white">{a.displayName}</p>
                  <p className="font-mono text-[11px] text-neutral-500">{a.robloxUserId}</p>
                </td>
                <td className="px-4 py-3">
                  <span className="inline-flex items-center gap-2 text-xs">
                    <span
                      className={`size-2 rounded-full ${a.online ? "bg-emerald-400 shadow-[0_0_8px_rgb(52_211_153/0.9)]" : "bg-neutral-600"}`}
                    />
                    <span className={a.online ? "text-emerald-300" : "text-neutral-500"}>{a.online ? "Online" : "Offline"}</span>
                  </span>
                </td>
                {game.stats.map((f) => {
                  const v = a.stats[f.key];
                  return (
                    <td key={f.key} className="px-4 py-3 text-right tabular-nums">
                      {f.type === "boolean" ? (
                        <span className={v ? "font-medium text-neon-soft" : "text-neutral-600"}>{formatStat(f, v)}</span>
                      ) : (
                        <span className="text-neutral-200">{formatStat(f, v)}</span>
                      )}
                    </td>
                  );
                })}
                <td className="px-4 py-3 text-right text-xs whitespace-nowrap text-neutral-400" title={new Date(a.lastSeenAt).toLocaleString()}>
                  {timeAgo(a.lastSeenAt, now)}
                </td>
              </motion.tr>
            ))}
          </AnimatePresence>
        </tbody>
      </table>
    </div>
  );
}
