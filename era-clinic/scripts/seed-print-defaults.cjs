const { PrismaClient } = require("@prisma/client");
const p = new PrismaClient();

async function main() {
  const n = await p.imagingPhrase.count();
  if (n === 0) {
    await p.imagingPhrase.createMany({
      data: [
        {
          organKey: "liver",
          code: "liver.normal",
          textEn: "Liver: normal size and echostructure.",
          textRu: "Liver: normal (RU).",
          textAz: "Qaraciyer: olcu ve ehostruktur normaldir.",
          sortOrder: 1,
        },
        {
          organKey: "gallbladder",
          code: "gb.normal",
          textEn: "Gallbladder: walls not thickened, no stones.",
          textRu: "Gallbladder: normal (RU).",
          textAz: "Od kisəsi: divarlar qalinlasmayib, das yoxdur.",
          sortOrder: 1,
        },
        {
          organKey: "conclusion",
          code: "conc.meteorizm",
          textEn: "Conclusion: meteorism.",
          textRu: "Conclusion: meteorism (RU).",
          textAz: "Netice: meteorizm.",
          sortOrder: 1,
        },
      ],
    });
    console.log("seeded phrases");
  } else {
    console.log("phrases exist", n);
  }

  const t = await p.tenant.findFirst();
  if (t && !t.checkupSectionsJson) {
    await p.tenant.update({
      where: { id: t.id },
      data: {
        checkupSectionsJson: JSON.stringify([
          { specialty: "therapist", enabled: true },
          { specialty: "cardiologist", enabled: true },
          { specialty: "gynecologist", enabled: true },
          { specialty: "usm", enabled: true },
          { specialty: "dermatoneurologist", enabled: true },
          { specialty: "cosmetologist", enabled: false },
          { specialty: "manual_therapist", enabled: true },
        ]),
        printClinicNameAz: "NAFTA SANATORIYA",
        printClinicNameEn: "NAFTA SANATORIUM",
        printClinicNameRu: "NAFTA SANATORIUM",
        printPhone: "0102257700",
        printAddressAz: "Naftalan sheheri, Heydar Aliyev pr.71",
        printAddressEn: "Naftalan city, Heydar Aliyev Ave. 71",
        printAddressRu: "Naftalan, Heydar Aliyev Ave. 71",
      },
    });
    console.log("tenant branding defaults");
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => p.$disconnect());
