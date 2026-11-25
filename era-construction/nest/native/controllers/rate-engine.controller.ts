import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Put,
  Query,
  Req,
  UseGuards,
} from "@nestjs/common";
import { z } from "zod";
import {
  applyRateToEstimateDocument,
  calcRate,
  createRateBase,
  getRateBase,
  listRateBases,
  RATE_ITEM_KINDS,
  upsertRateItem,
} from "@/lib/rate-engine.service";
import { platformConstructionMaterialsList } from "@era/satellite-kit";
import { requestOrganizationId } from "@/lib/request-organization";
import type { StaffSession } from "@/lib/api-utils";
import { Staff } from "../decorators/staff-session.decorator";
import { ConstructionStaffGuard } from "../guards/staff.guard";
import { assertOk } from "../filters/construction-exception.filter";
import { withStaffTenant } from "../tenant";
import type { ConstructionRequest } from "../session";

const createBaseSchema = z.object({
  code: z.string().min(1).max(64),
  title: z.string().min(1).max(200),
  version: z.number().int().positive().optional(),
  notes: z.string().max(2000).optional(),
});

const itemSchema = z.object({
  code: z.string().min(1).max(64),
  title: z.string().min(1).max(500),
  unit: z.string().max(32).optional(),
  kind: z.enum(RATE_ITEM_KINDS).optional(),
  unitAmount: z.number().positive(),
  materialCode: z.string().max(64).nullable().optional(),
  compositionJson: z.string().max(20_000).optional(),
  sortOrder: z.number().int().optional(),
});

const calcSchema = z.object({
  rateItemId: z.string().min(1).max(64),
  qty: z.number().positive(),
});

const applySchema = z.object({
  documentId: z.string().min(1).max(64),
  rateItemId: z.string().min(1).max(64),
  qty: z.number().positive(),
  itemCode: z.string().max(64).optional(),
});

@Controller("api")
@UseGuards(ConstructionStaffGuard)
export class RateEngineController {
  @Get("rate-bases")
  list(
    @Req() req: ConstructionRequest,
    @Staff() session: StaffSession,
  ) {
    return withStaffTenant(req, session, async () => {
      const result = await listRateBases();
      return assertOk(result);
    });
  }

  @Post("rate-bases")
  create(
    @Req() req: ConstructionRequest,
    @Staff() session: StaffSession,
    @Body() body: unknown,
  ) {
    return withStaffTenant(req, session, async () => {
      const parsed = createBaseSchema.parse(body ?? {});
      const result = await createRateBase(parsed);
      return assertOk(result).rateBase;
    });
  }

  @Get("rate-bases/:id")
  getOne(
    @Req() req: ConstructionRequest,
    @Staff() session: StaffSession,
    @Param("id") id: string,
  ) {
    return withStaffTenant(req, session, async () => {
      const result = await getRateBase(id);
      return assertOk(result).rateBase;
    });
  }

  @Put("rate-bases/:id/items")
  upsertItem(
    @Req() req: ConstructionRequest,
    @Staff() session: StaffSession,
    @Param("id") id: string,
    @Body() body: unknown,
  ) {
    return withStaffTenant(req, session, async () => {
      const parsed = itemSchema.parse(body ?? {});
      const result = await upsertRateItem(id, parsed);
      return assertOk(result).item;
    });
  }

  @Get("rate-engine/materials")
  materials(
    @Req() req: ConstructionRequest,
    @Staff() session: StaffSession,
    @Query("q") q?: string,
  ) {
    return withStaffTenant(req, session, async () => {
      const page = await platformConstructionMaterialsList(
        { q },
        { organizationId: session.organizationId || requestOrganizationId() },
      );
      return {
        materials: page?.materials ?? [],
        meta: page?.meta ?? null,
        hubAvailable: Boolean(page),
      };
    });
  }

  @Post("rate-engine/calc")
  calc(
    @Req() req: ConstructionRequest,
    @Staff() session: StaffSession,
    @Body() body: unknown,
  ) {
    return withStaffTenant(req, session, async () => {
      const parsed = calcSchema.parse(body ?? {});
      const result = await calcRate(parsed);
      return assertOk(result).calc;
    });
  }

  @Post("rate-engine/apply")
  apply(
    @Req() req: ConstructionRequest,
    @Staff() session: StaffSession,
    @Body() body: unknown,
  ) {
    return withStaffTenant(req, session, async () => {
      const parsed = applySchema.parse(body ?? {});
      const result = await applyRateToEstimateDocument(parsed);
      return assertOk(result);
    });
  }
}
