"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { io, type Socket } from "socket.io-client";
import type { AccountDTO } from "@/lib/accounts";
import type { ClientToServerEvents, ServerToClientEvents } from "@/lib/realtime";

export type ConnectionStatus = "connecting" | "connected" | "reconnecting" | "offline";

export interface DashboardUser {
  id: string;
  name: string;
  image: string | null;
}

interface DashboardContextValue {
  user: DashboardUser | null;
  devLogin: boolean;
  accounts: AccountDTO[];
  status: ConnectionStatus;
  /** Accounts currently online across every game (the header's "N live"). */
  liveCount: number;
}

const DashboardContext = createContext<DashboardContextValue | null>(null);

export function useDashboard() {
  const ctx = useContext(DashboardContext);
  if (!ctx) throw new Error("useDashboard must be used inside <DashboardProvider>");
  return ctx;
}

export function DashboardProvider({
  user,
  devLogin,
  initialAccounts,
  children,
}: {
  user: DashboardUser | null;
  devLogin: boolean;
  initialAccounts: AccountDTO[];
  children: React.ReactNode;
}) {
  const [accountsById, setAccountsById] = useState(() => new Map(initialAccounts.map((a) => [a.id, a])));
  const [status, setStatus] = useState<ConnectionStatus>(user ? "connecting" : "offline");

  const refetch = useCallback(async () => {
    const res = await fetch("/api/accounts", { cache: "no-store" });
    if (!res.ok) return;
    const { accounts } = (await res.json()) as { accounts: AccountDTO[] };
    setAccountsById(new Map(accounts.map((a) => [a.id, a])));
  }, []);

  const userId = user?.id;
  useEffect(() => {
    if (!userId) return;
    const socket: Socket<ServerToClientEvents, ClientToServerEvents> = io({ withCredentials: true });
    let hasConnected = false;

    socket.on("connect", () => {
      setStatus("connected");
      // Anything could have changed while we were away.
      if (hasConnected) void refetch();
      hasConnected = true;
    });
    socket.on("disconnect", (reason) => {
      // "io server disconnect" means the server kicked us; socket.io won't retry.
      setStatus(reason === "io server disconnect" ? "offline" : "reconnecting");
    });
    socket.on("connect_error", (err) => {
      // Auth failures are final; transport errors keep retrying.
      setStatus(err.message === "unauthorized" ? "offline" : "reconnecting");
    });
    socket.io.on("reconnect_failed", () => setStatus("offline"));

    socket.on("account:update", (account) => {
      setAccountsById((prev) => new Map(prev).set(account.id, account));
    });
    socket.on("account:offline", ({ id, lastSeenAt }) => {
      setAccountsById((prev) => {
        const existing = prev.get(id);
        // Ignore stale offline events that raced a newer update.
        if (!existing || existing.lastSeenAt > lastSeenAt) return prev;
        return new Map(prev).set(id, { ...existing, online: false });
      });
    });

    return () => {
      socket.disconnect();
    };
  }, [userId, refetch]);

  const value = useMemo<DashboardContextValue>(() => {
    const accounts = [...accountsById.values()];
    return { user, devLogin, accounts, status, liveCount: accounts.filter((a) => a.online).length };
  }, [accountsById, user, devLogin, status]);

  return <DashboardContext.Provider value={value}>{children}</DashboardContext.Provider>;
}
