import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from "@nestjs/common";
import {
  Prisma,
  seedSiteCatalog,
  seedSiteArchitectureEdges,
  ensureAutoArchitectureEdges,
  type SiteCatalogMaturity,
  type SiteCatalogVisibility,
  type SiteIndustryItemRole,
} from "@era365/database";
import { PrismaService } from "../prisma/prisma.service";
import { SystemConfigService } from "../system-config/system-config.service";

type LocaleMap = { az?: string; ru?: string; en?: string };

function asLocaleMap(value: unknown): LocaleMap {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const o = value as Record<string, unknown>;
  return {
    ...(typeof o.az === "string" ? { az: o.az } : {}),
    ...(typeof o.ru === "string" ? { ru: o.ru } : {}),
    ...(typeof o.en === "string" ? { en: o.en } : {}),
  };
}

function pickLocale(map: LocaleMap, locale?: string): string {
  const loc = (locale ?? "").toLowerCase();
  if (loc === "en" && map.en) return map.en;
  if (loc === "ru" && map.ru) return map.ru;
  if (loc === "az" && map.az) return map.az;
  return map.az || map.ru || map.en || "";
}

@Injectable()
export class SiteCatalogService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly systemConfig: SystemConfigService,
  ) {}

  private async ensureSeeded() {
    const n = await this.prisma.satellitePublicProfile.count();
    if (n === 0) {
      await seedSiteCatalog(this.prisma);
      return;
    }
    const edges = await this.prisma.siteArchitectureEdge.count();
    if (edges === 0) {
      await seedSiteArchitectureEdges(this.prisma);
      await ensureAutoArchitectureEdges(this.prisma);
    }
  }

  private async bumpCatalogCache() {
    const raw = await this.systemConfig.getJson("site.catalog_cache_version");
    const current =
      typeof raw === "number"
        ? raw
        : typeof raw === "string"
          ? Number.parseInt(raw, 10) || 0
          : 0;
    await this.systemConfig.setJson("site.catalog_cache_version", current + 1);
  }

  private resolveIndustryMaturity(
    override: SiteCatalogMaturity | null,
    items: Array<{
      role: SiteIndustryItemRole;
      satellite: { publicProfile: { maturity: SiteCatalogMaturity } | null };
      moduleKey: string;
    }>,
    moduleMaturityByKey: Map<string, SiteCatalogMaturity | null>,
  ): SiteCatalogMaturity {
    if (override) return override;
    for (const item of items) {
      if (item.role !== "C") continue;
      if (item.moduleKey) {
        const m = moduleMaturityByKey.get(item.moduleKey);
        if (m === "pilot") return "pilot";
      }
      if (item.satellite.publicProfile?.maturity === "pilot") return "pilot";
    }
    return "prod";
  }

  async getPublicCatalog(locale?: string) {
    await this.ensureSeeded();
    const [profiles, modules, industries, moduleProfiles, edgeRows] =
      await Promise.all([
      this.prisma.satellitePublicProfile.findMany({
        where: { visibility: "VISIBLE", showOnSite: true },
        include: { satellite: { select: { key: true, name: true } } },
        orderBy: [{ sortOrder: "asc" }, { publicSlug: "asc" }],
      }),
      this.prisma.pricingModule.findMany({
        where: {
          publicProfile: { is: { visibility: "VISIBLE" } },
        },
        include: { publicProfile: true },
        orderBy: [{ sortOrder: "asc" }, { key: "asc" }],
      }),
      this.prisma.siteIndustry.findMany({
        where: { visibility: "VISIBLE" },
        include: {
          items: {
            orderBy: { sortOrder: "asc" },
            include: {
              satellite: {
                select: {
                  key: true,
                  name: true,
                  publicProfile: true,
                },
              },
            },
          },
        },
        orderBy: [{ sortOrder: "asc" }, { slug: "asc" }],
      }),
      this.prisma.pricingModulePublicProfile.findMany({
        select: { moduleKey: true, maturity: true },
      }),
      this.prisma.siteArchitectureEdge.findMany({
        where: { visibility: "VISIBLE" },
        orderBy: [{ sortOrder: "asc" }, { fromKey: "asc" }, { toKey: "asc" }],
      }),
    ]);

    const moduleMaturity = new Map(
      moduleProfiles.map((m) => [m.moduleKey, m.maturity]),
    );

    const satellites = profiles.map((p) => {
      const names = asLocaleMap(p.names);
      const descriptions = asLocaleMap(p.descriptions);
      const tagline = asLocaleMap(p.tagline);
      return {
        satelliteKey: p.satelliteKey,
        publicSlug: p.publicSlug,
        kind: p.kind,
        maturity: p.maturity,
        sortOrder: p.sortOrder,
        imageUrl: p.imageUrl,
        name: pickLocale(names, locale) || p.satellite.name,
        description: pickLocale(descriptions, locale),
        tagline: pickLocale(tagline, locale),
        names,
        descriptions,
        taglineLocales: tagline,
        body: asLocaleMap(p.body),
        modules: modules
          .filter((m) => m.satelliteKey === p.satelliteKey)
          .map((m) => this.serializeModule(m, locale)),
      };
    });

    const industryItems = industries.map((ind) => {
      const names = asLocaleMap(ind.names);
      const descriptions = asLocaleMap(ind.descriptions);
      const maturity = this.resolveIndustryMaturity(
        ind.maturityOverride,
        ind.items,
        moduleMaturity,
      );
      return {
        slug: ind.slug,
        maturity,
        sortOrder: ind.sortOrder,
        imageUrl: ind.imageUrl,
        name: pickLocale(names, locale) || ind.slug,
        description: pickLocale(descriptions, locale),
        names,
        descriptions,
        body: asLocaleMap(ind.body),
        calcPrefill: ind.calcPrefill,
        items: ind.items
          .filter((it) => {
            const vis = it.satellite.publicProfile?.visibility;
            return !vis || vis === "VISIBLE";
          })
          .map((it) => {
            const sp = it.satellite.publicProfile;
            const namesSp = asLocaleMap(sp?.names);
            let itemMaturity = sp?.maturity ?? ("prod" as SiteCatalogMaturity);
            if (it.moduleKey) {
              const mm = moduleMaturity.get(it.moduleKey);
              if (mm) itemMaturity = mm;
            }
            return {
              satelliteKey: it.satelliteKey,
              moduleKey: it.moduleKey || null,
              role: it.role,
              sortOrder: it.sortOrder,
              publicSlug: sp?.publicSlug ?? null,
              name:
                pickLocale(namesSp, locale) ||
                it.satellite.name ||
                it.satelliteKey,
              maturity: itemMaturity,
            };
          }),
      };
    });

    const edges = edgeRows.map((e) => {
      const labels = asLocaleMap(e.labels);
      return {
        fromKey: e.fromKey,
        toKey: e.toKey,
        kind: e.kind,
        realizationStatus: e.realizationStatus,
        sortOrder: e.sortOrder,
        label: pickLocale(labels, locale),
        labels,
      };
    });

    const cacheVersion = await this.systemConfig.getJson(
      "site.catalog_cache_version",
    );

    const asStr = async (key: string, fallback = "") => {
      const raw = await this.systemConfig.getJson(key);
      return typeof raw === "string" && raw.trim() ? raw.trim() : fallback;
    };
    const contactPhone = await asStr("site.contact_phone", "+994 77 350 70 70");
    const contactPhoneE164 = await asStr(
      "site.contact_phone_e164",
      "+994773507070",
    );
    const contactEmail = await asStr(
      "site.contact_email",
      "chingiz@era-365.online",
    );
    const contactAddress = await asStr("site.contact_address");
    const legalName = await asStr("site.legal_name");
    const voen = await asStr("site.voen");

    return {
      cacheVersion: typeof cacheVersion === "number" ? cacheVersion : 0,
      satellites,
      industries: industryItems,
      edges,
      contact: {
        phoneDisplay: contactPhone,
        phoneE164: contactPhoneE164,
        whatsappUrl: `https://wa.me/${contactPhoneE164.replace(/\D/g, "")}`,
        email: contactEmail,
        address: contactAddress.trim() || null,
        legalName: legalName.trim() || null,
        voen: voen.trim() || null,
      },
    };
  }

  async listAdminEdges() {
    await this.ensureSeeded();
    return this.prisma.siteArchitectureEdge.findMany({
      orderBy: [{ sortOrder: "asc" }, { fromKey: "asc" }],
    });
  }

  async patchEdge(
    id: string,
    dto: {
      realizationStatus?: "live" | "partial" | "planned";
      visibility?: SiteCatalogVisibility;
      labels?: LocaleMap;
      sortOrder?: number;
      autoManaged?: boolean;
    },
  ) {
    const existing = await this.prisma.siteArchitectureEdge.findUnique({
      where: { id },
    });
    if (!existing) throw new NotFoundException(`edge ${id}`);
    const row = await this.prisma.siteArchitectureEdge.update({
      where: { id },
      data: {
        ...(dto.realizationStatus !== undefined
          ? { realizationStatus: dto.realizationStatus }
          : {}),
        ...(dto.visibility !== undefined ? { visibility: dto.visibility } : {}),
        ...(dto.labels !== undefined
          ? { labels: dto.labels as Prisma.InputJsonValue }
          : {}),
        ...(dto.sortOrder !== undefined ? { sortOrder: dto.sortOrder } : {}),
        ...(dto.autoManaged !== undefined
          ? { autoManaged: dto.autoManaged }
          : {}),
      },
    });
    await this.bumpCatalogCache();
    return row;
  }

  private serializeModule(
    m: {
      key: string;
      name: string;
      sortOrder: number;
      satelliteKey: string | null;
      publicProfile: {
        maturity: SiteCatalogMaturity | null;
        names: unknown;
        descriptions: unknown;
        tagline: unknown;
        body: unknown;
        imageUrl: string | null;
        showAsSubsection: boolean;
        sortOrder: number;
      } | null;
    },
    locale?: string,
  ) {
    const names = asLocaleMap(m.publicProfile?.names);
    const descriptions = asLocaleMap(m.publicProfile?.descriptions);
    return {
      key: m.key,
      satelliteKey: m.satelliteKey,
      sortOrder: m.publicProfile?.sortOrder ?? m.sortOrder,
      maturity: m.publicProfile?.maturity ?? null,
      imageUrl: m.publicProfile?.imageUrl ?? null,
      showAsSubsection: m.publicProfile?.showAsSubsection ?? true,
      name: pickLocale(names, locale) || m.name,
      description: pickLocale(descriptions, locale),
      names,
      descriptions,
      tagline: asLocaleMap(m.publicProfile?.tagline),
      body: asLocaleMap(m.publicProfile?.body),
    };
  }

  async getPublicSatellite(publicSlug: string, locale?: string) {
    const catalog = await this.getPublicCatalog(locale);
    const sat = catalog.satellites.find((s) => s.publicSlug === publicSlug);
    if (!sat) throw new NotFoundException(`Product ${publicSlug} not found`);
    const relatedIndustries = catalog.industries.filter((ind) =>
      ind.items.some((it) => it.publicSlug === publicSlug),
    );
    return { ...sat, relatedIndustries, cacheVersion: catalog.cacheVersion };
  }

  async getPublicIndustry(slug: string, locale?: string) {
    const catalog = await this.getPublicCatalog(locale);
    const ind = catalog.industries.find((i) => i.slug === slug);
    if (!ind) throw new NotFoundException(`Industry ${slug} not found`);
    return { ...ind, cacheVersion: catalog.cacheVersion };
  }

  /**
   * All commercial satellites from DB + optional public profile.
   * Admin UI may only configure rows that already exist here (no invent).
   */
  async listAdminSatellites() {
    await this.ensureSeeded();
    const rows = await this.prisma.satellite.findMany({
      include: { publicProfile: true },
      orderBy: [{ sortOrder: "asc" }, { key: "asc" }],
    });
    return rows.map((s) => {
      const names = asLocaleMap(s.publicProfile?.names);
      const hasPublicContent = Boolean(
        names.az || names.ru || names.en || s.publicProfile?.body,
      );
      return {
        satelliteKey: s.key,
        commercialName: s.name,
        verticalSlug: s.verticalSlug,
        commercialSortOrder: s.sortOrder,
        profile: s.publicProfile,
        hasProfile: Boolean(s.publicProfile),
        hasPublicContent,
        onVitrine:
          s.publicProfile?.visibility === "VISIBLE" &&
          s.publicProfile?.showOnSite === true,
      };
    });
  }

  /** All pricing_modules + optional public profile (pick-from-system only). */
  async listAdminModules() {
    await this.ensureSeeded();
    const rows = await this.prisma.pricingModule.findMany({
      include: { publicProfile: true },
      orderBy: [{ sortOrder: "asc" }, { key: "asc" }],
    });
    return rows.map((m) => ({
      moduleKey: m.key,
      commercialName: m.name,
      satelliteKey: m.satelliteKey,
      commercialSortOrder: m.sortOrder,
      profile: m.publicProfile,
      hasProfile: Boolean(m.publicProfile),
    }));
  }

  async listAdminIndustries() {
    await this.ensureSeeded();
    return this.prisma.siteIndustry.findMany({
      include: { items: { orderBy: { sortOrder: "asc" } } },
      orderBy: [{ sortOrder: "asc" }, { slug: "asc" }],
    });
  }

  /** Keys allowed when composing industry bundles. */
  async listCommercialKeys() {
    await this.ensureSeeded();
    const [satellites, modules] = await Promise.all([
      this.prisma.satellite.findMany({
        select: { key: true, name: true },
        orderBy: { sortOrder: "asc" },
      }),
      this.prisma.pricingModule.findMany({
        select: { key: true, name: true, satelliteKey: true },
        orderBy: { sortOrder: "asc" },
      }),
    ]);
    return { satellites, modules };
  }

  private async ensureSatelliteProfileRow(satelliteKey: string) {
    const sat = await this.prisma.satellite.findUnique({
      where: { key: satelliteKey },
    });
    if (!sat) {
      throw new NotFoundException(
        `Satellite ${satelliteKey} not in commercial catalog`,
      );
    }
    const existing = await this.prisma.satellitePublicProfile.findUnique({
      where: { satelliteKey },
    });
    if (existing) return existing;
    const slugGuess = sat.verticalSlug || sat.key.replace(/^industry_/, "");
    return this.prisma.satellitePublicProfile.create({
      data: {
        satelliteKey,
        publicSlug: slugGuess,
        kind: sat.key.startsWith("platform_")
          ? "platform"
          : sat.key === "finance_core"
            ? "core"
            : "industry",
        visibility: "DRAFT",
        maturity: "prod",
        sortOrder: sat.sortOrder,
        names: { az: sat.name, ru: sat.name, en: sat.name },
        descriptions: {},
        tagline: {},
        body: {},
        showOnSite: false,
      },
    });
  }

  private async ensureModuleProfileRow(moduleKey: string) {
    const mod = await this.prisma.pricingModule.findUnique({
      where: { key: moduleKey },
    });
    if (!mod) {
      throw new NotFoundException(
        `Module ${moduleKey} not in commercial catalog`,
      );
    }
    const existing = await this.prisma.pricingModulePublicProfile.findUnique({
      where: { moduleKey },
    });
    if (existing) return existing;
    return this.prisma.pricingModulePublicProfile.create({
      data: {
        moduleKey,
        visibility: "VISIBLE",
        maturity: null,
        sortOrder: mod.sortOrder,
        names: { az: mod.name, ru: mod.name, en: mod.name },
        descriptions: {},
        tagline: {},
        body: {},
        showAsSubsection: true,
      },
    });
  }

  async patchSatelliteProfile(
    satelliteKey: string,
    dto: {
      publicSlug?: string;
      visibility?: SiteCatalogVisibility;
      maturity?: SiteCatalogMaturity;
      sortOrder?: number;
      names?: LocaleMap;
      descriptions?: LocaleMap;
      tagline?: LocaleMap;
      body?: LocaleMap;
      imageUrl?: string | null;
      showOnSite?: boolean;
      kind?: string;
    },
  ) {
    await this.ensureSatelliteProfileRow(satelliteKey);
    const row = await this.prisma.satellitePublicProfile.update({
      where: { satelliteKey },
      data: {
        ...(dto.publicSlug !== undefined ? { publicSlug: dto.publicSlug } : {}),
        ...(dto.visibility !== undefined ? { visibility: dto.visibility } : {}),
        ...(dto.maturity !== undefined ? { maturity: dto.maturity } : {}),
        ...(dto.sortOrder !== undefined ? { sortOrder: dto.sortOrder } : {}),
        ...(dto.names !== undefined
          ? { names: dto.names as Prisma.InputJsonValue }
          : {}),
        ...(dto.descriptions !== undefined
          ? { descriptions: dto.descriptions as Prisma.InputJsonValue }
          : {}),
        ...(dto.tagline !== undefined
          ? { tagline: dto.tagline as Prisma.InputJsonValue }
          : {}),
        ...(dto.body !== undefined
          ? { body: dto.body as Prisma.InputJsonValue }
          : {}),
        ...(dto.imageUrl !== undefined ? { imageUrl: dto.imageUrl } : {}),
        ...(dto.showOnSite !== undefined ? { showOnSite: dto.showOnSite } : {}),
        ...(dto.kind !== undefined ? { kind: dto.kind } : {}),
      },
    });
    await this.bumpCatalogCache();
    return row;
  }

  async patchModuleProfile(
    moduleKey: string,
    dto: {
      visibility?: SiteCatalogVisibility;
      maturity?: SiteCatalogMaturity | null;
      sortOrder?: number;
      names?: LocaleMap;
      descriptions?: LocaleMap;
      tagline?: LocaleMap;
      body?: LocaleMap;
      imageUrl?: string | null;
      showAsSubsection?: boolean;
    },
  ) {
    await this.ensureModuleProfileRow(moduleKey);
    const row = await this.prisma.pricingModulePublicProfile.update({
      where: { moduleKey },
      data: {
        ...(dto.visibility !== undefined ? { visibility: dto.visibility } : {}),
        ...(dto.maturity !== undefined ? { maturity: dto.maturity } : {}),
        ...(dto.sortOrder !== undefined ? { sortOrder: dto.sortOrder } : {}),
        ...(dto.names !== undefined
          ? { names: dto.names as Prisma.InputJsonValue }
          : {}),
        ...(dto.descriptions !== undefined
          ? { descriptions: dto.descriptions as Prisma.InputJsonValue }
          : {}),
        ...(dto.tagline !== undefined
          ? { tagline: dto.tagline as Prisma.InputJsonValue }
          : {}),
        ...(dto.body !== undefined
          ? { body: dto.body as Prisma.InputJsonValue }
          : {}),
        ...(dto.imageUrl !== undefined ? { imageUrl: dto.imageUrl } : {}),
        ...(dto.showAsSubsection !== undefined
          ? { showAsSubsection: dto.showAsSubsection }
          : {}),
      },
    });
    await this.bumpCatalogCache();
    return row;
  }

  private async assertCommercialItemKeys(
    items: Array<{ satelliteKey: string; moduleKey?: string }>,
  ) {
    for (const item of items) {
      const sat = await this.prisma.satellite.findUnique({
        where: { key: item.satelliteKey },
        select: { key: true },
      });
      if (!sat) {
        throw new BadRequestException(
          `Unknown satelliteKey ${item.satelliteKey} — deploy commercial catalog first`,
        );
      }
      if (item.moduleKey) {
        const mod = await this.prisma.pricingModule.findUnique({
          where: { key: item.moduleKey },
          select: { key: true },
        });
        if (!mod) {
          throw new BadRequestException(
            `Unknown moduleKey ${item.moduleKey} — deploy commercial catalog first`,
          );
        }
      }
    }
  }

  async createIndustry(dto: {
    slug: string;
    visibility?: SiteCatalogVisibility;
    maturityOverride?: SiteCatalogMaturity | null;
    sortOrder?: number;
    names?: LocaleMap;
    descriptions?: LocaleMap;
    items?: Array<{
      satelliteKey: string;
      moduleKey?: string;
      role: SiteIndustryItemRole;
      assumed?: boolean;
      sortOrder: number;
    }>;
  }) {
    const slug = String(dto.slug || "")
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9-]/g, "");
    if (!slug) throw new BadRequestException("slug required");
    const exists = await this.prisma.siteIndustry.findUnique({ where: { slug } });
    if (exists) throw new BadRequestException(`Industry ${slug} already exists`);
    if (dto.items?.length) await this.assertCommercialItemKeys(dto.items);
    await this.prisma.siteIndustry.create({
      data: {
        slug,
        visibility: dto.visibility ?? "VISIBLE",
        maturityOverride: dto.maturityOverride ?? null,
        sortOrder: dto.sortOrder ?? 999,
        names: (dto.names ?? {}) as Prisma.InputJsonValue,
        descriptions: (dto.descriptions ?? {}) as Prisma.InputJsonValue,
        tagline: {},
        body: {},
        items: dto.items?.length
          ? {
              create: dto.items.map((item) => ({
                satelliteKey: item.satelliteKey,
                moduleKey: item.moduleKey ?? "",
                role: item.role,
                assumed: item.assumed ?? false,
                sortOrder: item.sortOrder,
              })),
            }
          : undefined,
      },
    });
    await this.bumpCatalogCache();
    return this.prisma.siteIndustry.findUnique({
      where: { slug },
      include: { items: { orderBy: { sortOrder: "asc" } } },
    });
  }

  async patchIndustry(
    slug: string,
    dto: {
      visibility?: SiteCatalogVisibility;
      maturityOverride?: SiteCatalogMaturity | null;
      sortOrder?: number;
      names?: LocaleMap;
      descriptions?: LocaleMap;
      tagline?: LocaleMap;
      body?: LocaleMap;
      imageUrl?: string | null;
      calcPrefill?: unknown;
      items?: Array<{
        satelliteKey: string;
        moduleKey?: string;
        role: SiteIndustryItemRole;
        assumed?: boolean;
        sortOrder: number;
      }>;
    },
  ) {
    const existing = await this.prisma.siteIndustry.findUnique({
      where: { slug },
    });
    if (!existing) throw new NotFoundException(`Industry ${slug} not found`);
    if (dto.items) {
      if (!Array.isArray(dto.items)) {
        throw new BadRequestException("items must be an array");
      }
      await this.assertCommercialItemKeys(dto.items);
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.siteIndustry.update({
        where: { slug },
        data: {
          ...(dto.visibility !== undefined
            ? { visibility: dto.visibility }
            : {}),
          ...(dto.maturityOverride !== undefined
            ? { maturityOverride: dto.maturityOverride }
            : {}),
          ...(dto.sortOrder !== undefined ? { sortOrder: dto.sortOrder } : {}),
          ...(dto.names !== undefined
            ? { names: dto.names as Prisma.InputJsonValue }
            : {}),
          ...(dto.descriptions !== undefined
            ? { descriptions: dto.descriptions as Prisma.InputJsonValue }
            : {}),
          ...(dto.tagline !== undefined
            ? { tagline: dto.tagline as Prisma.InputJsonValue }
            : {}),
          ...(dto.body !== undefined
            ? { body: dto.body as Prisma.InputJsonValue }
            : {}),
          ...(dto.imageUrl !== undefined ? { imageUrl: dto.imageUrl } : {}),
          ...(dto.calcPrefill !== undefined
            ? { calcPrefill: dto.calcPrefill as Prisma.InputJsonValue }
            : {}),
        },
      });
      if (dto.items) {
        await tx.siteIndustryItem.deleteMany({ where: { industrySlug: slug } });
        for (const item of dto.items) {
          await tx.siteIndustryItem.create({
            data: {
              industrySlug: slug,
              satelliteKey: item.satelliteKey,
              moduleKey: item.moduleKey ?? "",
              role: item.role,
              assumed: item.assumed ?? false,
              sortOrder: item.sortOrder,
            },
          });
        }
      }
    });
    await this.bumpCatalogCache();
    return this.prisma.siteIndustry.findUnique({
      where: { slug },
      include: { items: { orderBy: { sortOrder: "asc" } } },
    });
  }
}
