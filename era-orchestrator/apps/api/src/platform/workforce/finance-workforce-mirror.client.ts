import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { PrismaService } from "../../prisma/prisma.service";

export type FinanceEmploymentMirror = {
  salary: number | null;
  vacationDaysBalance: number | null;
  employmentStatus: string | null;
};

@Injectable()
export class FinanceWorkforceMirrorClient {
  private readonly logger = new Logger(FinanceWorkforceMirrorClient.name);

  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
  ) {}

  /**
   * Read-only S2S: contract salary + vacationDaysBalance for a CP employment.
   * Returns nulls when Finance unreachable, hr_full missing, or mirror absent.
   */
  async fetchEmploymentMirror(
    organizationId: string,
    cpEmploymentId: string,
  ): Promise<FinanceEmploymentMirror> {
    const empty: FinanceEmploymentMirror = {
      salary: null,
      vacationDaysBalance: null,
      employmentStatus: null,
    };
    try {
      const base = await this.resolveFinanceBaseUrl(organizationId);
      const token =
        this.config.get<string>("FINANCE_INTERNAL_SERVICE_TOKEN")?.trim() ?? "";
      const url = new URL(`${base}/internal/v1/workforce/employees/by-cp-employment`);
      url.searchParams.set("organizationId", organizationId);
      url.searchParams.set("cpEmploymentId", cpEmploymentId);
      const res = await fetch(url.toString(), {
        headers: {
          Accept: "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      });
      if (res.status === 404) return empty;
      if (!res.ok) {
        this.logger.warn(
          `Finance mirror ${res.status} for employment ${cpEmploymentId}`,
        );
        return empty;
      }
      const body = (await res.json()) as {
        salary?: number | string | null;
        vacationDaysBalance?: number | string | null;
        employmentStatus?: string | null;
      };
      return {
        salary:
          body.salary == null || body.salary === ""
            ? null
            : Number(body.salary),
        vacationDaysBalance:
          body.vacationDaysBalance == null || body.vacationDaysBalance === ""
            ? null
            : Number(body.vacationDaysBalance),
        employmentStatus: body.employmentStatus ?? null,
      };
    } catch (err) {
      this.logger.warn(
        `Finance mirror unavailable: ${err instanceof Error ? err.message : String(err)}`,
      );
      return empty;
    }
  }

  /**
   * Write S2S opening (salary / internalRate / inverted vacation). Throws on Finance failure.
   */
  async applyEmploymentOpening(
    organizationId: string,
    cpEmploymentId: string,
    body: {
      salary?: number;
      internalRate?: number | null;
      balanceDays?: number;
      baseVacationDaysPerYear?: number;
      asOfDate?: string;
    },
  ): Promise<{
    salary: number | null;
    internalRate: number | null;
    vacationDaysBalance: number | null;
  }> {
    const base = await this.resolveFinanceBaseUrl(organizationId);
    const token =
      this.config.get<string>("FINANCE_INTERNAL_SERVICE_TOKEN")?.trim() ?? "";
    const res = await fetch(`${base}/internal/v1/workforce/employees/opening`, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({
        organizationId,
        cpEmploymentId,
        ...body,
      }),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      let detail = text.slice(0, 200);
      try {
        const parsed = JSON.parse(text) as { message?: unknown };
        if (typeof parsed.message === "string") detail = parsed.message;
      } catch {
        /* keep raw */
      }
      throw new Error(
        `Finance opening failed (${res.status})${detail ? `: ${detail}` : ""}`,
      );
    }
    const json = (await res.json()) as {
      salary?: number | string | null;
      internalRate?: number | string | null;
      vacationDaysBalance?: number | string | null;
    };
    return {
      salary:
        json.salary == null || json.salary === "" ? null : Number(json.salary),
      internalRate:
        json.internalRate == null || json.internalRate === ""
          ? null
          : Number(json.internalRate),
      vacationDaysBalance:
        json.vacationDaysBalance == null || json.vacationDaysBalance === ""
          ? null
          : Number(json.vacationDaysBalance),
    };
  }

  private async resolveFinanceBaseUrl(organizationId: string): Promise<string> {
    const org = await this.prisma.organization.findFirst({
      where: { id: organizationId },
      select: { settings: true },
    });
    if (org?.settings && typeof org.settings === "object" && !Array.isArray(org.settings)) {
      const s = org.settings as Record<string, unknown>;
      const direct = s.financeApiBaseUrl;
      if (typeof direct === "string" && direct.trim()) {
        return direct.trim().replace(/\/$/, "");
      }
    }
    return (
      this.config.get<string>("ERA_FINANCE_API_INTERNAL_URL")?.trim() ||
      "http://127.0.0.1:4100"
    ).replace(/\/$/, "");
  }
}
