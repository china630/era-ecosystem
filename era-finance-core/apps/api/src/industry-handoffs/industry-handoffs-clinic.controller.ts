import { Body, Controller, Get, Headers, Post, UnauthorizedException } from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";
import { assertEnvServiceToken } from "@era/satellite-kit";
import { Public } from "../auth/decorators/public.decorator";
import { IsArray, IsNumber, IsOptional, IsString, MinLength, ValidateNested } from "class-validator";
import { Type } from "class-transformer";
import { OrganizationId } from "../common/org-id.decorator";
import { PrismaService } from "../prisma/prisma.service";

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
  constructor(private readonly prisma: PrismaService) {}

  @Get("clinic-service-catalog")
  @ApiOperation({ summary: "CLINIC channel prices for the clinic reception sync" })
  async list(
    @OrganizationId() organizationId: string,
    @Headers("authorization") authorization?: string,
    @Headers("x-service-token") xServiceToken?: string,
  ) {
    authorize(authorization, xServiceToken);
    const lines = await this.prisma.priceListLine.findMany({
      where: {
        organizationId,
        priceList: { organizationId, isActive: true, channel: "CLINIC" },
      },
      include: { product: true },
    });
    return {
      items: lines
        .filter((line) => line.product && !line.product.deletedAt)
        .map((line) => ({
          code: line.product.sku,
          description: line.product.name,
          amount: Number(line.unitPrice),
          sku: line.product.sku,
        })),
    };
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
    const items: Array<{ code: string; sku: string; amount: number }> = [];
    for (const service of body.services ?? []) {
      const sku = service.code.trim();
      const product = await this.prisma.product.upsert({
        where: { organizationId_sku: { organizationId, sku } },
        create: {
          organizationId,
          sku,
          name: service.name,
          price: service.amount,
          vatRate: 0,
          isService: true,
          revenueAccountCode: service.revenueAccountCode?.trim() || null,
        },
        update: {
          name: service.name,
          price: service.amount,
          isService: true,
          deletedAt: null,
        },
      });
      items.push({ code: sku, sku: product.sku, amount: service.amount });
    }
    return { items };
  }
}
