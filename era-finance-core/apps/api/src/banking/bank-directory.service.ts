import { Injectable, NotFoundException } from "@nestjs/common";
import { DataHubClientService } from "../data-hub/data-hub-client.service";
import { PrismaService } from "../prisma/prisma.service";

@Injectable()
export class BankDirectoryService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly dataHub: DataHubClientService,
  ) {}

  async listBanks() {
    if (this.dataHub.isEnabled()) {
      const remote = await this.dataHub.getBanks();
      if (remote?.banks?.length) {
        return remote;
      }
    }
    const banks = await this.prisma.bankGlossary.findMany({
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
    return { banks };
  }

  async getBranch(branchCode: string) {
    const code = branchCode.trim();
    if (this.dataHub.isEnabled()) {
      const remote = await this.dataHub.getBankBranches(code);
      if (remote?.branch) {
        return remote;
      }
    }
    const branch = await this.prisma.bankBranch.findFirst({
      where: { branchCode: code, isActive: true },
      include: { bank: true },
    });
    if (!branch) {
      throw new NotFoundException(`Branch ${code} not found`);
    }
    return {
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
      },
    };
  }
}
