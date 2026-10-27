import { BadRequestException, NotFoundException } from "@nestjs/common";
import { SatellitePeerEndpointController } from "./satellite-peer-endpoint.controller";

jest.mock("../common/utils/internal-service-token.util", () => ({
  assertMatchingServiceToken: jest.fn(),
}));

describe("SatellitePeerEndpointController", () => {
  const registry = {
    listForOrg: jest.fn(),
    resolveEndpoint: jest.fn(),
  };

  const controller = new SatellitePeerEndpointController(registry as never);

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("returns registry peer URL", async () => {
    registry.listForOrg.mockResolvedValue([
      { satelliteKey: "industry_hotel_pms", enabled: true, baseUrl: "http://hotel-pms:3201" },
    ]);
    registry.resolveEndpoint.mockResolvedValue({
      baseUrl: "http://hotel-pms:3201",
      secret: "",
    });

    const out = await controller.peerEndpoint(
      "industry_hotel_pms",
      undefined,
      "Bearer t",
      undefined,
      "org-1",
    );
    expect(out).toEqual({
      organizationId: "org-1",
      satelliteKey: "industry_hotel_pms",
      baseUrl: "http://hotel-pms:3201",
      source: "registry",
    });
  });

  it("requires satelliteKey and org", async () => {
    await expect(
      controller.peerEndpoint("", undefined, "Bearer t", undefined, "org-1"),
    ).rejects.toBeInstanceOf(BadRequestException);
    await expect(
      controller.peerEndpoint("industry_hotel_pms", undefined, "Bearer t"),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it("404 when unresolved", async () => {
    registry.listForOrg.mockResolvedValue([]);
    registry.resolveEndpoint.mockResolvedValue(null);
    await expect(
      controller.peerEndpoint(
        "industry_hotel_pms",
        undefined,
        "Bearer t",
        undefined,
        "org-1",
      ),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});
