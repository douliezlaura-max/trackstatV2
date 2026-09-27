import type { AccountDTO } from "./accounts";

/** Socket.io events the server pushes to the `user:<id>` room. */
export interface ServerToClientEvents {
  "account:update": (account: AccountDTO) => void;
  "account:offline": (payload: { id: string; game: string; lastSeenAt: string }) => void;
}

// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export interface ClientToServerEvents {}

export const userRoom = (userId: string) => `user:${userId}`;
