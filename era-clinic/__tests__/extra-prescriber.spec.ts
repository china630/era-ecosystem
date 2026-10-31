import { resolveExtraPrescriber } from "@/lib/extra-prescriber";

describe("resolveExtraPrescriber", () => {
  const care = ["doc-first", "doc-second"];

  it("uses the actor when they are a doctor", () => {
    expect(
      resolveExtraPrescriber({
        actorPractitionerId: "doc-second",
        actorIsDoctor: true,
        careDoctorIdsInAssignedOrder: care,
      }),
    ).toBe("doc-second");
  });

  it("uses the earliest care doctor when reception writes the extra", () => {
    expect(
      resolveExtraPrescriber({
        actorPractitionerId: "nurse-1",
        actorIsDoctor: false,
        careDoctorIdsInAssignedOrder: care,
      }),
    ).toBe("doc-first");
  });

  it("returns null when nobody can be named", () => {
    expect(
      resolveExtraPrescriber({
        actorPractitionerId: null,
        actorIsDoctor: false,
        careDoctorIdsInAssignedOrder: [],
      }),
    ).toBeNull();
  });
});
