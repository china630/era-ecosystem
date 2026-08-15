import { Injectable, NotFoundException } from "@nestjs/common";
import {
  BpmProcessStatus,
  DmsDocumentStatus,
  MisReportJobStatus,
  Prisma,
} from "@era/bank-core-database";
import { PrismaService } from "../../prisma/prisma.service";
import { BankOrgConfig } from "../../common/bank-org.config";

@Injectable()
export class PlatformExtrasService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly bankOrg: BankOrgConfig,
  ) {}

  listMisJobs() {
    return this.prisma.misReportJob.findMany({
      where: { bankOrgId: this.bankOrg.bankOrgId },
      orderBy: { createdAt: "desc" },
      take: 100,
    });
  }

  createMisJob(input: { reportCode: string; paramsJson?: Record<string, unknown> }) {
    return this.prisma.misReportJob.create({
      data: {
        bankOrgId: this.bankOrg.bankOrgId,
        reportCode: input.reportCode,
        paramsJson: (input.paramsJson ?? {}) as Prisma.InputJsonValue,
        status: MisReportJobStatus.QUEUED,
      },
    });
  }

  async completeMisJob(id: string) {
    const job = await this.prisma.misReportJob.findFirst({
      where: { id, bankOrgId: this.bankOrg.bankOrgId },
    });
    if (!job) throw new NotFoundException("MIS job not found");
    return this.prisma.misReportJob.update({
      where: { id },
      data: {
        status: MisReportJobStatus.COMPLETED,
        completedAt: new Date(),
        resultJson: { metadataOnly: true, reportCode: job.reportCode },
      },
    });
  }

  listBpmProcesses() {
    return this.prisma.bpmProcessStub.findMany({
      where: { bankOrgId: this.bankOrg.bankOrgId },
    });
  }

  createBpmProcess(input: {
    processCode: string;
    name: string;
    stepsJson?: unknown[];
  }) {
    return this.prisma.bpmProcessStub.create({
      data: {
        bankOrgId: this.bankOrg.bankOrgId,
        processCode: input.processCode,
        name: input.name,
        stepsJson: (input.stepsJson ?? []) as Prisma.InputJsonValue,
        status: BpmProcessStatus.DRAFT,
      },
    });
  }

  listDmsDocuments() {
    return this.prisma.dmsDocumentMeta.findMany({
      where: { bankOrgId: this.bankOrg.bankOrgId },
      orderBy: { createdAt: "desc" },
      take: 100,
    });
  }

  createDmsDocument(input: {
    documentRef: string;
    category: string;
    title: string;
    metadataJson?: Record<string, unknown>;
  }) {
    return this.prisma.dmsDocumentMeta.create({
      data: {
        bankOrgId: this.bankOrg.bankOrgId,
        documentRef: input.documentRef,
        category: input.category,
        title: input.title,
        metadataJson: (input.metadataJson ?? {}) as Prisma.InputJsonValue,
        status: DmsDocumentStatus.DRAFT,
      },
    });
  }
}
