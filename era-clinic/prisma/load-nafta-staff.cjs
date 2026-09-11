"use strict";
/**
 * Nafta staff link — upserts system roles (empty matrix filled from defaults JSON;
 * customized permissionsJson is preserved) then links practitioners to users.
 */
const { scryptSync, randomBytes } = require("crypto");
const { PrismaClient } = require("@prisma/client");
const roleDefaults = require("./clinic-role-permissions.defaults.json");

const prisma = new PrismaClient();
const PASSWORD = "12345678";

function hash(pw) {
  const salt = randomBytes(16).toString("hex");
  return `${salt}:${scryptSync(pw, salt, 64).toString("hex")}`;
}

function seedOrgId() {
  return (
    process.env.ERA_SATELLITE_ORGANIZATION_ID?.trim() ||
    process.env.ORGANIZATION_ID?.trim() ||
    "demo-org"
  );
}

function isEmptyPermissionsJson(json) {
  if (!json || typeof json !== "string") return true;
  const trimmed = json.trim();
  if (!trimmed || trimmed === "[]") return true;
  try {
    const parsed = JSON.parse(trimmed);
    return !Array.isArray(parsed) || parsed.length === 0;
  } catch {
    return true;
  }
}

const SYSTEM_ROLES = [
  ["CLINIC_ADMIN", "Clinic administrator", "NONE"],
  ["RECEPTION", "Reception", "NONE"],
  ["DOCTOR", "Doctor", "DOCTOR"],
  ["NURSE", "Nurse", "NURSE"],
  ["LAB_TECH", "Lab technician", "LAB"],
  ["FLOOR", "Floor check-in", "NURSE"],
];

// practitionerCode -> {login, role}
const STAFF = [
  { code: "DR-01", login: "rena.kengerli", role: "DOCTOR" },
  { code: "DR-02", login: "kamaleddin.sahmuradov", role: "DOCTOR" },
  { code: "DR-03", login: "azade.mustafayeva", role: "DOCTOR" },
  { code: "DR-04", login: "turxan.ceferov", role: "DOCTOR" },
  { code: "DR-05", login: "salman.sadiqi", role: "DOCTOR" },
  { code: "DR-06", login: "leyla.hesimova", role: "DOCTOR" },
  { code: "DR-07", login: "rafiq.huseynov", role: "DOCTOR" },
  { code: "NR-01", login: "leyla.qasimova", role: "NURSE" },
  { code: "CS-01", login: "turane.memmedzade", role: "DOCTOR" },
];

async function ensureSystemRoles(organizationId) {
  const roles = {};
  for (const [code, name, staffKind] of SYSTEM_ROLES) {
    const perms = JSON.stringify(roleDefaults[code] || []);
    const existing = await prisma.role.findFirst({
      where: { organizationId, code },
    });
    let row;
    if (!existing) {
      row = await prisma.role.create({
        data: {
          organizationId,
          code,
          name,
          isSystem: true,
          staffKind,
          permissionsJson: perms,
        },
      });
    } else {
      row = await prisma.role.update({
        where: { id: existing.id },
        data: {
          isSystem: true,
          ...(existing.staffKind ? {} : { staffKind }),
          ...(isEmptyPermissionsJson(existing.permissionsJson)
            ? { permissionsJson: perms }
            : {}),
        },
      });
    }
    roles[code] = row.id;
  }
  return roles;
}

async function main() {
  const organizationId = seedOrgId();
  const roles = await ensureSystemRoles(organizationId);
  const ph = hash(PASSWORD);
  let n = 0;
  for (const s of STAFF) {
    const pr = await prisma.practitioner.findUnique({ where: { code: s.code } });
    if (!pr) {
      console.log("skip missing practitioner", s.code);
      continue;
    }
    const roleId = roles[s.role];
    if (!roleId) throw new Error(`Missing role ${s.role}`);
    const existingUser = await prisma.user.findFirst({
      where: { organizationId, login: s.login },
    });
    let u;
    if (existingUser) {
      u = await prisma.user.update({
        where: { id: existingUser.id },
        data: {
          fullName: pr.fullName,
          passwordHash: ph,
          roleId,
          status: "ACTIVE",
        },
      });
    } else {
      u = await prisma.user.create({
        data: {
          organizationId,
          login: s.login,
          email: s.login + "@nafta.local",
          fullName: pr.fullName,
          passwordHash: ph,
          roleId,
          status: "ACTIVE",
        },
      });
    }
    const kind = s.role === "NURSE" ? "NURSE" : s.role === "LAB_TECH" ? "LAB" : "DOCTOR";
    await prisma.practitioner.update({
      where: { id: pr.id },
      data: { userId: u.id, staffKind: kind },
    });
    n++;
  }

  const receptionRoleId = roles.RECEPTION;
  const existingReception = await prisma.user.findFirst({
    where: { organizationId, login: "reception" },
  });
  if (existingReception) {
    await prisma.user.update({
      where: { id: existingReception.id },
      data: { passwordHash: ph, roleId: receptionRoleId, status: "ACTIVE" },
    });
  } else {
    await prisma.user.create({
      data: {
        organizationId,
        login: "reception",
        email: "reception@nafta.local",
        fullName: "Clinic Reception",
        passwordHash: ph,
        roleId: receptionRoleId,
        status: "ACTIVE",
      },
    });
  }

  console.log(
    "CLINIC STAFF OK",
    JSON.stringify({
      staffLinked: n,
      totalUsers: await prisma.user.count(),
      roles: await prisma.role.count(),
    }),
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
