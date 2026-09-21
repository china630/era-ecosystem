const fs = require("fs");
const path = "era-orchestrator/packages/database/prisma/schema.prisma";
let s = fs.readFileSync(path, "utf8");

if (!s.includes("model WorkforceAttendanceDevice")) {
  // Add org relations
  if (!s.includes("workforceAttendanceDevices")) {
    s = s.replace(
      "  workforceDayOverrides WorkforceDayOverride[]\n",
      "  workforceDayOverrides WorkforceDayOverride[]\n" +
        "  workforceAttendanceDevices WorkforceAttendanceDevice[]\n" +
        "  workforceAttendanceIdentities WorkforceAttendanceIdentity[]\n" +
        "  workforceAttendancePunches WorkforceAttendancePunch[]\n",
    );
  }

  // Place relation
  if (!s.includes("attendanceDevices")) {
    s = s.replace(
      "  dayOverrides         WorkforceDayOverride[]\n\n  @@unique([organizationId, code])\n  @@index([organizationId, status])\n  @@map(\"workforce_places\")",
      "  dayOverrides         WorkforceDayOverride[]\n" +
        "  attendanceDevices    WorkforceAttendanceDevice[]\n" +
        "  attendancePunches    WorkforceAttendancePunch[]\n\n" +
        "  @@unique([organizationId, code])\n  @@index([organizationId, status])\n  @@map(\"workforce_places\")",
    );
  }

  // Employment relation
  if (!s.includes("attendanceIdentities")) {
    s = s.replace(
      "  dayOverrides               WorkforceDayOverride[]\n\n  @@index([organizationId, status])\n  @@index([workforceScopeId, orgUnitId])\n  @@index([globalPersonId])\n  @@map(\"workforce_employments\")",
      "  dayOverrides               WorkforceDayOverride[]\n" +
        "  attendanceIdentities       WorkforceAttendanceIdentity[]\n" +
        "  attendancePunches          WorkforceAttendancePunch[]\n\n" +
        "  @@index([organizationId, status])\n  @@index([workforceScopeId, orgUnitId])\n  @@index([globalPersonId])\n  @@map(\"workforce_employments\")",
    );
  }

  const enums = `
enum WorkforceAttendanceDeviceStatus {
  ACTIVE
  REVOKED
}

enum WorkforceAttendanceDirection {
  IN
  OUT
}

enum WorkforceAttendancePunchStatus {
  UNMAPPED
  MAPPED
  OPEN
  PAIRED
  REJECTED
}
`;

  const models = `
/// Wave 6: tablet / FaceID device bound to one org + usually one Place. Auth via att_ token (hash stored).
model WorkforceAttendanceDevice {
  id             String                          @id @default(dbgenerated("uuid_generate_v4()")) @db.Uuid
  organizationId String                          @map("organization_id") @db.Uuid
  placeId        String                          @map("place_id") @db.Uuid
  name           String                          @db.VarChar(128)
  code           String?                         @db.VarChar(64)
  tokenHash      String                          @map("token_hash") @db.VarChar(128)
  /// Optional HMAC secret hash for body signature (sha256 hex of secret).
  hmacSecretHash String?                         @map("hmac_secret_hash") @db.VarChar(128)
  status         WorkforceAttendanceDeviceStatus @default(ACTIVE)
  lastSeenAt     DateTime?                       @map("last_seen_at") @db.Timestamptz(6)
  createdAt      DateTime                        @default(now()) @map("created_at")
  updatedAt      DateTime                        @updatedAt @map("updated_at")
  organization   Organization                    @relation(fields: [organizationId], references: [id], onDelete: Cascade)
  place          WorkforcePlace                  @relation(fields: [placeId], references: [id], onDelete: Restrict)
  punches        WorkforceAttendancePunch[]

  @@unique([organizationId, tokenHash])
  @@index([organizationId, status])
  @@index([placeId])
  @@map("workforce_attendance_devices")
}

/// Wave 6: device personRef → employment within one org (two VÖEN = two mappings).
model WorkforceAttendanceIdentity {
  id             String              @id @default(dbgenerated("uuid_generate_v4()")) @db.Uuid
  organizationId String              @map("organization_id") @db.Uuid
  personRef      String              @map("person_ref") @db.VarChar(128)
  employmentId   String              @map("employment_id") @db.Uuid
  createdAt      DateTime            @default(now()) @map("created_at")
  updatedAt      DateTime            @updatedAt @map("updated_at")
  organization   Organization        @relation(fields: [organizationId], references: [id], onDelete: Cascade)
  employment     WorkforceEmployment @relation(fields: [employmentId], references: [id], onDelete: Cascade)

  @@unique([organizationId, personRef])
  @@index([organizationId, employmentId])
  @@map("workforce_attendance_identities")
}

/// Wave 6: immutable raw punch. No biometric templates.
model WorkforceAttendancePunch {
  id               String                         @id @default(dbgenerated("uuid_generate_v4()")) @db.Uuid
  organizationId   String                         @map("organization_id") @db.Uuid
  deviceId         String                         @map("device_id") @db.Uuid
  placeId          String                         @map("place_id") @db.Uuid
  employmentId     String?                        @map("employment_id") @db.Uuid
  personRef        String                         @map("person_ref") @db.VarChar(128)
  direction        WorkforceAttendanceDirection
  occurredAt       DateTime                       @map("occurred_at") @db.Timestamptz(6)
  externalId       String?                        @map("external_id") @db.VarChar(128)
  status           WorkforceAttendancePunchStatus @default(UNMAPPED)
  placeMismatch    Boolean                        @default(false) @map("place_mismatch")
  pairId           String?                        @map("pair_id") @db.Uuid
  hoursAttributed  Decimal?                       @map("hours_attributed") @db.Decimal(10, 2)
  workDate         DateTime?                      @map("work_date") @db.Date
  createdAt        DateTime                       @default(now()) @map("created_at")
  organization     Organization                   @relation(fields: [organizationId], references: [id], onDelete: Cascade)
  device           WorkforceAttendanceDevice      @relation(fields: [deviceId], references: [id], onDelete: Cascade)
  place            WorkforcePlace                 @relation(fields: [placeId], references: [id], onDelete: Restrict)
  employment       WorkforceEmployment?           @relation(fields: [employmentId], references: [id], onDelete: SetNull)

  @@unique([deviceId, externalId])
  @@index([organizationId, occurredAt])
  @@index([organizationId, status])
  @@index([organizationId, employmentId, occurredAt])
  @@index([pairId])
  @@map("workforce_attendance_punches")
}
`;

  // Insert enums near other Workforce enums
  if (!s.includes("enum WorkforceAttendanceDeviceStatus")) {
    s = s.replace(
      "enum WorkforcePlaceStatus {",
      enums + "\nenum WorkforcePlaceStatus {",
    );
  }

  // Insert models after WorkforcePlace block end
  if (!s.includes("model WorkforceAttendanceDevice")) {
    s = s.replace(
      "  @@map(\"workforce_places\")\n}\n\n/// Named shift window",
      "  @@map(\"workforce_places\")\n}\n" + models + "\n/// Named shift window",
    );
  }

  fs.writeFileSync(path, s, "utf8");
  console.log(
    "ok",
    s.includes("model WorkforceAttendanceDevice"),
    s.includes("workforceAttendanceDevices"),
  );
}
