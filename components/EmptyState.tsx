"use client";

import { motion } from "framer-motion";
import { CometIcon } from "./CometIcon";

export function EmptyState({ signedIn, onConnect }: { signedIn: boolean; onConnect: () => void }) {
  return (
    <div className="relative flex flex-col items-center justify-center overflow-hidden rounded-2xl border border-line bg-ink-900/60 px-6 py-20 text-center">
      <div className="pointer-events-none absolute top-1/3 left-1/2 size-72 -translate-x-1/2 -translate-y-1/2 rounded-full bg-neon/20 blur-3xl" />
      <motion.div
        initial={{ opacity: 0, x: 24, y: -24, rotate: -6 }}
        animate={{ opacity: 1, x: 0, y: [0, -6, 0], rotate: 0 }}
        transition={{ opacity: { duration: 0.6 }, x: { duration: 0.6 }, rotate: { duration: 0.6 }, y: { duration: 4, repeat: Infinity, ease: "easeInOut" } }}
      >
        <CometIcon className="relative size-40 drop-shadow-[0_0_24px_rgb(147_51_234/0.8)] sm:size-48" />
      </motion.div>
      <h2 className="relative mt-6 text-2xl font-bold tracking-[0.2em] text-white drop-shadow-[0_0_12px_rgb(192_132_252/0.6)] sm:text-3xl">
        NO ACCOUNTS YET
      </h2>
      <p className="relative mt-3 max-w-md text-sm text-neutral-400">
        Run the collector script in game. Accounts show up here within a minute.
      </p>
      {signedIn ? (
        <button
          type="button"
          onClick={onConnect}
          className="relative mt-6 rounded-lg border border-neon/50 px-4 py-2 text-sm font-medium text-neon-soft transition hover:bg-neon/10 hover:shadow-neon"
        >
          Get an API key
        </button>
      ) : (
        <p className="relative mt-6 text-xs text-neutral-500">Log in with Discord to create an API key for your collector.</p>
      )}
    </div>
  );
}
