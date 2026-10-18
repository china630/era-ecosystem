import {
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

  it("prints only seated sessions, not unpaid extras or unplaced proposals", () => {
    expect(PRINT_PROCEDURE_STATUSES).toEqual([
      "SCHEDULED",
      "CHECKED_IN",
      "COMPLETED",
      "NO_SHOW",
    ]);
  });
});
