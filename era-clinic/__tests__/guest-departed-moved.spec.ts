jest.mock("@/lib/prisma", () => ({
  prisma: {
    clinicalEpisode: {
      findMany: jest.fn(),
      updateMany: jest.fn(),
    },
    procedureOrder: {
      updateMany: jest.fn(),
      deleteMany: jest.fn(),
    },
    visit: {
      updateMany: jest.fn(),
    },
  },
}));

jest.mock("@/lib/request-organization", () => ({
  enterRequestTenant: jest.fn(),
}));

import { prisma } from "@/lib/prisma";
import {
  handleGuestDeparted,
  handleGuestMoved,
} from "@/lib/lifecycle-consumer";
import {
  SATELLITE_HOTEL_GUEST_DEPARTED,
  SATELLITE_HOTEL_GUEST_MOVED,
} from "@era/contracts";

const mockedEpisodes = prisma.clinicalEpisode as unknown as {
  findMany: jest.Mock;
  updateMany: jest.Mock;
};
const mockedOrders = prisma.procedureOrder as unknown as {
  updateMany: jest.Mock;
  deleteMany: jest.Mock;
};
const mockedVisits = prisma.visit as unknown as {
  updateMany: jest.Mock;
};

describe("hotel person-level lifecycle (Depart / Move)", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("handleGuestDeparted closes only matched OPEN episode", async () => {
    mockedEpisodes.findMany.mockResolvedValue([{ id: "ep-spouse" }]);
    mockedEpisodes.updateMany.mockResolvedValue({ count: 1 });
    mockedOrders.updateMany.mockResolvedValue({ count: 0 });
    mockedOrders.deleteMany.mockResolvedValue({ count: 0 });

    await handleGuestDeparted({
      type: SATELLITE_HOTEL_GUEST_DEPARTED,
      organizationId: "org-1",
      correlationId: "c1",
      occurredAt: new Date().toISOString(),
      payload: {
        reservationId: "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee",
        paxKey: "pax-spouse",
        globalPersonId: "mdm-spouse",
      },
    });

    expect(mockedEpisodes.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          reservationId: "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee",
          status: "OPEN",
        }),
      }),
    );
    expect(mockedEpisodes.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: { in: ["ep-spouse"] } },
        data: expect.objectContaining({ status: "CLOSED" }),
      }),
    );
    expect(mockedOrders.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ cancelReason: "hotel_guest_departed" }),
      }),
    );
  });

  it("handleGuestDeparted no-ops when no episode matches", async () => {
    mockedEpisodes.findMany.mockResolvedValue([]);
    await handleGuestDeparted({
      type: SATELLITE_HOTEL_GUEST_DEPARTED,
      organizationId: "org-1",
      correlationId: "c2",
      occurredAt: new Date().toISOString(),
      payload: {
        reservationId: "res-1",
        paxKey: "missing",
      },
    });
    expect(mockedEpisodes.updateMany).not.toHaveBeenCalled();
  });

  it("handleGuestMoved retargets episode stay/room for pax", async () => {
    mockedEpisodes.updateMany.mockResolvedValue({ count: 1 });
    mockedVisits.updateMany.mockResolvedValue({ count: 0 });

    await handleGuestMoved({
      type: SATELLITE_HOTEL_GUEST_MOVED,
      organizationId: "org-1",
      correlationId: "c3",
      occurredAt: new Date().toISOString(),
      globalPersonId: "mdm-1",
      payload: {
        reservationId: "to-res",
        fromReservationId: "from-res",
        toReservationId: "to-res",
        paxKey: "pax-1",
        newRoomNumber: "102",
        globalPersonId: "mdm-1",
      },
    });

    expect(mockedEpisodes.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          reservationId: "from-res",
          status: "OPEN",
        }),
        data: expect.objectContaining({
          reservationId: "to-res",
          hotelStayId: "to-res",
          roomNumber: "102",
        }),
      }),
    );
  });
});
