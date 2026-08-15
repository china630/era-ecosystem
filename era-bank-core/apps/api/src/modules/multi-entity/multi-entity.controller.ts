import { Body, Controller, Get, Post, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { IsString } from "class-validator";
import { BankAuthGuard } from "../../auth/bank-auth.guard";
import {
  BankingModuleGuard,
  RequireBankingModule,
} from "../../auth/banking-module.guard";
import { MultiEntityService } from "./multi-entity.service";

class AgencyLinkDto {
  @IsString() peerBankOrgId!: string;
  @IsString() agencyType!: string;
}

@ApiTags("multi-entity")
@ApiBearerAuth()
@UseGuards(BankAuthGuard, BankingModuleGuard)
@RequireBankingModule("banking_core")
@Controller("multi-entity")
export class MultiEntityController {
  constructor(private readonly multiEntity: MultiEntityService) {}

  @Get("status")
  status() {
    return {
      multiEntityEnabled: this.multiEntity.isMultiEntityEnabled(),
      default: "single bankOrg per deployment (D5)",
    };
  }

  @Get("agency-links")
  listLinks() {
    return this.multiEntity.listAgencyLinks();
  }

  @Post("agency-links")
  createLink(@Body() body: AgencyLinkDto) {
    return this.multiEntity.createAgencyLink(body);
  }
}
