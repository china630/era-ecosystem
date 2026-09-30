import {
  BadRequestException,
  Injectable,
  ServiceUnavailableException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Prisma } from "@era365/database";
import { AuthService } from "../auth/auth.service";
import { ControlPlanePrismaService } from "../prisma/control-plane-prisma.service";
import { SatelliteEndpointRegistryService } from "../satellite-events/satellite-endpoint-registry.service";
import { SatelliteOrgBindSyncService } from "../admin/satellite-org-bind-sync.service";
import { SubscriptionAccessService } from "../subscription/subscription-access.service";
import type { KafeOnboardDto } from "./dto/kafe-onboard.dto";

const FNB_KEY = "industry_fnb_pos";

@Injectable()
export class KafeOnboardService {
  constructor(
    private readonly auth: AuthService,
    private readonly prisma: ControlPlanePrismaService,
    private readonly config: ConfigService,
    private readonly subscription: SubscriptionAccessService,
    private readonly endpoints: SatelliteEndpointRegistryService,
    private readonly bindSync: SatelliteOrgBindSyncService,
  ) {}

  private poolBaseUrl(): string {
    const keys = [
      "NEXT_PUBLIC_SATELLITE_FNB_POS_URL",
      "NEXT_PUBLIC_SATELLITE_FB_POS_URL",
      "ERA_FNB_POS_ORIGIN",
    ];
    for (const k of keys) {
      const raw = this.config.get<string>(k)?.trim() || process.env[k]?.trim();
      if (raw) return raw.replace(/\/$/, "");
    }
    throw new ServiceUnavailableException(
      "F&B SHARED pool URL is not configured (ERA_FNB_POS_ORIGIN)",
    );
  }

  async onboard(dto: KafeOnboardDto) {
    const registered = await this.auth.registerUser({
      email: dto.email,
      password: dto.password,
      firstName: dto.firstName,
      lastName: dto.lastName,
    });
    const userId = registered.user.id;
    const session = await this.auth.registerOrganizationForUser(userId, {
      name: dto.cafeName.trim(),
      taxId: dto.taxId.trim(),
    });
    const organizationId = session.claims.organizationId;
    if (!organizationId) {
      throw new BadRequestException("Organization was not created");
    }

    const extraSlugs: Record<string, boolean> = {
      [FNB_KEY]: true,
    };
    if (dto.zal) extraSlugs.fnb_waiter_pin = true;
    if (dto.kitchen) extraSlugs.fnb_kitchen_kds = true;
    if (dto.qrMenu) extraSlugs.fnb_qr_menu = true;

    await this.subscription.updateModuleAddons(organizationId, { extraSlugs });

    const priceRows = await this.prisma.pricingModule.findMany({
      where: { key: { in: Object.keys(extraSlugs).filter((k) => extraSlugs[k]) } },
    });
    const priceByKey = new Map(priceRows.map((r) => [r.key, r.pricePerMonth]));

    for (const key of Object.keys(extraSlugs)) {
      if (!extraSlugs[key]) continue;
      await this.prisma.organizationModule.upsert({
        where: { organizationId_moduleKey: { organizationId, moduleKey: key } },
        create: {
          organizationId,
          moduleKey: key,
          priceSnapshot: priceByKey.get(key) ?? new Prisma.Decimal(0),
        },
        update: {
          pendingDeactivation: false,
          cancelledAt: null,
          accessUntil: null,
          activatedAt: new Date(),
        },
      });
    }

    const settings = {
      edition: "kafe",
      signupSource: "kafe",
      hotelMode: false,
      waiterPinPacks: dto.zal ? 1 : 0,
    };

    await this.prisma.organization.update({
      where: { id: organizationId },
      data: {
        subscriptionPlan: "kafe",
        deploymentTopology: "SHARED",
        settings,
      },
    });

    const baseUrl = this.poolBaseUrl();
    await this.endpoints.upsertEndpoint({
      organizationId,
      satelliteKey: FNB_KEY,
      baseUrl,
      enabled: true,
    });

    try {
      await this.bindSync.syncForOrg(organizationId);
    } catch {
      // Pool bind is best-effort; org+endpoint already exist.
    }

    await this.bootstrapFnbOwner(organizationId, dto, extraSlugs);

    const orgRow = await this.prisma.organization.findUnique({
      where: { id: organizationId },
      select: { publicOrgNumber: true },
    });

    return {
      ...session,
      kafe: {
        organizationId,
        publicOrgNumber: orgRow?.publicOrgNumber ?? null,
        satelliteKey: FNB_KEY,
        poolBaseUrl: baseUrl,
        modules: Object.keys(extraSlugs).filter((k) => extraSlugs[k]),
      },
    };
  }

  private async bootstrapFnbOwner(
    organizationId: string,
    dto: KafeOnboardDto,
    extraSlugs: Record<string, boolean>,
  ): Promise<void> {
    const resolved = await this.endpoints.resolveEndpoint(organizationId, FNB_KEY);
    const base = (resolved?.baseUrl || this.poolBaseUrl()).replace(/\/$/, "");
    const token =
      this.config.get<string>("SATELLITE_EVENT_SERVICE_TOKEN")?.trim() ||
      process.env.SATELLITE_EVENT_SERVICE_TOKEN?.trim() ||
      "";
    if (!token) {
      throw new ServiceUnavailableException(
        "SATELLITE_EVENT_SERVICE_TOKEN is required to provision the café till",
      );
    }
    const activeModules = Object.keys(extraSlugs).filter((k) => extraSlugs[k]);
    const res = await fetch(`${base}/api/internal/v1/kafe/bootstrap-owner`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        organizationId,
        email: dto.email,
        password: dto.password,
        fullName: `${dto.firstName.trim()} ${dto.lastName.trim()}`.trim(),
        cafeName: dto.cafeName.trim(),
        activeModules,
      }),
      signal: AbortSignal.timeout(
        Number(process.env.SATELLITE_FANOUT_TIMEOUT_MS ?? 15_000),
      ),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new ServiceUnavailableException(
        `F&B café bootstrap failed (${res.status}) ${text.slice(0, 120)}`.trim(),
      );
    }
  }
}
