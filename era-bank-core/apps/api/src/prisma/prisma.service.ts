import { Injectable, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { Prisma, PrismaClient } from "@era/bank-core-database";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import {
  asSatellitePrisma,
  createSatelliteTenantExtension,
  setRuntimeOrganizationId,
  type SatellitePrisma,
} from "@era/satellite-kit";

type ExtendedClient = SatellitePrisma<PrismaClient> & { __pool: Pool };

function buildClient(): ExtendedClient {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is required for era-bank-core");
  const pool = new Pool({ connectionString: url });
  const adapter = new PrismaPg(pool as unknown as never);
  const base = new PrismaClient({ adapter });
  const client = asSatellitePrisma(
    base.$extends(
      createSatelliteTenantExtension(Prisma as never) as never,
    ) as unknown as PrismaClient,
  ) as ExtendedClient;
  client.__pool = pool;
  return client;
}

const ExtendedPrismaClient = class {
  constructor() {
    // Nest + Prisma $extends: constructor returns the extended client.
    // eslint-disable-next-line no-constructor-return
    return buildClient();
  }
} as new () => ExtendedClient;

@Injectable()
export class PrismaService
  extends ExtendedPrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  constructor() {
    super();
    const bankOrg =
      process.env.ERA_BANK_ORGANIZATION_ID?.trim() ||
      process.env.ERA_SATELLITE_ORGANIZATION_ID?.trim();
    if (bankOrg) setRuntimeOrganizationId(bankOrg);
  }

  async onModuleInit() {
    await this.$connect();
  }

  async onModuleDestroy() {
    await this.$disconnect();
    await this.__pool.end();
  }
}
