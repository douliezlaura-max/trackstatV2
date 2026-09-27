import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";

// One client per process. The custom server and Next's route handlers share the
// same Node process, so cache it on globalThis (also survives dev hot reloads).
const globalForPrisma = globalThis as unknown as { __cometPrisma?: PrismaClient };

function createClient() {
  const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
  return new PrismaClient({ adapter });
}

export const prisma = globalForPrisma.__cometPrisma ?? createClient();
globalForPrisma.__cometPrisma = prisma;
