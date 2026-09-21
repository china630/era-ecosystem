const fs = require("fs");
const path = "era-finance-core/packages/database/prisma/schema.prisma";
let s = fs.readFileSync(path, "utf8");

if (!s.includes("internalRate")) {
  s = s.replace(
    '  supplementSalary               Decimal                  @default(0) @map("supplement_salary") @db.Decimal(19, 4)\n  workScheduleId',
    '  supplementSalary               Decimal                  @default(0) @map("supplement_salary") @db.Decimal(19, 4)\n  /// Wave 5: management internal rate (AZN); payroll calc ignores this.\n  internalRate                   Decimal?                 @map("internal_rate") @db.Decimal(19, 4)\n  workScheduleId',
  );
}

if (!s.includes("mgmtLaborDeltas                MgmtLaborDelta[]")) {
  s = s.replace(
    "  timesheetEntries               TimesheetEntry[]\n  inventoryAuditsResponsible",
    "  timesheetEntries               TimesheetEntry[]\n  mgmtLaborDeltas                MgmtLaborDelta[]\n  inventoryAuditsResponsible",
  );
}

if (!s.includes("mgmtLaborDeltas                 MgmtLaborDelta[]")) {
  s = s.replace(
    "  warehouses                      Warehouse[]\n  warehouseBins                   WarehouseBin[]",
    "  warehouses                      Warehouse[]\n  warehouseBins                   WarehouseBin[]\n  mgmtLaborDeltas                 MgmtLaborDelta[]",
  );
}

if (!s.includes("model MgmtLaborDelta")) {
  const model = `
/// Wave 5: idempotent management labor cost delta (org×month×employee). Posts only to MGMT book.
model MgmtLaborDelta {
  id               String       @id @default(dbgenerated("uuid_generate_v4()")) @db.Uuid
  organizationId   String       @map("organization_id") @db.Uuid
  year             Int
  month            Int
  employeeId       String       @map("employee_id") @db.Uuid
  workHours        Decimal      @map("work_hours") @db.Decimal(19, 4)
  monthNormHours   Decimal      @map("month_norm_hours") @db.Decimal(19, 4)
  mgmtGross        Decimal      @map("mgmt_gross") @db.Decimal(19, 4)
  statGross        Decimal      @map("stat_gross") @db.Decimal(19, 4)
  delta            Decimal      @db.Decimal(19, 4)
  accountingBookId String       @map("accounting_book_id") @db.Uuid
  transactionId    String?      @map("transaction_id") @db.Uuid
  createdAt        DateTime     @default(now()) @map("created_at")
  updatedAt        DateTime     @updatedAt @map("updated_at")
  organization     Organization @relation(fields: [organizationId], references: [id], onDelete: Cascade)
  employee         Employee     @relation(fields: [employeeId], references: [id], onDelete: Cascade)

  @@unique([organizationId, year, month, employeeId], map: "mgmt_labor_deltas_org_ym_emp_uidx")
  @@index([organizationId, year, month])
  @@map("mgmt_labor_deltas")
}

`;
  s = s.replace("model PayrollRun {", model + "model PayrollRun {");
}

fs.writeFileSync(path, s, "utf8");
console.log(
  "ok",
  s.includes("internalRate"),
  s.includes("model MgmtLaborDelta"),
  s.includes("mgmtLaborDeltas"),
);
