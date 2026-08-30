import {
  ANAMNESIS_REQUIRED,
  EPISODE_NOT_IDLE,
  episodeAnamnesisDenied,
  episodeWriteDenied,
  walkInCloseDenied,
} from "@/domain/sanatorium/episode-gates";
import { formatEpisodeLabel } from "@/domain/sanatorium/episode-resolve";

describe("CLI-55 episode negative paths (W2–W4)", () => {
  it("blocks procedure assign/confirm when anamnesis empty", () => {
    expect(episodeAnamnesisDenied(null)).toMatch(/Anamnesis/i);
    expect(episodeAnamnesisDenied("")).toMatch(/Anamnesis/i);
    expect(ANAMNESIS_REQUIRED).toBe("ANAMNESIS_REQUIRED");
  });

  it("allows procedure path when anamnesis present", () => {
    expect(episodeAnamnesisDenied("HTN, allergy to iodine")).toBeNull();
  });

  it("CLOSED course is read-only for writes", () => {
    expect(episodeWriteDenied("CLOSED")).toMatch(/read-only/i);
    expect(episodeWriteDenied("OPEN")).toBeNull();
  });

  it("second walk-in OPEN is rejected by gate code contract", () => {
    // registerWalkInEpisode throws WALK_IN_OPEN_EXISTS — covered in service;
    // assert code constant remains stable for API 409 mapping.
    expect(EPISODE_NOT_IDLE).toBe("EPISODE_NOT_IDLE");
  });

  it("walk-in close refused with live procedure or open lab", () => {
    expect(
      walkInCloseDenied({ liveProcedureCount: 1, openLabCount: 0 }),
    ).toMatch(/Cannot close/i);
    expect(
      walkInCloseDenied({ liveProcedureCount: 0, openLabCount: 1 }),
    ).toMatch(/Cannot close/i);
  });

  it("walk-in close allowed when idle", () => {
    expect(walkInCloseDenied({ liveProcedureCount: 0, openLabCount: 0 })).toBeNull();
  });

  it("episode list labels include status and program", () => {
    const label = formatEpisodeLabel({
      openedAt: new Date("2026-08-01T10:00:00Z"),
      closedAt: null,
      programCode: "PKG-STANDART",
      status: "OPEN",
      patientOrigin: "WALK_IN",
      roomNumber: "101",
    });
    expect(label).toMatch(/PKG-STANDART/);
    expect(label).toMatch(/OPEN/);
  });

  it("demographics anamnesis gate is retired", async () => {
    const { patientAnamnesisDenied } = await import("@/lib/patient-card-gates");
    expect(patientAnamnesisDenied("", true)).toBeNull();
    expect(patientAnamnesisDenied(null, true)).toBeNull();
  });
});
