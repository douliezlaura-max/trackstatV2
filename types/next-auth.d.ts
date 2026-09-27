import "next-auth";
import "next-auth/jwt";

declare module "next-auth" {
  interface Session {
    user: { id: string; name: string; image: string | null };
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    /** Comet Tracker User.id (not the Discord id). */
    uid?: string;
  }
}
