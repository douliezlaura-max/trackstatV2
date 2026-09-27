/**
 * Seeds a demo user (the same identity the dev login uses) and prints a fresh API key
 * for scripts/simulate-collector.ts. Safe to re-run; each run issues a new key.
 */
import "dotenv/config";
import { createApiKey } from "../lib/apiKeys";
import { prisma } from "../lib/prisma";

async function main() {
  const user = await prisma.user.upsert({
    where: { discordId: "dev:dev-pilot" },
    create: { discordId: "dev:dev-pilot", username: "dev-pilot" },
    update: {},
  });
  const { key } = await createApiKey(user.id, "Seed / simulator");
  console.log(`Seeded user ${user.username} (${user.id}).`);
  console.log(`API key (shown once): ${key}`);
  console.log(`Try: COMET_API_KEY=${key} npm run simulate`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
