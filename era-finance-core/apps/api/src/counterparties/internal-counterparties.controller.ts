import { Body, Controller, Get, Headers, Post, Query, UnauthorizedException, NotFoundException } from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";
import { z } from "zod";
import { assertEnvServiceToken } from "@era/satellite-kit";
import { Public } from "../auth/decorators/public.decorator";
import { OrganizationId } from "../common/org-id.decorator";
import { PrismaService } from "../prisma/prisma.service";
import { CounterpartiesService } from "./counterparties.service";
import { blindIndex, normalizeVoen } from "../security/pii-crypto.util";

const findByVoenQuerySchema = z.object({
  taxId: z.string().min(1),
});

const findOrCreateBodySchema = z.object({
  taxId: z.string().min(1),
  nameFallback: z.string().min(1),
});

@ApiTags("internal")
@Controller("internal/v1/counterparties")
@Public()
export class InternalCounterpartiesController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly counterparties: CounterpartiesService,
  ) {}

  private authorize(authorization?: string, xServiceToken?: string) {
    const auth = assertEnvServiceToken({
      expectedEnvKeys: [
        "SATELLITE_EVENT_SERVICE_TOKEN",
        "CONTROL_PLANE_SERVICE_TOKEN",
        "ORCHESTRATOR_INTERNAL_SERVICE_TOKEN",
        "FINANCE_INTERNAL_SERVICE_TOKEN",
      ],
      authorization,
      xServiceToken,
    });
    if (!auth.ok) {
      throw new UnauthorizedException(auth.error);
    }
  }

  @Get("by-voen")
  @ApiOperation({ summary: "Lookup local counterparty by VÖEN (read-only; no create)" })
  async findByVoen(
    @OrganizationId() organizationId: string,
    @Query() q: { taxId?: string },
    @Headers("authorization") authorization?: string,
    @Headers("x-service-token") xServiceToken?: string,
  ) {
    this.authorize(authorization, xServiceToken);

    const parsed = findByVoenQuerySchema.parse(q);
    const voen = parsed.taxId.trim();
    const normalized = normalizeVoen(voen);
    if (!/^\d{10}$/.test(normalized)) {
      throw new NotFoundException("Invalid VÖEN");
    }

    const taxIdBlindIndex = blindIndex("voen", normalized);
    const row = await this.prisma.counterparty.findFirst({
      where: { organizationId, taxIdBlindIndex, deletedAt: null },
      select: { id: true },
    });
    if (!row) {
      throw new NotFoundException("Counterparty not found for VOEN");
    }
    return { id: row.id, taxId: normalized };
  }

  @Post("find-or-create-by-voen")
  @ApiOperation({ summary: "Find or create local counterparty by VÖEN (internal)" })
  async findOrCreateByVoen(
    @OrganizationId() organizationId: string,
    @Body() body: unknown,
    @Headers("authorization") authorization?: string,
    @Headers("x-service-token") xServiceToken?: string,
  ) {
    this.authorize(authorization, xServiceToken);

    const parsed = findOrCreateBodySchema.parse(body);
    const cp = await this.counterparties.findOrCreateByVoen({
      organizationId,
      taxId: parsed.taxId,
      nameFallback: parsed.nameFallback,
    });

    return { id: cp.id, taxId: normalizeVoen(parsed.taxId.trim()) };
  }
}

