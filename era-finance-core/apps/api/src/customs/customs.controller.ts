import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  UseGuards,
} from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { UserRole } from "@erafinance/database";
import {
  CustomsDeclarationFullPrefillCaptureSchema,
  CustomsDeclarationPrefillCaptureSchema,
} from "@erafinance/api-contracts";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import { Roles } from "../auth/decorators/roles.decorator";
import { RolesGuard } from "../auth/guards/roles.guard";
import type { AuthUser } from "../auth/types/auth-user";
import { OrganizationId } from "../common/org-id.decorator";
import { VoenIntegrityGuard } from "../auth/guards/voen-integrity.guard";
import { RequiresModule } from "../subscription/requires-module.decorator";
import { SubscriptionGuard } from "../subscription/subscription.guard";
import { ModuleEntitlement } from "../subscription/subscription.constants";
import { AttachCustomsDeclarationDto, UpsertCustomsDeclarationDto } from "./dto/customs-declaration.dto";
import {
  AllocateLandedCostDto,
  PatchCustomsDeclarationItemDto,
  RunImportPipelineDto,
} from "./dto/landed-cost.dto";
import { CustomsService } from "./customs.service";
import { LandedCostService } from "./landed-cost.service";
import { ImportPipelineService } from "./import-pipeline.service";

@ApiTags("customs")
@ApiBearerAuth("bearer")
@Controller("customs/declarations")
@UseGuards(RolesGuard, VoenIntegrityGuard)
export class CustomsController {
  constructor(
    private readonly customs: CustomsService,
    private readonly landedCost: LandedCostService,
    private readonly importPipeline: ImportPipelineService,
  ) {}

  @Get()
  @Roles(UserRole.OWNER, UserRole.ADMIN, UserRole.ACCOUNTANT)
  list(@OrganizationId() organizationId: string) {
    return this.customs.list(organizationId);
  }

  @Post()
  @Roles(UserRole.OWNER, UserRole.ADMIN, UserRole.ACCOUNTANT)
  create(@OrganizationId() organizationId: string, @Body() dto: UpsertCustomsDeclarationDto) {
    return this.customs.create(organizationId, dto);
  }

  @Post("import-pipeline")
  @UseGuards(SubscriptionGuard)
  @RequiresModule(ModuleEntitlement.TRADE_PRO)
  @Roles(UserRole.OWNER, UserRole.ADMIN, UserRole.ACCOUNTANT)
  @ApiOperation({
    summary: "Stub import pipeline: OCR → purchase draft → BGD link → landed cost (trade_pro)",
  })
  runImportPipeline(
    @OrganizationId() organizationId: string,
    @Body() dto: RunImportPipelineDto,
  ) {
    return this.importPipeline.run(
      organizationId,
      dto.ocrJobId,
      dto.customsDeclarationId,
      dto.landedCostMethod ?? "STAT_VALUE",
    );
  }

  @Get(":id")
  @Roles(UserRole.OWNER, UserRole.ADMIN, UserRole.ACCOUNTANT)
  @ApiOperation({ summary: "Get customs declaration with line items and mismatch hints" })
  getOne(
    @OrganizationId() organizationId: string,
    @Param("id", ParseUUIDPipe) id: string,
  ) {
    return this.customs.getOne(organizationId, id);
  }

  @Post("prefill-capture")
  @UseGuards(SubscriptionGuard)
  @RequiresModule(ModuleEntitlement.TRADE_PRO)
  @Roles(UserRole.OWNER, UserRole.ADMIN, UserRole.ACCOUNTANT)
  @ApiOperation({ summary: "Create BGD draft from extension/widget capture (trade_pro)" })
  prefillCapture(
    @OrganizationId() organizationId: string,
    @Body() body: unknown,
    @CurrentUser() user: AuthUser,
  ) {
    const full = CustomsDeclarationFullPrefillCaptureSchema.safeParse(body);
    if (full.success) {
      return this.customs.createFullDraftFromCapture(organizationId, full.data, user.userId);
    }
    const flat = CustomsDeclarationPrefillCaptureSchema.safeParse(body);
    if (!flat.success) {
      throw new BadRequestException({
        full: full.error.flatten(),
        flat: flat.error.flatten(),
      });
    }
    return this.customs.createDraftFromCapture(organizationId, flat.data, user.userId);
  }

  @Post(":id/allocate-landed-cost")
  @UseGuards(SubscriptionGuard)
  @RequiresModule(ModuleEntitlement.TRADE_PRO)
  @Roles(UserRole.OWNER, UserRole.ADMIN, UserRole.ACCOUNTANT)
  @ApiOperation({ summary: "Allocate BGD duty/fees/excise to linked products (trade_pro)" })
  allocateLandedCost(
    @OrganizationId() organizationId: string,
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: AllocateLandedCostDto,
  ) {
    return this.landedCost.allocate(organizationId, id, dto.method ?? "STAT_VALUE");
  }

  @Patch(":id/items/:itemId/product")
  @UseGuards(SubscriptionGuard)
  @RequiresModule(ModuleEntitlement.TRADE_PRO)
  @Roles(UserRole.OWNER, UserRole.ADMIN, UserRole.ACCOUNTANT)
  @ApiOperation({ summary: "Link catalog product to BGD line item (trade_pro)" })
  patchItemProduct(
    @OrganizationId() organizationId: string,
    @Param("id", ParseUUIDPipe) id: string,
    @Param("itemId", ParseUUIDPipe) itemId: string,
    @Body() dto: PatchCustomsDeclarationItemDto,
  ) {
    return this.customs.patchItemProduct(organizationId, id, itemId, dto.productId);
  }

  @Patch(":id/attach")
  @Roles(UserRole.OWNER, UserRole.ADMIN, UserRole.ACCOUNTANT)
  attach(
    @OrganizationId() organizationId: string,
    @Param("id") id: string,
    @Body() dto: AttachCustomsDeclarationDto,
  ) {
    return this.customs.attach(organizationId, id, dto);
  }
}
