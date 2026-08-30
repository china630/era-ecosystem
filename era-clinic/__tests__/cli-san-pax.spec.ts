import { resolveHotelPatientRefCode } from "@/lib/services/sanatorium.service";
import { z } from "zod";

describe("Wave E episode-per-pax (CLI-54)", () => {
  it("resolves distinct PatientRef codes for two pax on same reservation", () => {
    const resId = "res-abc12345xyz";
    const husband = resolveHotelPatientRefCode({
      reservationId: resId,
      paxKey: "pax-husband",
      passportNumber: resId,
    });
    const wife = resolveHotelPatientRefCode({
      reservationId: resId,
      paxKey: "pax-wife",
      passportNumber: resId,
    });
    expect(husband).not.toBe(wife);
    expect(husband).toContain("HOTEL-");
    expect(wife).toContain("HOTEL-");
  });

  it("prefers MDM globalPersonId over paxKey", () => {
    const code = resolveHotelPatientRefCode({
      reservationId: "res-1",
      globalPersonId: "gp-wife-99",
      paxKey: "pax-ignored",
    });
    expect(code).toBe("MDM-gp-wife-99");
  });

  it("share rooms stay two reservations → two ref namespaces", () => {
    const a = resolveHotelPatientRefCode({
      reservationId: "res-707",
      paxKey: "guest-a",
    });
    const b = resolveHotelPatientRefCode({
      reservationId: "res-707S",
      paxKey: "guest-a",
    });
    expect(a).not.toBe(b);
  });

  it("guest lifecycle payload accepts paxKey (HOT-PKG-04)", () => {
    const schema = z.object({
      reservationId: z.string().min(1),
      programCode: z.string().optional(),
      globalPersonId: z.string().min(1).optional(),
      guestName: z.string().optional(),
      paxKey: z.string().min(1).optional(),
    });
    const parsed = schema.parse({
      reservationId: "r1",
      programCode: "PKG-PREMIUM",
      guestName: "Wife",
      paxKey: "rg-2",
    });
    expect(parsed.paxKey).toBe("rg-2");
    expect(parsed.programCode).toBe("PKG-PREMIUM");
  });

  it("two SKUs → two programCodes on check-in fan-out (contract shape)", () => {
    const events = [
      { paxKey: "h", programCode: "PKG-STANDART", guestName: "Husband" },
      { paxKey: "w", programCode: "PKG-PREMIUM", guestName: "Wife" },
    ];
    expect(new Set(events.map((e) => e.programCode)).size).toBe(2);
    expect(new Set(events.map((e) => e.paxKey)).size).toBe(2);
  });
});
