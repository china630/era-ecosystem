import { episodeCareTeamPrintName } from "@/domain/print/print-procedures.service";

describe("procedure print doctor column", () => {
  it("uses episode care team names and never falls back to a placeholder staff string", () => {
    expect(episodeCareTeamPrintName(["Kəngərli Rəna Kamil qızı"])).toBe(
      "Kəngərli Rəna Kamil qızı",
    );
    expect(episodeCareTeamPrintName(["  ", ""])).toBe("—");
    expect(episodeCareTeamPrintName([])).toBe("—");
  });
});
