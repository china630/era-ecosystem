import { Injectable } from "@nestjs/common";
import { BillingStatus } from "@era365/database";
import { ControlPlanePrismaService } from "../prisma/control-plane-prisma.service";
import type {
  ValidateEntitlementRequest,
  ValidateEntitlementResponse,
} from "./dto/validate-entitlement.dto";

@Injectable()
export class EntitlementsService {
  constructor(private readonly prisma: ControlPlanePrismaService) {}

  async validate(
    input: ValidateEntitlementRequest,
  ): Promise<ValidateEntitlementResponse> {
    if (!input.organizationId || input.isSuperAdmin) {
      return { allowed: true, billingStatus: "ACTIVE" };
    }

    const billingStatus = await this.resolveBillingStatus(input.organizationId);
    const method = (input.method ?? "GET").toUpperCase();
    const path = this.normalizePath(input.path);

    if (billingStatus === BillingStatus.SOFT_BLOCK) {
      if (this.isExportPath(path)) {
        return {
          allowed: false,
          billingStatus: "SOFT_BLOCK",
          code: "BILLING_SOFT_BLOCK_EXPORTS",
          message:
            "Billing SOFT_BLOCK: export functions are restricted until invoice payment.",
          httpStatus: 402,
        };
      }
      return { allowed: true, billingStatus: "SOFT_BLOCK" };
    }

    if (billingStatus === BillingStatus.HARD_BLOCK) {
      if (["GET", "HEAD", "OPTIONS"].includes(method)) {
        return { allowed: true, billingStatus: "HARD_BLOCK" };
      }
      if (this.isEarlyAccessPath(path)) {
        return { allowed: true, billingStatus: "HARD_BLOCK" };
      }
      if (this.isBillingPaymentPath(path, method)) {
        return { allowed: true, billingStatus: "HARD_BLOCK" };
      }
      return {
        allowed: false,
        billingStatus: "HARD_BLOCK",
        code: "BILLING_HARD_BLOCK_READ_ONLY",
        message:
          "Billing HARD_BLOCK: system is in read-only mode until invoice payment.",
        httpStatus: 402,
      };
    }

    return { allowed: true, billingStatus: "ACTIVE" };
  }

  private async resolveBillingStatus(
    organizationId: string,
  ): Promise<BillingStatus> {
    const tenant = await this.prisma.tenantBilling.findUnique({
      where: { organizationId },
      select: { billingStatus: true },
    });
    if (tenant?.billingStatus) return tenant.billingStatus;

    const rows = await this.prisma.$queryRaw<{ billing_status: string }[]>`
      SELECT billing_status::text AS billing_status
      FROM organizations
      WHERE id = ${organizationId}::uuid
      LIMIT 1
    `;
    const raw = rows[0]?.billing_status;
    if (raw && Object.values(BillingStatus).includes(raw as BillingStatus)) {
      return raw as BillingStatus;
    }
    return BillingStatus.ACTIVE;
  }

  private normalizePath(path: string): string {
    if (!path) return "";
    if (path.startsWith("/api")) return path;
    return path.startsWith("/") ? `/api${path}` : `/api/${path}`;
  }

  private isEarlyAccessPath(path: string): boolean {
    return path.startsWith("/api/early-access/");
  }

  private isBillingPaymentPath(path: string, method: string): boolean {
    if (method !== "POST") return false;
    if (path === "/api/billing/checkout") return true;
    if (path.startsWith("/api/billing/webhooks/")) return true;
    if (path === "/api/public/billing/webhook") return true;
    if (path.startsWith("/api/integrations/drakaris/")) return true;
    return false;
  }

  private isExportPath(path: string): boolean {
    const p = path.toLowerCase();
    return (
      p.includes("/export") ||
      p.includes("/pdf") ||
      p.includes("/xlsx") ||
      p.includes("/xml") ||
      p.includes("/tax-export")
    );
  }
}
