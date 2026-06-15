import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

@Injectable()
export class BankOrgConfig {
  readonly bankOrgId: string;

  constructor(config: ConfigService) {
    const id = config.get<string>("ERA_BANK_ORGANIZATION_ID")?.trim();
    if (!id) {
      throw new Error("ERA_BANK_ORGANIZATION_ID is required");
    }
    this.bankOrgId = id;
  }
}
