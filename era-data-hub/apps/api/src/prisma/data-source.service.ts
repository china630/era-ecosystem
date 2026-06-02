import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import type { PrismaClient as HubClient } from "@era/data-hub-database";
import { PrismaHubService } from "./prisma-hub.service";
import { PrismaFinanceRoService } from "./prisma-finance-ro.service";

/** Finance RO and hub share reference table shapes; cast for TS (dual Prisma clients). */
export type ReferenceDb = HubClient;

@Injectable()
export class DataSourceService {
  constructor(
    private readonly config: ConfigService,
    private readonly hub: PrismaHubService,
    private readonly financeRo: PrismaFinanceRoService,
  ) {}

  /** finance_ro (Phase 0) or hub (Phase 1 cutover). */
  referenceDb(): ReferenceDb {
    const mode = (this.config.get<string>("ERA_DATA_HUB_DATA_SOURCE") ?? "finance_ro")
      .trim()
      .toLowerCase();
    return (mode === "hub" ? this.hub : this.financeRo) as unknown as ReferenceDb;
  }

  /** Hub-only tables (calendar). */
  hubDb(): HubClient {
    return this.hub;
  }
}
