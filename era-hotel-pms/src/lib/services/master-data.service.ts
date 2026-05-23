import { prisma } from '@/lib/prisma';
import { toDecimal } from '@/lib/decimal';
import type { FolioType } from '@prisma/client';

export async function listRoomTypes() {
  return prisma.roomType.findMany({ orderBy: { code: 'asc' }, include: { _count: { select: { rooms: true } } } });
}

export async function createRoomType(input: {
  code: string;
  name: string;
  adultCapacity?: number;
  childCapacity?: number;
  baseQuota: number;
}) {
  return prisma.roomType.create({ data: input });
}

export async function listRatePlans() {
  return prisma.ratePlan.findMany({
    include: { roomType: true, mealPlan: true },
    orderBy: { code: 'asc' },
  });
}

export async function createRatePlan(input: {
  code: string;
  name: string;
  pricePerNight: number;
  medicalFlag?: boolean;
  roomTypeId?: string;
  mealPlanId?: string;
}) {
  return prisma.ratePlan.create({
    data: {
      ...input,
      pricePerNight: toDecimal(input.pricePerNight),
    },
    include: { roomType: true, mealPlan: true },
  });
}

export async function listRevenueCodes() {
  return prisma.revenueCode.findMany({
    include: { department: true, routingRule: true },
    orderBy: { code: 'asc' },
  });
}

export async function createRevenueCode(input: {
  code: string;
  name: string;
  taxTag?: string;
  departmentId?: string;
  targetFolioType?: FolioType;
}) {
  const { targetFolioType, ...codeData } = input;
  return prisma.$transaction(async (tx) => {
    const code = await tx.revenueCode.create({ data: codeData });
    if (targetFolioType) {
      await tx.folioRoutingRule.create({
        data: { revenueCodeId: code.id, targetFolioType },
      });
    }
    return tx.revenueCode.findUnique({
      where: { id: code.id },
      include: { department: true, routingRule: true },
    });
  });
}

export async function listMealPlans() {
  return prisma.mealPlan.findMany({ orderBy: { code: 'asc' } });
}

export async function listDepartments() {
  return prisma.department.findMany({ orderBy: { code: 'asc' } });
}
