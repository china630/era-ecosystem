/**
 * Migrate legacy AccountMapping + IfrsMappingRule into LedgerMappingSet v1.
 *
 * Prefer IfrsMappingRule on NAS-source conflicts. Conflicting orgs stay DRAFT;
 * clean orgs are PUBLISHED.
 *
 * Usage (from era-finance-core root):
 *   dotenv -e .env -o -- npm run db:migrate-legacy-ifrs-mapping
 */
import {
  LedgerMappingSetStatus,
  LedgerType,
} from "@prisma/client";
import { closePrismaPool, createPrismaClient } from "../../../prisma-client";

const prisma = createPrismaClient();
const CODE = "NAS_TO_IFRS";

type Pair = {
  sourceAccountId: string;
  targetAccountId: string;
  ratio: string;
  from: "rule" | "mapping";
};

async function migrateOrg(organizationId: string): Promise<{
  organizationId: string;
  published: boolean;
  conflicts: number;
  lines: number;
}> {
  const existing = await prisma.ledgerMappingSet.findFirst({
    where: { organizationId, code: CODE },
  });
  if (existing) {
    return {
      organizationId,
      published: existing.status === LedgerMappingSetStatus.PUBLISHED,
      conflicts: 0,
      lines: 0,
    };
  }

  const [rules, mappings, nasAccounts, ifrsAccounts] = await Promise.all([
    prisma.ifrsMappingRule.findMany({
      where: { organizationId, isActive: true, deletedAt: null },
    }),
    prisma.accountMapping.findMany({
      where: { organizationId, deletedAt: null },
    }),
    prisma.account.findMany({
      where: { organizationId, ledgerType: LedgerType.NAS, deletedAt: null },
      select: { id: true, code: true },
    }),
    prisma.account.findMany({
      where: { organizationId, ledgerType: LedgerType.IFRS, deletedAt: null },
      select: { id: true, code: true },
    }),
  ]);

  const nasByCode = new Map(nasAccounts.map((a) => [a.code, a.id]));
  const ifrsByCode = new Map(ifrsAccounts.map((a) => [a.code, a.id]));

  const bySource = new Map<string, Pair>();
  const conflicts: Array<{ sourceAccountId: string }> = [];

  for (const r of rules) {
    const src = nasByCode.get(r.sourceNasAccountCode);
    const tgt = ifrsByCode.get(r.targetIfrsAccountCode);
    if (!src || !tgt) continue;
    bySource.set(src, {
      sourceAccountId: src,
      targetAccountId: tgt,
      ratio: "1",
      from: "rule",
    });
  }

  for (const m of mappings) {
    const existingPair = bySource.get(m.nasAccountId);
    if (existingPair) {
      if (existingPair.targetAccountId !== m.ifrsAccountId) {
        conflicts.push({ sourceAccountId: m.nasAccountId });
        // Prefer rule (already in map)
      }
      continue;
    }
    bySource.set(m.nasAccountId, {
      sourceAccountId: m.nasAccountId,
      targetAccountId: m.ifrsAccountId,
      ratio: m.ratio.toString(),
      from: "mapping",
    });
  }

  const lines = [...bySource.values()];
  const publish = conflicts.length === 0 && lines.length > 0;

  const set = await prisma.ledgerMappingSet.create({
    data: {
      organizationId,
      code: CODE,
      version: 1,
      status: publish
        ? LedgerMappingSetStatus.PUBLISHED
        : LedgerMappingSetStatus.DRAFT,
      publishedAt: publish ? new Date() : null,
      lines: {
        create: lines.map((l) => ({
          sourceAccountId: l.sourceAccountId,
          targetAccountId: l.targetAccountId,
          ratio: l.ratio,
          sortOrder: 0,
        })),
      },
    },
  });

  if (conflicts.length > 0) {
    console.warn(
      JSON.stringify({
        organizationId,
        setId: set.id,
        conflicts: conflicts.length,
        note: "left DRAFT due to rule vs AccountMapping target conflict",
      }),
    );
  }

  return {
    organizationId,
    published: publish,
    conflicts: conflicts.length,
    lines: lines.length,
  };
}

async function main() {
  const orgs = await prisma.organization.findMany({
    where: { isDeleted: false },
    select: { id: true },
  });
  const report = [];
  for (const org of orgs) {
    report.push(await migrateOrg(org.id));
  }
  console.log(JSON.stringify({ orgs: report.length, report }, null, 2));
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
    await closePrismaPool();
  });
