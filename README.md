# Comet Tracker

Real-time game stat tracker for Roblox accounts. An in-game collector script POSTs
stats to the backend. The backend validates and stores them, then pushes them over
Socket.io to the owner's dashboard as they arrive.

| Live dashboard (Blox Fruits) | Empty state |
| --- | --- |
| ![Blox Fruits](docs/screenshots/blox-fruits-live.png) | ![Empty state](docs/screenshots/empty-state.png) |

More screenshots: [Adopt Me](docs/screenshots/adopt-me-live.png) ·
[Connect Script modal](docs/screenshots/connect-script.png) · [Mobile](docs/screenshots/mobile.png) ·
[Logged out](docs/screenshots/logged-out.png)

**Stack:** Next.js 16 (App Router) · React 19 · Tailwind CSS 4 · Framer Motion ·
Express 5 · Socket.io 4 · NextAuth 4 (Discord) · PostgreSQL + Prisma 7 · zod 4

---

## Architecture

One Node process serves everything on one origin (`server.ts`):

```
 In-game collector (Lua, etc.)                       Browser dashboard
            │                                            ▲        │
            │ POST /api/ingest                           │        │ HTTP pages, /api/auth,
            │ Authorization: Bearer ct_…                 │        │ /api/keys, /api/accounts
            ▼                                            │        ▼
 ┌───────────────────────────────── server.ts (one HTTP server) ─────────────────────────────┐
 │                                                                                           │
 │  Express ── /api/ingest ─► 1. find key by sha256 hash (401 if unknown/revoked)            │
 │                             2. token-bucket rate limit per key (429)                      │
 │                             3. body ≤ 16 KB (413), JSON (400)                             │
 │                             4. zod schema for that game (400)                             │
 │                             5. upsert TrackedAccount ───────────────┐                     │
 │                             6. emit "account:update" ─┐             │                     │
 │                             7. 202 → then snapshot +  │             │                     │
 │                                key.lastUsedAt         │             │                     │
 │                                                       ▼             ▼                     │
 │  Socket.io (/socket.io) ◄── room "user:<id>"      PostgreSQL (Prisma)                     │
 │     handshake: decode NextAuth       ▲             User · ApiKey · TrackedAccount         │
 │     session cookie → join room       │             (stats JSONB) · StatSnapshot           │
 │                                      │                      ▲                             │
 │  Sweeper (every 10 s) ── "account:offline" ── UPDATE … SET online=false RETURNING         │
 │                                                                                           │
 │  Next.js request handler ── everything else (App Router pages + route handlers)           │
 └───────────────────────────────────────────────────────────────────────────────────────────┘
```

Why a custom server? Socket.io needs a long-lived process, and it can't run inside
Next.js API routes on serverless hosts. Serving pages, the ingest API and the socket
from one origin also means the socket handshake carries the NextAuth session cookie,
so dashboard sockets authenticate without a separate token.

### Code map

| Path | What |
| --- | --- |
| `lib/games.ts` | **Game registry**, the single source of truth: slugs, names, stat fields, types, labels, formatters, and how each card aggregates. |
| `lib/schemas.ts` | zod schemas derived from the registry: ingest validation and the JSON Schema. |
| `server.ts` | Custom server: Next + Express + Socket.io on one HTTP server. |
| `server/ingest.ts` | `POST /api/ingest`, the collector bridge. |
| `server/socket.ts` | Socket auth (NextAuth cookie → `user:<id>` room). |
| `server/sweeper.ts` | Online → offline transitions. |
| `lib/auth.ts` | NextAuth config (Discord + dev-only bypass). |
| `app/api/keys/*` | Create, list and revoke API keys. |
| `app/api/accounts` | Account list (refetched after a socket reconnect). |
| `components/*` | Dashboard UI: sidebar, header, stat cards, table, empty state, Connect Script modal. |
| `prisma/` | Schema, migrations, seed. |
| `scripts/simulate-collector.ts` | Fake collectors for local testing. |
| `scripts/generate-json-schema.ts` | Writes `docs/schemas/*.json`. |
| `scripts/screenshots.ts` | Headless Chromium screenshots into `docs/screenshots/`. |

---

## Setup

Requirements: Node ≥ 20.9 and PostgreSQL 14+ (Docker Compose provided).

```bash
npm install                      # also runs `prisma generate`
cp .env.example .env             # then fill in the values (see below)
docker compose up -d db          # or point DATABASE_URL at any Postgres
npx prisma migrate deploy        # create tables (use `npm run db:migrate` when changing the schema)
npm run dev                      # http://localhost:3000
```

Without Discord credentials you can still try the UI: set `DEV_LOGIN_BYPASS="true"`
in `.env` and use the **Dev login** button (development only; see below).

### Watch it update without a game

```bash
npm run db:seed                  # creates the dev user and prints an API key
COMET_API_KEY=ct_… npm run simulate
# options: --games adopt_me,blox_fruits --accounts 4 --interval 5 --once --drop 1
```

Log in with **Dev login** (the seed user is the same identity) and watch the cards
and table update. `--drop 1` stops one account per game after two rounds, so you
can watch it go offline about 90 s later. Or create a key in **Connect Script**
while logged in with Discord, and pass that instead.

### Scripts

| Command | |
| --- | --- |
| `npm run dev` | Dev server (custom server with Next in dev mode, restarts on server-file changes) |
| `npm run build` / `npm start` | Production build / start (`NODE_ENV=production`) |
| `npm run lint` / `npm run typecheck` | ESLint / `next typegen` + `tsc` |
| `npm run db:migrate` / `db:deploy` / `db:seed` | Prisma migrate dev / deploy / seed |
| `npm run simulate` | Fake collectors |
| `npm run schema:json` | Regenerate `docs/schemas/*.json` from the registry |

### Environment variables

| Var | Purpose |
| --- | --- |
| `DATABASE_URL` | Postgres connection string |
| `NEXTAUTH_URL` | Public base URL (`http://localhost:3000` locally, `https://…` in prod) |
| `NEXTAUTH_SECRET` | Signs/encrypts session JWTs. `openssl rand -base64 32` |
| `DISCORD_CLIENT_ID` / `DISCORD_CLIENT_SECRET` | From the Discord Developer Portal |
| `PORT`, `HOSTNAME` | Listen address (default `0.0.0.0:3000`) |
| `DEV_LOGIN_BYPASS` | `"true"` enables the fake-user login, **only** when `NODE_ENV !== "production"` |
| `COMET_API_KEY`, `COMET_URL` | Used by the simulator script only |

---

## Discord OAuth

1. Go to <https://discord.com/developers/applications> and click **New Application**, then name it (e.g. "Comet Tracker").
2. Open **OAuth2** in the left menu.
   - Copy the **Client ID** into `DISCORD_CLIENT_ID`.
   - Click **Reset Secret** and copy it into `DISCORD_CLIENT_SECRET`.
   - Under **Redirects**, add `http://localhost:3000/api/auth/callback/discord`, plus
     `https://<your-domain>/api/auth/callback/discord` for production. Save.
3. Set `NEXTAUTH_URL` and `NEXTAUTH_SECRET` in `.env`, then restart the server.

How it works (`lib/auth.ts`):

- NextAuth **v4.24** (`next-auth@latest` on npm; Auth.js v5 is still in beta) with the
  Discord provider. It requests only the `identify` scope, since email isn't needed.
- **JWT sessions** with no database session tables. On first sign-in the `jwt` callback
  upserts a `User` keyed by Discord id (username = display name, plus avatar URL) and
  stores our `User.id` in the token as `uid`.
- `session.user = { id, name, image }` drives the header (avatar, username, "N live").
- **Socket auth** (`server/socket.ts`): the handshake's `next-auth.session-token`
  cookie (`__Secure-` prefixed on https, chunked cookies reassembled) is decoded with
  `next-auth/jwt`'s `decode()` using `NEXTAUTH_SECRET`. A missing, forged or expired
  cookie, or an unknown user, is rejected with `unauthorized`. Valid sockets join `user:<id>`.

### Dev-only login bypass

`DEV_LOGIN_BYPASS="true"` adds a credentials provider (`dev-login`) that signs you in
as `dev-pilot` without Discord. Both the provider registration and `authorize()`
check `NODE_ENV !== "production" && DEV_LOGIN_BYPASS === "true"`. `npm start` always
sets `NODE_ENV=production`, so it can't activate there. This was verified: a production
server with `DEV_LOGIN_BYPASS=true` in `.env` lists only the Discord provider, and a
POST to `/api/auth/callback/dev-login` fails.

---

## The connector bridge

### Flow

1. The user logs in with Discord, opens **Connect Script** and creates an API key.
   The key (`ct_…`) is shown **once**. Only `sha256(key)` and an 11-character display
   prefix are stored.
2. The in-game collector POSTs stats every **30 s** per account.
3. The server looks up the key by hash, rejects revoked keys, rate-limits, checks
   the size, validates the payload against **that game's** schema, upserts the
   `TrackedAccount`, and emits `account:update` to `user:<ownerId>`. It then returns `202`.
4. After responding, it writes a `StatSnapshot` if the last one is ≥ 5 min old
   (claimed atomically), and bumps `ApiKey.lastUsedAt` (at most once a minute).
5. The dashboard merges the update into its state. The cards and table re-render
   with no reload.
6. **Online rule:** an account is online if `lastSeenAt` is within **90 s**. Every
   10 s the sweeper runs `UPDATE … SET online=false WHERE online AND lastSeenAt < now-90s RETURNING …`
   and emits `account:offline` for each row. Because it's one atomic statement, every
   transition is emitted exactly once and an in-flight ingest can't be marked offline.
7. After a socket reconnect, the dashboard refetches `/api/accounts` to catch up.

### Contract

```http
POST /api/ingest
Authorization: Bearer ct_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
Content-Type: application/json

{
  "game": "blox_fruits",
  "account": { "robloxUserId": "123456789", "displayName": "CometPilot" },
  "stats": { "beli": 1250000, "level": 2450, "god_human": true, "cdk": false, "sanguine_art": true },
  "sentAt": "2026-01-01T12:00:00Z"
}
```

- `game`: a slug from the registry (`adopt_me`, `blox_fruits`, `pet_simulator_99`, `anime_adventures`).
- `account.robloxUserId`: a numeric string, or a number (normalized to a string). `displayName`: 1–64 chars.
- `stats`: exactly that game's fields. Unknown keys are rejected, integers must be ≥ 0, and booleans must be real booleans.
- `sentAt` (optional): ISO 8601 string or Unix seconds. Informational only; the server clock decides `lastSeenAt`.
- Full machine-readable contract: [`docs/schemas/ingest-payload.schema.json`](docs/schemas/ingest-payload.schema.json).

| Status | Body | When |
| --- | --- | --- |
| `202` | `{ ok, accountId, nextPostInSeconds: 30 }` | Accepted |
| `400` | `{ error: "invalid_json" }` or `{ error: "invalid_payload", issues: [{ path, message }] }` | Bad JSON, wrong content type, schema errors |
| `401` | `{ error: "unauthorized" }` | Missing, unknown or revoked key |
| `413` | `{ error: "payload_too_large" }` | Body > 16 KB (Content-Length or streamed) |
| `429` | `{ error: "rate_limited" }` + `Retry-After` | > 60-request burst / 2 req/s sustained per key |

Try it:

```bash
curl -X POST http://localhost:3000/api/ingest \
  -H "Authorization: Bearer $COMET_API_KEY" -H "Content-Type: application/json" \
  -d '{"game":"adopt_me","account":{"robloxUserId":"1","displayName":"Test"},"stats":{"bucks":1500,"pets":12,"eggs":3}}'
```

No Lua collector ships with this repo. Any script that can make this HTTP request
works (e.g. an executor's `request`/`http_request` function with `HttpService:JSONEncode`).

### Socket.io events (server → dashboard)

| Event | Payload |
| --- | --- |
| `account:update` | `{ id, game, robloxUserId, displayName, stats, lastSeenAt, online: true }` |
| `account:offline` | `{ id, game, lastSeenAt }` |

Types live in `lib/realtime.ts`.

---

## Database schema

PostgreSQL via Prisma (`prisma/schema.prisma`). Stable data is normalized, and the
per-game stats go in JSONB so adding a game or a stat never needs a migration.

```
User            id · discordId (unique) · username · avatarUrl · createdAt · updatedAt
 ├─< ApiKey          id · userId · name · keyHash (unique, sha256 hex) · prefix
 │                   createdAt · lastUsedAt · revokedAt
 └─< TrackedAccount  id · userId · game · robloxUserId · displayName
      │              stats JSONB · lastSeenAt · online · lastSnapshotAt · createdAt · updatedAt
      │              UNIQUE (userId, game, robloxUserId) · INDEX (userId, game) · INDEX (online, lastSeenAt)
      └─< StatSnapshot   id · trackedAccountId · stats JSONB · capturedAt
                         INDEX (trackedAccountId, capturedAt)   -- ≤ 1 per account per 5 min
```

- Deletes cascade from `User` down.
- `online` records what dashboards were last told. The rule itself is `lastSeenAt` within 90 s.
- Snapshot growth is bounded: an account posting 24/7 writes 288 rows a day. Prune
  or downsample old rows with a cron if you keep them long-term.
- The ingest path does one indexed key lookup plus one upsert, then the post-response bookkeeping.

### Per-game JSON schema

Generated from the same zod definitions that validate ingest (`npm run schema:json`):

- [`docs/schemas/game-stats.schema.json`](docs/schemas/game-stats.schema.json): every game's stats under one user profile.
- [`docs/schemas/ingest-payload.schema.json`](docs/schemas/ingest-payload.schema.json): the POST body.

A user's profile, keyed by game and then by Roblox user id:

```json
{
  "adopt_me": {
    "123456789": { "bucks": 1500, "pets": 12, "eggs": 3 }
  },
  "blox_fruits": {
    "123456789": { "beli": 1250000, "level": 2450, "god_human": true, "cdk": false, "sanguine_art": true }
  },
  "pet_simulator_99": { "…": { "diamonds": 0, "pets": 0, "huges": 0, "rank": 0 } },
  "anime_adventures": { "…": { "gems": 0, "gold": 0, "level": 0, "units": 0 } }
}
```

In Postgres, each leaf object is one `TrackedAccount.stats` value.

### Games and cards

| Game | Cards (after **Online / Total**) | Aggregation |
| --- | --- | --- |
| Adopt Me | Bucks, Pets, Eggs | sum, sum, sum |
| Blox Fruits | Beli, Top Level, God Human, CDK, Sanguine Art | sum, **max**, then "N of M accounts" ×3 |
| Pet Simulator 99 ⚠︎ placeholder | Diamonds, Pets, Huges, Top Rank | sum, sum, sum, max |
| Anime Adventures ⚠︎ placeholder | Gems, Gold, Top Level, Units | sum, sum, max, sum |

- **Level uses max**, the highest-level account. Summing levels is meaningless, and
  an average hides your best account. The table still shows each account's level.
- **Placeholders:** the owner didn't specify stats for Pet Simulator 99 or Anime
  Adventures. These sets are guesses, marked `placeholder: true` in the registry and
  labelled "placeholder stats" in the header. Replace them with the real fields.
- The card row lays out any number of cards: 2 columns on phones, rows of up to 4
  on large screens (6 → 3 + 3), and one row on extra-large screens.

### Adding a game

Add one entry to `GAMES` in `lib/games.ts`, then run `npm run schema:json`. The
sidebar, cards, table columns, search, ingest validation, example payload and JSON
Schema all follow.

---

## Deploying

This needs a **long-lived Node host** (Railway, Fly.io, Render, a VPS, a container
platform). It does **not** run on Vercel or other serverless platforms: Socket.io
needs a persistent server, and the ingest route shares its process.

```bash
npm ci
npx prisma migrate deploy
npm run build
npm start                 # NODE_ENV=production tsx server.ts, listens on $PORT
```

- Set `NEXTAUTH_URL=https://your-domain` (this switches to `__Secure-` cookies, which
  the socket auth handles) and a strong `NEXTAUTH_SECRET`. Add the production redirect
  URI in Discord.
- Terminate TLS at the platform or proxy, and make sure it forwards WebSocket upgrades
  for `/socket.io/`.
- **Single instance as written.** The rate limiter is in memory, and Socket.io rooms
  are per process. To scale out, add the Socket.io Redis adapter, move the limiter to
  Redis, and use sticky sessions (or websocket-only transport).
- Health check: `GET /healthz`.

## Verified locally

- `npm run lint`, `npm run typecheck` and `npm run build` pass.
- Against Postgres 16 with the simulator running:
  - Dashboard values change and accounts flip to Offline with no page reload.
  - Sockets without a session cookie, or with a forged one, are rejected.
  - Bad key → 401. Malformed JSON or a schema violation → 400. A 20 KB body → 413
    (with Content-Length and chunked). A revoked key → 401. A burst over 60 → 429.
- The production server doesn't expose the dev login. The Discord authorize redirect
  has the right `redirect_uri` and scope.
- **Not verified:** a real Discord OAuth round trip (it needs real app credentials).
