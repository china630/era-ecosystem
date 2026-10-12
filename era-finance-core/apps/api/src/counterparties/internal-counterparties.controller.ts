import { Body, Controller, Get, Headers, Post, Query, UnauthorizedException, NotFoundException } from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";
import { z } from "zod";
import { assertEnvServiceToken } from "@era/satellite-kit";
import { Public } from "../auth/decorators/public.decorator";
import { OrganizationId } from "../common/org-id.decorator";
import { PrismaService } from "../prisma/prisma.service";
import { runWithTenantContextAsync } from "../prisma/tenant-context";
import { CounterpartiesService } from "./counterparties.service";
import { blindIndex, encryptText, normalizeName, normalizeVoen } from "../security/pii-crypto.util";
import { CounterpartyLegalForm } from "@erafinance/database";

const findByVoenQuerySchema = z.object({
  taxId: z.string().min(1),
});

const findOrCreateBodySchema = z.object({
  taxId: z.string().min(1),
  nameFallback: z.string().min(1),
});

const cardRequestSchema = z.object({
  taxId: z.string().min(1),
  name: z.string().min(1),
  partyKind: z.enum(["COMPANY", "AGENCY"]),
  legalForm: z.nativeEnum(CounterpartyLegalForm).optional(),
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
    const row = await runWithTenantContextAsync(
      { organizationId, skipTenantFilter: false },
      () =>
        this.prisma.counterparty.findFirst({
          where: { organizationId, taxIdBlindIndex, deletedAt: null },
          select: { id: true },
        }),
    );
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
    const cp = await runWithTenantContextAsync(
      { organizationId, skipTenantFilter: false },
      () =>
        this.counterparties.findOrCreateByVoen({
          organizationId,
          taxId: parsed.taxId,
          nameFallback: parsed.nameFallback,
        }),
    );

    return { id: cp.id, taxId: normalizeVoen(parsed.taxId.trim()) };
  }

  @Post("card-requests")
  @ApiOperation({
    summary: "Queue a company or agency card when Finance has no VÖEN. Does not create the card.",
  })
  async queueCard(
    @OrganizationId() organizationId: string,
    @Body() body: unknown,
    @Headers("authorization") authorization?: string,
    @Headers("x-service-token") xServiceToken?: string,
  ) {
    this.authorize(authorization, xServiceToken);
    const parsed = cardRequestSchema.parse(body);
    const normalized = normalizeVoen(parsed.taxId.trim());
    if (!/^\d{10}$/.test(normalized)) {
      throw new NotFoundException("Invalid VÖEN");
    }
    const taxIdBlindIndex = blindIndex("voen", normalized);
    return runWithTenantContextAsync({ organizationId, skipTenantFilter: false }, async () => {
      const existing = await this.prisma.counterparty.findFirst({
        where: { organizationId, taxIdBlindIndex, deletedAt: null },
        select: { id: true },
      });
      if (existing) return { queued: false, counterpartyId: existing.id };
      await this.prisma.counterpartyCardRequest.upsert({
        where: { organizationId_taxIdBlindIndex: { organizationId, taxIdBlindIndex } },
        create: {
          organizationId,
          taxIdBlindIndex,
          taxIdCipher: encryptText(normalized),
          nameCipher: encryptText(normalizeName(parsed.name.trim())),
          partyKind: parsed.partyKind,
          legalForm: parsed.legalForm ?? CounterpartyLegalForm.LLC,
          status: "PENDING",
          source: "HOTEL",
        },
        update: {
          nameCipher: encryptText(normalizeName(parsed.name.trim())),
          partyKind: parsed.partyKind,
          legalForm: parsed.legalForm ?? CounterpartyLegalForm.LLC,
          status: "PENDING",
        },
      });
      return { queued: true };
    });
  }
}

