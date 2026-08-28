import {
  CUTOVER_EPISODE_IMPORTED_CLOSED,
  CUTOVER_EPISODE_OPEN,
  cutoverEpisodeFromCheckout,
} from "@/lib/import/cutover-episode-status";

const asOf = new Date("2026-08-28T12:00:00+04:00");

describe("cutoverEpisodeFromCheckout", () => {
  it("keeps OPEN when checkOut is empty", () => {
    expect(cutoverEpisodeFromCheckout(null, asOf)).toEqual({
      status: CUTOVER_EPISODE_OPEN,
      closedAt: null,
    });
  });

  it("keeps OPEN when checkOut is today (Baku)", () => {
    const checkOut = new Date("2026-08-28T00:00:00.000Z");
    expect(cutoverEpisodeFromCheckout(checkOut, asOf)).toEqual({
      status: CUTOVER_EPISODE_OPEN,
      closedAt: null,
    });
  });

  it("keeps OPEN when checkOut is in the future", () => {
    const checkOut = new Date("2026-09-04T00:00:00.000Z");
    expect(cutoverEpisodeFromCheckout(checkOut, asOf).status).toBe(CUTOVER_EPISODE_OPEN);
  });

  it("sets IMPORTED_CLOSED when checkOut is before today (not live CLOSED)", () => {
    const checkOut = new Date("2026-08-20T00:00:00.000Z");
    expect(cutoverEpisodeFromCheckout(checkOut, asOf)).toEqual({
      status: CUTOVER_EPISODE_IMPORTED_CLOSED,
      closedAt: checkOut,
    });
  });
});
