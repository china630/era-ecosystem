/**
 * Copy InboxThread rows into Conversation (best-effort).
 * Usage: npx tsx prisma/scripts/migrate-inbox-threads.ts
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const threads = await prisma.inboxThread.findMany();
  let n = 0;
  for (const t of threads) {
    // Requires a placeholder connection per org — skip if none.
    const connection = await prisma.integrationConnection.findFirst({
      where: { organizationId: t.organizationId, providerKey: "mock_telegram" },
    });
    if (!connection) continue;
    await prisma.conversation.upsert({
      where: {
        connectionId_externalChatId: {
          connectionId: connection.id,
          externalChatId: t.externalRef,
        },
      },
      create: {
        organizationId: t.organizationId,
        connectionId: connection.id,
        channel: t.channel,
        externalChatId: t.externalRef,
        leadId: t.leadId,
        lastMessageAt: t.lastMessageAt,
      },
      update: { leadId: t.leadId, lastMessageAt: t.lastMessageAt },
    });
    n += 1;
  }
  console.log(`migrated ${n}/${threads.length} inbox threads`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => prisma.$disconnect());
