import { episodeAnamnesisDenied } from "@/domain/sanatorium/episode-gates";
import { episodeCareTeamDenied } from "@/domain/sanatorium/episode-care-team-gates";

describe("day-1 therapist stage → open package (gates)", () => {
  it("requires anamnesis and at least one complaint conceptually", () => {
    expect(episodeAnamnesisDenied(null)).not.toBeNull();
    expect(episodeAnamnesisDenied("ok")).toBeNull();
  });

  it("requires care team before opening program", () => {
    expect(episodeCareTeamDenied(0)).not.toBeNull();
    expect(episodeCareTeamDenied(2)).toBeNull();
  });
});
