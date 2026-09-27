/**
 * Dashboard sockets. The browser connects to the same origin, so the handshake
 * carries the NextAuth session cookie; we decode it and join `user:<id>`.
 * Unauthenticated sockets are rejected.
 */
import { parseCookie } from "cookie";
import type { IncomingMessage } from "node:http";
import { decode } from "next-auth/jwt";
import type { Server } from "socket.io";
import { prisma } from "@/lib/prisma";
import { userRoom, type ClientToServerEvents, type ServerToClientEvents } from "@/lib/realtime";

interface SocketData {
  userId: string;
}

function sessionCookieName() {
  const secure = process.env.NEXTAUTH_URL?.startsWith("https://") ?? false;
  return `${secure ? "__Secure-" : ""}next-auth.session-token`;
}

/** Reads the session token, reassembling NextAuth's chunked cookies (name.0, name.1, ...) if needed. */
export function readSessionToken(req: IncomingMessage): string | null {
  const cookies = parseCookie(req.headers.cookie ?? "");
  const name = sessionCookieName();
  const whole = cookies[name];
  if (whole) return whole;
  const chunks = Object.keys(cookies)
    .filter((k) => k.startsWith(`${name}.`))
    .sort((a, b) => Number(a.slice(name.length + 1)) - Number(b.slice(name.length + 1)))
    .map((k) => cookies[k] ?? "");
  return chunks.length ? chunks.join("") : null;
}

export async function userIdFromRequest(req: IncomingMessage): Promise<string | null> {
  const token = readSessionToken(req);
  if (!token) return null;
  try {
    const jwt = await decode({ token, secret: process.env.NEXTAUTH_SECRET! });
    if (!jwt?.uid) return null;
    const user = await prisma.user.findUnique({ where: { id: jwt.uid }, select: { id: true } });
    return user?.id ?? null;
  } catch {
    return null;
  }
}

export function attachSocketAuth(io: Server<ClientToServerEvents, ServerToClientEvents, object, SocketData>) {
  io.use(async (socket, next) => {
    const userId = await userIdFromRequest(socket.request);
    if (!userId) return next(new Error("unauthorized"));
    socket.data.userId = userId;
    next();
  });

  io.on("connection", (socket) => {
    void socket.join(userRoom(socket.data.userId));
  });
}
