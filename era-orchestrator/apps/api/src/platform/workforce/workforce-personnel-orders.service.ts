import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import {
  WorkforceEmploymentStatus,
  WorkforcePersonnelOrderStatus,
  WorkforcePersonnelOrderType,
} from "@era365/database";
import PDFDocument from "pdfkit";
import { MdmService } from "../../mdm/mdm.service";
import { PrismaService } from "../../prisma/prisma.service";
import {
  PDF_FONT_UNICODE,
  registerUnicodeFonts,
} from "../../reporting/pdf-font.util";
import { WorkforceAuditService } from "./workforce-audit.service";
import { WorkforceEntitlementService } from "./workforce-entitlement.service";
import { WorkforceScopeService } from "./workforce-scope.service";
import type {
  CreatePersonnelOrderDto,
  ListPersonnelOrdersQueryDto,
} from "./dto/workforce-personnel-docs.dto";

function parseDateOnly(iso: string): Date {
  return new Date(`${iso.slice(0, 10)}T00:00:00.000Z`);
}

@Injectable()
export class WorkforcePersonnelOrdersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly entitlement: WorkforceEntitlementService,
    private readonly audit: WorkforceAuditService,
    private readonly scopeService: WorkforceScopeService,
    private readonly mdm: MdmService,
  ) {}

  async list(organizationId: string, query: ListPersonnelOrdersQueryDto) {
    await this.entitlement.assertWorkforceHub(organizationId);
    const link = await this.scopeService.resolveScopeForCommercialOrg(organizationId);
    return this.prisma.workforcePersonnelOrder.findMany({
      where: {
        workforceScopeId: link.workforceScope.id,
        ...(query.type ? { type: query.type } : {}),
        ...(query.employmentId ? { employmentId: query.employmentId } : {}),
      },
      orderBy: [{ effectiveDate: "desc" }, { createdAt: "desc" }],
      include: {
        employment: {
          include: { orgUnit: true, position: true },
        },
      },
    });
  }

  async getOne(organizationId: string, id: string) {
    await this.entitlement.assertWorkforceHub(organizationId);
    const link = await this.scopeService.resolveScopeForCommercialOrg(organizationId);
    const row = await this.prisma.workforcePersonnelOrder.findFirst({
      where: { id, workforceScopeId: link.workforceScope.id },
      include: {
        employment: { include: { orgUnit: true, position: true } },
      },
    });
    if (!row) throw new NotFoundException("Personnel order not found");
    return row;
  }

  async create(
    organizationId: string,
    actorUserId: string,
    dto: CreatePersonnelOrderDto,
  ) {
    await this.entitlement.assertWorkforceHub(organizationId);
    const link = await this.scopeService.resolveScopeForCommercialOrg(organizationId);
    const scope = link.workforceScope;

    const employment = await this.prisma.workforceEmployment.findFirst({
      where: {
        id: dto.employmentId,
        workforceScopeId: scope.id,
      },
      include: { orgUnit: true, position: true },
    });
    if (!employment) throw new NotFoundException("Employment not found");

    let personDisplayName: string | null = null;
    try {
      const profile = await this.mdm.getPersonOpsProfile(
        employment.globalPersonId,
        organizationId,
      );
      personDisplayName = profile?.fullName ?? null;
    } catch {
      personDisplayName = null;
    }

    const count = await this.prisma.workforcePersonnelOrder.count({
      where: { workforceScopeId: scope.id },
    });
    const orderNumber = `PO-${new Date().getUTCFullYear()}-${String(count + 1).padStart(5, "0")}`;

    const issue = dto.issue === true;
    const now = new Date();
    const row = await this.prisma.workforcePersonnelOrder.create({
      data: {
        workforceScopeId: scope.id,
        employmentId: employment.id,
        organizationId,
        type: dto.type,
        status: issue
          ? WorkforcePersonnelOrderStatus.ISSUED
          : WorkforcePersonnelOrderStatus.DRAFT,
        orderNumber,
        effectiveDate: parseDateOnly(dto.effectiveDate),
        note: dto.note?.trim() ?? "",
        personDisplayName,
        issuedByUserId: issue ? actorUserId : null,
        issuedAt: issue ? now : null,
      },
      include: {
        employment: { include: { orgUnit: true, position: true } },
      },
    });

    await this.audit.log({
      organizationId,
      workforceScopeId: scope.id,
      actorUserId,
      action: issue ? "PERSONNEL_ORDER_ISSUED" : "PERSONNEL_ORDER_CREATED",
      entityType: "WorkforcePersonnelOrder",
      entityId: row.id,
      payload: { type: row.type, orderNumber: row.orderNumber },
    });

    return row;
  }

  async issue(organizationId: string, id: string, actorUserId: string) {
    const row = await this.getOne(organizationId, id);
    if (row.status !== WorkforcePersonnelOrderStatus.DRAFT) {
      throw new BadRequestException("Only DRAFT orders can be issued");
    }
    const updated = await this.prisma.workforcePersonnelOrder.update({
      where: { id },
      data: {
        status: WorkforcePersonnelOrderStatus.ISSUED,
        issuedByUserId: actorUserId,
        issuedAt: new Date(),
      },
      include: {
        employment: { include: { orgUnit: true, position: true } },
      },
    });
    await this.audit.log({
      organizationId,
      workforceScopeId: row.workforceScopeId,
      actorUserId,
      action: "PERSONNEL_ORDER_ISSUED",
      entityType: "WorkforcePersonnelOrder",
      entityId: id,
      payload: { type: updated.type },
    });
    return updated;
  }

  async buildPdfBuffer(
    organizationId: string,
    id: string,
  ): Promise<{ buffer: Buffer; filename: string }> {
    const row = await this.getOne(organizationId, id);
    const typeLabel =
      row.type === WorkforcePersonnelOrderType.HIRE
        ? "İşə qəbul əmri / Hire order"
        : row.type === WorkforcePersonnelOrderType.TRANSFER
          ? "Yerdəyişmə əmri / Transfer order"
          : "Xitam əmri / Termination order";

    const chunks: Buffer[] = [];
    const doc = new PDFDocument({ margin: 50, size: "A4" });
    registerUnicodeFonts(doc);
    doc.on("data", (c: Buffer) => chunks.push(c));
    const done = new Promise<Buffer>((resolve) => {
      doc.on("end", () => resolve(Buffer.concat(chunks)));
    });

    doc.font(PDF_FONT_UNICODE).fontSize(16).text(typeLabel, { align: "center" });
    doc.moveDown();
    doc.fontSize(11);
    doc.text(`Order №: ${row.orderNumber}`);
    doc.text(`Effective date: ${row.effectiveDate.toISOString().slice(0, 10)}`);
    doc.text(`Status: ${row.status}`);
    doc.text(`Person: ${row.personDisplayName ?? row.employment.globalPersonId}`);
    doc.text(`Org unit: ${row.employment.orgUnit.name}`);
    doc.text(`Position: ${row.employment.position.name}`);
    if (row.note) {
      doc.moveDown();
      doc.text(`Note: ${row.note}`);
    }
    doc.moveDown(2);
    doc.text("______________________", { align: "right" });
    doc.text("HR / Director", { align: "right" });
    doc.end();

    const buffer = await done;
    return {
      buffer,
      filename: `${row.orderNumber.replace(/[^\w.-]+/g, "_")}.pdf`,
    };
  }
}
