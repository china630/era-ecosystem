import {
  isSatelliteStaffDeactivated,
  isSatelliteStaffProvisioned,
  satelliteStaffDeactivatedSchema,
  satelliteStaffProvisionedSchema,
} from "@era/contracts";
import { hashPassword } from "@era/satellite-kit";
import { prisma } from "@/lib/prisma";
import { CLINIC_ROLE } from "@/lib/clinic-roles";
import { permissionsJsonForRole } from "@/lib/auth/clinic-permissions";
import { staffKindFromSatelliteRole } from "@/domain/staff/staff-kind";
import { requestOrganizationId } from "@/lib/request-organization";

function latinize(value: string): string {
  return value
    .trim()
    .replace(/\u0259/gi, "e") // ə
    .replace(/\u018F/gi, "e") // Ə
    .replace(/\u0131/g, "i") // ı
    .replace(/\u0130/g, "i") // İ
    .replace(/\u00F6/gi, "o") // ö
    .replace(/\u00FC/gi, "u") // ü
    .replace(/\u00E7/gi, "c") // ç
    .replace(/\u015F/gi, "s") // ş
    .replace(/\u011F/gi, "g") // ğ
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const NAME_PARTICLES = new Set(["qizi", "oglu", "ogli", "kyzy"]);

function nameTokens(value: string): string[] {
  return latinize(value)
    .split(" ")
    .filter((t) => t.length >= 3 && !NAME_PARTICLES.has(t));
}

function editDistance(a: string, b: string): number {
  if (a === b) return 0;
  if (Math.abs(a.length - b.length) > 1) return 99;
  const m = a.length;
  const n = b.length;
  const prev = Array.from({ length: n + 1 }, (_, j) => j);
  const cur = new Array<number>(n + 1);
  for (let i = 1; i <= m; i++) {
    cur[0] = i;
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + cost);
    }
    for (let j = 0; j <= n; j++) prev[j] = cur[j]!;
  }
  return prev[n]!;
}

function foldVowels(value: string): string {
  return value.replace(/[aeiou]/g, "a");
}

function tokensCompatible(a: string, b: string): boolean {
  if (editDistance(a, b) <= 1) return true;
  return a.length === b.length && foldVowels(a) === foldVowels(b);
}

/** Exact latinized match, or unique token overlap (Excel FIO vs MDM "Last First Patronymic"). */
function namesLikelySame(imported: string, provisioned: string): boolean {
  const a = latinize(imported);
  const b = latinize(provisioned);
  if (!a || !b) return false;
  if (a === b) return true;
  const importedTokens = nameTokens(imported);
  const provisionedTokens = nameTokens(provisioned);
  if (importedTokens.length < 2 || provisionedTokens.length < 2) return false;
  return importedTokens.every((token) =>
    provisionedTokens.some((other) => tokensCompatible(token, other)),
  );
}

const ROLE_CODES: Record<string, string> = {
  DOCTOR: CLINIC_ROLE.DOCTOR,
  NURSE: CLINIC_ROLE.NURSE,
  FLOOR: CLINIC_ROLE.FLOOR,
  LAB_TECH: CLINIC_ROLE.LAB_TECH,
  LAB: CLINIC_ROLE.LAB_TECH,
  CLINIC_ADMIN: CLINIC_ROLE.CLINIC_ADMIN,
  RECEPTION: CLINIC_ROLE.RECEPTION,
  ADMIN: CLINIC_ROLE.CLINIC_ADMIN,
  STAFF: CLINIC_ROLE.RECEPTION,
};

export class SatelliteLoginTakenError extends Error {
  readonly code = "LOGIN_TAKEN" as const;
  constructor(login: string) {
    super(`Login already taken: ${login}`);
    this.name = "SatelliteLoginTakenError";
  }
}

async function resolveUserForLogin(args: {
  cpEmploymentId: string;
  login: string;
  organizationId: string;
}) {
  const byCp = await prisma.user.findFirst({
    where: { cpEmploymentId: args.cpEmploymentId },
  });
  if (byCp) return { existing: byCp, mode: "update" as const };
  const byLogin = await prisma.user.findFirst({
    where: { login: args.login, organizationId: args.organizationId },
  });
  if (
    byLogin?.cpEmploymentId &&
    byLogin.cpEmploymentId !== args.cpEmploymentId
  ) {
    throw new SatelliteLoginTakenError(args.login);
  }
  if (byLogin) return { existing: byLogin, mode: "update" as const };
  return { existing: null, mode: "create" as const };
}

async function ensureRole(roleCode: string) {
  let role = await prisma.role.findFirst({ where: { code: roleCode } });
  if (!role) {
    role = await prisma.role.create({
      data: {
        code: roleCode,
        name: roleCode.replace(/_/g, " "),
        permissionsJson: permissionsJsonForRole(roleCode),
      },
    });
  }
  if (!role) throw new Error(`Failed to ensure role: ${roleCode}`);
  return role;
}

async function findExistingPractitioner(input: {
  cpEmploymentId: string;
  globalPersonId: string | null;
  fullName: string;
  staffKind: "DOCTOR" | "NURSE" | "LAB";
}) {
  const byCp = await prisma.practitioner.findFirst({
    where: { cpEmploymentId: input.cpEmploymentId },
  });
  if (byCp) return byCp;
  if (input.globalPersonId) {
    const byMdm = await prisma.practitioner.findFirst({
      where: { globalPersonId: input.globalPersonId, cpEmploymentId: null },
    });
    if (byMdm) return byMdm;
  }
  const candidates = await prisma.practitioner.findMany({
    where: { staffKind: input.staffKind, cpEmploymentId: null },
  });
  const matches = candidates.filter((row) =>
    namesLikelySame(row.fullName, input.fullName),
  );
  return matches.length === 1 ? matches[0]! : null;
}

export async function handleStaffProvisionEvent(event: unknown) {
  /** T3 ops cache: fullName from STAFF_PROVISIONED is display-only; MDM is identity SoR. */
  if (isSatelliteStaffProvisioned(event)) {
    const parsed = satelliteStaffProvisionedSchema.parse(event);
    const p = parsed.payload;
    const organizationId = requestOrganizationId();
    const roleCode = ROLE_CODES[p.satelliteRole] ?? CLINIC_ROLE.RECEPTION;
    const role = await ensureRole(roleCode);

    const login = p.login ?? `emp-${p.staffCode.toLowerCase()}`;
    const passwordHash = await hashPassword(p.pin ?? "0000");
    const globalPersonId = parsed.globalPersonId ?? null;
    const cpEmploymentId = p.cpEmploymentId;

    const resolved = await resolveUserForLogin({
      cpEmploymentId,
      login,
      organizationId,
    });
    let userId: string;
    if (resolved.mode === "update" && resolved.existing) {
      await prisma.user.update({
        where: { id: resolved.existing.id },
        data: {
          login,
          fullName: p.fullName,
          roleId: role.id,
          status: "ACTIVE",
          passwordHash,
          globalPersonId,
          cpEmploymentId,
          ...(p.financeEmployeeId ? { financeEmployeeId: p.financeEmployeeId } : {}),
        },
      });
      userId = resolved.existing.id;
    } else {
      const user = await prisma.user.create({
        data: {
          organizationId,
          login,
          fullName: p.fullName,
          passwordHash,
          roleId: role.id,
          isCrossSystem: true,
          globalPersonId,
          cpEmploymentId,
          ...(p.financeEmployeeId ? { financeEmployeeId: p.financeEmployeeId } : {}),
        },
      });
      userId = user.id;
    }

    const staffKind = staffKindFromSatelliteRole(p.satelliteRole);
    const existingPractitioner = await findExistingPractitioner({
      cpEmploymentId,
      globalPersonId,
      fullName: p.fullName,
      staffKind,
    });
    const practitionerPatch = {
      fullName: p.fullName,
      staffKind,
      globalPersonId,
      userId,
      active: true,
      cpEmploymentId,
      ...(p.financeEmployeeId ? { financeEmployeeId: p.financeEmployeeId } : {}),
    };
    if (existingPractitioner) {
      await prisma.practitioner.update({
        where: { id: existingPractitioner.id },
        data: practitionerPatch,
      });
    } else {
      await prisma.practitioner.create({
        data: {
          organizationId,
          code: p.staffCode,
          ...practitionerPatch,
        },
      });
    }

    return { satelliteUserId: userId };
  }

  if (isSatelliteStaffDeactivated(event)) {
    const parsed = satelliteStaffDeactivatedSchema.parse(event);
    const p = parsed.payload;
    const organizationId = requestOrganizationId();
    const target = await resolveUserForDeactivate({
      satelliteUserId: p.satelliteUserId,
      cpEmploymentId: p.cpEmploymentId,
      organizationId,
    });
    if (!target) return { ok: true };
    await prisma.user.updateMany({
      where: { id: target.id },
      data: { status: "INACTIVE" },
    });
    await prisma.practitioner.updateMany({
      where: { userId: target.id },
      data: { active: false },
    });
    return { ok: true };
  }

  throw new Error("Unsupported staff provision event");
}

export class SatelliteTargetAmbiguousError extends Error {
  readonly code = "TARGET_AMBIGUOUS" as const;
  constructor(cpEmploymentId: string) {
    super(`Multiple users for cpEmploymentId=${cpEmploymentId}`);
    this.name = "SatelliteTargetAmbiguousError";
  }
}

async function resolveUserForDeactivate(args: {
  satelliteUserId?: string;
  cpEmploymentId: string;
  organizationId: string;
}): Promise<{ id: string } | null> {
  if (args.satelliteUserId) {
    const byId = await prisma.user.findFirst({
      where: { id: args.satelliteUserId },
      select: { id: true },
    });
    return byId;
  }
  const matches = await prisma.user.findMany({
    where: {
      organizationId: args.organizationId,
      cpEmploymentId: args.cpEmploymentId,
    },
    select: { id: true },
    take: 2,
  });
  if (matches.length === 0) return null;
  if (matches.length > 1) {
    throw new SatelliteTargetAmbiguousError(args.cpEmploymentId);
  }
  return matches[0]!;
}
