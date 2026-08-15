const fs = require("fs");
const path = require("path");

const file = path.join(__dirname, "../../src/lib/procedure-scheduling.service.ts");
let src = fs.readFileSync(file, "utf8");
if (src.charCodeAt(0) === 0xfeff) src = src.slice(1);

const oldType = `    const slots: Array<{
      time: string;
      occupied: boolean;
      procedureOrderId?: string;
      patientName?: string;
      procedureName?: string;
      staffPractitionerId?: string;
      staffName?: string;
    }> = [];`;

const newType = `    const slots: Array<{
      time: string;
      endsAt: string;
      occupied: boolean;
      procedureOrderId?: string;
      patientName?: string;
      procedureName?: string;
      procedureCode?: string;
      status?: string;
      staffPractitionerId?: string;
      staffName?: string;
    }> = [];`;

const oldPush = `        slots.push({
          time: slotStart.toISOString(),
          occupied: Boolean(hit),
          procedureOrderId: hit?.procedureOrderId ?? undefined,
          patientName: hit?.procedureOrder?.patientRef.fullName,
          procedureName: hit?.procedureOrder?.procedureName,
          staffPractitionerId:
            staffAlloc?.practitionerId ?? staffAlloc?.practitioner?.id,
          staffName: staffAlloc?.practitioner?.fullName,
        });`;

const newPush = `        slots.push({
          time: slotStart.toISOString(),
          endsAt: (hit?.endsAt ?? slotEnd).toISOString(),
          occupied: Boolean(hit),
          procedureOrderId: hit?.procedureOrderId ?? undefined,
          patientName: hit?.procedureOrder?.patientRef.fullName,
          procedureName: hit?.procedureOrder?.procedureName,
          procedureCode: hit?.procedureOrder?.procedureCode,
          status: hit?.procedureOrder?.status,
          staffPractitionerId:
            staffAlloc?.practitionerId ?? staffAlloc?.practitioner?.id,
          staffName: staffAlloc?.practitioner?.fullName,
        });`;

if (!src.includes(oldType) || !src.includes(oldPush)) {
  console.error("patch-calendar-slots: markers not found");
  process.exit(1);
}
src = src.replace(oldType, newType).replace(oldPush, newPush);
fs.writeFileSync(file, src, "utf8");
const b = fs.readFileSync(file);
console.log("patched procedure-scheduling.service.ts byte0=", b[0]);