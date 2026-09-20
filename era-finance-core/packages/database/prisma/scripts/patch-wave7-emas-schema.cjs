const fs = require("fs");
const p = "era-finance-core/packages/database/prisma/schema.prisma";
let s = fs.readFileSync(p, "utf8");
if (!s.includes("PENDING_MANUAL")) {
  s = s.replace(
    "enum EmasContractEventStatus {\n  PENDING\n  SUBMITTED\n  ACCEPTED\n  REJECTED\n  FAILED\n}",
    "enum EmasContractEventStatus {\n  PENDING\n  PENDING_MANUAL\n  SUBMITTED\n  SUBMITTED_MANUAL\n  ACCEPTED\n  REJECTED\n  FAILED\n}",
  );
}
if (!s.includes("submittedByUserId")) {
  s = s.replace(
    '  submittedAt    DateTime?               @map("submitted_at") @db.Timestamptz(6)\n  createdAt      DateTime                @default(now()) @map("created_at")\n  updatedAt      DateTime                @updatedAt @map("updated_at")\n  organization   Organization            @relation(fields: [organizationId], references: [id], onDelete: Cascade)\n  employee       Employee                @relation(fields: [employeeId], references: [id], onDelete: Cascade)\n\n  @@index([organizationId, employeeId])\n  @@index([organizationId, status])\n  @@map("emas_contract_events")',
    '  submittedAt    DateTime?               @map("submitted_at") @db.Timestamptz(6)\n  submittedByUserId String?                @map("submitted_by_user_id") @db.Uuid\n  createdAt      DateTime                @default(now()) @map("created_at")\n  updatedAt      DateTime                @updatedAt @map("updated_at")\n  organization   Organization            @relation(fields: [organizationId], references: [id], onDelete: Cascade)\n  employee       Employee                @relation(fields: [employeeId], references: [id], onDelete: Cascade)\n\n  @@index([organizationId, employeeId])\n  @@index([organizationId, status])\n  @@map("emas_contract_events")',
  );
}
fs.writeFileSync(p, s, "utf8");
console.log(
  "ok",
  s.includes("PENDING_MANUAL"),
  s.includes("SUBMITTED_MANUAL"),
  s.includes("submittedByUserId"),
);
