import { Injectable } from "@nestjs/common";
import { DataSourceService } from "../../prisma/data-source.service";
import { registryMeta } from "../../common/registry-meta";
import { validateAzIban } from "./iban.util";

/** AZ IBAN positions 5-8 often encode bank code (MFO fragment). */
@Injectable()
export class IbanService {
  constructor(private readonly ds: DataSourceService) {}

  async validate(ibanRaw: string) {
    const local = validateAzIban(ibanRaw);
    let branch: {
      branchCode: string;
      name: string;
      bank: { voen: string; nameAz: string; code: string };
    } | null = null;
    if (local.isValid) {
      const mfoHint = local.normalized.slice(4, 9);
      try {
        const db = this.ds.referenceDb();
        const br = await db.bankBranch.findFirst({
          where: { branchCode: { contains: mfoHint } },
          include: { bank: true },
        });
        if (br) {
          branch = {
            branchCode: br.branchCode,
            name: br.name,
            bank: { voen: br.bank.voen, nameAz: br.bank.nameAz, code: br.bank.code },
          };
        }
      } catch {
        /* optional resolve */
      }
    }
    return {
      meta: registryMeta("iban", new Date().toISOString().slice(0, 10)),
      iban: local.normalized,
      isValid: local.isValid,
      reason: local.reason,
      branch,
    };
  }
}
