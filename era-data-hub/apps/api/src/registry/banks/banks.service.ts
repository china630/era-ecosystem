import { Injectable, NotFoundException } from "@nestjs/common";
import { DataSourceService } from "../../prisma/data-source.service";
import { registryMeta } from "../../common/registry-meta";

@Injectable()
export class BanksService {
  constructor(private readonly ds: DataSourceService) {}

  async listBanks() {
    const db = this.ds.referenceDb();
    const rows = await db.bankGlossary.findMany({
      where: { isActive: true },
      orderBy: { code: "asc" },
      select: {
        id: true,
        nameAz: true,
        voen: true,
        code: true,
        swift: true,
        correspondentIban: true,
        headAddress: true,
        headPhones: true,
      },
    });
    return { meta: registryMeta("bank_glossary", new Date().toISOString().slice(0, 10)), banks: rows };
  }

  async getBranch(branchCode: string) {
    const code = branchCode.trim();
    const db = this.ds.referenceDb();
    const branch = await db.bankBranch.findFirst({
      where: { branchCode: code, isActive: true },
      include: { bank: true },
    });
    if (!branch) {
      throw new NotFoundException({ code: "BRANCH_NOT_FOUND", message: `Branch ${code} not found` });
    }
    let company: { taxId: string; name: string } | null = null;
    const dir = await db.globalCompanyDirectory.findUnique({
      where: { taxId: branch.bank.voen },
    });
    if (dir) company = { taxId: dir.taxId, name: dir.name };

    return {
      meta: registryMeta("bank_branches", new Date().toISOString().slice(0, 10)),
      branch: {
        branchCode: branch.branchCode,
        name: branch.name,
        swift: branch.swift,
        address: branch.address,
        phones: branch.phones,
        isHeadOffice: branch.isHeadOffice,
        bank: {
          voen: branch.bank.voen,
          nameAz: branch.bank.nameAz,
          code: branch.bank.code,
          swift: branch.bank.swift,
        },
        company,
      },
    };
  }
}
