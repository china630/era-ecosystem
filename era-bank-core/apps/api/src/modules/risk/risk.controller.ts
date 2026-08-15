import { Body, Controller, Get, Param, Post, Query, Req, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { IsBoolean, IsDateString, IsNumber, IsOptional, IsString } from "class-validator";
import { OpRiskEventStatus } from "@era/bank-core-database";
import { BankAuthGuard, type BankAuthRequest } from "../../auth/bank-auth.guard";
import { RiskService } from "./risk.service";

class EclRunDto {
  @IsOptional()
  @IsString()
  asOfDate?: string;

  @IsOptional()
  @IsBoolean()
  runStagingFirst?: boolean;

  @IsOptional()
  @IsString()
  methodology?: "STAGE_FLAT" | "PD_LGD";
}

class IrrbbInputDto {
  @IsDateString()
  asOfDate!: string;

  @IsString()
  bucketKey!: string;

  @IsString()
  amountMinor!: string;

  @IsNumber()
  rateBps!: number;
}

class OpRiskDto {
  @IsDateString()
  eventDate!: string;

  @IsString()
  amountMinor!: string;

  @IsString()
  category!: string;

  @IsString()
  description!: string;
}

@ApiTags("risk")
@ApiBearerAuth("service-token")
@UseGuards(BankAuthGuard)
@Controller("risk")
export class RiskController {
  constructor(private readonly risk: RiskService) {}

  @Get("dashboard")
  dashboard() {
    return this.risk.dashboard();
  }

  @Get("exposures")
  exposures() {
    return this.risk.exposures();
  }

  @Get("collateral")
  collateral() {
    return this.risk.collateral();
  }

  @Post("staging/run")
  stagingRun() {
    return this.risk.stagingRun();
  }

  @Get("ecl/last")
  lastEcl() {
    return this.risk.lastEclRun();
  }

  @Post("ecl/run")
  runEcl(@Body() body: EclRunDto, @Req() req: BankAuthRequest) {
    return this.risk.runEcl({
      asOfDate: body?.asOfDate ? new Date(body.asOfDate) : undefined,
      runStagingFirst: body?.runStagingFirst,
      methodology: body?.methodology,
      makerUserId: req.userId ?? "risk-system",
    });
  }

  @Post("ecl/:id/provision-approve")
  provisionApprove(@Param("id") id: string, @Req() req: BankAuthRequest) {
    return this.risk.postProvisionsApprove(id, req.userId ?? "service");
  }

  @Post("ecl/:id/provision-reject")
  provisionReject(@Param("id") id: string, @Req() req: BankAuthRequest) {
    return this.risk.postProvisionsReject(id, req.userId ?? "service");
  }

  @Get("lcr")
  lcr() {
    return this.risk.lcr();
  }

  @Get("nsfr")
  nsfr() {
    return this.risk.nsfr();
  }

  @Get("rwa")
  rwa() {
    return this.risk.lastRwa();
  }

  @Get("capital-adequacy")
  capital(@Query("withNsfr") withNsfr?: string) {
    if (withNsfr === "1" || withNsfr === "true") {
      return this.risk.capitalWithNsfr();
    }
    return this.risk.lastCar();
  }

  @Post("capital/run")
  runCapital(@Body() body?: { asOfDate?: string }) {
    return this.risk.runCapital(
      body?.asOfDate ? new Date(body.asOfDate) : undefined,
    );
  }

  @Get("large-exposures")
  largeExposures() {
    return this.risk.largeExposures();
  }

  @Get("irrbb/inputs")
  irrbbInputs(@Query("asOfDate") asOfDate?: string) {
    return this.risk.listIrrbbInputs(
      asOfDate ? new Date(asOfDate) : undefined,
    );
  }

  @Post("irrbb/inputs")
  upsertIrrbb(@Body() dto: IrrbbInputDto) {
    return this.risk.upsertIrrbbInput({
      asOfDate: new Date(dto.asOfDate),
      bucketKey: dto.bucketKey,
      amountMinor: BigInt(dto.amountMinor),
      rateBps: dto.rateBps,
    });
  }

  @Get("oprisk/events")
  opRiskEvents(@Query("status") status?: OpRiskEventStatus) {
    return this.risk.listOpRiskEvents(status);
  }

  @Post("oprisk/events")
  createOpRisk(@Body() dto: OpRiskDto) {
    return this.risk.createOpRiskEvent({
      eventDate: new Date(dto.eventDate),
      amountMinor: BigInt(dto.amountMinor),
      category: dto.category,
      description: dto.description,
    });
  }

  @Post("oprisk/events/:id/close")
  closeOpRisk(@Param("id") id: string) {
    return this.risk.closeOpRiskEvent(id);
  }

  @Get("irrbb/gap")
  irrbbGap(@Query("asOfDate") asOfDate?: string, @Query("shockBps") shockBps?: string) {
    return this.risk.irrbbGap(
      asOfDate ? new Date(asOfDate) : undefined,
      shockBps ? Number(shockBps) : undefined,
    );
  }

  @Get("oprisk/capital-addon")
  opRiskAddon(@Query("status") status?: OpRiskEventStatus) {
    return this.risk.opRiskCapitalAddon(status);
  }

  @Get("certification-pack")
  certificationPack() {
    return this.risk.certificationPack();
  }
}
