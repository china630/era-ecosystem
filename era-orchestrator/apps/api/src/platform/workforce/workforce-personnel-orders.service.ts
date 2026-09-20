import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
  forwardRef,
} from "@nestjs/common";
import {
  Prisma,
  WorkforceAbsenceKind,
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
import { FinanceWorkforceMirrorClient } from "./finance-workforce-mirror.client";
import {
  applyTemplatePlaceholders,
  DEFAULT_ORDER_TEMPLATES,
  formatOrderNumber,
  htmlToPlainText,
} from "./personnel-order-template.util";
import { WorkforceAuditService } from "./workforce-audit.service";
import { WorkforceEmploymentsService } from "./workforce-employments.service";
import { WorkforceEntitlementService } from "./workforce-entitlement.service";
import { WorkforceScopeService } from "./workforce-scope.service";
import type {
  CreatePersonnelOrderDto,
  ListPersonnelOrdersQueryDto,
  PreviewPersonnelOrderTemplateDto,
  UpsertPersonnelOrderTemplateDto,
} from "./dto/workforce-personnel-docs.dto";

function parseDateOnly(iso: string): Date {
  return new Date(`${iso.slice(0, 10)}T00:00:00.000Z`);
}

function orgVoenFromSettings(settings: unknown): string | null {
  if (!settings || typeof settings !== "object" || Array.isArray(settings)) {
    return null;
  }
  const s = settings as Record<string, unknown>;
  for (const key of ["taxId", "voen", "legalTaxId", "vohn"]) {
    const v = s[key];
    if (typeof v === "string" && v.trim()) return v.trim();
  }
  return null;
}

function requireOrderIssuedGate(settings: unknown): boolean {
  if (!settings || typeof settings !== "object" || Array.isArray(settings)) {
    return false;
  }
  const wf = (settings as Record<string, unknown>).workforce;
  if (!wf || typeof wf !== "object" || Array.isArray(wf)) return false;
  return (wf as Record<string, unknown>).requireOrderIssuedBeforeTerminate === true;
}

@Injectable()
export class WorkforcePersonnelOrdersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly entitlement: WorkforceEntitlementService,
    private readonly audit: WorkforceAuditService,
    private readonly scopeService: WorkforceScopeService,
    private readonly mdm: MdmService,
    @Inject(forwardRef(() => WorkforceEmploymentsService))
    private readonly employments: WorkforceEmploymentsService,
    private readonly financeMirror: FinanceWorkforceMirrorClient,
  ) {}

  async getWorkforceOrderSettings(organizationId: string) {
    await this.entitlement.assertWorkforceHub(organizationId);
    const org = await this.prisma.organization.findFirst({
      where: { id: organizationId },
      select: { settings: true },
    });
    return {
      requireOrderIssuedBeforeTerminate: requireOrderIssuedGate(org?.settings),
    };
  }

  async patchWorkforceOrderSettings(
    organizationId: string,
    dto: { requireOrderIssuedBeforeTerminate?: boolean },
  ) {
    await this.entitlement.assertWorkforceHub(organizationId);
    const org = await this.prisma.organization.findFirst({
      where: { id: organizationId },
      select: { settings: true },
    });
    const base =
      org?.settings &&
      typeof org.settings === "object" &&
      !Array.isArray(org.settings)
        ? ({ ...(org.settings as Record<string, unknown>) } as Record<
            string,
            unknown
          >)
        : {};
    const prevWf =
      base.workforce &&
      typeof base.workforce === "object" &&
      !Array.isArray(base.workforce)
        ? ({ ...(base.workforce as Record<string, unknown>) } as Record<
            string,
            unknown
          >)
        : {};
    if (dto.requireOrderIssuedBeforeTerminate !== undefined) {
      prevWf.requireOrderIssuedBeforeTerminate =
        dto.requireOrderIssuedBeforeTerminate === true;
    }
    base.workforce = prevWf;
    await this.prisma.organization.update({
      where: { id: organizationId },
      data: { settings: base as Prisma.InputJsonValue },
    });
    return {
      requireOrderIssuedBeforeTerminate: prevWf.requireOrderIssuedBeforeTerminate === true,
    };
  }

  async list(organizationId: string, query: ListPersonnelOrdersQueryDto) {
    await this.entitlement.assertWorkforceHub(organizationId);
    const link = await this.scopeService.resolveScopeForCommercialOrg(organizationId);
    const items = await this.prisma.workforcePersonnelOrder.findMany({
      where: {
        workforceScopeId: link.workforceScope.id,
        ...(query.type ? { type: query.type } : {}),
        ...(query.employmentId ? { employmentId: query.employmentId } : {}),
        ...(query.status ? { status: query.status } : {}),
      },
      orderBy: [{ effectiveDate: "desc" }, { createdAt: "desc" }],
      include: {
        employment: {
          include: { orgUnit: true, position: true },
        },
      },
    });
    const persons = await this.employments.resolvePersonProfiles(
      organizationId,
      items.map((o) => o.employment.globalPersonId),
    );
    return { items, persons };
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

  async listTemplates(organizationId: string) {
    await this.entitlement.assertWorkforceHub(organizationId);
    const org = await this.prisma.organization.findFirst({
      where: { id: organizationId },
      select: { holdingId: true },
    });
    const orgRows = await this.prisma.workforcePersonnelOrderTemplate.findMany({
      where: { organizationId },
      orderBy: [{ type: "asc" }, { locale: "asc" }],
    });
    const holdingRows =
      org?.holdingId != null
        ? await this.prisma.workforcePersonnelOrderTemplate.findMany({
            where: { holdingId: org.holdingId, organizationId: null },
            orderBy: [{ type: "asc" }, { locale: "asc" }],
          })
        : [];
    return {
      items: orgRows,
      holdingDefaults: holdingRows,
      builtins: DEFAULT_ORDER_TEMPLATES.map((t) => ({
        type: t.type,
        locale: t.locale,
        name: t.name,
        placeholders: t.placeholders,
      })),
    };
  }

  async upsertTemplate(
    organizationId: string,
    actorUserId: string,
    dto: UpsertPersonnelOrderTemplateDto,
  ) {
    await this.entitlement.assertWorkforceHub(organizationId);
    const locale = (dto.locale ?? "az").toLowerCase();
    if (locale !== "az" && locale !== "ru") {
      throw new BadRequestException("locale must be az or ru");
    }
    const scope = dto.scope === "holding" ? "holding" : "org";
    let holdingId: string | null = null;
    if (scope === "holding") {
      const org = await this.prisma.organization.findFirst({
        where: { id: organizationId },
        select: { holdingId: true },
      });
      if (!org?.holdingId) {
        throw new BadRequestException("Organization is not in a holding");
      }
      holdingId = org.holdingId;
    }

    const existing = await this.prisma.workforcePersonnelOrderTemplate.findFirst({
      where:
        scope === "holding"
          ? { holdingId: holdingId!, type: dto.type, locale, organizationId: null }
          : { organizationId, type: dto.type, locale, holdingId: null },
    });

    const data = {
      name: dto.name.trim(),
      bodyHtml: dto.bodyHtml,
      placeholders: (dto.placeholders ?? []) as Prisma.InputJsonValue,
      updatedAt: new Date(),
    };

    const row = existing
      ? await this.prisma.workforcePersonnelOrderTemplate.update({
          where: { id: existing.id },
          data,
        })
      : await this.prisma.workforcePersonnelOrderTemplate.create({
          data: {
            organizationId: scope === "org" ? organizationId : null,
            holdingId: scope === "holding" ? holdingId : null,
            type: dto.type,
            locale,
            ...data,
            createdAt: new Date(),
          },
        });

    await this.audit.log({
      organizationId,
      actorUserId,
      action: "PERSONNEL_ORDER_TEMPLATE_UPSERTED",
      entityType: "WorkforcePersonnelOrderTemplate",
      entityId: row.id,
      payload: { type: row.type, locale: row.locale, scope },
    });
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

    if (dto.type === WorkforcePersonnelOrderType.LEAVE_ANNUAL) {
      // Prefer template path; allow create without template (issue will require template).
    }

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

    const year = parseDateOnly(dto.effectiveDate).getUTCFullYear();
    const { orderNumber, sequenceYear, sequenceSeq } = await this.allocateNumber(
      organizationId,
      dto.type,
      year,
    );

    const issue = dto.issue === true;
    const locale = (dto.locale ?? "az").toLowerCase();
    const now = new Date();

    let contextJson: Prisma.InputJsonValue | undefined;
    if (issue) {
      contextJson = (await this.buildContextSnapshot({
        organizationId,
        employment,
        type: dto.type,
        orderNumber,
        effectiveDate: dto.effectiveDate.slice(0, 10),
        note: dto.note?.trim() ?? "",
        personDisplayName,
        leaveStartDate: dto.leaveStartDate,
        leaveEndDate: dto.leaveEndDate,
      })) as Prisma.InputJsonValue;
    } else if (dto.leaveStartDate || dto.leaveEndDate || dto.note?.trim()) {
      // Persist leave window on DRAFT so issue() can merge Finance without losing dates.
      contextJson = {
        leave: {
          startDate: dto.leaveStartDate?.slice(0, 10) ?? null,
          endDate: dto.leaveEndDate?.slice(0, 10) ?? null,
          remainingDays: null,
        },
        order: {
          note: dto.note?.trim() ?? "",
        },
      } as Prisma.InputJsonValue;
    }

    if (issue && dto.type === WorkforcePersonnelOrderType.LEAVE_ANNUAL) {
      const tpl = await this.resolveTemplate(organizationId, dto.type, locale);
      if (!tpl) {
        throw new BadRequestException({
          code: "PERSONNEL_ORDER_TEMPLATE_REQUIRED",
          message: "LEAVE_ANNUAL requires an HTML template before ISSUED",
        });
      }
    }

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
        sequenceYear,
        sequenceSeq,
        effectiveDate: parseDateOnly(dto.effectiveDate),
        note: dto.note?.trim() ?? "",
        locale,
        personDisplayName,
        contextJson,
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
      globalPersonId: employment.globalPersonId,
      cpEmploymentId: employment.id,
      payload: { type: row.type, orderNumber: row.orderNumber },
    });

    return row;
  }

  /**
   * Idempotent DRAFT for hire/terminate/transfer/vacation approve hooks.
   * Skips when a DRAFT or ISSUED already exists for employment+type+effectiveDate.
   */
  async ensureDraftForMutation(input: {
    organizationId: string;
    actorUserId: string;
    employmentId: string;
    type: WorkforcePersonnelOrderType;
    effectiveDate: string;
    note?: string;
    leaveStartDate?: string;
    leaveEndDate?: string;
  }) {
    await this.entitlement.assertWorkforceHub(input.organizationId);
    const link = await this.scopeService.resolveScopeForCommercialOrg(
      input.organizationId,
    );
    const effective = parseDateOnly(input.effectiveDate);
    const existing = await this.prisma.workforcePersonnelOrder.findFirst({
      where: {
        workforceScopeId: link.workforceScope.id,
        employmentId: input.employmentId,
        type: input.type,
        effectiveDate: effective,
        status: {
          in: [
            WorkforcePersonnelOrderStatus.DRAFT,
            WorkforcePersonnelOrderStatus.ISSUED,
          ],
        },
      },
    });
    if (existing) return existing;
    return this.create(input.organizationId, input.actorUserId, {
      employmentId: input.employmentId,
      type: input.type,
      effectiveDate: input.effectiveDate.slice(0, 10),
      note: input.note,
      leaveStartDate: input.leaveStartDate,
      leaveEndDate: input.leaveEndDate,
      issue: false,
    });
  }

  async assertTerminateAllowed(organizationId: string, employmentId: string) {
    const org = await this.prisma.organization.findFirst({
      where: { id: organizationId },
      select: { settings: true },
    });
    if (!requireOrderIssuedGate(org?.settings)) return;
    const issued = await this.prisma.workforcePersonnelOrder.findFirst({
      where: {
        organizationId,
        employmentId,
        type: WorkforcePersonnelOrderType.TERMINATE,
        status: WorkforcePersonnelOrderStatus.ISSUED,
      },
    });
    if (!issued) {
      throw new BadRequestException({
        code: "PERSONNEL_ORDER_ISSUE_REQUIRED",
        message:
          "Org requires ISSUED TERMINATE order before employment terminate",
      });
    }
  }

  async listDraftBanners(organizationId: string, employmentIds: string[]) {
    if (!employmentIds.length) return {};
    const drafts = await this.prisma.workforcePersonnelOrder.findMany({
      where: {
        organizationId,
        employmentId: { in: employmentIds },
        status: WorkforcePersonnelOrderStatus.DRAFT,
      },
      select: { employmentId: true, type: true, id: true, orderNumber: true },
    });
    const out: Record<
      string,
      Array<{ id: string; type: string; orderNumber: string }>
    > = {};
    for (const d of drafts) {
      const list = out[d.employmentId] ?? [];
      list.push({ id: d.id, type: d.type, orderNumber: d.orderNumber });
      out[d.employmentId] = list;
    }
    return out;
  }

  async issue(organizationId: string, id: string, actorUserId: string) {
    const row = await this.getOne(organizationId, id);
    if (row.status !== WorkforcePersonnelOrderStatus.DRAFT) {
      throw new BadRequestException("Only DRAFT orders can be issued");
    }
    const locale = row.locale || "az";
    if (row.type === WorkforcePersonnelOrderType.LEAVE_ANNUAL) {
      const tpl = await this.resolveTemplate(organizationId, row.type, locale);
      if (!tpl) {
        throw new BadRequestException({
          code: "PERSONNEL_ORDER_TEMPLATE_REQUIRED",
          message: "LEAVE_ANNUAL requires an HTML template before ISSUED",
        });
      }
    }

    const leave =
      row.contextJson && typeof row.contextJson === "object"
        ? (row.contextJson as Record<string, unknown>).leave
        : undefined;
    const leaveObj =
      leave && typeof leave === "object"
        ? (leave as Record<string, unknown>)
        : {};

    const contextJson = await this.buildContextSnapshot({
      organizationId,
      employment: row.employment,
      type: row.type,
      orderNumber: row.orderNumber,
      effectiveDate: row.effectiveDate.toISOString().slice(0, 10),
      note: row.note,
      personDisplayName: row.personDisplayName,
      leaveStartDate:
        typeof leaveObj.startDate === "string" ? leaveObj.startDate : undefined,
      leaveEndDate:
        typeof leaveObj.endDate === "string" ? leaveObj.endDate : undefined,
    });

    const updated = await this.prisma.workforcePersonnelOrder.update({
      where: { id },
      data: {
        status: WorkforcePersonnelOrderStatus.ISSUED,
        issuedByUserId: actorUserId,
        issuedAt: new Date(),
        contextJson: contextJson as Prisma.InputJsonValue,
        personDisplayName:
          (contextJson.person as { fullName?: string } | undefined)?.fullName ??
          row.personDisplayName,
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
      globalPersonId: row.employment.globalPersonId,
      cpEmploymentId: row.employmentId,
      payload: { type: updated.type, orderNumber: updated.orderNumber },
    });
    return updated;
  }

  async cancel(organizationId: string, id: string, actorUserId: string) {
    const row = await this.getOne(organizationId, id);
    if (row.status !== WorkforcePersonnelOrderStatus.DRAFT) {
      throw new BadRequestException({
        code: "PERSONNEL_ORDER_CANCEL_DRAFT_ONLY",
        message: "Only DRAFT orders can be cancelled",
      });
    }
    const updated = await this.prisma.workforcePersonnelOrder.update({
      where: { id },
      data: {
        status: WorkforcePersonnelOrderStatus.CANCELLED,
        cancelledAt: new Date(),
        cancelledByUserId: actorUserId,
      },
      include: {
        employment: { include: { orgUnit: true, position: true } },
      },
    });
    await this.audit.log({
      organizationId,
      workforceScopeId: row.workforceScopeId,
      actorUserId,
      action: "PERSONNEL_ORDER_CANCELLED",
      entityType: "WorkforcePersonnelOrder",
      entityId: id,
      globalPersonId: row.employment.globalPersonId,
      cpEmploymentId: row.employmentId,
      payload: { type: updated.type, orderNumber: updated.orderNumber },
    });
    return updated;
  }

  async previewTemplatePdf(
    organizationId: string,
    dto: PreviewPersonnelOrderTemplateDto,
  ): Promise<{ buffer: Buffer; filename: string }> {
    await this.entitlement.assertWorkforceHub(organizationId);
    const locale = dto.locale.toLowerCase();
    if (locale !== "az" && locale !== "ru") {
      throw new BadRequestException("locale must be az or ru");
    }

    const org = await this.prisma.organization.findFirst({
      where: { id: organizationId },
      select: { name: true, settings: true },
    });

    const year = new Date().getUTCFullYear();
    const ctx = {
      order: {
        number: formatOrderNumber(dto.type, year, 1),
        type: dto.type,
        effectiveDate: new Date().toISOString().slice(0, 10),
        note: "Sample note / Nümunə qeyd",
      },
      person: {
        globalPersonId: "00000000-0000-4000-8000-000000000001",
        fullName: "Sample Person / Nümunə İşçi",
        firstName: "Sample",
        middleName: "",
        lastName: "Person",
      },
      employment: {
        id: "00000000-0000-4000-8000-000000000002",
        position: "Sample Position",
        orgUnit: "Sample Org Unit",
        hireDate: "2026-01-01",
      },
      org: {
        id: organizationId,
        name: org?.name ?? "Sample Organization",
        voen: orgVoenFromSettings(org?.settings) ?? "1234567890",
      },
      salary: {
        contract: "1200.00",
      },
      leave: {
        remainingDays: 21,
        startDate: "—",
        endDate: "—",
      },
    };

    const html = applyTemplatePlaceholders(dto.bodyHtml, ctx);
    const plain = htmlToPlainText(html);

    const chunks: Buffer[] = [];
    const doc = new PDFDocument({ margin: 50, size: "A4" });
    registerUnicodeFonts(doc);
    doc.on("data", (c: Buffer) => chunks.push(c));
    const done = new Promise<Buffer>((resolve) => {
      doc.on("end", () => resolve(Buffer.concat(chunks)));
    });
    doc.font(PDF_FONT_UNICODE).fontSize(11).text(plain, { align: "left" });
    doc.end();
    const buffer = await done;

    return {
      buffer,
      filename: `template-preview-${dto.type}-${locale}.pdf`,
    };
  }

  async buildPdfBuffer(
    organizationId: string,
    id: string,
    actorUserId?: string,
  ): Promise<{ buffer: Buffer; filename: string }> {
    const row = await this.getOne(organizationId, id);
    const locale = row.locale || "az";
    const ctx =
      row.contextJson && typeof row.contextJson === "object"
        ? (row.contextJson as Record<string, unknown>)
        : await this.buildContextSnapshot({
            organizationId,
            employment: row.employment,
            type: row.type,
            orderNumber: row.orderNumber,
            effectiveDate: row.effectiveDate.toISOString().slice(0, 10),
            note: row.note,
            personDisplayName: row.personDisplayName,
          });

    const template = await this.resolveTemplate(organizationId, row.type, locale);
    let plain: string;
    if (template) {
      const html = applyTemplatePlaceholders(template.bodyHtml, ctx);
      plain = htmlToPlainText(html);
    } else if (row.type === WorkforcePersonnelOrderType.LEAVE_ANNUAL) {
      throw new BadRequestException({
        code: "PERSONNEL_ORDER_TEMPLATE_REQUIRED",
        message: "LEAVE_ANNUAL PDF requires an HTML template",
      });
    } else {
      plain = this.fallbackPlainText(row, ctx);
    }

    const chunks: Buffer[] = [];
    const doc = new PDFDocument({ margin: 50, size: "A4" });
    registerUnicodeFonts(doc);
    doc.on("data", (c: Buffer) => chunks.push(c));
    const done = new Promise<Buffer>((resolve) => {
      doc.on("end", () => resolve(Buffer.concat(chunks)));
    });
    doc.font(PDF_FONT_UNICODE).fontSize(11).text(plain, { align: "left" });
    doc.end();
    const buffer = await done;

    if (actorUserId) {
      await this.audit.log({
        organizationId,
        workforceScopeId: row.workforceScopeId,
        actorUserId,
        action: "PERSONNEL_ORDER_PDF_DOWNLOADED",
        entityType: "WorkforcePersonnelOrder",
        entityId: row.id,
        globalPersonId: row.employment.globalPersonId,
        cpEmploymentId: row.employmentId,
        payload: { orderNumber: row.orderNumber, type: row.type },
      });
    }

    return {
      buffer,
      filename: `${row.orderNumber.replace(/[^\w.-]+/g, "_")}.pdf`,
    };
  }

  /** Map absence VACATION approve → LEAVE_ANNUAL draft. */
  orderTypeForAbsenceKind(
    kind: WorkforceAbsenceKind,
  ): WorkforcePersonnelOrderType | null {
    if (kind === WorkforceAbsenceKind.VACATION) {
      return WorkforcePersonnelOrderType.LEAVE_ANNUAL;
    }
    return null;
  }

  private async allocateNumber(
    organizationId: string,
    type: WorkforcePersonnelOrderType,
    year: number,
  ) {
    const agg = await this.prisma.workforcePersonnelOrder.aggregate({
      where: {
        organizationId,
        type,
        sequenceYear: year,
      },
      _max: { sequenceSeq: true },
    });
    const sequenceSeq = (agg._max.sequenceSeq ?? 0) + 1;
    return {
      sequenceYear: year,
      sequenceSeq,
      orderNumber: formatOrderNumber(type, year, sequenceSeq),
    };
  }

  private async resolveTemplate(
    organizationId: string,
    type: WorkforcePersonnelOrderType,
    locale: string,
  ): Promise<{ bodyHtml: string; name: string } | null> {
    const orgTpl = await this.prisma.workforcePersonnelOrderTemplate.findFirst({
      where: { organizationId, type, locale, holdingId: null },
    });
    if (orgTpl) return orgTpl;

    const org = await this.prisma.organization.findFirst({
      where: { id: organizationId },
      select: { holdingId: true },
    });
    if (org?.holdingId) {
      const holdingTpl =
        await this.prisma.workforcePersonnelOrderTemplate.findFirst({
          where: {
            holdingId: org.holdingId,
            type,
            locale,
            organizationId: null,
          },
        });
      if (holdingTpl) return holdingTpl;
    }

    const builtin = DEFAULT_ORDER_TEMPLATES.find(
      (t) => t.type === type && t.locale === locale,
    );
    return builtin
      ? { bodyHtml: builtin.bodyHtml, name: builtin.name }
      : null;
  }

  private async buildContextSnapshot(input: {
    organizationId: string;
    employment: {
      id: string;
      globalPersonId: string;
      hireDate?: Date;
      orgUnit?: { name: string } | null;
      position?: { name: string } | null;
    };
    type: WorkforcePersonnelOrderType;
    orderNumber: string;
    effectiveDate: string;
    note: string;
    personDisplayName: string | null;
    leaveStartDate?: string;
    leaveEndDate?: string;
  }) {
    const org = await this.prisma.organization.findFirst({
      where: { id: input.organizationId },
      select: { name: true, settings: true },
    });

    let firstName = "";
    let middleName = "";
    let lastName = "";
    let fullName = input.personDisplayName ?? "";
    try {
      const profile = await this.mdm.getPersonOpsProfile(
        input.employment.globalPersonId,
        input.organizationId,
      );
      firstName = profile?.firstName ?? "";
      middleName = profile?.middleName ?? "";
      lastName = profile?.lastName ?? "";
      fullName = profile?.fullName ?? fullName;
    } catch {
      /* keep display snapshot */
    }

    const mirror = await this.financeMirror.fetchEmploymentMirror(
      input.organizationId,
      input.employment.id,
    );

    return {
      order: {
        number: input.orderNumber,
        type: input.type,
        effectiveDate: input.effectiveDate,
        note: input.note || "—",
      },
      person: {
        globalPersonId: input.employment.globalPersonId,
        fullName: fullName || "—",
        firstName: firstName || "—",
        middleName: middleName || "—",
        lastName: lastName || "—",
      },
      employment: {
        id: input.employment.id,
        position: input.employment.position?.name ?? "—",
        orgUnit: input.employment.orgUnit?.name ?? "—",
        hireDate: input.employment.hireDate
          ? input.employment.hireDate.toISOString().slice(0, 10)
          : "—",
      },
      org: {
        id: input.organizationId,
        name: org?.name ?? "—",
        voen: orgVoenFromSettings(org?.settings) ?? "—",
      },
      salary: {
        contract:
          mirror.salary == null || Number.isNaN(mirror.salary)
            ? "—"
            : String(mirror.salary),
      },
      leave: {
        remainingDays:
          mirror.vacationDaysBalance == null ||
          Number.isNaN(mirror.vacationDaysBalance)
            ? null
            : mirror.vacationDaysBalance,
        startDate: input.leaveStartDate ?? "—",
        endDate: input.leaveEndDate ?? "—",
      },
    };
  }

  private fallbackPlainText(
    row: {
      type: WorkforcePersonnelOrderType;
      orderNumber: string;
      effectiveDate: Date;
      status: string;
      note: string;
      personDisplayName: string | null;
      employment: {
        globalPersonId: string;
        orgUnit: { name: string };
        position: { name: string };
      };
    },
    ctx: Record<string, unknown>,
  ): string {
    const typeLabel =
      row.type === WorkforcePersonnelOrderType.HIRE
        ? "İşə qəbul əmri / Hire order"
        : row.type === WorkforcePersonnelOrderType.TRANSFER
          ? "Yerdəyişmə əmri / Transfer order"
          : row.type === WorkforcePersonnelOrderType.LEAVE_ANNUAL
            ? "Məzuniyyət əmri / Leave order"
            : "Xitam əmri / Termination order";
    const person =
      (ctx.person as { fullName?: string } | undefined)?.fullName ??
      row.personDisplayName ??
      row.employment.globalPersonId;
    return [
      typeLabel,
      `Order №: ${row.orderNumber}`,
      `Effective date: ${row.effectiveDate.toISOString().slice(0, 10)}`,
      `Status: ${row.status}`,
      `Person: ${person}`,
      `Org unit: ${row.employment.orgUnit.name}`,
      `Position: ${row.employment.position.name}`,
      row.note ? `Note: ${row.note}` : "",
      "",
      "______________________",
      "HR / Director",
    ]
      .filter(Boolean)
      .join("\n");
  }
}
