import { Body, Controller, Get, Headers, Post, UnauthorizedException } from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";
import { assertEnvServiceToken } from "@era/satellite-kit";
import { Public } from "../auth/decorators/public.decorator";
import { IsArray, IsNumber, IsOptional, IsString, MinLength, ValidateNested } from "class-validator";
import { Type } from "class-transformer";
import { OrganizationId } from "../common/org-id.decorator";
import { IndustryHandoffsService } from "./industry-handoffs.service";

class ClinicServiceLineDto {
  @IsString()
  @MinLength(1)
  code!: string;

  @IsString()
  @MinLength(1)
  name!: string;

  @IsNumber()
  amount!: number;

  @IsOptional()
  @IsString()
  revenueAccountCode?: string;
}

class ClinicServiceCatalogDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ClinicServiceLineDto)
  services!: ClinicServiceLineDto[];
}

function authorize(authorization?: string, xServiceToken?: string) {
  const auth = assertEnvServiceToken({
    expectedEnvKeys: [
      "SATELLITE_EVENT_SERVICE_TOKEN",
      "FINANCE_INTERNAL_SERVICE_TOKEN",
      "FINANCE_SERVICE_TOKEN",
    ],
    authorization,
    xServiceToken,
  });
  if (!auth.ok) throw new UnauthorizedException(auth.error);
}

@ApiTags("industry-handoffs")
@Controller("industry-handoffs")
export class IndustryHandoffsClinicController {
  constructor(private readonly handoffs: IndustryHandoffsService) {}

  @Get("clinic-service-catalog")
  @ApiOperation({ summary: "CLINIC channel prices for the clinic reception sync" })
  async list(
    @OrganizationId() organizationId: string,
    @Headers("authorization") authorization?: string,
    @Headers("x-service-token") xServiceToken?: string,
  ) {
    authorize(authorization, xServiceToken);
    return this.handoffs.listClinicServiceCatalog(organizationId);
  }

  @Post("clinic-service-catalog")
  @Public()
  @ApiOperation({ summary: "Create clinic procedures as finance services and return their SKU" })
  async push(
    @OrganizationId() organizationId: string,
    @Body() body: ClinicServiceCatalogDto,
    @Headers("authorization") authorization?: string,
    @Headers("x-service-token") xServiceToken?: string,
  ) {
    authorize(authorization, xServiceToken);
    return this.handoffs.pushClinicServiceCatalog(organizationId, body.services);
  }
}
