import { Body, Controller, Post } from "@nestjs/common";
import { QuotaService } from "./quota.service";

type QuotaAssertBody = {
  organizationId: string;
  kind:
    | "employee"
    | "storage"
    | "invoice"
    | "whatsapp"
    | "ocr"
    | "workspace";
  quantity?: number;
  additionalBytes?: number;
};

@Controller("internal/v1/quota")
export class QuotaController {
  constructor(private readonly quota: QuotaService) {}

  @Post("assert")
  async assert(@Body() body: QuotaAssertBody) {
    const orgId = body.organizationId;
    switch (body.kind) {
      case "employee":
        await this.quota.assertEmployeeQuota(orgId);
        break;
      case "storage":
        await this.quota.assertStorageQuota(orgId, body.additionalBytes ?? 0);
        break;
      case "invoice":
        await this.quota.assertInvoiceQuota(orgId);
        break;
      case "whatsapp":
        await this.quota.assertWhatsappQuota(orgId, body.quantity ?? 1);
        break;
      case "ocr":
        await this.quota.assertOcrQuota(orgId, body.quantity ?? 1);
        break;
      default:
        break;
    }
    return { ok: true as const };
  }
}
