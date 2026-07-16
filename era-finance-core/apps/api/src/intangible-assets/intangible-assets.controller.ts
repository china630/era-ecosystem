import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  UseGuards,
} from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { UserRole } from "@erafinance/database";
import { OrganizationId } from "../common/org-id.decorator";
import { Roles } from "../auth/decorators/roles.decorator";
import { RolesGuard } from "../auth/guards/roles.guard";
import { PrismaService } from "../prisma/prisma.service";
import { RequiresModule } from "../subscription/requires-module.decorator";
import { SubscriptionGuard } from "../subscription/subscription.guard";
import { ModuleEntitlement } from "../subscription/subscription.constants";
import { CreateIntangibleAssetDto } from "./dto/create-intangible-asset.dto";
import {
  AcquireIntangibleAssetDto,
  DisposeIntangibleAssetDto,
} from "./dto/intangible-lifecycle.dto";
import { RunIntangibleAmortizationDto } from "./dto/run-intangible-amortization.dto";
import { IntangibleAmortizationService } from "./intangible-amortization.service";
import { IntangibleAssetsService } from "./intangible-assets.service";

@ApiTags("intangible-assets")
@ApiBearerAuth("bearer")
@UseGuards(SubscriptionGuard)
@RequiresModule(ModuleEntitlement.FIXED_ASSETS)
@Controller("intangible-assets")
export class IntangibleAssetsController {
  constructor(
    private readonly assets: IntangibleAssetsService,
    private readonly amortization: IntangibleAmortizationService,
    private readonly prisma: PrismaService,
  ) {}

  @Get()
  @ApiOperation({ summary: "List intangible assets" })
  list(@OrganizationId() organizationId: string) {
    return this.assets.list(organizationId);
  }

  @Post()
  @UseGuards(RolesGuard)
  @Roles(UserRole.OWNER, UserRole.ADMIN, UserRole.ACCOUNTANT)
  @ApiOperation({ summary: "Create intangible asset register entry" })
  create(
    @OrganizationId() organizationId: string,
    @Body() dto: CreateIntangibleAssetDto,
  ) {
    return this.assets.create(organizationId, dto);
  }

  @Post("run-amortization")
  @UseGuards(RolesGuard)
  @Roles(UserRole.OWNER, UserRole.ADMIN, UserRole.ACCOUNTANT)
  @ApiOperation({ summary: "Run monthly intangible amortization for a period" })
  runAmortization(
    @OrganizationId() organizationId: string,
    @Query() query: RunIntangibleAmortizationDto,
  ) {
    return this.prisma.$transaction((tx) =>
      this.amortization.applyForClosedMonth(
        tx,
        organizationId,
        query.year,
        query.month,
      ),
    );
  }

  @Get(":id")
  @ApiOperation({ summary: "Get intangible asset by id" })
  getOne(
    @OrganizationId() organizationId: string,
    @Param("id", ParseUUIDPipe) id: string,
  ) {
    return this.assets.getOne(organizationId, id);
  }

  @Delete(":id")
  @UseGuards(RolesGuard)
  @Roles(UserRole.OWNER, UserRole.ADMIN, UserRole.ACCOUNTANT)
  @ApiOperation({ summary: "Delete intangible asset" })
  remove(
    @OrganizationId() organizationId: string,
    @Param("id", ParseUUIDPipe) id: string,
  ) {
    return this.assets.remove(organizationId, id);
  }

  @Post(":id/acquire")
  @UseGuards(RolesGuard)
  @Roles(UserRole.OWNER, UserRole.ADMIN, UserRole.ACCOUNTANT)
  @ApiOperation({ summary: "Capitalize intangible asset (Dt 131 / Cr supplier or bank)" })
  acquire(
    @OrganizationId() organizationId: string,
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: AcquireIntangibleAssetDto,
  ) {
    return this.prisma.$transaction((tx) =>
      this.amortization.acquireInTransaction(tx, organizationId, id, dto),
    );
  }

  @Post(":id/dispose")
  @UseGuards(RolesGuard)
  @Roles(UserRole.OWNER, UserRole.ADMIN, UserRole.ACCOUNTANT)
  @ApiOperation({ summary: "Dispose intangible asset" })
  dispose(
    @OrganizationId() organizationId: string,
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: DisposeIntangibleAssetDto,
  ) {
    return this.prisma.$transaction((tx) =>
      this.amortization.disposeInTransaction(tx, organizationId, id, dto),
    );
  }
}
