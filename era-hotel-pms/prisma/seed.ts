import { PrismaClient, PaymentMethod } from '@prisma/client';
import {
  ROLE_CODES,
  ROLE_PERMISSIONS,
  serializePermissions,
} from '../src/lib/auth/permissions';
import { hashPassword } from '../src/lib/auth/password';
import { seedFoDemo } from './seed-fo-demo';

const prisma = new PrismaClient();

async function main() {
  await prisma.user.deleteMany();
  await prisma.role.deleteMany();
  await prisma.recipeLine.deleteMany();
  await prisma.recipe.deleteMany();
  await prisma.stockMovement.deleteMany();
  await prisma.product.deleteMany();
  await prisma.productGroup.deleteMany();
  await prisma.warehouse.deleteMany();
  await prisma.posReservation.deleteMany();
  await prisma.banquetEvent.deleteMany();
  await prisma.banquetMenuPackage.deleteMany();
  await prisma.banquetSaloon.deleteMany();
  await prisma.posResource.deleteMany();
  await prisma.tourismSubmission.deleteMany();
  await prisma.fiscalDocument.deleteMany();
  await prisma.outboundEventLog.deleteMany();
  await prisma.labResult.deleteMany();
  await prisma.medicalOrder.deleteMany();
  await prisma.medicalAlert.deleteMany();
  await prisma.medicalProcedure.deleteMany();
  await prisma.procedureAppointment.deleteMany();
  await prisma.transferOrder.deleteMany();
  await prisma.transferVehicle.deleteMany();
  await prisma.ratePlanProcedureInclusion.deleteMany();
  await prisma.procedureService.deleteMany();
  await prisma.ratePlanPackageLine.deleteMany();
  await prisma.channelSyncError.deleteMany();
  await prisma.housekeepingTask.deleteMany();
  await prisma.nightAuditRun.deleteMany();
  await prisma.businessDay.deleteMany();
  await prisma.folioPayment.deleteMany();
  await prisma.folioCharge.deleteMany();
  await prisma.folioRoutingRule.deleteMany();
  await prisma.hotelRevenueGlMapping.deleteMany();
  await prisma.folio.deleteMany();
  await prisma.stay.deleteMany();
  await prisma.reservationNote.deleteMany();
  await prisma.reservationGuest.deleteMany();
  await prisma.reservationDailyRate.deleteMany();
  await prisma.reservation.deleteMany();
  await prisma.reservationGroup.deleteMany();
  await prisma.lostFoundItem.deleteMany();
  await prisma.cashShift.deleteMany();
  await prisma.guest.deleteMany();
  await prisma.room.deleteMany();
  await prisma.ratePlan.deleteMany();
  await prisma.revenueCode.deleteMany();
  await prisma.department.deleteMany();
  await prisma.mealPlan.deleteMany();
  await prisma.roomType.deleteMany();
  await prisma.bookingSource.deleteMany();
  await prisma.contractPricingRule.deleteMany();
  await prisma.agency.deleteMany();
  await prisma.hotelProfile.deleteMany();

  await prisma.hotelProfile.create({
    data: {
      name: 'Nafta Sanatorium',
      propertyCode: 'NAFTA-SANATORIUM-001',
      organizationId: 'nafta-sanatorium-org',
      roomCapacity: 78,
      currency: 'AZN',
      timezone: 'Asia/Baku',
    },
  });

  const roleEntries = Object.entries(ROLE_PERMISSIONS) as [string, string[]][];
  const roles: Record<string, string> = {};
  for (const [code, perms] of roleEntries) {
    const role = await prisma.role.create({
      data: {
        code,
        name: code.replace(/_/g, ' '),
        permissionsJson: serializePermissions(perms as never[]),
      },
    });
    roles[code] = role.id;
  }

  const adminHash = await hashPassword('admin123');
  const receptionHash = await hashPassword('reception123');
  const managerHash = await hashPassword('manager123');

  await prisma.user.create({
    data: {
      login: 'admin',
      fullName: 'Hotel Administrator',
      passwordHash: adminHash,
      roleId: roles[ROLE_CODES.HOTEL_ADMIN],
      department: 'Management',
    },
  });

  await prisma.user.create({
    data: {
      login: 'reception',
      fullName: 'Front Desk Reception',
      passwordHash: receptionHash,
      roleId: roles[ROLE_CODES.RECEPTIONIST],
      department: 'Reception',
    },
  });

  await prisma.user.create({
    data: {
      login: 'manager',
      fullName: 'Duty Manager',
      passwordHash: managerHash,
      roleId: roles[ROLE_CODES.MANAGER],
      department: 'Front Office',
    },
  });

  const demoHash = await hashPassword(
    process.env.ECOSYSTEM_DEMO_PASSWORD ?? '12345678',
  );
  await prisma.user.upsert({
    where: { login: 'chingiz@era.com' },
    create: {
      login: 'chingiz@era.com',
      email: 'chingiz@era.com',
      fullName: 'Chingiz Demo',
      passwordHash: demoHash,
      roleId: roles[ROLE_CODES.HOTEL_ADMIN],
      department: 'Management',
      isCrossSystem: true,
    },
    update: {
      email: 'chingiz@era.com',
      passwordHash: demoHash,
      roleId: roles[ROLE_CODES.HOTEL_ADMIN],
      isCrossSystem: true,
    },
  });

  const deptAcc = await prisma.department.create({
    data: { code: 'ACC', name: 'Accommodation' },
  });
  const deptRest = await prisma.department.create({
    data: { code: 'REST', name: 'Restaurant' },
  });
  const deptMed = await prisma.department.create({
    data: { code: 'MED', name: 'Medical' },
  });

  const revRoom = await prisma.revenueCode.create({
    data: { code: 'ROOM', name: 'Room revenue', taxTag: '18%', departmentId: deptAcc.id },
  });
  const revFood = await prisma.revenueCode.create({
    data: { code: 'FOOD', name: 'Food & beverage', taxTag: '18%', departmentId: deptRest.id },
  });
  const revMedical = await prisma.revenueCode.create({
    data: { code: 'MEDICAL', name: 'Medical procedures', departmentId: deptMed.id },
  });
  const revPkg = await prisma.revenueCode.create({
    data: { code: 'PKG', name: 'Medical package bundle', departmentId: deptMed.id },
  });
  const revTreatment = await prisma.revenueCode.create({
    data: { code: 'TREATMENT', name: 'Included treatment', departmentId: deptMed.id },
  });
  const revBoard = await prisma.revenueCode.create({
    data: { code: 'BOARD', name: 'Included board', departmentId: deptRest.id },
  });
  const revTransfer = await prisma.revenueCode.create({
    data: { code: 'TRANSFER', name: 'Airport transfer', departmentId: deptAcc.id },
  });

  await prisma.folioRoutingRule.create({
    data: { revenueCodeId: revRoom.id, targetFolioType: 'COMPANY' },
  });
  await prisma.folioRoutingRule.create({
    data: { revenueCodeId: revFood.id, targetFolioType: 'GUEST' },
  });

  await prisma.hotelRevenueGlMapping.createMany({
    data: [
      { revenueCodeId: revRoom.id, glAccountCode: '601' },
      { revenueCodeId: revFood.id, glAccountCode: '602' },
      { revenueCodeId: revMedical.id, glAccountCode: '603' },
      { revenueCodeId: revPkg.id, glAccountCode: '601' },
      { revenueCodeId: revTreatment.id, glAccountCode: '604' },
      { revenueCodeId: revBoard.id, glAccountCode: '605' },
      { revenueCodeId: revTransfer.id, glAccountCode: '606' },
    ],
  });

  const mealHB = await prisma.mealPlan.create({ data: { code: 'HB', name: 'Half board' } });
  const mealBB = await prisma.mealPlan.create({ data: { code: 'BB', name: 'Breakfast' } });

  const typeStd = await prisma.roomType.create({
    data: { code: 'STWN', name: 'Standard Twin', baseQuota: 40, adultCapacity: 2 },
  });
  const typeDlx = await prisma.roomType.create({
    data: { code: 'DLX', name: 'Deluxe', baseQuota: 20, adultCapacity: 2 },
  });
  const typeSuite = await prisma.roomType.create({
    data: { code: 'SUITE', name: 'Suite', baseQuota: 8, adultCapacity: 3 },
  });

  const rateStd = await prisma.ratePlan.create({
    data: { code: 'STANDARD', name: 'Standard rate', pricePerNight: 120, roomTypeId: typeStd.id, mealPlanId: mealBB.id },
  });
  const rateMedical = await prisma.ratePlan.create({
    data: {
      code: 'MEDICAL',
      name: 'Medical package',
      pricePerNight: 180,
      medicalFlag: true,
      roomTypeId: typeDlx.id,
      mealPlanId: mealHB.id,
    },
  });

  await prisma.ratePlanPackageLine.createMany({
    data: [
      { ratePlanId: rateMedical.id, revenueCodeId: revRoom.id, amount: 90, sortOrder: 1 },
      { ratePlanId: rateMedical.id, revenueCodeId: revTreatment.id, amount: 60, sortOrder: 2 },
      { ratePlanId: rateMedical.id, revenueCodeId: revBoard.id, amount: 30, sortOrder: 3 },
    ],
  });

  const svcMassage = await prisma.procedureService.create({
    data: { code: 'MASSAGE', name: 'Therapeutic massage', durationMin: 45, defaultAmount: 50 },
  });
  const svcMud = await prisma.procedureService.create({
    data: { code: 'MUD', name: 'Mud bath', durationMin: 30, defaultAmount: 40 },
  });
  await prisma.ratePlanProcedureInclusion.create({
    data: { ratePlanId: rateMedical.id, serviceId: svcMassage.id },
  });

  const vehicleVan1 = await prisma.transferVehicle.create({
    data: {
      code: 'VAN-01',
      brand: 'Mercedes Vito',
      licensePlate: '10-AA-001',
      driverName: 'Rashad Aliyev',
      driverPhone: '+994501112233',
      maxSeats: 7,
    },
  });
  await prisma.transferVehicle.create({
    data: {
      code: 'VAN-02',
      brand: 'Toyota Hiace',
      licensePlate: '10-BB-002',
      driverName: 'Elvin Mammadov',
      driverPhone: '+994502223344',
      maxSeats: 4,
    },
  });

  const sourceWalkin = await prisma.bookingSource.create({ data: { code: 'WALKIN', name: 'Walk-in' } });
  const sourceOta = await prisma.bookingSource.create({ data: { code: 'OTA', name: 'OTA channels' } });

  const rooms = await Promise.all(
    [
      { roomNumber: '101', typeId: typeStd.id, floor: 1 },
      { roomNumber: '102', typeId: typeStd.id, floor: 1 },
      { roomNumber: '201', typeId: typeDlx.id, floor: 2 },
      { roomNumber: '202', typeId: typeDlx.id, floor: 2 },
      { roomNumber: '301', typeId: typeSuite.id, floor: 3 },
      { roomNumber: '302', typeId: typeSuite.id, floor: 3 },
      { roomNumber: '401', typeId: typeStd.id, floor: 4 },
      { roomNumber: '402', typeId: typeDlx.id, floor: 4 },
    ].map((r) =>
      prisma.room.create({
        data: { roomNumber: r.roomNumber, roomTypeId: r.typeId, floor: r.floor, status: 'AVAILABLE' },
      }),
    ),
  );

  const agency = await prisma.agency.create({
    data: { code: 'TRAVEL-AZ', name: 'Demo Travel Agency', voen: '1234567890' },
  });

  await prisma.contractPricingRule.create({
    data: {
      name: 'Travel agency -10%',
      agencyId: agency.id,
      ratePlanId: rateStd.id,
      ruleType: 'DISCOUNT',
      valuePercent: 10,
      validFrom: new Date('2026-01-01'),
      active: true,
    },
  });

  await prisma.posResource.createMany({
    data: [
      { code: 'T-01', name: 'Table 1', resourceType: 'TABLE', outletCode: 'RESTAURANT' },
      { code: 'SPA-1', name: 'Spa cabin 1', resourceType: 'SPA_CABIN', outletCode: 'SPA' },
      {
        code: 'NAFTANI-HALL',
        name: 'Naftani Banquet Hall',
        resourceType: 'BANQUET_HALL',
        outletCode: 'BANQUET',
      },
    ],
  });

  const hallResource = await prisma.posResource.findUnique({ where: { code: 'NAFTANI-HALL' } });
  const banquetSaloon = await prisma.banquetSaloon.create({
    data: {
      code: 'NAFTANI-HALL',
      name: 'Naftani Banquet Hall',
      maxPax: 120,
      posResourceId: hallResource!.id,
    },
  });
  const banquetMenu = await prisma.banquetMenuPackage.create({
    data: {
      code: 'STD-BANQUET',
      name: 'Standard banquet menu',
      pricePerPax: 85,
    },
  });
  const wh = await prisma.warehouse.create({
    data: { code: 'MAIN', name: 'Main kitchen store' },
  });
  const grp = await prisma.productGroup.create({ data: { code: 'FB', name: 'F&B' } });
  const product = await prisma.product.create({
    data: { code: 'DINNER-SET', name: 'Dinner set menu', groupId: grp.id, unit: 'portion' },
  });
  await prisma.stockMovement.create({
    data: {
      warehouseId: wh.id,
      productId: product.id,
      type: 'RECEIPT',
      qty: 100,
      reference: 'SEED-OPENING',
    },
  });

  await seedFoDemo(prisma, {
    rooms,
    typeStd,
    typeDlx,
    typeSuite,
    rateStd,
    rateMedical,
    mealHB,
    mealBB,
    agency,
    sourceWalkin,
    sourceOta,
    revRoom,
    revFood,
    deptAcc,
    deptRest,
    vehicleVan1,
  });

  const sampleRes = await prisma.reservation.findFirst({ where: { status: 'IN_HOUSE' } });

  const beoDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  beoDate.setHours(0, 0, 0, 0);
  await prisma.banquetEvent.create({
    data: {
      referenceNo: 'BEO-SEED-001',
      eventName: 'Corporate dinner — Demo Travel',
      saloonId: banquetSaloon.id,
      menuPackageId: banquetMenu.id,
      reservationId: sampleRes?.id,
      eventDate: beoDate,
      pax: 60,
      advanceAmount: 500,
      contactName: 'Demo Travel Agency',
      status: 'DRAFT',
    },
  });

  console.log('Seed complete', {
    rooms: rooms.length,
    agency: agency.id,
    warehouse: wh.id,
    sampleInHouse: sampleRes?.resNo ?? sampleRes?.id,
    guestCount: await prisma.guest.count(),
    reservationCount: await prisma.reservation.count(),
  });
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
