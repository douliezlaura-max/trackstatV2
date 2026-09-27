"use client";

import { LogOut } from "lucide-react";
import { signIn, signOut } from "next-auth/react";
import Image from "next/image";
import Link from "next/link";
import { useParams } from "next/navigation";
import { GAMES, getGame } from "@/lib/games";
import { useDashboard } from "./DashboardProvider";
import { DiscordIcon } from "./icons";
import { Logo } from "./Sidebar";

export function Header() {
  const { slug } = useParams<{ slug: string }>();
  const game = getGame(slug);
  const { user, liveCount, devLogin } = useDashboard();

  return (
    <header className="sticky top-0 z-20 border-b border-line bg-ink-950/85 backdrop-blur">
      <div className="flex h-16 items-center gap-4 px-4 sm:px-8">
        <div className="min-w-0 md:hidden">
          <Logo compact />
        </div>
        <div className="hidden min-w-0 md:block">
          <p className="text-[11px] font-semibold tracking-[0.14em] text-neutral-500 uppercase">Dashboard</p>
          <h1 className="truncate text-lg font-semibold text-white">
            {game?.name}
            {game?.placeholder && (
              <span className="ml-2 align-middle text-[10px] font-medium tracking-wide text-neutral-500 uppercase">
                placeholder stats
              </span>
            )}
          </h1>
        </div>

        <div className="ml-auto flex shrink-0 items-center gap-2 sm:gap-3">
          {user ? (
            <>
              <div className="flex items-center gap-2 rounded-full border border-line bg-ink-900 px-3 py-1.5 text-xs font-medium whitespace-nowrap">
                <span className="relative flex size-2">
                  {liveCount > 0 && <span className="absolute inline-flex size-full animate-ping rounded-full bg-emerald-400 opacity-60" />}
                  <span className={`relative inline-flex size-2 rounded-full ${liveCount > 0 ? "bg-emerald-400" : "bg-neutral-600"}`} />
                </span>
                <span className={liveCount > 0 ? "text-emerald-300" : "text-neutral-400"}>{liveCount} live</span>
              </div>
              <div className="flex items-center gap-2.5 rounded-full border border-line bg-ink-900 py-1 pr-1 pl-1">
                {user.image ? (
                  <Image src={user.image} alt="" width={28} height={28} className="size-7 rounded-full ring-2 ring-neon/60" />
                ) : (
                  <span className="grid size-7 place-items-center rounded-full bg-neon text-xs font-bold text-white ring-2 ring-neon/60">
                    {user.name.slice(0, 1).toUpperCase()}
                  </span>
                )}
                <span className="hidden max-w-32 truncate text-sm font-medium text-white sm:inline">{user.name}</span>
                <button
                  type="button"
                  onClick={() => signOut()}
                  title="Sign out"
                  className="grid size-7 place-items-center rounded-full text-neutral-500 transition-colors hover:bg-ink-800 hover:text-white"
                >
                  <LogOut className="size-3.5" />
                  <span className="sr-only">Sign out</span>
                </button>
              </div>
            </>
          ) : (
            <>
              {devLogin && (
                <button
                  type="button"
                  onClick={() => signIn("dev-login", { username: "dev-pilot" })}
                  className="rounded-lg border border-dashed border-amber-400/40 px-3 py-2 text-xs font-medium text-amber-300 hover:bg-amber-400/10"
                  title="DEV_LOGIN_BYPASS is on. Never enabled in production."
                >
                  Dev login
                </button>
              )}
              <button
                type="button"
                onClick={() => signIn("discord")}
                className="flex items-center gap-2 rounded-lg bg-[#5865F2] px-4 py-2 text-sm font-semibold text-white shadow-[0_0_18px_rgb(88_101_242/0.45)] transition hover:brightness-110"
              >
                <DiscordIcon className="size-4" />
                Login with Discord
              </button>
            </>
          )}
        </div>
      </div>

      {/* Mobile game switcher (the sidebar is hidden below md). */}
      <nav className="flex gap-2 overflow-x-auto border-t border-line px-4 py-2 md:hidden" aria-label="Games">
        {GAMES.map((g) => (
          <Link
            key={g.slug}
            href={`/games/${g.slug}`}
            className={`shrink-0 rounded-full border px-3 py-1 text-xs ${
              g.slug === slug ? "border-neon bg-neon-deep text-white" : "border-line text-neutral-400"
            }`}
          >
            {g.name}
          </Link>
        ))}
      </nav>
    </header>
  );
}
