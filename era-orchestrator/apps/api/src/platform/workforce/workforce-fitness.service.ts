import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { randomUUID } from "crypto";
import { promises as fs } from "fs";
import * as path from "path";
import {
  Prisma,
  WorkforceFitnessKind,
} from "@era365/database";
import { addBakuDays, todayBakuYmd } from "@era/satellite-kit/time";
import { PrismaService } from "../../prisma/prisma.service";
import { QuotaService } from "../../quota/quota.service";
import { WorkforceAuditService } from "./workforce-audit.service";
import { WorkforceEntitlementService } from "./workforce-entitlement.service";

export type FitnessStatus = "MISSING" | "PRESENT" | "EXPIRED";

export type FitnessPolicy = {
  requiredKinds: WorkforceFitnessKind[];
  criminalRecordFreshnessDays: number;
};

const ALL_KINDS: WorkforceFitnessKind[] = [
  WorkforceFitnessKind.HEALTH,
  WorkforceFitnessKind.NARCOLOGY,
  WorkforceFitnessKind.CRIMINAL_RECORD,
];

const ALLOWED_CONTENT = new Set([
  "application/pdf",
  "image/jpeg",
  "image/png",
]);

const MAX_BYTES = 5 * 1024 * 1024;

const DEFAULT_CRIMINAL_DAYS = 90;

function parseYmd(iso: string): Date {
  return new Date(`${iso.slice(0, 10)}T00:00:00.000Z`);
}

function ymdFromDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function sniffAllowedFile(buffer: Buffer, contentType: string): boolean {
  if (contentType === "application/pdf") {
    return buffer.subarray(0, 5).toString("latin1") === "%PDF-";
  }
  if (contentType === "image/png") {
    return (
      buffer[0] === 0x89 &&
      buffer[1] === 0x50 &&
      buffer[2] === 0x4e &&
      buffer[3] === 0x47
    );
  }
  return buffer[0] === 0xff && buffer[1] === 0xd8;
}

@Injectable()
export class WorkforceFitnessService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly entitlement: WorkforceEntitlementService,
    private readonly audit: WorkforceAuditService,
    private readonly quota: QuotaService,
  ) {}

  private storageRoot(): string {
    return (
      process.env.ERA_WORKFORCE_FITNESS_ROOT?.trim() ||
      path.join(process.cwd(), "data", "workforce-fitness")
    );
  }

  async getPolicy(organizationId: string): Promise<FitnessPolicy> {
    const org = await this.prisma.organization.findFirst({
      where: { id: organizationId },
      select: { settings: true },
    });
    return this.readPolicyFromSettings(org?.settings);
  }

  readPolicyFromSettings(settings: unknown): FitnessPolicy {
    const base =
      settings && typeof settings === "object" && !Array.isArray(settings)
        ? (settings as Record<string, unknown>)
        : {};
    const wf =
      base.workforce &&
      typeof base.workforce === "object" &&
      !Array.isArray(base.workforce)
        ? (base.workforce as Record<string, unknown>)
        : {};
    const fitness =
      wf.fitness && typeof wf.fitness === "object" && !Array.isArray(wf.fitness)
        ? (wf.fitness as Record<string, unknown>)
        : {};
    const rawKinds = Array.isArray(fitness.requiredKinds)
      ? fitness.requiredKinds
      : [];
    const requiredKinds = rawKinds.filter(
      (k): k is WorkforceFitnessKind =>
        typeof k === "string" &&
        ALL_KINDS.includes(k as WorkforceFitnessKind),
    );
    const daysRaw = fitness.criminalRecordFreshnessDays;
    const criminalRecordFreshnessDays =
      typeof daysRaw === "number" &&
      Number.isFinite(daysRaw) &&
      daysRaw >= 1
        ? Math.floor(daysRaw)
        : DEFAULT_CRIMINAL_DAYS;
    return { requiredKinds, criminalRecordFreshnessDays };
  }

  async patchPolicy(
    organizationId: string,
    actorUserId: string,
    dto: {
      requiredKinds?: string[];
      criminalRecordFreshnessDays?: number;
    },
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
    const prevFit =
      prevWf.fitness &&
      typeof prevWf.fitness === "object" &&
      !Array.isArray(prevWf.fitness)
        ? ({ ...(prevWf.fitness as Record<string, unknown>) } as Record<
            string,
            unknown
          >)
        : {};

    if (dto.requiredKinds !== undefined) {
      const kinds = dto.requiredKinds.filter(
        (k): k is WorkforceFitnessKind =>
          ALL_KINDS.includes(k as WorkforceFitnessKind),
      );
      prevFit.requiredKinds = kinds;
    }
    if (dto.criminalRecordFreshnessDays !== undefined) {
      const d = Number(dto.criminalRecordFreshnessDays);
      if (!Number.isFinite(d) || d < 1) {
        throw new BadRequestException(
          "criminalRecordFreshnessDays must be >= 1",
        );
      }
      prevFit.criminalRecordFreshnessDays = Math.floor(d);
    }
    prevWf.fitness = prevFit;
    base.workforce = prevWf;
    await this.prisma.organization.update({
      where: { id: organizationId },
      data: { settings: base as Prisma.InputJsonValue },
    });
    await this.audit.log({
      organizationId,
      actorUserId,
      action: "FITNESS_POLICY_PATCH",
      entityType: "ORGANIZATION",
      entityId: organizationId,
      payload: {
        requiredKinds: prevFit.requiredKinds ?? [],
        criminalRecordFreshnessDays: prevFit.criminalRecordFreshnessDays,
      },
    });
    return this.readPolicyFromSettings(base);
  }

  computeStatus(
    kind: WorkforceFitnessKind,
    row: {
      issuedOn: Date;
      validUntil: Date | null;
    } | null,
    policy: FitnessPolicy,
    asOfYmd: string,
  ): FitnessStatus {
    if (!row) return "MISSING";
    if (kind === WorkforceFitnessKind.CRIMINAL_RECORD) {
      const issued = ymdFromDate(row.issuedOn);
      const expiresExclusive = addBakuDays(
        issued,
        policy.criminalRecordFreshnessDays,
      );
      return asOfYmd < expiresExclusive ? "PRESENT" : "EXPIRED";
    }
    if (!row.validUntil) return "EXPIRED";
    return asOfYmd <= ymdFromDate(row.validUntil) ? "PRESENT" : "EXPIRED";
  }

  async listForEmployment(organizationId: string, employmentId: string) {
    await this.entitlement.assertWorkforceHub(organizationId);
    const emp = await this.prisma.workforceEmployment.findFirst({
      where: { id: employmentId, organizationId },
    });
    if (!emp) throw new NotFoundException("Employment not found");
    const policy = await this.getPolicy(organizationId);
    const asOf = todayBakuYmd();
    const rows = await this.prisma.workforceFitnessRecord.findMany({
      where: { organizationId, employmentId },
    });
    const byKind = new Map(rows.map((r) => [r.kind, r]));
    return {
      policy,
      asOf,
      items: ALL_KINDS.map((kind) => {
        const row = byKind.get(kind) ?? null;
        const status = this.computeStatus(kind, row, policy, asOf);
        return {
          kind,
          status,
          required: policy.requiredKinds.includes(kind),
          issuedOn: row ? ymdFromDate(row.issuedOn) : null,
          validUntil: row?.validUntil ? ymdFromDate(row.validUntil) : null,
          attachedAt: row?.attachedAt.toISOString() ?? null,
          contentType: row?.contentType ?? null,
          originalName: row?.originalName ?? null,
          byteSize: row?.byteSize ?? null,
          id: row?.id ?? null,
        };
      }),
    };
  }

  async attach(
    organizationId: string,
    actorUserId: string,
    employmentId: string,
    dto: {
      kind: string;
      issuedOn: string;
      validUntil?: string;
      fileBase64: string;
      fileName: string;
      contentType: string;
    },
  ) {
    await this.entitlement.assertWorkforceHub(organizationId);
    if (!ALL_KINDS.includes(dto.kind as WorkforceFitnessKind)) {
      throw new BadRequestException("Invalid fitness kind");
    }
    const kind = dto.kind as WorkforceFitnessKind;
    const emp = await this.prisma.workforceEmployment.findFirst({
      where: { id: employmentId, organizationId },
    });
    if (!emp) throw new NotFoundException("Employment not found");

    const contentType = (dto.contentType ?? "").toLowerCase().trim();
    if (!ALLOWED_CONTENT.has(contentType)) {
      throw new BadRequestException("File must be PDF, JPEG, or PNG");
    }
    let buffer: Buffer;
    try {
      buffer = Buffer.from(dto.fileBase64, "base64");
    } catch {
      throw new BadRequestException("Invalid fileBase64");
    }
    if (buffer.length < 16 || buffer.length > MAX_BYTES) {
      throw new BadRequestException(
        `File size must be between 16 bytes and ${MAX_BYTES} bytes`,
      );
    }
    if (!sniffAllowedFile(buffer, contentType)) {
      throw new BadRequestException("File contents are not PDF, JPEG, or PNG");
    }

    const issuedOn = parseYmd(dto.issuedOn);
    let validUntil: Date | null = null;
    if (
      kind === WorkforceFitnessKind.HEALTH ||
      kind === WorkforceFitnessKind.NARCOLOGY
    ) {
      if (!dto.validUntil?.trim()) {
        throw new BadRequestException("validUntil required for HEALTH/NARCOLOGY");
      }
      validUntil = parseYmd(dto.validUntil);
      if (validUntil.getTime() < issuedOn.getTime()) {
        throw new BadRequestException("validUntil must be on or after issuedOn");
      }
    }

    await this.quota.assertStorageQuota(organizationId, buffer.length);

    const existing = await this.prisma.workforceFitnessRecord.findUnique({
      where: { employmentId_kind: { employmentId, kind } },
    });

    const id = existing?.id ?? randomUUID();
    const storageKey = `org/${organizationId}/workforce-fitness/${id}`;
    const absPath = path.join(this.storageRoot(), storageKey);
    await fs.mkdir(path.dirname(absPath), { recursive: true });
    await fs.writeFile(absPath, buffer);

    let row;
    try {
      row = await this.prisma.workforceFitnessRecord.upsert({
        where: { employmentId_kind: { employmentId, kind } },
        create: {
          id,
          organizationId,
          employmentId,
          kind,
          issuedOn,
          validUntil,
          storageKey,
          contentType,
          byteSize: buffer.length,
          originalName: (dto.fileName ?? "file").slice(0, 255),
          attachedByUserId: actorUserId,
        },
        update: {
          issuedOn,
          validUntil,
          storageKey,
          contentType,
          byteSize: buffer.length,
          originalName: (dto.fileName ?? "file").slice(0, 255),
          attachedByUserId: actorUserId,
          attachedAt: new Date(),
        },
      });
    } catch (err) {
      if (!existing) {
        await fs.unlink(absPath).catch(() => undefined);
      }
      throw err;
    }

    const delta = existing
      ? Math.max(0, buffer.length - existing.byteSize)
      : buffer.length;
    if (delta > 0) {
      await this.quota.addStorageUsage(organizationId, delta);
    }

    await this.audit.log({
      organizationId,
      actorUserId,
      action: "FITNESS_ATTACH",
      entityType: "FITNESS",
      entityId: row.id,
      payload: {
        kind,
        issuedOn: dto.issuedOn.slice(0, 10),
        validUntil: dto.validUntil?.slice(0, 10) ?? null,
      },
    });

    return this.listForEmployment(organizationId, employmentId);
  }

  async download(
    organizationId: string,
    employmentId: string,
    kindRaw: string,
  ): Promise<{ buffer: Buffer; contentType: string; fileName: string }> {
    await this.entitlement.assertWorkforceHub(organizationId);
    if (!ALL_KINDS.includes(kindRaw as WorkforceFitnessKind)) {
      throw new BadRequestException("Invalid fitness kind");
    }
    const kind = kindRaw as WorkforceFitnessKind;
    const row = await this.prisma.workforceFitnessRecord.findFirst({
      where: { organizationId, employmentId, kind },
    });
    if (!row) throw new NotFoundException("Fitness file not found");
    if (!row.storageKey.startsWith(`org/${organizationId}/workforce-fitness/`)) {
      throw new ForbiddenException("Storage key org mismatch");
    }
    const root = path.resolve(this.storageRoot());
    const absPath = path.resolve(root, row.storageKey);
    if (!absPath.startsWith(root + path.sep)) {
      throw new ForbiddenException("Storage key org mismatch");
    }
    let buffer: Buffer;
    try {
      buffer = await fs.readFile(absPath);
    } catch {
      throw new NotFoundException("Fitness file missing on disk");
    }
    return {
      buffer,
      contentType: row.contentType,
      fileName: row.originalName,
    };
  }

  /**
   * Blocks new place assignment when a required kind is not PRESENT on asOfYmd.
   * Empty requiredKinds → no-op.
   */
  async assertAssignable(
    organizationId: string,
    employmentId: string,
    asOfYmd: string,
  ): Promise<void> {
    const policy = await this.getPolicy(organizationId);
    if (policy.requiredKinds.length === 0) return;

    const rows = await this.prisma.workforceFitnessRecord.findMany({
      where: {
        organizationId,
        employmentId,
        kind: { in: policy.requiredKinds },
      },
    });
    const byKind = new Map(rows.map((r) => [r.kind, r]));
    const failing: Array<{ kind: WorkforceFitnessKind; status: FitnessStatus }> =
      [];
    for (const kind of policy.requiredKinds) {
      const status = this.computeStatus(
        kind,
        byKind.get(kind) ?? null,
        policy,
        asOfYmd,
      );
      if (status !== "PRESENT") {
        failing.push({ kind, status });
      }
    }
    if (failing.length > 0) {
      throw new BadRequestException({
        code: "FITNESS_REQUIRED",
        message: "Required fitness file missing or expired",
        asOf: asOfYmd,
        failing,
      });
    }
  }

  async assertBrigadeAssignable(
    organizationId: string,
    brigadeId: string,
    asOfYmd: string,
  ): Promise<void> {
    const policy = await this.getPolicy(organizationId);
    if (policy.requiredKinds.length === 0) return;

    const asOf = parseYmd(asOfYmd);
    const members = await this.prisma.workforceBrigadeMember.findMany({
      where: {
        organizationId,
        brigadeId,
        effectiveFrom: { lte: asOf },
        OR: [{ effectiveTo: null }, { effectiveTo: { gte: asOf } }],
      },
      select: { employmentId: true },
    });
    for (const m of members) {
      await this.assertAssignable(organizationId, m.employmentId, asOfYmd);
    }
  }

  /** Floor board: employments with any required kind MISSING/EXPIRED today. */
  async listFloorIssues(
    organizationId: string,
    employmentIds: string[],
  ): Promise<
    Array<{
      employmentId: string;
      kind: WorkforceFitnessKind;
      status: FitnessStatus;
    }>
  > {
    if (employmentIds.length === 0) return [];
    const policy = await this.getPolicy(organizationId);
    if (policy.requiredKinds.length === 0) return [];
    const asOf = todayBakuYmd();
    const rows = await this.prisma.workforceFitnessRecord.findMany({
      where: {
        organizationId,
        employmentId: { in: employmentIds },
        kind: { in: policy.requiredKinds },
      },
    });
    const byEmp = new Map<string, Map<WorkforceFitnessKind, (typeof rows)[0]>>();
    for (const r of rows) {
      let m = byEmp.get(r.employmentId);
      if (!m) {
        m = new Map();
        byEmp.set(r.employmentId, m);
      }
      m.set(r.kind, r);
    }
    const out: Array<{
      employmentId: string;
      kind: WorkforceFitnessKind;
      status: FitnessStatus;
    }> = [];
    for (const empId of employmentIds) {
      const m = byEmp.get(empId) ?? new Map();
      for (const kind of policy.requiredKinds) {
        const status = this.computeStatus(kind, m.get(kind) ?? null, policy, asOf);
        if (status !== "PRESENT") {
          out.push({ employmentId: empId, kind, status });
        }
      }
    }
    return out;
  }
}
