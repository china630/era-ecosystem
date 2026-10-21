import {
  appendCheckoutMarker,
  episodeCareTeamPrintName,
  PRINT_PROCEDURE_STATUSES,
} from "@/domain/print/print-procedures.service";
import { composePrintPatientStrip } from "@/domain/print/print-patient-strip";

describe("procedure print doctor column", () => {
  it("uses episode care team names and never falls back to a placeholder staff string", () => {
    expect(episodeCareTeamPrintName(["Kəngərli Rəna Kamil qızı"])).toBe(
      "Kəngərli Rəna Kamil qızı",
    );
    expect(episodeCareTeamPrintName(["  ", ""])).toBe("—");
    expect(episodeCareTeamPrintName([])).toBe("—");
  });

  it("composePrintPatientStrip puts stay on the episode side", () => {
    const strip = composePrintPatientStrip({
      fullName: "Matanat",
      sex: "FEMALE",
      birthDate: "1982-10-13",
      phone: "+994",
      nationality: "AZ",
      date: "2026-10-18",
      stay: {
        roomNumber: "911",
        doctorName: "Mustafayeva",
        arrival: "2026-10-17",
        departure: "2026-10-24",
        stayDays: 7,
      },
    });
    expect(strip.arrival).toBe("2026-10-17");
    expect(strip.stayDays).toBe(7);
    expect(strip.doctorName).toBe("Mustafayeva");
    expect(strip.date).toBe("2026-10-18");
  });

  it("adds the checkout day and a 12:00 marker even when that day has no procedures", () => {
    const groups = appendCheckoutMarker(
      [
        {
          date: "27/10/2026",
          rows: [
            {
              no: 1,
              date: "27/10/2026",
              name: "Darsonval",
              zones: "",
              settings: "",
              quantity: 1,
              time: "09:00-09:15",
              room: "Cabin 19",
              price: "0.00 AZN",
              note: "",
            },
          ],
        },
      ],
      "2026-10-31",
      "Çıxış",
    );
    expect(groups.map((group) => group.date)).toEqual(["27/10/2026", "31/10/2026"]);
    const last = groups[1]?.rows[0];
    expect(last?.checkout).toBe(true);
    expect(last?.time).toBe("12:00");
    expect(last?.name).toBe("Çıxış");
    expect(last?.room).toBe("");
    expect(last?.price).toBe("");
  });

  it("prints only seated sessions, not unpaid extras or unplaced proposals", () => {
    expect(PRINT_PROCEDURE_STATUSES).toEqual([
      "SCHEDULED",
      "CHECKED_IN",
      "COMPLETED",
      "NO_SHOW",
    ]);
  });
});
