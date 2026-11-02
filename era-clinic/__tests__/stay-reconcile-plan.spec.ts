import { planClinicStayReconcile } from "@/lib/stay-reconcile-plan";

const episode = {
  id: "ep-1",
  reservationId: "stay-1",
  globalPersonId: "person-1",
  hotelStayId: "stay-1::mdm:person-1",
  programCode: "PKG-STANDART",
  roomNumber: "1003",
};

describe("clinic stay reconcile plan", () => {
  it("opens a missing in-house guest and closes a checked-out course", () => {
    const plan = planClinicStayReconcile({
      inHouse: [
        {
          reservationId: "stay-2",
          paxKey: "pax-2",
          departed: false,
          globalPersonId: "person-2",
          programCode: "PKG-STANDART",
          roomNumber: "1001",
          guestName: "New Guest",
        },
      ],
      checkedOutIds: ["stay-1"],
      openEpisodes: [episode],
    });
    expect(plan.open.map((guest) => guest.guestName)).toEqual(["New Guest"]);
    expect(plan.closeEpisodeIds).toEqual(["ep-1"]);
  });

  it("closes only the departed guest and still syncs the one who stays", () => {
    const plan = planClinicStayReconcile({
      inHouse: [
        {
          reservationId: "stay-1",
          paxKey: "pax-left",
          departed: true,
          globalPersonId: "person-1",
          programCode: "PKG-STANDART",
          guestName: "Left",
        },
        {
          reservationId: "stay-1",
          paxKey: "pax-stay",
          departed: false,
          globalPersonId: "person-9",
          programCode: "PKG-DERMA",
          roomNumber: "1004",
          guestName: "Stays",
        },
      ],
      checkedOutIds: [],
      openEpisodes: [episode],
    });
    expect(plan.closeEpisodeIds).toEqual(["ep-1"]);
    expect(plan.open.map((guest) => guest.guestName)).toEqual(["Stays"]);
    expect(plan.sync.map((guest) => guest.guestName)).toEqual(["Stays"]);
  });
});