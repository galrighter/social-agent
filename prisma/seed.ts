import { PrismaClient } from "@prisma/client";
import { SEED_CORRECTIONS } from "../src/lib/corrections";

const prisma = new PrismaClient();

async function main() {
  for (const rule of SEED_CORRECTIONS) {
    await prisma.dataCorrection.upsert({
      where: { name: rule.name },
      update: {},
      create: {
        name: rule.name,
        enabled: rule.enabled,
        matchPlayerName: rule.matchPlayerName ?? null,
        matchPhone: rule.matchPhone ?? null,
        matchType: rule.matchType ?? null,
        matchOccurredAt: rule.matchOccurredAt ?? null,
        matchRawAmount: rule.matchRawAmount ?? null,
        effectiveAmount: rule.effectiveAmount ?? null,
        excludeFromStats: rule.excludeFromStats,
        note: rule.note ?? null,
      },
    });
  }
  console.log(`Seeded ${SEED_CORRECTIONS.length} data corrections.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
