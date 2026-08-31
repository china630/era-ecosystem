import {
  ANAMNESIS_REQUIRED,
  episodeAnamnesisDenied,
  episodeWriteDenied,
  walkInCloseDenied,
} from "@/domain/sanatorium/episode-gates";

describe("CLI-55 episode gates (W2)", () => {
  it("ANAMNESIS_REQUIRED when empty OPEN anamnesis", () => {
    expect(episodeAnamnesisDenied(null)).toMatch(/Anamnesis/i);
    expect(episodeAnamnesisDenied("   ")).toMatch(/Anamnesis/i);
    expect(episodeAnamnesisDenied("ok")).toBeNull();
    expect(ANAMNESIS_REQUIRED).toBe("ANAMNESIS_REQUIRED");
  });

  it("CLOSED episode is read-only", () => {
    expect(episodeWriteDenied("CLOSED")).toMatch(/read-only/i);
    expect(episodeWriteDenied("OPEN")).toBeNull();
  });

  it("walk-in close refused with live procedures or open labs", () => {
    expect(
      walkInCloseDenied({ liveProcedureCount: 1, openLabCount: 0 }),
    ).toMatch(/Cannot close/i);
    expect(
      walkInCloseDenied({ liveProcedureCount: 0, openLabCount: 2 }),
    ).toMatch(/Cannot close/i);
    expect(walkInCloseDenied({ liveProcedureCount: 0, openLabCount: 0 })).toBeNull();
  });
});
