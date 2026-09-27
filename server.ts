/**
 * Comet Tracker server: one process, one origin.
 *
 *   HTTP server
 *   ├── Socket.io  (/socket.io/*)   dashboard realtime, authenticated by the NextAuth cookie
 *   └── Express
 *       ├── POST /api/ingest        collector bridge (API key auth)
 *       ├── GET  /healthz
 *       └── everything else  ->  Next.js (App Router pages, /api/auth, /api/keys, ...)
 *
 * Socket.io needs a long-lived process, so this does not run on serverless hosts (e.g. Vercel).
 */
import "dotenv/config";
import express from "express";
import next from "next";
import { createServer } from "node:http";
import { Server } from "socket.io";
import type { ClientToServerEvents, ServerToClientEvents } from "@/lib/realtime";
import { prisma } from "@/lib/prisma";
import { createIngestRouter } from "@/server/ingest";
import { attachSocketAuth } from "@/server/socket";
import { startSweeper } from "@/server/sweeper";

const dev = process.env.NODE_ENV !== "production";
const hostname = process.env.HOSTNAME ?? "0.0.0.0";
const port = Number(process.env.PORT ?? 3000);

if (!process.env.NEXTAUTH_SECRET) {
  console.error("NEXTAUTH_SECRET is not set; see .env.example");
  process.exit(1);
}

async function main() {
  const httpServer = createServer();
  const nextApp = next({ dev, hostname, port, httpServer });
  const handle = nextApp.getRequestHandler();
  await nextApp.prepare();

  const app = express();
  app.disable("x-powered-by");

  // Express's listener must be registered before Socket.io attaches: Socket.io
  // wraps existing "request" listeners and routes /socket.io/* to itself.
  httpServer.on("request", app);
  const io = new Server<ClientToServerEvents, ServerToClientEvents>(httpServer, {
    serveClient: false,
    // Leave other upgrade requests (Next's dev HMR socket) alone.
    destroyUpgrade: false,
  });
  attachSocketAuth(io);

  app.use(createIngestRouter(io));
  app.get("/healthz", (_req, res) => {
    res.json({ ok: true });
  });
  app.use((req, res) => handle(req, res));

  const stopSweeper = startSweeper(io);

  httpServer.listen(port, hostname, () => {
    console.log(`> Comet Tracker ready on http://localhost:${port} (${dev ? "development" : "production"})`);
  });

  const shutdown = async () => {
    stopSweeper();
    await io.close();
    await prisma.$disconnect();
    process.exit(0);
  };
  process.on("SIGTERM", shutdown);
  process.on("SIGINT", shutdown);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
