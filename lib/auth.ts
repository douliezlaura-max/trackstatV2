import type { NextAuthOptions } from "next-auth";
import { getServerSession } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import DiscordProvider from "next-auth/providers/discord";
import { prisma } from "./prisma";

interface DiscordProfile {
  id: string;
  username: string;
  global_name: string | null;
  avatar: string | null;
}

function discordAvatarUrl(p: DiscordProfile): string {
  if (p.avatar) {
    const ext = p.avatar.startsWith("a_") ? "gif" : "png";
    return `https://cdn.discordapp.com/avatars/${p.id}/${p.avatar}.${ext}?size=128`;
  }
  // Default avatar for accounts on Discord's new username system.
  const index = Number((BigInt(p.id) >> BigInt(22)) % BigInt(6));
  return `https://cdn.discordapp.com/embed/avatars/${index}.png`;
}

/**
 * Dev-only login bypass: sign in as a fake user without Discord credentials.
 * Requires BOTH a non-production NODE_ENV and DEV_LOGIN_BYPASS=true. It can never
 * activate in production (`next build` / `npm start` always run with NODE_ENV=production).
 */
export function devLoginEnabled(): boolean {
  return process.env.NODE_ENV !== "production" && process.env.DEV_LOGIN_BYPASS === "true";
}

function providers(): NextAuthOptions["providers"] {
  const list: NextAuthOptions["providers"] = [
    DiscordProvider({
      clientId: process.env.DISCORD_CLIENT_ID ?? "",
      clientSecret: process.env.DISCORD_CLIENT_SECRET ?? "",
      authorization: { params: { scope: "identify" } },
      profile(raw) {
        // next-auth v4 types predate `global_name`; Discord does send it.
        const profile = raw as unknown as DiscordProfile;
        return {
          id: profile.id,
          name: profile.global_name ?? profile.username,
          image: discordAvatarUrl(profile),
        };
      },
    }),
  ];
  if (devLoginEnabled()) {
    list.push(
      CredentialsProvider({
        id: "dev-login",
        name: "Dev login",
        credentials: { username: { label: "Username", type: "text" } },
        async authorize(credentials) {
          if (!devLoginEnabled()) return null;
          const username = (credentials?.username || "dev-pilot").slice(0, 32);
          return { id: `dev:${username}`, name: username, image: null };
        },
      }),
    );
  }
  return list;
}

export const authOptions: NextAuthOptions = {
  secret: process.env.NEXTAUTH_SECRET,
  session: { strategy: "jwt", maxAge: 30 * 24 * 60 * 60 },
  providers: providers(),
  callbacks: {
    async jwt({ token, user, account }) {
      // Only on sign-in: persist the Discord identity and pin our user id in the token.
      if (account && user) {
        const discordId = account.provider === "discord" ? account.providerAccountId : String(user.id);
        const dbUser = await prisma.user.upsert({
          where: { discordId },
          create: { discordId, username: user.name ?? "Unknown", avatarUrl: user.image ?? null },
          update: { username: user.name ?? "Unknown", avatarUrl: user.image ?? null },
          select: { id: true, username: true, avatarUrl: true },
        });
        token.uid = dbUser.id;
        token.name = dbUser.username;
        token.picture = dbUser.avatarUrl;
      }
      return token;
    },
    async session({ session, token }) {
      if (token.uid) {
        session.user = { id: token.uid, name: token.name ?? "Unknown", image: token.picture ?? null };
      }
      return session;
    },
  },
};

export function getSession() {
  return getServerSession(authOptions);
}

/** The signed-in user's id, or null. For route handlers and server components. */
export async function getUserId(): Promise<string | null> {
  const session = await getSession();
  return session?.user?.id ?? null;
}
