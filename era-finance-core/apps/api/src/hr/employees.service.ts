import {
  BadRequestException,
  ConflictException,
  HttpException,
  HttpStatus,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import {
  EmployeeEmploymentStatus,
  EmployeeKind,
  Prisma,
  TaxResidencyStatus,
} from "@erafinance/database";
import { PrismaService } from "../prisma/prisma.service";
import { IntegrationSyncRunService } from "../integrations/integration-sync-run.service";
import { OrchestratorMdmClientService } from "../orchestrator/orchestrator-mdm-client.service";
import { BulkSyncResultEmployeesDto } from "./dto/bulk-sync-result-employees.dto";
import { ConvertEmployeeToFinDto, CreateEmployeeDto } from "./dto/create-employee.dto";
import { UpdateEmployeeDto } from "./dto/update-employee.dto";
import {
  blindIndex,
  decryptText,
  encryptText,
  normalizeVoen,
} from "../security/pii-crypto.util";
import {
  attachEmployeePerson,
  batchEmployeePersonMap,
  personDisplayFromOpsProfile,
  splitAzPersonName,
} from "./employee-person.util";
import type { ResolvePersonInput } from "../orchestrator/orchestrator-mdm-client.service";

const Decimal = Prisma.Decimal;

@Injectable()
export class EmployeesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly syncRuns: IntegrationSyncRunService,
    private readonly mdm: OrchestratorMdmClientService,
  ) {}

  async list(
    organizationId: string,
    query?: { page?: number; pageSize?: number; departmentId?: string },
  ) {
    const page = Math.max(1, query?.page ?? 1);
    const pageSize = Math.min(500, Math.max(1, query?.pageSize ?? 20));
    const where = {
      organizationId,
      ...(query?.departmentId
        ? { jobPosition: { departmentId: query.departmentId } }
        : {}),
    };
    const result = await this.prisma.$transaction(async (tx) => {
      const total = await tx.employee.count({ where });
      const items = await tx.employee.findMany({
        where,
        orderBy: [{ hireDate: "desc" }, { createdAt: "desc" }],
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: {
          jobPosition: {
            include: { department: { select: { id: true, name: true } } },
          },
        },
      });
      return { items, total, page, pageSize };
    });
    const personIds = result.items
      .map((e) => e.globalPersonId)
      .filter((id): id is string => Boolean(id));
    const personMap = await batchEmployeePersonMap(this.mdm, organizationId, personIds);
    const persons = Object.fromEntries(
      [...personMap.entries()].map(([id, p]) => [
        id,
        {
          displayName: p.displayName,
          finMasked: p.finMasked,
          accessDenied: p.accessDenied,
        },
      ]),
    );
    return {
      ...result,
      items: result.items
        .filter((item): item is typeof item & { globalPersonId: string } =>
          Boolean(item.globalPersonId),
        )
        .map((item) => attachEmployeePerson(item, personMap)),
      persons,
    };
  }

  async resolvePersonForHire(organizationId: string, input: ResolvePersonInput) {
    const resolved = await this.mdm.workforceResolve({
      ...input,
      organizationId,
    });
    if (!resolved?.globalPersonId) {
      throw new BadRequestException("MDM person resolve failed");
    }
    return {
      globalPersonId: resolved.globalPersonId,
      created: resolved.created,
      person: personDisplayFromOpsProfile(resolved.opsProfile),
    };
  }

  private async personDisplay(organizationId: string, globalPersonId: string) {
    const map = await this.mdm.batchOpsProfile([globalPersonId], organizationId);
    const row = map[globalPersonId];
    if (!row) {
      return {
        displayName: null as string | null,
        finMasked: null as string | null,
        accessDenied: true,
      };
    }
    return {
      displayName: row.displayName,
      finMasked: row.primaryIdentifierMasked,
      accessDenied: row.accessDenied,
    };
  }

  private async assertPositionSlotAvailableTx(
    tx: Prisma.TransactionClient,
    organizationId: string,
    positionId: string,
    excludeEmployeeId?: string,
  ) {
    const pos = await tx.jobPosition.findFirst({
      where: { id: positionId, department: { organizationId } },
    });
    if (!pos) {
      throw new BadRequestException("Указанная должность не найдена в организации");
    }
    const cnt = await tx.employee.count({
      where: {
        organizationId,
        positionId,
        employmentStatus: EmployeeEmploymentStatus.ACTIVE,
        ...(excludeEmployeeId ? { id: { not: excludeEmployeeId } } : {}),
      },
    });
    if (cnt >= pos.totalSlots) {
      throw new HttpException({
        statusCode: HttpStatus.PAYMENT_REQUIRED,
        code: "QUOTA_EXCEEDED",
        message: "Штатный лимит по этой должности исчерпан",
        limit: pos.totalSlots,
        current: cnt,
      }, HttpStatus.PAYMENT_REQUIRED);
    }
  }

  private static readonly hireGateTxOptions = {
    isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
    maxWait: 5000,
    timeout: 15000,
  } as const;

  async create(organizationId: string, dto: CreateEmployeeDto) {
    const kind = dto.kind ?? EmployeeKind.EMPLOYEE;
    if (kind === EmployeeKind.CONTRACTOR && !dto.voen?.trim()) {
      throw new BadRequestException("Для подрядчика (CONTRACTOR) укажите VÖEN (10 цифр)");
    }
    const globalPersonId = dto.globalPersonId.trim();
    const profiles = await this.mdm.batchOpsProfile([globalPersonId], organizationId);
    if (!profiles[globalPersonId]) {
      throw new BadRequestException("MDM person not found or access denied");
    }
    const compliance = await this.mdm.complianceIdentity(globalPersonId, organizationId);
    const hasFin = Boolean(compliance?.fin);
    try {
      const created = await this.prisma.$transaction(
        async (tx) => {
          await this.assertPositionSlotAvailableTx(
            tx,
            organizationId,
            dto.positionId,
          );
          const voenRaw =
            kind === EmployeeKind.CONTRACTOR
              ? dto.voen!.trim()
              : (dto.voen?.trim() ?? null);
          const createData: Record<string, unknown> = {
            organizationId,
            kind,
            globalPersonId,
            taxResidencyStatus: dto.taxResidencyStatus ?? TaxResidencyStatus.RESIDENT,
            nationality: dto.nationality?.trim() ?? "AZ",
            workPermitNumber: dto.workPermitNumber?.trim() ?? null,
            emasEligible: hasFin,
            userId: dto.userId ?? null,
            cpEmploymentId: dto.cpEmploymentId?.trim() ?? null,
            voenBlindIndex: voenRaw ? blindIndex("voen", normalizeVoen(voenRaw)) : null,
            voenCipher: voenRaw ? encryptText(normalizeVoen(voenRaw)) : null,
            patronymic: dto.patronymic?.trim() || null,
            positionId: dto.positionId,
            startDate: new Date(dto.startDate),
            hireDate: new Date(dto.hireDate),
            salary: new Decimal(dto.salary),
            initialVacationDays: new Decimal(dto.initialVacationDays ?? 0),
            avgMonthlySalaryLastYear:
              dto.avgMonthlySalaryLastYear != null
                ? new Decimal(dto.avgMonthlySalaryLastYear)
                : null,
            initialSalaryBalance: new Decimal(dto.initialSalaryBalance ?? 0),
            contractorMonthlySocialAzn:
              kind === EmployeeKind.CONTRACTOR &&
              dto.contractorMonthlySocialAzn != null
                ? new Decimal(dto.contractorMonthlySocialAzn)
                : null,
          };
          return tx.employee.create({
            data: createData as Prisma.EmployeeUncheckedCreateInput,
            include: {
              jobPosition: {
                include: { department: { select: { id: true, name: true } } },
              },
            },
          });
        },
        EmployeesService.hireGateTxOptions,
      );
      const person = await this.personDisplay(organizationId, globalPersonId);
      return { ...created, person };
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
        throw new ConflictException("Employee already linked to this MDM person");
      }
      throw e;
    }
  }

  async convertToFin(
    organizationId: string,
    id: string,
    dto: ConvertEmployeeToFinDto,
  ) {
    const current = await this.getOne(organizationId, id);
    const fin = dto.finCode.trim();
    let globalPersonId = current.globalPersonId;
    const person = current.person as { displayName?: string | null };
    const fullName = person?.displayName?.trim() || "Employee";
    if (globalPersonId) {
      const finLookup = await this.mdm.lookupPersonByFin(fin, organizationId);
      if (finLookup?.globalPersonId && finLookup.globalPersonId !== globalPersonId) {
        const merged = await this.mdm.mergePersons(
          globalPersonId,
          finLookup.globalPersonId,
          organizationId,
        );
        globalPersonId = merged.globalPersonId ?? finLookup.globalPersonId;
      }
    } else {
      globalPersonId = (
        await this.mdm.resolvePersonIdentity({ fin, fullName })
      ).globalPersonId!;
    }
    const updated = await this.prisma.employee.update({
      where: { id },
      data: {
        globalPersonId,
        emasEligible: true,
        taxResidencyStatus: TaxResidencyStatus.RESIDENT,
      },
      include: {
        jobPosition: {
          include: { department: { select: { id: true, name: true } } },
        },
      },
    });
    const personDisplay = await this.personDisplay(organizationId, globalPersonId);
    return { ...updated, person: personDisplay };
  }

  async getOne(organizationId: string, id: string) {
    const row = await this.prisma.employee.findFirst({
      where: { id, organizationId },
      include: {
        jobPosition: {
          include: { department: { select: { id: true, name: true } } },
        },
      },
    });
    if (!row) throw new NotFoundException("Employee not found");
    if (!row.globalPersonId) {
      throw new BadRequestException("Employee missing MDM globalPersonId link");
    }
    const person = await this.personDisplay(organizationId, row.globalPersonId);
    return { ...row, person };
  }

  /** Minimal DTO for ERA Finance Assistant (ƏMAS e-müqavilə prefill). */
  async getExtensionPrefill(organizationId: string, id: string) {
    return this.buildEmasPrefill(organizationId, id);
  }

  /** Plan F — alias; resolves by finance employee id or cpEmploymentId query. */
  async getEmasPrefill(
    organizationId: string,
    opts: { employeeId?: string; cpEmploymentId?: string },
  ) {
    let employeeId = opts.employeeId?.trim();
    if (!employeeId && opts.cpEmploymentId?.trim()) {
      const mirror = await this.prisma.employee.findFirst({
        where: { organizationId, cpEmploymentId: opts.cpEmploymentId.trim() },
        select: { id: true },
      });
      if (!mirror) {
        throw new NotFoundException("Employee mirror not found for cpEmploymentId");
      }
      employeeId = mirror.id;
    }
    if (!employeeId) {
      throw new BadRequestException("employeeId or cpEmploymentId required");
    }
    return this.buildEmasPrefill(organizationId, employeeId, opts.cpEmploymentId);
  }

  private async buildEmasPrefill(
    organizationId: string,
    id: string,
    cpEmploymentIdHint?: string,
  ) {
    const row = await this.getOne(organizationId, id);
    const start = row.startDate.toISOString().slice(0, 10);
    const person = row.person as {
      displayName: string | null;
      finMasked: string | null;
      accessDenied: boolean;
    };
    const compliance = await this.mdm.complianceIdentity(row.globalPersonId, organizationId);

    const cpEmploymentId = row.cpEmploymentId ?? cpEmploymentIdHint ?? null;
    let absenceWindow: { startDate: string; endDate: string; kind: string } | null =
      null;
    if (cpEmploymentId) {
      const mirror = await this.prisma.absence.findFirst({
        where: {
          organizationId,
          cpAbsenceId: { not: null },
          employeeId: row.id,
          approved: true,
        },
        include: { absenceType: true },
        orderBy: { startDate: "desc" },
      });
      if (mirror) {
        absenceWindow = {
          startDate: mirror.startDate.toISOString().slice(0, 10),
          endDate: mirror.endDate.toISOString().slice(0, 10),
          kind: mirror.absenceType?.code ?? "ABSENCE",
        };
      }
    }

    const nameParts = (person.displayName ?? "").split(/\s+/).filter(Boolean);
    const firstName = nameParts[0] ?? "";
    const lastName = nameParts.slice(1).join(" ") || firstName;
    if (!row.emasEligible || !compliance?.fin) {
      return {
        employeeId: row.id,
        cpEmploymentId,
        emasStatus: "PENDING_FIN" as const,
        firstName,
        lastName,
        finCode: null,
        positionTitle: row.jobPosition.name,
        departmentName: row.jobPosition.department?.name ?? null,
        salaryGrossAzn: row.salary.toFixed(2),
        contractStartDate: start,
        contractEndDate: null as string | null,
        contractId: row.id,
        absenceWindow,
        message: "ƏMAS requires FIN — use convert-to-FIN when citizen ID is available",
      };
    }
    return {
      employeeId: row.id,
      cpEmploymentId,
      emasStatus: "READY" as const,
      firstName,
      lastName,
      finCode: compliance.fin,
      positionTitle: row.jobPosition.name,
      departmentName: row.jobPosition.department?.name ?? null,
      salaryGrossAzn: row.salary.toFixed(2),
      contractStartDate: start,
      contractEndDate: null as string | null,
      contractId: row.id,
      absenceWindow,
    };
  }

  async getExtensionPrefillBulk(organizationId: string, employeeIds: string[]) {
    const normalized = Array.from(new Set(employeeIds.map((id) => id.trim()).filter(Boolean)));
    const items = await Promise.all(
      normalized.map(async (employeeId) => ({
        employeeId,
        data: await this.getExtensionPrefill(organizationId, employeeId),
      })),
    );
    const runId = await this.syncRuns.start({
      organizationId,
      portal: "EMAS",
      flow: "emuqavile",
      transport: "RPA_WIDGET",
      totalCount: items.length,
    });
    return { runId, items };
  }

  async saveBulkSyncResult(
    organizationId: string,
    dto: BulkSyncResultEmployeesDto,
    triggeredByUserId?: string,
  ) {
    const syncedAt = new Date();
    await this.prisma.$transaction(async (tx) => {
      for (const item of dto.items) {
        await tx.employee.updateMany({
          where: { organizationId, id: item.employeeId },
          data: {
            emasSyncStatus: item.status,
            emasSyncedAt: item.status === "SYNCED" ? syncedAt : null,
            emasSyncError: item.error ?? null,
            emasExternalId: item.externalId ?? null,
          } as never,
        });
      }
    });

    const successCount = dto.items.filter((it) => it.status === "SYNCED").length;
    const errorCount = dto.items.length - successCount;
    try {
      await this.syncRuns.complete({
        runId: dto.runId,
        successCount,
        errorCount,
        notes: { triggeredByUserId: triggeredByUserId ?? null },
      });
    } catch {
      const runId = await this.syncRuns.start({
        organizationId,
        portal: "EMAS",
        flow: "emuqavile",
        transport: "RPA_WIDGET",
        totalCount: dto.items.length,
        triggeredByUserId,
      });
      await this.syncRuns.complete({ runId, successCount, errorCount });
    }

    return { ok: true, successCount, errorCount };
  }

  async update(organizationId: string, id: string, dto: UpdateEmployeeDto) {
    const current = await this.getOne(organizationId, id);
    const kind = dto.kind ?? current.kind;
    if (kind === EmployeeKind.CONTRACTOR) {
      const voen =
        dto.voen?.trim() ??
        ((current as { voenCipher?: string | null }).voenCipher
          ? (decryptText((current as { voenCipher?: string | null }).voenCipher ?? "")?.trim() ?? "")
          : "");
      if (!/^\d{10}$/.test(voen)) {
        throw new BadRequestException("Для подрядчика укажите VÖEN (10 цифр)");
      }
    }
    const data: Record<string, unknown> = {};
    if (dto.kind != null) data.kind = dto.kind;
    if (dto.taxResidencyStatus != null) data.taxResidencyStatus = dto.taxResidencyStatus;
    if (dto.nationality != null) data.nationality = dto.nationality.trim();
    if (dto.workPermitNumber !== undefined) {
      data.workPermitNumber = dto.workPermitNumber?.trim() || null;
    }
    if (dto.userId !== undefined) data.userId = dto.userId;
    if (dto.patronymic !== undefined) {
      const p = dto.patronymic.trim();
      data.patronymic = p.length ? p : null;
    }
    if (dto.positionId != null) data.positionId = dto.positionId;
    if (dto.startDate != null) data.startDate = new Date(dto.startDate);
    if (dto.hireDate != null) data.hireDate = new Date(dto.hireDate);
    if (dto.dateOfBirth !== undefined) {
      data.dateOfBirth = dto.dateOfBirth ? new Date(dto.dateOfBirth) : null;
    }
    if (dto.contractEndDate !== undefined) {
      data.contractEndDate = dto.contractEndDate ? new Date(dto.contractEndDate) : null;
    }
    if (dto.salary != null) data.salary = new Decimal(dto.salary);
    if (dto.voen !== undefined) {
      const voen = dto.voen.trim() || null;
      data.voenBlindIndex = voen ? blindIndex("voen", normalizeVoen(voen)) : null;
      data.voenCipher = voen ? encryptText(normalizeVoen(voen)) : null;
    }
    if (dto.contractorMonthlySocialAzn !== undefined) {
      data.contractorMonthlySocialAzn =
        dto.contractorMonthlySocialAzn == null
          ? null
          : new Decimal(dto.contractorMonthlySocialAzn);
    }
    if (dto.initialSalaryBalance !== undefined) {
      data.initialSalaryBalance =
        dto.initialSalaryBalance == null
          ? new Decimal(0)
          : new Decimal(dto.initialSalaryBalance);
    }
    if (dto.initialVacationDays !== undefined) {
      data.initialVacationDays =
        dto.initialVacationDays == null
          ? new Decimal(0)
          : new Decimal(dto.initialVacationDays);
    }
    if (dto.avgMonthlySalaryLastYear !== undefined) {
      data.avgMonthlySalaryLastYear =
        dto.avgMonthlySalaryLastYear == null
          ? null
          : new Decimal(dto.avgMonthlySalaryLastYear);
    }
    if (dto.accountableAccountCode244 !== undefined) {
      const v = dto.accountableAccountCode244?.trim();
      data.accountableAccountCode244 = v ? v : null;
    }

    const nextKind = (data.kind as EmployeeKind | undefined) ?? current.kind;
    if (nextKind === EmployeeKind.EMPLOYEE) {
      data.voenBlindIndex = null;
      data.voenCipher = null;
      data.contractorMonthlySocialAzn = null;
    } else if (nextKind === EmployeeKind.CONTRACTOR) {
      const v =
        (typeof data.voenCipher === "string" ? (decryptText(data.voenCipher)?.trim() ?? null) : null) ??
        ((current as { voenCipher?: string | null }).voenCipher
          ? (decryptText((current as { voenCipher?: string | null }).voenCipher ?? "")?.trim() ?? null)
          : null);
      data.voenCipher = v ? encryptText(normalizeVoen(v)) : null;
      data.voenBlindIndex = v ? blindIndex("voen", normalizeVoen(v)) : null;
    }
    const positionChanged =
      dto.positionId != null && dto.positionId !== current.positionId;

    const runUpdate = async (
      client: Pick<typeof this.prisma, "employee">,
    ) =>
      client.employee.update({
        where: { id },
        data,
        include: {
          jobPosition: {
            include: { department: { select: { id: true, name: true } } },
          },
        },
      });

    try {
      let updated;
      if (positionChanged) {
        updated = await this.prisma.$transaction(
          async (tx) => {
            await this.assertPositionSlotAvailableTx(
              tx,
              organizationId,
              dto.positionId!,
              id,
            );
            return runUpdate(tx);
          },
          EmployeesService.hireGateTxOptions,
        );
      } else {
        updated = await runUpdate(this.prisma);
      }
      return updated;
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
        throw new ConflictException("Duplicate employee link");
      }
      throw e;
    }
  }

  async remove(organizationId: string, id: string) {
    await this.getOne(organizationId, id);
    try {
      await this.prisma.employee.delete({ where: { id } });
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2003") {
        throw new ConflictException("Нельзя удалить: есть расчётные листовки");
      }
      throw e;
    }
  }
}
