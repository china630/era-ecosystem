import { formatCheckInBusyMessage } from "@/lib/check-in-busy-ui";

const t = ((key: string, values?: Record<string, string>) => {
  if (key === "resourceBusy") {
    return `busy:${values?.cabin}|${values?.guest}|${values?.time}`;
  }
  if (key === "resourceBusyNoTime") {
    return `busy-no-time:${values?.cabin}|${values?.guest}`;
  }
  if (key === "resourceBusyGeneric") return "busy-generic";
  return key;
}) as Parameters<typeof formatCheckInBusyMessage>[1];

describe("formatCheckInBusyMessage", () => {
  it("formats RESOURCE_BUSY details", () => {
    const msg = formatCheckInBusyMessage(
      {
        code: "RESOURCE_BUSY",
        details: {
          resourceName: "Kabina 6",
          blockingGuestName: "Nicolae",
          blockingActualEndsAt: "2026-11-27T07:31:57.000Z",
        },
      },
      t,
    );
    expect(msg).toMatch(/^busy:Kabina 6\|Nicolae\|/);
  });

  it("returns null for unrelated errors (do not overwrite toast)", () => {
    expect(
      formatCheckInBusyMessage({ error: "Guest QR required", code: "QR_REQUIRED" }, t),
    ).toBeNull();
  });

  it("returns generic for bare RESOURCE_BUSY", () => {
    expect(formatCheckInBusyMessage({ code: "RESOURCE_BUSY", details: {} }, t)).toBe(
      "busy-generic",
    );
  });
});
