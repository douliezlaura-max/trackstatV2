"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { GAMES } from "@/lib/games";
import { CometIcon } from "./CometIcon";
import { useDashboard, type ConnectionStatus } from "./DashboardProvider";

const STATUS: Record<ConnectionStatus, { label: string; dot: string; text: string }> = {
  connected: { label: "Connected", dot: "bg-emerald-400 shadow-[0_0_10px_rgb(52_211_153/0.8)]", text: "text-emerald-300" },
  connecting: { label: "Connecting", dot: "bg-amber-400 animate-pulse", text: "text-amber-300" },
  reconnecting: { label: "Reconnecting", dot: "bg-amber-400 animate-pulse", text: "text-amber-300" },
  offline: { label: "Offline", dot: "bg-neutral-600", text: "text-neutral-400" },
};

/** `compact` hides the wordmark on very narrow screens (mobile header). */
export function Logo({ compact = false }: { compact?: boolean }) {
  return (
    <div className="flex items-center gap-2.5">
      <CometIcon className="size-9 shrink-0 drop-shadow-neon" />
      <span className={`text-[15px] font-semibold tracking-tight whitespace-nowrap text-white ${compact ? "hidden min-[420px]:inline" : ""}`}>
        Comet Tracker
      </span>
      <span className="rounded-md border border-neon/40 bg-neon/15 px-1.5 py-0.5 text-[10px] font-bold tracking-wider text-neon-soft shadow-neon">
        BETA
      </span>
    </div>
  );
}

export function Sidebar() {
  const { slug } = useParams<{ slug: string }>();
  const { accounts, status, user } = useDashboard();
  const s = STATUS[status];

  return (
    <aside className="sticky top-0 hidden h-dvh w-64 shrink-0 flex-col border-r border-line bg-ink-900 md:flex">
      <div className="flex h-16 items-center border-b border-line px-5">
        <Logo />
      </div>

      <nav className="flex-1 overflow-y-auto px-3 py-5" aria-label="Games">
        <p className="px-3 pb-2 text-[11px] font-semibold tracking-[0.14em] text-neutral-500 uppercase">Games</p>
        <ul className="space-y-1">
          {GAMES.map((g) => {
            const active = g.slug === slug;
            const online = accounts.filter((a) => a.game === g.slug && a.online).length;
            return (
              <li key={g.slug}>
                <Link
                  href={`/games/${g.slug}`}
                  aria-current={active ? "page" : undefined}
                  className={`group flex items-center gap-3 rounded-r-lg border-l-2 px-3 py-2.5 text-sm transition-colors ${
                    active
                      ? "border-neon bg-neon-deep text-white"
                      : "border-transparent text-neutral-400 hover:bg-ink-800 hover:text-neutral-200"
                  }`}
                >
                  <span
                    className={`grid size-7 place-items-center rounded-md text-[10px] font-bold ${
                      active ? "bg-neon text-white shadow-neon" : "bg-ink-800 text-neutral-400 group-hover:text-neutral-200"
                    }`}
                  >
                    {g.badge}
                  </span>
                  <span className="flex-1 truncate">{g.name}</span>
                  {online > 0 && (
                    <span className="rounded-full bg-emerald-400/10 px-1.5 text-[11px] font-medium text-emerald-300">{online}</span>
                  )}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      <div className="border-t border-line p-4">
        <div className="flex items-center gap-3 rounded-lg border border-line bg-ink-950 px-3 py-2.5" role="status" aria-live="polite">
          <span className={`size-2.5 rounded-full ${s.dot}`} />
          <div className="min-w-0 flex-1">
            <p className={`text-sm font-medium ${s.text}`}>{s.label}</p>
            <p className="truncate text-[11px] text-neutral-500">{user ? "Live updates via WebSocket" : "Sign in to go live"}</p>
          </div>
        </div>
      </div>
    </aside>
  );
}
