import { BadRequestException, Injectable, Logger } from "@nestjs/common";
import { WORKFORCE_OPERATIONAL_SATELLITE_KEYS } from "@era/contracts";
import { PrismaService } from "../../prisma/prisma.service";
import { SatelliteEndpointRegistryService } from "../../satellite-events/satellite-endpoint-registry.service";

export type SatelliteRoleCatalogInput = {
  code: string;
  name: string;
  active: boolean;
};

@Injectable()
export class WorkforceSatelliteRoleCatalogService {
  private readonly logger = new Logger(WorkforceSatelliteRoleCatalogService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly endpoints: SatelliteEndpointRegistryService,
  ) {}

  async upsert(
    organizationId: string,
    satelliteKey: string,
    role: SatelliteRoleCatalogInput,
  ) {
    const code = role.code.trim();
    const name = role.name.trim();
    const key = satelliteKey.trim();
    if (!code || !name || !key) {
      throw new BadRequestException("satellite role code, name, and key are required");
    }
    return this.prisma.satelliteRoleCatalog.upsert({
      where: {
        organizationId_satelliteKey_code: {
          organizationId,
          satelliteKey: key,
          code,
        },
      },
      create: {
        organizationId,
        satelliteKey: key,
        code,
        name,
        active: role.active,
      },
      update: { name, active: role.active },
    });
  }

  async replaceSnapshot(
    organizationId: string,
    satelliteKey: string,
    roles: SatelliteRoleCatalogInput[],
    options?: { replaceMissing?: boolean },
  ) {
    const key = satelliteKey.trim();
    const saved = [];
    for (const role of roles) {
      if (!role.code?.trim() || !role.name?.trim()) continue;
      saved.push(await this.upsert(organizationId, key, role));
    }
    if (options?.replaceMissing && saved.length > 0) {
      await this.prisma.satelliteRoleCatalog.updateMany({
        where: {
          organizationId,
          satelliteKey: key,
          code: { notIn: saved.map((row) => row.code) },
        },
        data: { active: false },
      });
    }
    return saved;
  }

  async list(organizationId: string) {
    for (const satelliteKey of WORKFORCE_OPERATIONAL_SATELLITE_KEYS) {
      await this.pullIfEmpty(organizationId, satelliteKey);
    }
    return this.prisma.satelliteRoleCatalog.findMany({
      where: { organizationId },
      orderBy: [{ satelliteKey: "asc" }, { name: "asc" }],
      select: {
        satelliteKey: true,
        code: true,
        name: true,
        active: true,
      },
    });
  }

  /**
   * Code must already be an active catalog row. Does not invent RECEPTION/STAFF.
   * Pulls once when this satellite has never reported roles.
   */
  async assertAssignable(
    organizationId: string,
    satelliteKey: string,
    code: string,
  ): Promise<string> {
    const trimmed = code.trim();
    const key = satelliteKey.trim();
    let row = await this.findActive(organizationId, key, trimmed);
    if (!row) {
      const known = await this.prisma.satelliteRoleCatalog.count({
        where: { organizationId, satelliteKey: key },
      });
      if (known === 0) {
        await this.pullIfEmpty(organizationId, key);
        row = await this.findActive(organizationId, key, trimmed);
      }
    }
    if (!row) {
      throw new BadRequestException({
        code: "SATELLITE_ROLE_UNKNOWN",
        message: `Role ${trimmed} is not an active ${key} role`,
      });
    }
    return row.code;
  }

  private findActive(organizationId: string, satelliteKey: string, code: string) {
    return this.prisma.satelliteRoleCatalog.findFirst({
      where: { organizationId, satelliteKey, code, active: true },
      select: { code: true },
    });
  }

  private async pullIfEmpty(organizationId: string, satelliteKey: string) {
    const known = await this.prisma.satelliteRoleCatalog.count({
      where: { organizationId, satelliteKey },
    });
    if (known > 0) return;
    const endpoint = await this.endpoints.resolveEndpoint(organizationId, satelliteKey);
    if (!endpoint?.baseUrl) return;
    const url = `${endpoint.baseUrl}/api/internal/v1/workforce/roles?organizationId=${encodeURIComponent(organizationId)}`;
    try {
      const res = await fetch(url, {
        headers: { "x-satellite-bridge-secret": endpoint.secret },
      });
      if (!res.ok) {
        this.logger.warn(
          `Role catalog pull ${satelliteKey} failed: HTTP ${res.status}`,
        );
        return;
      }
      const body = (await res.json()) as {
        roles?: SatelliteRoleCatalogInput[];
      };
      await this.replaceSnapshot(organizationId, satelliteKey, body.roles ?? []);
    } catch (err) {
      this.logger.warn(
        `Role catalog pull ${satelliteKey} failed: ${
          err instanceof Error ? err.message : String(err)
        }`,
      );
    }
  }
}
