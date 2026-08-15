const fs = require("fs");
const path = require("path");
const p = path.join(__dirname, "../app/api/admin/settings/route.ts");
let s = fs.readFileSync(p, "utf8");
if (s.includes("printLogoDataUrl")) {
  console.log("already patched");
  process.exit(0);
}
const marker = "patientCardPlanPageSize: z.number().int().min(10).max(100).optional(),\n});";
const insert = `patientCardPlanPageSize: z.number().int().min(10).max(100).optional(),
  printLogoDataUrl: z.string().nullable().optional(),
  printClinicNameEn: z.string().nullable().optional(),
  printClinicNameRu: z.string().nullable().optional(),
  printClinicNameAz: z.string().nullable().optional(),
  printAddressEn: z.string().nullable().optional(),
  printAddressRu: z.string().nullable().optional(),
  printAddressAz: z.string().nullable().optional(),
  printPhone: z.string().nullable().optional(),
  printEmail: z.string().nullable().optional(),
  printWebsite: z.string().nullable().optional(),
  printFooterEn: z.string().nullable().optional(),
  printFooterRu: z.string().nullable().optional(),
  printFooterAz: z.string().nullable().optional(),
  printSignatureLab: z.string().nullable().optional(),
  printSignatureDoctor: z.string().nullable().optional(),
  checkupSectionsJson: z.string().nullable().optional(),
});`;
if (!s.includes(marker)) {
  console.error("marker missing");
  process.exit(1);
}
fs.writeFileSync(p, s.replace(marker, insert), "utf8");
console.log("route ok");
