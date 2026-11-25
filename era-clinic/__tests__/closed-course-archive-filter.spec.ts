import {
  PACKAGE_ASSIGN_ADJUST_REASON,
  archiveEpisodeSummaryLabStatusWhere,
  archiveLabWhere,
  archiveProcedureWhere,
  archiveVisitWhere,
  includesArchiveLab,
  includesArchiveProcedure,
  includesArchiveVisit,
} from "@/domain/patient/closed-course-archive-filter";

describe("closed-course-archive-filter", () => {
  describe("includesArchiveProcedure", () => {
    it("always keeps executed rows", () => {
      expect(includesArchiveProcedure({ status: "COMPLETED" }, false)).toBe(true);
      expect(includesArchiveProcedure({ status: "CHECKED_IN" }, true)).toBe(true);
    });

    it("OFF hides cancelled and no-show", () => {
      expect(includesArchiveProcedure({ status: "CANCELLED", cancelReason: "hotel_checkout" }, false)).toBe(
        false,
      );
      expect(includesArchiveProcedure({ status: "NO_SHOW" }, false)).toBe(false);
    });

    it("ON keeps hotel_checkout cancelled and no-show", () => {
      expect(includesArchiveProcedure({ status: "CANCELLED", cancelReason: "hotel_checkout" }, true)).toBe(
        true,
      );
      expect(includesArchiveProcedure({ status: "NO_SHOW" }, true)).toBe(true);
      expect(includesArchiveProcedure({ status: "CANCELLED", cancelReason: null }, true)).toBe(true);
    });

    it("ON excludes package_assign_adjust", () => {
      expect(
        includesArchiveProcedure(
          { status: "CANCELLED", cancelReason: PACKAGE_ASSIGN_ADJUST_REASON },
          true,
        ),
      ).toBe(false);
    });
  });

  describe("includesArchiveLab / visit", () => {
    it("OFF keeps live labs only", () => {
      expect(includesArchiveLab("COMPLETED", false)).toBe(true);
      expect(includesArchiveLab("CANCELLED", false)).toBe(false);
    });

    it("ON adds cancelled labs", () => {
      expect(includesArchiveLab("CANCELLED", true)).toBe(true);
      expect(includesArchiveLab("ORDERED", true)).toBe(false);
    });

    it("visit mirrors completed / cancelled", () => {
      expect(includesArchiveVisit("COMPLETED", false)).toBe(true);
      expect(includesArchiveVisit("CANCELLED", false)).toBe(false);
      expect(includesArchiveVisit("CANCELLED", true)).toBe(true);
    });
  });

  describe("Prisma where shapes", () => {
    it("procedure OFF is executed-only", () => {
      expect(archiveProcedureWhere(false)).toEqual({
        status: { in: ["CHECKED_IN", "COMPLETED"] },
      });
    });

    it("procedure ON ORs no-show with non-adjust cancelled", () => {
      const where = archiveProcedureWhere(true);
      expect(where).toEqual({
        OR: [
          { status: { in: ["CHECKED_IN", "COMPLETED", "NO_SHOW"] } },
          {
            status: "CANCELLED",
            NOT: { cancelReason: PACKAGE_ASSIGN_ADJUST_REASON },
          },
        ],
      });
    });

    it("lab / visit / summary lab expand on ON", () => {
      expect(archiveLabWhere(true).status).toEqual({
        in: [
          "COLLECTED",
          "IN_PROGRESS",
          "RESULT_READY",
          "PUBLISHED",
          "COMPLETED",
          "CANCELLED",
        ],
      });
      expect(archiveVisitWhere(true)).toEqual({
        status: { in: ["COMPLETED", "CANCELLED"] },
      });
      expect(archiveEpisodeSummaryLabStatusWhere(true).status).toEqual({
        in: ["RESULT_READY", "PUBLISHED", "COMPLETED", "CANCELLED"],
      });
    });
  });
});
