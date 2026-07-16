import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import {
  OrgUnitStatus,
  StaffScheduleRevisionStatus,
  WorkforceEmploymentStatus,
} from "@era365/database";
import PDFDocument from "pdfkit";
import { PrismaService } from "../../prisma/prisma.service";
import {
  PDF_FONT_UNICODE,
  registerUnicodeFonts,
} from "../../reporting/pdf-font.util";
import { WorkforceAuditService } from "./workforce-audit.service";
import { WorkforceEntitlementService } from "./workforce-entitlement.service";
import { WorkforceScopeService } from "./workforce-scope.service";
import type { CreateStaffScheduleRevisionDto } from "./dto/workforce-personnel-docs.dto";

type SnapshotRow = {
  positionId: string;
  name: string;
  code: string | null;
  orgUnitId: string;
  orgUnitName: string;
  totalSlots: number;
  occupied: number;
  vacant: number;
};

@Injectable()
export class StaffScheduleRevisionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly entitlement: WorkforceEntitlementService,
    private readonly audit: WorkforceAuditService,
    private readonly scopeService: WorkforceScopeService,
  ) {}

  async list(organizationId: string) {
    await this.entitlement.assertWorkforceHub(organizationId);
    const link = await this.scopeService.resolveScopeForCommercialOrg(organizationId);
    return this.prisma.staffScheduleRevision.findMany({
      where: { workforceScopeId: link.workforceScope.id },
      orderBy: [{ createdAt: "desc" }],
    });
  }

  async getOne(organizationId: string, id: string) {
    await this.entitlement.assertWorkforceHub(organizationId);
    const link = await this.scopeService.resolveScopeForCommercialOrg(organizationId);
    const row = await this.prisma.staffScheduleRevision.findFirst({
      where: { id, workforceScopeId: link.workforceScope.id },
    });
    if (!row) throw new NotFoundException("Staff schedule revision not found");
    return row;
  }

  async buildLiveSnapshot(workforceScopeId: string): Promise<SnapshotRow[]> {
    const positions = await this.prisma.workforcePosition.findMany({
      where: {
        orgUnit: { workforceScopeId },
        status: OrgUnitStatus.ACTIVE,
      },
      include: {
        orgUnit: true,
        employments: {
          where: { status: WorkforceEmploymentStatus.ACTIVE },
          select: { id: true },
        },
      },
      orderBy: [{ orgUnit: { sortOrder: "asc" } }, { name: "asc" }],
    });
    return positions.map((p) => {
      const occupied = p.employments.length;
      return {
        positionId: p.id,
        name: p.name,
        code: p.code,
        orgUnitId: p.orgUnitId,
        orgUnitName: p.orgUnit.name,
        totalSlots: p.totalSlots,
        occupied,
        vacant: Math.max(0, p.totalSlots - occupied),
      };
    });
  }

  async create(
    organizationId: string,
    actorUserId: string,
    dto: CreateStaffScheduleRevisionDto,
  ) {
    await this.entitlement.assertWorkforceHub(organizationId);
    const link = await this.scopeService.resolveScopeForCommercialOrg(organizationId);
    const scope = link.workforceScope;
    const snapshot = await this.buildLiveSnapshot(scope.id);
    const submit = dto.submit === true;
    const now = new Date();
    const row = await this.prisma.staffScheduleRevision.create({
      data: {
        workforceScopeId: scope.id,
        title: dto.title.trim(),
        status: submit
          ? StaffScheduleRevisionStatus.SUBMITTED
          : StaffScheduleRevisionStatus.DRAFT,
        snapshotJson: snapshot,
        submittedByUserId: submit ? actorUserId : null,
        submittedAt: submit ? now : null,
      },
    });
    await this.audit.log({
      organizationId,
      workforceScopeId: scope.id,
      actorUserId,
      action: submit ? "STAFF_SCHEDULE_SUBMITTED" : "STAFF_SCHEDULE_CREATED",
      entityType: "StaffScheduleRevision",
      entityId: row.id,
      payload: { title: row.title, positions: snapshot.length },
    });
    return row;
  }

  async submit(organizationId: string, id: string, actorUserId: string) {
    const row = await this.getOne(organizationId, id);
    if (
      row.status !== StaffScheduleRevisionStatus.DRAFT &&
      row.status !== StaffScheduleRevisionStatus.REJECTED
    ) {
      throw new BadRequestException("Only DRAFT/REJECTED can be submitted");
    }
    const snapshot = await this.buildLiveSnapshot(row.workforceScopeId);
    return this.prisma.staffScheduleRevision.update({
      where: { id },
      data: {
        status: StaffScheduleRevisionStatus.SUBMITTED,
        snapshotJson: snapshot,
        submittedByUserId: actorUserId,
        submittedAt: new Date(),
      },
    });
  }

  async approve(organizationId: string, id: string, actorUserId: string) {
    const row = await this.getOne(organizationId, id);
    if (row.status !== StaffScheduleRevisionStatus.SUBMITTED) {
      throw new BadRequestException("Only SUBMITTED can be approved");
    }
    const updated = await this.prisma.staffScheduleRevision.update({
      where: { id },
      data: {
        status: StaffScheduleRevisionStatus.APPROVED,
        approvedByUserId: actorUserId,
        approvedAt: new Date(),
      },
    });
    await this.audit.log({
      organizationId,
      workforceScopeId: row.workforceScopeId,
      actorUserId,
      action: "STAFF_SCHEDULE_APPROVED",
      entityType: "StaffScheduleRevision",
      entityId: id,
      payload: { title: updated.title },
    });
    return updated;
  }

  async buildPdfBuffer(
    organizationId: string,
    id: string,
  ): Promise<{ buffer: Buffer; filename: string }> {
    const row = await this.getOne(organizationId, id);
    const snapshot = (row.snapshotJson as SnapshotRow[]) ?? [];
    const chunks: Buffer[] = [];
    const doc = new PDFDocument({ margin: 40, size: "A4", layout: "landscape" });
    registerUnicodeFonts(doc);
    doc.on("data", (c: Buffer) => chunks.push(c));
    const done = new Promise<Buffer>((resolve) => {
      doc.on("end", () => resolve(Buffer.concat(chunks)));
    });

    doc.font(PDF_FONT_UNICODE).fontSize(14).text(`Ştat cədvəli / Staff schedule: ${row.title}`, {
      align: "center",
    });
    doc.fontSize(10).text(`Status: ${row.status}`, { align: "center" });
    doc.moveDown();
    doc.fontSize(9);
    for (const r of snapshot) {
      doc.text(
        `${r.orgUnitName} | ${r.name}${r.code ? ` (${r.code})` : ""} | slots ${r.totalSlots} | occupied ${r.occupied} | vacant ${r.vacant}`,
      );
    }
    doc.end();
    const buffer = await done;
    return {
      buffer,
      filename: `staff-schedule-${row.id.slice(0, 8)}.pdf`,
    };
  }
}
