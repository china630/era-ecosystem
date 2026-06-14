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
import { HrStaffProvisioningService } from "../integration/hr-staff-provisioning.service";
import { OrchestratorMdmClientService } from "../orchestrator/orchestrator-mdm-client.service";
import { BulkSyncResultEmployeesDto } from "./dto/bulk-sync-result-employees.dto";
import { ConvertEmployeeToFinDto, CreateEmployeeDto } from "./dto/create-employee.dto";
import { UpdateEmployeeDto } from "./dto/update-employee.dto";
import {
  blindIndex,
  decryptText,
  encryptText,
  normalizeFin,
  normalizeName,
  normalizeVoen,
  placeholderEmployeeFin,
  placeholderEmployeeFirstName,
  placeholderEmployeeLastName,
} from "../security/pii-crypto.util";

const Decimal = Prisma.Decimal;

@Injectable()
export class EmployeesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly syncRuns: IntegrationSyncRunService,
    private readonly mdm: OrchestratorMdmClientService,
    private readonly staffProvisioning: HrStaffProvisioningService,
  ) {}

  list(
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
    return this.prisma.$transaction(async (tx) => {
      const total = await tx.employee.count({ where });
      const items = await tx.employee.findMany({
        where,
        orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
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

  private validateIdentityInput(dto: {
    taxResidencyStatus?: TaxResidencyStatus;
    finCode?: string;
    passportNumber?: string;
    issuingCountry?: string;
  }) {
    const residency = dto.taxResidencyStatus ?? TaxResidencyStatus.RESIDENT;
    const fin = dto.finCode?.trim();
    const passport = dto.passportNumber?.trim();
    const country = dto.issuingCountry?.trim();
    if (residency === TaxResidencyStatus.RESIDENT && !fin) {
      throw new BadRequestException("Для резидента укажите ФИН");
    }
    if (residency === TaxResidencyStatus.NON_RESIDENT && !fin && (!passport || !country)) {
      throw new BadRequestException(
        "Для нерезидента без ФИН укажите passportNumber и issuingCountry",
      );
    }
  }

  private async resolveGlobalPersonId(
    organizationId: string,
    dto: {
      finCode?: string;
      passportNumber?: string;
      issuingCountry?: string;
      nationality?: string;
      firstName: string;
      lastName: string;
    },
  ): Promise<string | null> {
    const fullName = `${dto.firstName.trim()} ${dto.lastName.trim()}`;
    const resolved = await this.mdm.resolvePersonIdentity({
      fin: dto.finCode?.trim(),
      passport: dto.passportNumber?.trim(),
      issuingCountry: dto.issuingCountry?.trim() ?? dto.nationality?.trim(),
      fullName,
      nationality: dto.nationality?.trim(),
    });
    return resolved.globalPersonId;
  }

  private buildIdentityFields(dto: {
    taxResidencyStatus?: TaxResidencyStatus;
    finCode?: string;
    passportNumber?: string;
    issuingCountry?: string;
    nationality?: string;
    workPermitNumber?: string;
  }) {
    const residency = dto.taxResidencyStatus ?? TaxResidencyStatus.RESIDENT;
    const fin = dto.finCode?.trim();
    const passport = dto.passportNumber?.trim();
    const hasFin = Boolean(fin);
    const fields: Record<string, unknown> = {
      taxResidencyStatus: residency,
      nationality: dto.nationality?.trim() ?? "AZ",
      issuingCountry: dto.issuingCountry?.trim() ?? null,
      workPermitNumber: dto.workPermitNumber?.trim() ?? null,
      emasEligible: hasFin,
    };
    if (fin) {
      fields.finCode = placeholderEmployeeFin(fin);
      fields.finCodeBlindIndex = blindIndex("fin", normalizeFin(fin));
      fields.finCodeCipher = encryptText(normalizeFin(fin));
    } else {
      fields.finCode = null;
      fields.finCodeBlindIndex = null;
      fields.finCodeCipher = null;
    }
    if (passport) {
      fields.passportBlindIndex = blindIndex("passport", passport.toUpperCase());
      fields.passportNumberCipher = encryptText(passport.toUpperCase());
    }
    return fields;
  }

  async create(organizationId: string, dto: CreateEmployeeDto) {
    const kind = dto.kind ?? EmployeeKind.EMPLOYEE;
    if (kind === EmployeeKind.CONTRACTOR && !dto.voen?.trim()) {
      throw new BadRequestException("Для подрядчика (CONTRACTOR) укажите VÖEN (10 цифр)");
    }
    this.validateIdentityInput(dto);
    try {
      const globalPersonId = await this.resolveGlobalPersonId(organizationId, dto);
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
          const firstName = dto.firstName.trim();
          const lastName = dto.lastName.trim();
          const createData: Record<string, unknown> = {
            organizationId,
            kind,
            ...this.buildIdentityFields(dto),
            globalPersonId,
            userId: dto.userId ?? null,
            provisionedSatelliteKey: dto.provisionedSatelliteKey?.trim() ?? null,
            provisionedSatelliteRole: dto.provisionedSatelliteRole?.trim() ?? null,
            voenBlindIndex: voenRaw ? blindIndex("voen", normalizeVoen(voenRaw)) : null,
            voenCipher: voenRaw ? encryptText(normalizeVoen(voenRaw)) : null,
            firstName: placeholderEmployeeFirstName(firstName),
            firstNameCipher: encryptText(normalizeName(firstName)),
            lastName: placeholderEmployeeLastName(lastName),
            lastNameCipher: encryptText(normalizeName(lastName)),
            patronymic: dto.patronymic.trim(),
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
      await this.staffProvisioning.emitProvisioned(organizationId, created, {
        pin: dto.staffPin,
      });
      return created;
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
        const target = `${e.meta?.target ?? ""}`;
        if (target.includes("employees_org_fin_blind_uidx")) {
          throw new ConflictException("ФИН уже занят в организации");
        }
        throw new ConflictException("ФИН уже занят в организации");
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
        await this.mdm.resolvePersonIdentity({
          fin,
          fullName: `${current.firstName} ${current.lastName}`,
        })
      ).globalPersonId;
    }
    const updated = await this.prisma.employee.update({
      where: { id },
      data: {
        finCode: placeholderEmployeeFin(fin),
        finCodeBlindIndex: blindIndex("fin", normalizeFin(fin)),
        finCodeCipher: encryptText(normalizeFin(fin)),
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
    await this.staffProvisioning.emitProvisioned(organizationId, updated);
    return updated;
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
    return row;
  }

  /** Minimal DTO for ERA Finance Assistant (ƏMAS e-müqavilə prefill). */
  async getExtensionPrefill(organizationId: string, id: string) {
    const row = await this.getOne(organizationId, id);
    const start = row.startDate.toISOString().slice(0, 10);
    if (!row.emasEligible) {
      return {
        employeeId: row.id,
        emasStatus: "PENDING_FIN" as const,
        firstName: row.firstName,
        lastName: row.lastName,
        finCode: null,
        positionTitle: row.jobPosition.name,
        departmentName: row.jobPosition.department?.name ?? null,
        salaryGrossAzn: row.salary.toFixed(2),
        contractStartDate: start,
        contractEndDate: null as string | null,
        contractId: row.id,
        message: "ƏMAS requires FIN — use convert-to-FIN when citizen ID is available",
      };
    }
    const finPlain =
      row.finCodeCipher != null
        ? decryptText(row.finCodeCipher) ?? row.finCode
        : row.finCode;
    return {
      employeeId: row.id,
      emasStatus: "READY" as const,
      firstName: row.firstName,
      lastName: row.lastName,
      finCode: finPlain,
      positionTitle: row.jobPosition.name,
      departmentName: row.jobPosition.department?.name ?? null,
      salaryGrossAzn: row.salary.toFixed(2),
      contractStartDate: start,
      contractEndDate: null as string | null,
      contractId: row.id,
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
    if (dto.finCode != null) {
      const fin = dto.finCode.trim();
      data.finCode = placeholderEmployeeFin(fin);
      data.finCodeBlindIndex = blindIndex("fin", normalizeFin(fin));
      data.finCodeCipher = encryptText(normalizeFin(fin));
      data.emasEligible = true;
    }
    if (dto.taxResidencyStatus != null) data.taxResidencyStatus = dto.taxResidencyStatus;
    if (dto.nationality != null) data.nationality = dto.nationality.trim();
    if (dto.passportNumber != null) {
      const passport = dto.passportNumber.trim();
      data.passportBlindIndex = passport
        ? blindIndex("passport", passport.toUpperCase())
        : null;
      data.passportNumberCipher = passport ? encryptText(passport.toUpperCase()) : null;
    }
    if (dto.issuingCountry !== undefined) {
      data.issuingCountry = dto.issuingCountry?.trim() || null;
    }
    if (dto.workPermitNumber !== undefined) {
      data.workPermitNumber = dto.workPermitNumber?.trim() || null;
    }
    if (dto.userId !== undefined) data.userId = dto.userId;
    if (dto.provisionedSatelliteKey !== undefined) {
      data.provisionedSatelliteKey = dto.provisionedSatelliteKey?.trim() || null;
    }
    if (dto.provisionedSatelliteRole !== undefined) {
      data.provisionedSatelliteRole = dto.provisionedSatelliteRole?.trim() || null;
    }
    if (dto.firstName != null) {
      const firstName = dto.firstName.trim();
      data.firstName = placeholderEmployeeFirstName(firstName);
      data.firstNameCipher = encryptText(normalizeName(firstName));
    }
    if (dto.lastName != null) {
      const lastName = dto.lastName.trim();
      data.lastName = placeholderEmployeeLastName(lastName);
      data.lastNameCipher = encryptText(normalizeName(lastName));
    }
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
      await this.staffProvisioning.emitProvisioned(organizationId, updated, {
        pin: dto.staffPin,
      });
      return updated;
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
        const target = `${e.meta?.target ?? ""}`;
        if (target.includes("employees_org_fin_blind_uidx")) {
          throw new ConflictException("ФИН уже занят в организации");
        }
        throw new ConflictException("ФИН уже занят в организации");
      }
      throw e;
    }
  }

  async remove(organizationId: string, id: string) {
    const row = await this.getOne(organizationId, id);
    try {
      await this.prisma.employee.delete({ where: { id } });
      await this.staffProvisioning.emitDeactivated(organizationId, row);
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2003") {
        throw new ConflictException("Нельзя удалить: есть расчётные листовки");
      }
      throw e;
    }
  }
}
