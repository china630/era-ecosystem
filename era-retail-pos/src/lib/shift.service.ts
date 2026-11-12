import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

type ShiftForClose = Prisma.ShiftGetPayload<{
  include: {
    register: { include: { outlet: true } };
    receipts: true;
  };
}>;

type ShiftXReport = Prisma.ShiftGetPayload<{
  include: {
    register: { include: { outlet: true } };
    receipts: true;
  };
}>;

export async function getShiftForClose(shiftId: string): Promise<ShiftForClose | null> {
  return (await prisma.shift.findUnique({
    where: { id: shiftId },
    include: {
      register: { include: { outlet: true } },
      receipts: { where: { status: "PAID" } },
    },
  })) as ShiftForClose | null;
}

export async function closeShiftById(shiftId: string) {
  return prisma.shift.update({
    where: { id: shiftId },
    data: { status: "CLOSED", closedAt: new Date() },
  });
}

export async function getShiftForXReport(id: string): Promise<ShiftXReport | null> {
  return (await prisma.shift.findUnique({
    where: { id },
    include: {
      register: { include: { outlet: true } },
      receipts: { where: { status: "PAID" } },
    },
  })) as ShiftXReport | null;
}

export async function findFirstTenant() {
  return prisma.tenant.findFirst();
}

export async function createDemoTenant() {
  return prisma.tenant.create({
    data: { code: "demo", name: "Demo Tenant" },
  });
}

export async function findOutletByTenantAndCode(tenantId: string, outletCode: string) {
  return prisma.outlet.findFirst({
    where: { tenantId, code: outletCode },
  });
}

export async function createOutlet(data: {
  tenantId: string;
  code: string;
  name: string;
  preset: string;
}) {
  return prisma.outlet.create({ data });
}

export async function updateOutletPreset(outletId: string, preset: string) {
  return prisma.outlet.update({
    where: { id: outletId },
    data: { preset },
  });
}

export async function findRegisterByOutletAndCode(outletId: string, registerCode: string) {
  return prisma.register.findFirst({
    where: { outletId, code: registerCode },
  });
}

export async function createRegister(outletId: string, code: string, name: string) {
  return prisma.register.create({
    data: { outletId, code, name },
  });
}

export async function findOpenShiftOnRegister(registerId: string) {
  return prisma.shift.findFirst({
    where: { registerId, status: "OPEN" },
  });
}

export async function createShiftOnRegister(data: {
  registerId: string;
  fiscalDeviceId: string | null;
  bankTerminalId: string | null;
}) {
  return prisma.shift.create({ data });
}

export async function listOpenShiftsForHub() {
  return prisma.shift.findMany({
    where: { status: "OPEN" },
    include: { register: { include: { outlet: true } } },
    orderBy: { openedAt: "asc" },
  });
}
