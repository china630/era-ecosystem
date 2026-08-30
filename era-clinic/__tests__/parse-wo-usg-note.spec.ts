import {
  mapWoUsgServiceCode,
  parseWoUsgNote,
  parseWoUsgNoteWithFallback,
} from "@/lib/import/parse-wo-usg-note";
import { getImportAdapter } from "@/lib/import/adapters";

jest.mock("@era/satellite-kit", () => ({
  satelliteOrganizationId: () => "org-test",
  resolveSatelliteTenantOrgId: () => "org-test",
  enterSatelliteTenant: () => undefined,
  linkPersonIdentity: jest.fn().mockResolvedValue({ globalPersonId: null }),
}));

jest.mock("@/lib/import/cutover-patient-mdm", () => ({
  resolveCutoverPatientMdm: jest.fn().mockResolvedValue("gp-cutover"),
}));

const ABD_2019 = `             Tam abdomen Ultrasonografiya müayinəsi
Qaraciyər sağ pay KKÖ  138mm  (n >150mm) böyüklükdədir.Parenximi  homogen  ,exogenliyi  normal  (GRADE ).Solid və ya kistik lezyon aşkar edilmir.Portal vena (nor. 10-15mm)və hepatik venalar normal genişlikdədir.
Öd kisəsi          vizualziasiya olunmur.
Pankreas  ölçüləri :başı     20mm.Strukturu homogen  .Exogenliyi   normal
 Dalaq     normal    (80-130x30-50mm) ölçülərdədir.Parenximi homogen .Splenik vena    (>8mm)normal genişlikdədir.
Sağ böyrək     normal   ölçülərdədir.Parenxim qalınlığı         13mm   və exogenliyi normaldır. Mikrolitlər izlənilir.
Sol böyrək   normal    ölçülərdədir.Parenxim qalınlığı    14mm        və exogenliyi normaldır. Mikrolitlər izlənilir.
Sidik kisəsi  Divar qalınlığı        2.3mm     (>3mm).Konturları hamar.Sidik möhtəviyatı təmiz
Uterus         normal (42-61x42-60x28-42mm) ölçülərindədir. Miometrium  homogen.  Endometrium   normal .Douglasda  sərbəst maye izlənilmədi.
Hər iki over atrofikdir. .
 Nəticə.Meteorizim.Böyrək mikrolitləri,
Dr.Radioloq: Cəfərov Turxan`;

const THYROID_2077 = `İsthmus    6mm   ölçüdədir.Parenximası heterogen
Sağ lob  həcmi      12sm3     ölçüdədir.Parenximası heterogen    olub ,exogenliyi   qarışıq  ,9x9 mm ölçüsündə hiperexogen periferik qanlanan  düyün izlənilir.
Sol lob  həcmi     11sm3    ölçüdədir.Parenximası heterogen    olub ,exogenliyi   qarışıq  ,solid və kistik lezyon aşkar olunmur .
Bilateral arterial qanlanması normaldır.

Nəticə.Xaşimoto, Düyünlü zob .
Dr.Radioloq:Cəfərov Turxan`;

const BREAST_2019 = `Sağ süd vəzidə dərialtı toxumalar normaldır. TİP – I .
Süd vəzisi əsasən  piy toxumasından təşkil olunmuşdur.
Sol  süd vəzidə dərialtı toxumalar normaldır. TİP – I .
Törəmə  aşkar edilmədi.`;

describe("WO USG cutover mapping", () => {
  it("maps Müayinə Anketi types to catalog codes", () => {
    expect(mapWoUsgServiceCode({ diagnoses: [{ diagnosisName: "USM" }], notes: ABD_2019 })).toBe(
      "USG-ABD",
    );
    expect(mapWoUsgServiceCode({ diagnoses: [{ diagnosisName: "Tiroid" }], notes: THYROID_2077 })).toBe(
      "USG-THYROID",
    );
    expect(
      mapWoUsgServiceCode({ diagnoses: [{ diagnosisName: "Süd vəzilərin us" }], notes: BREAST_2019 }),
    ).toBe("USG-BREAST");
    expect(mapWoUsgServiceCode({ diagnoses: [{ diagnosisName: "USM dopler" }], notes: "Doppler" })).toBe(
      "USG-DOPPLER",
    );
    expect(
      mapWoUsgServiceCode({ diagnoses: [{ diagnosisName: "USM səthi toxuma" }], notes: "lipoma" }),
    ).toBe("USG-SOFT");
    expect(mapWoUsgServiceCode({ diagnoses: [], notes: ABD_2019 })).toBeNull();
    expect(mapWoUsgServiceCode({ diagnoses: [{ diagnosisName: "U?SM" }], notes: ABD_2019 })).toBe(
      "USG-ABD",
    );
  });

  it("keeps raw Qeyd as sourceNote fallback", () => {
    const lines = parseWoUsgNoteWithFallback("USG-ABD", ABD_2019);
    expect(lines.some((l) => l.code === "sourceNote" && l.value.includes("Tam abdomen"))).toBe(true);
  });

  it("parses Nafta abdomen organs and conclusion", () => {
    const lines = parseWoUsgNote("USG-ABD", ABD_2019);
    const byCode = Object.fromEntries(lines.map((l) => [l.code, l.value]));
    expect(byCode.liver).toMatch(/138mm/);
    expect(byCode.gallbladder).toMatch(/vizualziasiya/i);
    expect(byCode.rightKidney).toMatch(/Mikrolit/);
    expect(byCode.uterus).toMatch(/Douglas/);
    expect(byCode.conclusion).toMatch(/Meteorizim/);
    expect(byCode["meta.performer"]).toMatch(/Cəfərov/);
  });

  it("parses thyroid lobes", () => {
    const lines = parseWoUsgNote("USG-THYROID", THYROID_2077);
    const byCode = Object.fromEntries(lines.map((l) => [l.code, l.value]));
    expect(byCode.isthmus).toMatch(/6mm/);
    expect(byCode.rightLobe).toMatch(/12sm3/);
    expect(byCode.conclusion).toMatch(/Xaşimoto/);
  });

  it("parses both breasts", () => {
    const lines = parseWoUsgNote("USG-BREAST", BREAST_2019);
    const byCode = Object.fromEntries(lines.map((l) => [l.code, l.value]));
    expect(byCode.rightBreast).toMatch(/TİP/);
    expect(byCode.leftBreast).toMatch(/TİP/);
  });

  it("parses Doppler and soft-tissue notes as findings", () => {
    const doppler = parseWoUsgNote("USG-DOPPLER", "A. carotis flow 120 cm/s\nNəticə. Stenoz yoxdur.\nDr.Radioloq: Cəfərov Turxan");
    const byD = Object.fromEntries(doppler.map((l) => [l.code, l.value]));
    expect(byD.findings).toMatch(/carotis/i);
    expect(byD.conclusion).toMatch(/Stenoz/);
    const soft = parseWoUsgNote("USG-SOFT", "Lipoma 12mm.\nNəticə. Xoşxassəli.");
    expect(Object.fromEntries(soft.map((l) => [l.code, l.value])).findings).toMatch(/Lipoma/);
  });

  it("diagnostics upsert writes USG-ABD lines not a USG stub", async () => {
    const adapter = getImportAdapter("diagnostics")!;
    const mapped = adapter.mapRow({
      externalRef: "wo:usg:377",
      patientRef: "wo:patient:2019",
      code: "USG-ABD",
      name: "Qarın boşluğu və kiçik çanaq USM",
      resultText: ABD_2019,
      resultJson: "",
      takenAt: "2026-08-17",
    });
    const row = adapter.rowSchema.parse(mapped);
    const createOrder = jest.fn().mockResolvedValue({ id: "ord1" });
    const createResult = jest.fn().mockResolvedValue({ id: "r1" });
    const tx = {
      cutoverImportKey: {
        findFirst: jest.fn(async ({ where }: { where: { entity: string } }) =>
          where.entity === "patients" ? { recordId: "pat1" } : null,
        ),
        create: jest.fn(),
      },
      modality: { findFirst: jest.fn().mockResolvedValue({ id: "mod-usg" }), create: jest.fn() },
      diagnosticService: { findFirst: jest.fn().mockResolvedValue({ id: "svc-abd" }), create: jest.fn() },
      labOrder: { create: createOrder, update: jest.fn() },
      labOrderItem: { create: jest.fn().mockResolvedValue({ id: "item1" }), findFirst: jest.fn().mockResolvedValue({ id: "item1" }) },
      labResult: { findUnique: jest.fn().mockResolvedValue(null), create: createResult, update: jest.fn(), deleteMany: jest.fn().mockResolvedValue({ count: 0 }) },
    };
    await adapter.upsert(tx as never, row, false);
    expect(createOrder.mock.calls[0][0].data.testCode).toBe("USG-ABD");
    const parsed = JSON.parse(createOrder.mock.calls[0][0].data.resultJson) as Array<{ code: string }>;
    expect(parsed.some((l) => l.code === "liver")).toBe(true);
    expect(parsed.some((l) => l.code === "rightKidney")).toBe(true);
    expect(parsed.some((l) => l.code === "sourceNote")).toBe(true);
    expect(createResult).toHaveBeenCalled();
  });

  it("diagnostics upsert prefers resultJson from the workbook", async () => {
    const adapter = getImportAdapter("diagnostics")!;
    const mapped = adapter.mapRow({
      externalRef: "wo:usg:377",
      patientRef: "wo:patient:2019",
      code: "USG-ABD",
      name: "Qarın boşluğu və kiçik çanaq USM",
      resultText: ABD_2019,
      resultJson: JSON.stringify([{ code: "liver", label: "Qaraciyər", value: "from-book" }]),
      takenAt: "2026-08-17",
    });
    const row = adapter.rowSchema.parse(mapped);
    const createOrder = jest.fn().mockResolvedValue({ id: "ord1" });
    const tx = {
      cutoverImportKey: {
        findFirst: jest.fn(async ({ where }: { where: { entity: string } }) =>
          where.entity === "patients" ? { recordId: "pat1" } : null,
        ),
        create: jest.fn(),
      },
      modality: { findFirst: jest.fn().mockResolvedValue({ id: "mod-usg" }), create: jest.fn() },
      diagnosticService: { findFirst: jest.fn().mockResolvedValue({ id: "svc-abd" }), create: jest.fn() },
      labOrder: { create: createOrder, update: jest.fn() },
      labOrderItem: { create: jest.fn().mockResolvedValue({ id: "item1" }), findFirst: jest.fn().mockResolvedValue({ id: "item1" }) },
      labResult: { findUnique: jest.fn().mockResolvedValue(null), create: jest.fn().mockResolvedValue({ id: "r1" }), update: jest.fn(), deleteMany: jest.fn().mockResolvedValue({ count: 0 }) },
    };
    await adapter.upsert(tx as never, row, false);
    const parsed = JSON.parse(createOrder.mock.calls[0][0].data.resultJson) as Array<{ code: string; value: string }>;
    expect(parsed.find((l) => l.code === "liver")?.value).toBe("from-book");
    expect(parsed.some((l) => l.code === "gallbladder")).toBe(false);
    expect(parsed.some((l) => l.code === "sourceNote")).toBe(true);
  });
});
