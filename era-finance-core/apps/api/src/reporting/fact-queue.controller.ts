import { CP_PERMISSION } from "@era/contracts";
import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Post,
  Query,
  UseGuards,
} from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { Permissions } from "../common/decorators/permissions.decorator";
import { PermissionsGuard } from "../common/guards/permissions.guard";
import { OrganizationId } from "../common/org-id.decorator";
import { ClassifyFactMeaningDto } from "./dto/classify-fact-meaning.dto";
import { FactQueueService } from "./fact-queue.service";

@ApiTags("reporting")
@ApiBearerAuth("bearer")
@Controller("reporting/fact-queue")
@UseGuards(PermissionsGuard)
export class FactQueueController {
  constructor(private readonly queue: FactQueueService) {}

  @Get()
  @Permissions(CP_PERMISSION.API_LEDGER_READ)
  @ApiOperation({
    summary: "Money lines in the month that still have no meaning",
  })
  list(
    @OrganizationId() organizationId: string,
    @Query("period") period: string,
  ) {
    const parsed = parsePeriod(period);
    return this.queue.list(organizationId, parsed.year, parsed.month);
  }

  @Post("classify")
  @Permissions(CP_PERMISSION.API_LEDGER_POST)
  @ApiOperation({
    summary: "Choose a closed meaning. Does not accept a manual journal as the meaning.",
  })
  classify(
    @OrganizationId() organizationId: string,
    @Body() dto: ClassifyFactMeaningDto,
  ) {
    return this.queue.classify(organizationId, dto);
  }
}

function parsePeriod(period: string): { year: number; month: number } {
  const match = /^(\d{4})-(0[1-9]|1[0-2])$/.exec(period?.trim() ?? "");
  if (!match) throw new BadRequestException("period must be YYYY-MM");
  return { year: Number(match[1]), month: Number(match[2]) };
}
