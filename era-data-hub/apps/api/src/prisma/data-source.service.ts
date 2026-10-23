import { Injectable } from "@nestjs/common";
import type { PrismaClient as HubClient } from "@era/data-hub-database";
import { PrismaHubService } from "./prisma-hub.service";

/** Registry reads always use era_data_hub. */
export type ReferenceDb = HubClient;

@Injectable()
export class DataSourceService {
  constructor(private readonly hub: PrismaHubService) {}

  referenceDb(): ReferenceDb {
    return this.hub;
  }

  hubDb(): HubClient {
    return this.hub;
  }
}
