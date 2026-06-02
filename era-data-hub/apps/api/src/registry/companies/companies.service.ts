import { Injectable, NotFoundException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { DataSourceService } from "../../prisma/data-source.service";
import { registryMeta } from "../../common/registry-meta";

@Injectable()
export class CompaniesService {
  constructor(
    private readonly ds: DataSourceService,
    private readonly config: ConfigService,
  ) {}

  async getByVoen(voen: string, maskPii?: boolean) {
    const taxId = voen.trim();
    if (!/^\d{10}$/.test(taxId)) {
      throw new NotFoundException({ code: "INVALID_VOEN", message: "VÖEN must be 10 digits" });
    }
    const db = this.ds.referenceDb();
    const row = await db.globalCompanyDirectory.findUnique({ where: { taxId } });
    if (!row) {
      throw new NotFoundException({ code: "COMPANY_NOT_FOUND", message: `VÖEN ${taxId} not found` });
    }

    const external =
      (this.config.get<string>("DATA_HUB_MASK_PII_EXTERNAL") ?? "true").toLowerCase() ===
      "true";
    const shouldMask = maskPii ?? external;

    return {
      meta: registryMeta("global_company_directory", row.updatedAt.toISOString().slice(0, 10)),
      company: {
        taxId: row.taxId,
        name: row.name,
        legalForm: row.legalForm,
        legalAddress: row.legalAddress,
        phone: shouldMask ? this.maskPhone(row.phone) : row.phone,
        directorName: shouldMask ? this.maskName(row.directorName) : row.directorName,
      },
    };
  }

  private maskPhone(phone: string | null): string | null {
    if (!phone) return null;
    return phone.length > 4 ? `***${phone.slice(-4)}` : "***";
  }

  private maskName(name: string | null): string | null {
    if (!name) return null;
    const parts = name.trim().split(/\s+/);
    if (parts.length === 0) return null;
    return `${parts[0]!.charAt(0)}. ***`;
  }
}
