"use client";

import { AnimatePresence, motion } from "framer-motion";
import { Check, Copy, KeyRound, Terminal, Trash2, X } from "lucide-react";
import { signIn } from "next-auth/react";
import { useCallback, useEffect, useState } from "react";
import { examplePayload, ONLINE_WINDOW_MS, RECOMMENDED_POST_INTERVAL_S, type GameDef } from "@/lib/games";
import { useDashboard } from "./DashboardProvider";
import { DiscordIcon } from "./icons";

interface ApiKeyRow {
  id: string;
  name: string;
  prefix: string;
  createdAt: string;
  lastUsedAt: string | null;
  revokedAt: string | null;
}

function CopyButton({ text, label = "Copy" }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={async () => {
        await navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      }}
      className="inline-flex items-center gap-1.5 rounded-md border border-line bg-ink-800 px-2 py-1 text-[11px] text-neutral-300 hover:border-neon/50 hover:text-white"
    >
      {copied ? <Check className="size-3 text-emerald-400" /> : <Copy className="size-3" />}
      {copied ? "Copied" : label}
    </button>
  );
}

function CodeBlock({ code, title }: { code: string; title: string }) {
  return (
    <div className="overflow-hidden rounded-lg border border-line bg-ink-950">
      <div className="flex items-center justify-between border-b border-line px-3 py-1.5">
        <span className="text-[11px] font-medium tracking-wide text-neutral-500 uppercase">{title}</span>
        <CopyButton text={code} />
      </div>
      <pre className="overflow-x-auto p-3 font-mono text-xs leading-relaxed text-neutral-300">{code}</pre>
    </div>
  );
}

export function ConnectScriptModal({ open, onClose, game }: { open: boolean; onClose: () => void; game: GameDef }) {
  const { user } = useDashboard();
  const [keys, setKeys] = useState<ApiKeyRow[]>([]);
  const [newKey, setNewKey] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const userId = user?.id;
  const loadKeys = useCallback(async () => {
    const res = await fetch("/api/keys", { cache: "no-store" });
    if (res.ok) setKeys(((await res.json()) as { keys: ApiKeyRow[] }).keys);
  }, []);

  useEffect(() => {
    if (!open || !userId) return;
    let cancelled = false;
    fetch("/api/keys", { cache: "no-store" })
      .then((res) => (res.ok ? (res.json() as Promise<{ keys: ApiKeyRow[] }>) : null))
      .then((body) => {
        if (body && !cancelled) setKeys(body.keys);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [open, userId]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  async function createKey() {
    setBusy(true);
    setError(null);
    const res = await fetch("/api/keys", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(name.trim() ? { name: name.trim() } : {}),
    });
    const body = await res.json();
    setBusy(false);
    if (!res.ok) return setError(body.message ?? "Could not create key.");
    setNewKey(body.key);
    setName("");
    void loadKeys();
  }

  async function revokeKey(id: string) {
    if (!confirm("Revoke this key? Collectors using it will stop updating immediately.")) return;
    await fetch(`/api/keys/${id}`, { method: "DELETE" });
    void loadKeys();
  }

  // Only rendered after a click, so `window` exists whenever this is shown.
  const origin = typeof window === "undefined" ? "" : window.location.origin;
  const endpoint = `${origin}/api/ingest`;
  const payload = JSON.stringify(examplePayload(game), null, 2);
  const curl = `curl -X POST ${endpoint} \\
  -H "Authorization: Bearer ${newKey ?? "$COMET_API_KEY"}" \\
  -H "Content-Type: application/json" \\
  -d '${JSON.stringify(examplePayload(game))}'`;
  const activeKeys = keys.filter((k) => !k.revokedAt);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/70 p-4 backdrop-blur-sm sm:p-8"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onMouseDown={(e) => e.target === e.currentTarget && onClose()}
        >
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-labelledby="connect-title"
            className="w-full max-w-2xl rounded-2xl border border-line bg-ink-900 shadow-neon-lg"
            initial={{ opacity: 0, y: 16, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 16, scale: 0.98 }}
          >
            <div className="flex items-center justify-between border-b border-line px-6 py-4">
              <div className="flex items-center gap-3">
                <span className="grid size-9 place-items-center rounded-lg bg-neon/15 text-neon-soft shadow-neon">
                  <Terminal className="size-4" />
                </span>
                <div>
                  <h2 id="connect-title" className="font-semibold text-white">
                    Connect Script
                  </h2>
                  <p className="text-xs text-neutral-500">Point your in-game collector at Comet Tracker</p>
                </div>
              </div>
              <button type="button" onClick={onClose} className="rounded-md p-1.5 text-neutral-500 hover:bg-ink-800 hover:text-white">
                <X className="size-4" />
                <span className="sr-only">Close</span>
              </button>
            </div>

            <div className="space-y-6 px-6 py-5">
              <section>
                <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold text-white">
                  <KeyRound className="size-4 text-neon-soft" /> 1. API keys
                </h3>
                {!user ? (
                  <div className="flex flex-col items-start gap-3 rounded-lg border border-line bg-ink-950 p-4 text-sm text-neutral-400">
                    Log in to create an API key for your collector.
                    <button
                      type="button"
                      onClick={() => signIn("discord")}
                      className="flex items-center gap-2 rounded-lg bg-[#5865F2] px-3 py-1.5 text-xs font-semibold text-white"
                    >
                      <DiscordIcon className="size-3.5" /> Login with Discord
                    </button>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {newKey && (
                      <div className="rounded-lg border border-emerald-400/30 bg-emerald-400/5 p-3">
                        <p className="text-xs font-medium text-emerald-300">
                          Copy this key now. It won&apos;t be shown again.
                        </p>
                        <div className="mt-2 flex items-center gap-2">
                          <code className="flex-1 truncate rounded bg-ink-950 px-2 py-1.5 font-mono text-xs text-white">{newKey}</code>
                          <CopyButton text={newKey} />
                        </div>
                      </div>
                    )}
                    <div className="flex gap-2">
                      <input
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        maxLength={40}
                        placeholder="Key name (e.g. Main PC)"
                        className="h-9 flex-1 rounded-lg border border-line bg-ink-950 px-3 text-sm text-white placeholder:text-neutral-600 focus:border-neon/60 focus:outline-none"
                      />
                      <button
                        type="button"
                        onClick={createKey}
                        disabled={busy}
                        className="h-9 rounded-lg bg-neon px-4 text-sm font-semibold text-white shadow-neon hover:bg-[#a855f7] disabled:opacity-50"
                      >
                        Create key
                      </button>
                    </div>
                    {error && <p className="text-xs text-red-400">{error}</p>}
                    <ul className="divide-y divide-line rounded-lg border border-line bg-ink-950">
                      {activeKeys.length === 0 && <li className="px-3 py-3 text-xs text-neutral-500">No active keys yet.</li>}
                      {activeKeys.map((k) => (
                        <li key={k.id} className="flex items-center gap-3 px-3 py-2.5">
                          <code className="font-mono text-xs text-neon-soft">{k.prefix}…</code>
                          <span className="flex-1 truncate text-sm text-neutral-200">{k.name}</span>
                          <span className="hidden text-[11px] text-neutral-500 sm:inline">
                            {k.lastUsedAt ? `used ${new Date(k.lastUsedAt).toLocaleString()}` : "never used"}
                          </span>
                          <button
                            type="button"
                            onClick={() => revokeKey(k.id)}
                            className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11px] text-red-400 hover:bg-red-500/10"
                          >
                            <Trash2 className="size-3" /> Revoke
                          </button>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </section>

              <section className="space-y-3">
                <h3 className="text-sm font-semibold text-white">2. Send stats</h3>
                <div className="flex flex-wrap items-center gap-2 text-xs">
                  <span className="rounded bg-neon/15 px-1.5 py-0.5 font-mono font-semibold text-neon-soft">POST</span>
                  <code className="font-mono text-neutral-200">{endpoint}</code>
                  <CopyButton text={endpoint} />
                </div>
                <p className="text-xs leading-relaxed text-neutral-400">
                  Send <code className="text-neutral-200">Authorization: Bearer &lt;key&gt;</code> and a JSON body (max 16 KB) every{" "}
                  {RECOMMENDED_POST_INTERVAL_S}s per account. An account shows as online while it has posted in the last{" "}
                  {ONLINE_WINDOW_MS / 1000}s. Responses: <code className="text-neutral-200">202</code> ok,{" "}
                  <code className="text-neutral-200">400</code> invalid payload, <code className="text-neutral-200">401</code> bad key,{" "}
                  <code className="text-neutral-200">413</code> too large, <code className="text-neutral-200">429</code> rate limited.
                </p>
                <CodeBlock title={`Payload · ${game.name}`} code={payload} />
                <CodeBlock title="curl" code={curl} />
              </section>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
