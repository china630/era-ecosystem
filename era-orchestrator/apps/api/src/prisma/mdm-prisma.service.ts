import { Injectable, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { PrismaClient } from "@era365/mdm-database";
import { Pool } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";

@Injectable()
export class MdmPrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  private readonly pool: Pool;

  constructor() {
    const url = process.env.MDM_DATABASE_URL ?? process.env.DATABASE_URL;
    if (!url) {
      throw new Error("MDM_DATABASE_URL (or DATABASE_URL fallback) is required");
    }
    const pool = new Pool({ connectionString: url });
    const adapter = new PrismaPg(pool as unknown as never);
    super({ adapter });
    this.pool = pool;
  }

  async onModuleInit() {
    await this.$connect();
  }

  async onModuleDestroy() {
    await this.$disconnect();
    await this.pool.end();
  }
}
