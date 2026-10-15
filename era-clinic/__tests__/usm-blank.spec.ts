import { parseUsmSections, usmBlankKind } from "@/domain/lab/usm-blank";

const abdomen = [
  "Müayinə adı",
  "Tam abdominal USM",
  "Tarix",
  "Qaraciyər",
  "Sağ pay KKÖ (n >150mm) böyüklükdədir.",
  "Öd kisəsi",
  "ölçülərdədir.",
  "Uterus",
  "normal ölçülərindədir.",
  "Sağ over",
  "Atrofikdir",
  "Sol over",
  "Atrofikdir",
  "Prostat vəzi",
  "həcmi sm3.",
  "Nəticə",
  "Hepatosteatoz",
  "Dr.Radioloq: Cəfərov Turxan",
];

describe("usm narrative blank", () => {
  it("knows abdomen and thyroid panels", () => {
    expect(usmBlankKind("USG-ABD")).toBe("abdomen");
    expect(usmBlankKind("USG-THYROID")).toBe("thyroid");
    expect(usmBlankKind("LAB-THYROID")).toBeNull();
    expect(usmBlankKind("LAB-CBC")).toBeNull();
  });

  it("keeps female organs and drops the prostate", () => {
    const fields = parseUsmSections(abdomen, { kind: "abdomen", sex: "FEMALE" });
    expect(fields.liver).toContain("böyüklükdədir");
    expect(fields.uterus).toContain("ölçülərindədir");
    expect(fields.ovaries).toBe("Sağ over: Atrofikdir\nSol over: Atrofikdir");
    expect(fields.prostate).toBeUndefined();
    expect(fields.conclusion).toBe("Hepatosteatoz");
    expect(JSON.stringify(fields)).not.toContain("Cəfərov");
    expect(JSON.stringify(fields)).not.toContain("Tam abdominal");
  });

  it("keeps the prostate and drops uterus and ovaries", () => {
    const fields = parseUsmSections(abdomen, { kind: "abdomen", sex: "MALE" });
    expect(fields.prostate).toContain("həcmi");
    expect(fields.uterus).toBeUndefined();
    expect(fields.ovaries).toBeUndefined();
  });

  it("reads thyroid headings including the dotted capital i", () => {
    const fields = parseUsmSections(
      ["İsthmus", "ölçüdədir.", "Sol lob həcmi", "həcmi ölçüdədir.", "Limfa düyünü", "İzlənilmir", "Nəticə"],
      { kind: "thyroid", sex: "FEMALE" },
    );
    expect(fields.isthmus).toBe("ölçüdədir.");
    expect(fields.leftLobe).toBe("həcmi ölçüdədir.");
    expect(fields.lymphNodes).toBe("İzlənilmir");
  });
});
