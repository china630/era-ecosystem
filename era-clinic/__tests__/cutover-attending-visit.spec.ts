import {
  attendingDoctorExternalRef,
  attendingVisitExternalRef,
  ensureCutoverAttendingVisit,
} from "@/lib/import/cutover-attending-visit";

jest.mock("@/lib/request-organization", () => ({
  requestOrganizationId: () => "org-test",
}));

describe("attendingDoctorExternalRef", () => {
  it("maps WO doctorId to #27 externalRef", () => {
    expect(attendingDoctorExternalRef("3")).toBe("wo:doctor:3");
    expect(attendingVisitExternalRef("wo:patient:2148")).toBe("wo:patient:2148:attending");
  });

  it("skips empty and zero (no attending doctor)", () => {
    expect(attendingDoctorExternalRef("")).toBeNull();
    expect(attendingDoctorExternalRef("0")).toBeNull();
    expect(attendingDoctorExternalRef("0.0")).toBeNull();
  });
});

describe("ensureCutoverAttendingVisit", () => {
  it("creates one IN_PROGRESS visit when practitioner exists and episode is OPEN", async () => {
    const create = jest.fn().mockResolvedValue({ id: "vis1" });
    const keyCreate = jest.fn();
    const careUpsert = jest.fn();
    const tx = {
      cutoverImportKey: {
        findFirst: jest.fn(async ({ where }: { where: { entity: string; externalRef: string } }) => {
          if (where.entity === "practitioners" && where.externalRef === "wo:doctor:3") {
            return { recordId: "prac-3" };
          }
          return null;
        }),
        create: keyCreate,
      },
      visit: { create, update: jest.fn() },
      episodeCareDoctor: { upsert: careUpsert },
    };
    const id = await ensureCutoverAttendingVisit(tx as never, {
      patientRefId: "pat1",
      patientExternalRef: "wo:patient:2148",
      doctorId: "3",
      checkIn: new Date("2026-08-27"),
      episodeStatus: "OPEN",
      closedAt: null,
      roomNumber: "711",
      reservationId: "11112877",
      patientOrigin: "IN_HOUSE",
      clinicalEpisodeId: "ep1",
    });
    expect(id).toBe("vis1");
    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          practitionerId: "prac-3",
          status: "IN_PROGRESS",
          completedAt: null,
          createdAt: new Date("2026-08-27"),
        }),
      }),
    );
    expect(careUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          episodeId_practitionerId: {
            episodeId: "ep1",
            practitionerId: "prac-3",
          },
        },
      }),
    );
  });

  it("updates existing visit instead of creating a second (idempotent)", async () => {
    const update = jest.fn();
    const create = jest.fn();
    const careUpsert = jest.fn();
    const tx = {
      cutoverImportKey: {
        findFirst: jest.fn(async ({ where }: { where: { entity: string } }) => {
          if (where.entity === "practitioners") return { recordId: "prac-3" };
          if (where.entity === "attending-visits") return { recordId: "vis-existing" };
          return null;
        }),
        create: jest.fn(),
      },
      visit: { create, update },
      episodeCareDoctor: { upsert: careUpsert },
    };
    const id = await ensureCutoverAttendingVisit(tx as never, {
      patientRefId: "pat1",
      patientExternalRef: "wo:patient:2148",
      doctorId: "3",
      checkIn: new Date("2020-01-01"),
      episodeStatus: "IMPORTED_CLOSED",
      closedAt: new Date("2020-01-15"),
      roomNumber: "102",
      reservationId: "11110002",
      patientOrigin: "IN_HOUSE",
      clinicalEpisodeId: "ep-closed",
    });
    expect(id).toBe("vis-existing");
    expect(create).not.toHaveBeenCalled();
    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "vis-existing" },
        data: expect.objectContaining({
          status: "COMPLETED",
          practitionerId: "prac-3",
          completedAt: new Date("2020-01-15"),
        }),
      }),
    );
    expect(careUpsert).toHaveBeenCalled();
  });

  it("skips when #27 practitioner is not imported", async () => {
    const tx = {
      cutoverImportKey: { findFirst: jest.fn().mockResolvedValue(null) },
      visit: { create: jest.fn(), update: jest.fn() },
      episodeCareDoctor: { upsert: jest.fn() },
    };
    const id = await ensureCutoverAttendingVisit(tx as never, {
      patientRefId: "pat1",
      patientExternalRef: "wo:patient:1",
      doctorId: "3",
      checkIn: new Date("2026-08-27"),
      episodeStatus: "OPEN",
      closedAt: null,
      roomNumber: null,
      reservationId: null,
      patientOrigin: "WALK_IN",
    });
    expect(id).toBeNull();
    expect(tx.visit.create).not.toHaveBeenCalled();
    expect(tx.episodeCareDoctor.upsert).not.toHaveBeenCalled();
  });
});
