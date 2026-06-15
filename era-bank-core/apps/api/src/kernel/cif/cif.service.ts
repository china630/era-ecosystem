import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";

import { CustomerType, KycStatus } from "@era/bank-core-database";

import { MdmClient } from "../../integration/mdm.client";

import { PrismaService } from "../../prisma/prisma.service";

import { BankOrgConfig } from "../../common/bank-org.config";

import { AuditService } from "../audit/audit.service";



@Injectable()

export class CifService {

  constructor(

    private readonly prisma: PrismaService,

    private readonly bankOrg: BankOrgConfig,

    private readonly audit: AuditService,

    private readonly mdm: MdmClient,

  ) {}



  list(filters?: { q?: string; status?: string }) {
    const q = filters?.q?.trim();
    return this.prisma.bankCustomer.findMany({
      where: {
        bankOrgId: this.bankOrg.bankOrgId,
        ...(filters?.status ? { status: filters.status as never } : {}),
        ...(q
          ? {
              OR: [
                { id: { contains: q, mode: "insensitive" } },
                { voen: { contains: q } },
                { globalPersonId: { contains: q, mode: "insensitive" } },
              ],
            }
          : {}),
      },
      orderBy: { createdAt: "desc" },
    });
  }



  getById(id: string) {

    return this.prisma.bankCustomer.findFirst({

      where: { id, bankOrgId: this.bankOrg.bankOrgId },

      include: { beneficialOwners: true },

    });

  }



  async create(input: {

    globalPersonId?: string;

    fin?: string;

    passport?: string;

    issuingCountry?: string;

    fullName?: string;

    voen?: string;

    customerType: CustomerType;

    homeBranchId: string;

    actorUserId: string;

  }) {

    if (input.customerType === CustomerType.LEGAL) {

      if (!input.voen || !/^\d{10}$/.test(input.voen)) {

        throw new BadRequestException("Legal entity requires valid 10-digit VÖEN");

      }

    }



    let globalPersonId = input.globalPersonId;

    if (!globalPersonId && input.customerType === CustomerType.NATURAL) {

      const resolved = await this.mdm.resolvePerson({
        fin: input.fin,
        passport: input.passport,
        issuingCountry: input.issuingCountry,
        fullName: input.fullName,
      });

      globalPersonId = resolved.globalPersonId;

    }



    const customer = await this.prisma.bankCustomer.create({

      data: {

        bankOrgId: this.bankOrg.bankOrgId,

        globalPersonId,

        voen: input.voen,

        customerType: input.customerType,

        homeBranchId: input.homeBranchId,

        kycStatus: KycStatus.PENDING,

      },

    });

    await this.audit.append({

      entity: "BankCustomer",

      entityId: customer.id,

      action: "CREATED",

      afterJson: customer,

      actorUserId: input.actorUserId,

    });

    return customer;

  }



  async assertExists(customerId: string) {

    const row = await this.getById(customerId);

    if (!row) throw new NotFoundException("Customer not found");

    return row;

  }

  async addBeneficialOwner(input: {
    customerId: string;
    fin?: string;
    passport?: string;
    issuingCountry?: string;
    fullName?: string;
    sharePercent: number;
    actorUserId: string;
  }) {
    const customer = await this.assertExists(input.customerId);
    if (customer.customerType !== CustomerType.LEGAL) {
      throw new BadRequestException("Beneficial owners apply to legal entity customers only");
    }
    const resolved = await this.mdm.resolvePerson({
      fin: input.fin,
      passport: input.passport,
      issuingCountry: input.issuingCountry,
      fullName: input.fullName,
    });
    if (!resolved.globalPersonId) {
      throw new BadRequestException("MDM person link required for beneficial owner");
    }
    const row = await this.prisma.beneficialOwner.create({
      data: {
        bankOrgId: this.bankOrg.bankOrgId,
        customerId: input.customerId,
        globalPersonId: resolved.globalPersonId,
        sharePercent: input.sharePercent,
      },
    });
    await this.audit.append({
      entity: "BeneficialOwner",
      entityId: row.id,
      action: "CREATED",
      afterJson: row,
      actorUserId: input.actorUserId,
    });
    return row;
  }

}


