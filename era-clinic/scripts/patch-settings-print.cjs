const fs = require("fs");
const path = require("path");
const p = path.join(__dirname, "../src/domain/settings/settings.service.ts");
let s = fs.readFileSync(p, "utf8");

if (!s.includes("printLogoDataUrl")) {
  const marker =
    "patientCardPlanPageSize:\n      tenant.patientCardPlanPageSize ?? CARD_DEFAULTS.patientCardPlanPageSize,\n  };";
  const insert = `patientCardPlanPageSize:
      tenant.patientCardPlanPageSize ?? CARD_DEFAULTS.patientCardPlanPageSize,
    printLogoDataUrl: tenant.printLogoDataUrl ?? null,
    printClinicNameEn: tenant.printClinicNameEn ?? null,
    printClinicNameRu: tenant.printClinicNameRu ?? null,
    printClinicNameAz: tenant.printClinicNameAz ?? null,
    printAddressEn: tenant.printAddressEn ?? null,
    printAddressRu: tenant.printAddressRu ?? null,
    printAddressAz: tenant.printAddressAz ?? null,
    printPhone: tenant.printPhone ?? null,
    printEmail: tenant.printEmail ?? null,
    printWebsite: tenant.printWebsite ?? null,
    printFooterEn: tenant.printFooterEn ?? null,
    printFooterRu: tenant.printFooterRu ?? null,
    printFooterAz: tenant.printFooterAz ?? null,
    printSignatureLab: tenant.printSignatureLab ?? null,
    printSignatureDoctor: tenant.printSignatureDoctor ?? null,
    checkupSectionsJson: tenant.checkupSectionsJson ?? null,
  };`;
  if (!s.includes(marker)) {
    console.error("marker not found for getClinicSettings");
    process.exit(1);
  }
  s = s.replace(marker, insert);
}

if (!s.includes("printLogoDataUrl?:")) {
  const inputMarker = "  patientCardPlanPageSize?: number;\n}) {";
  const inputInsert = `  patientCardPlanPageSize?: number;
  printLogoDataUrl?: string | null;
  printClinicNameEn?: string | null;
  printClinicNameRu?: string | null;
  printClinicNameAz?: string | null;
  printAddressEn?: string | null;
  printAddressRu?: string | null;
  printAddressAz?: string | null;
  printPhone?: string | null;
  printEmail?: string | null;
  printWebsite?: string | null;
  printFooterEn?: string | null;
  printFooterRu?: string | null;
  printFooterAz?: string | null;
  printSignatureLab?: string | null;
  printSignatureDoctor?: string | null;
  checkupSectionsJson?: string | null;
}) {`;
  if (!s.includes(inputMarker)) {
    console.error("input marker not found");
    process.exit(1);
  }
  s = s.replace(inputMarker, inputInsert);
}

if (!s.includes("printLogoDataUrl: input.printLogoDataUrl")) {
  const updateMarker =
    "      ...(planPage != null ? { patientCardPlanPageSize: planPage } : {}),\n    },\n  });\n}";
  const updateInsert = `      ...(planPage != null ? { patientCardPlanPageSize: planPage } : {}),
      ...(input.printLogoDataUrl !== undefined ? { printLogoDataUrl: input.printLogoDataUrl } : {}),
      ...(input.printClinicNameEn !== undefined ? { printClinicNameEn: input.printClinicNameEn } : {}),
      ...(input.printClinicNameRu !== undefined ? { printClinicNameRu: input.printClinicNameRu } : {}),
      ...(input.printClinicNameAz !== undefined ? { printClinicNameAz: input.printClinicNameAz } : {}),
      ...(input.printAddressEn !== undefined ? { printAddressEn: input.printAddressEn } : {}),
      ...(input.printAddressRu !== undefined ? { printAddressRu: input.printAddressRu } : {}),
      ...(input.printAddressAz !== undefined ? { printAddressAz: input.printAddressAz } : {}),
      ...(input.printPhone !== undefined ? { printPhone: input.printPhone } : {}),
      ...(input.printEmail !== undefined ? { printEmail: input.printEmail } : {}),
      ...(input.printWebsite !== undefined ? { printWebsite: input.printWebsite } : {}),
      ...(input.printFooterEn !== undefined ? { printFooterEn: input.printFooterEn } : {}),
      ...(input.printFooterRu !== undefined ? { printFooterRu: input.printFooterRu } : {}),
      ...(input.printFooterAz !== undefined ? { printFooterAz: input.printFooterAz } : {}),
      ...(input.printSignatureLab !== undefined ? { printSignatureLab: input.printSignatureLab } : {}),
      ...(input.printSignatureDoctor !== undefined
        ? { printSignatureDoctor: input.printSignatureDoctor }
        : {}),
      ...(input.checkupSectionsJson !== undefined
        ? { checkupSectionsJson: input.checkupSectionsJson }
        : {}),
    },
  });
}`;
  // only replace the update block's closing — find last occurrence carefully
  const idx = s.lastIndexOf(
    "      ...(planPage != null ? { patientCardPlanPageSize: planPage } : {}),\n    },\n  });\n}",
  );
  if (idx < 0) {
    console.error("update marker not found");
    process.exit(1);
  }
  s =
    s.slice(0, idx) +
    updateInsert +
    s.slice(
      idx +
        "      ...(planPage != null ? { patientCardPlanPageSize: planPage } : {}),\n    },\n  });\n}"
          .length,
    );
}

fs.writeFileSync(p, s, "utf8");
console.log("settings patched ok", s.includes("printSignatureDoctor"));
