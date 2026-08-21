import { Prisma, PrismaClient } from '@prisma/client';
import {
  asSatellitePrisma,
  createSatelliteTenantExtension,
  type SatellitePrisma,
} from '@era/satellite-kit/tenancy';

type AppPrisma = SatellitePrisma<PrismaClient>;

const globalForPrisma = globalThis as unknown as {
  prisma: AppPrisma | undefined;
};

function createClient(): AppPrisma {
  const base = new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
  });
  // Fail-closed tenant filter via kit; ERA_SKIP_TENANT_FILTER=1 for seeds only.
  // $extends returns a narrowed client; cast through PrismaClient then SatellitePrisma.
  return asSatellitePrisma(
    base.$extends(createSatelliteTenantExtension(Prisma as never) as never) as unknown as PrismaClient,
  );
}

export const prisma = globalForPrisma.prisma ?? createClient();

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}
