import { Injectable, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { PrismaClient } from "@erafinance/database";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";

/**
 * Read-only client for era_finance (D1). Never use primary finance DATABASE_URL for DaaS traffic.
 */
@Injectable()
export class PrismaFinanceRoService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly pool: Pool;

  constructor(config: ConfigService) {
    const url =
      config.get<string>("FINANCE_RO_DATABASE_URL")?.trim() ||
      config.get<string>("DATABASE_URL");
    if (!url) throw new Error("FINANCE_RO_DATABASE_URL is required");
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
