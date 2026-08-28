import { bakuDateKey, mergeAppointmentVisitEvents } from "@/domain/patient/patient-timeline.service";

describe("patient timeline bakuDateKey", () => {
  it("groups UTC evening into next Asia/Baku calendar day", () => {
    // 2026-07-13 22:30 UTC = 2026-07-14 02:30 in Asia/Baku (UTC+4)
    expect(bakuDateKey("2026-07-13T22:30:00.000Z")).toBe("2026-07-14");
  });

  it("keeps same Baku day for afternoon UTC", () => {
    expect(bakuDateKey("2026-07-14T10:00:00.000Z")).toBe("2026-07-14");
  });
});

describe("mergeAppointmentVisitEvents", () => {
  const practitioner = { fullName: "Dr Aliyev", code: "DR-01" };

  it("collapses linked appointment+visit into one visit row with slot date", () => {
    const scheduledAt = new Date("2026-08-28T06:00:00.000Z");
    const events = mergeAppointmentVisitEvents({
      appointments: [
        {
          id: "appt1",
          scheduledAt,
          roomCode: "C1",
          status: "CHECKED_IN",
          practitioner,
          visit: { id: "vis1" },
        },
      ],
      visits: [
        {
          id: "vis1",
          appointmentId: "appt1",
          createdAt: new Date("2026-08-20T10:00:00.000Z"),
          completedAt: null,
          status: "IN_PROGRESS",
          amountNet: { toString: () => "0" },
          practitioner,
          serviceLines: [],
          appointment: { scheduledAt, roomCode: "C1" },
        },
      ],
    });
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      id: "visit:vis1",
      type: "visit",
      at: scheduledAt.toISOString(),
      status: "IN_PROGRESS",
      href: "/visits/vis1",
    });
    expect(events[0].titleL10n?.ru).toMatch(/^Приём ·/);
  });

  it("keeps appointment-only rows when no visit exists", () => {
    const scheduledAt = new Date("2026-09-01T07:00:00.000Z");
    const events = mergeAppointmentVisitEvents({
      appointments: [
        {
          id: "appt2",
          scheduledAt,
          roomCode: null,
          status: "SCHEDULED",
          practitioner,
          visit: null,
        },
      ],
      visits: [],
    });
    expect(events).toHaveLength(1);
    expect(events[0].type).toBe("appointment");
    expect(events[0].href).toBe("/appointments");
  });

  it("uses visit completedAt when there is no appointment (cutover)", () => {
    const completedAt = new Date("2026-08-27T00:00:00.000Z");
    const events = mergeAppointmentVisitEvents({
      appointments: [],
      visits: [
        {
          id: "vis-cut",
          appointmentId: null,
          createdAt: new Date("2026-08-01T00:00:00.000Z"),
          completedAt,
          status: "COMPLETED",
          amountNet: { toString: () => "0" },
          practitioner,
          serviceLines: [{ serviceCode: "CONSULT" }],
          appointment: null,
        },
      ],
    });
    expect(events).toHaveLength(1);
    expect(events[0].at).toBe(completedAt.toISOString());
    expect(events[0].href).toBe("/visits/vis-cut");
  });
});
