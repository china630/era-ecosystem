/**
 * Hotel S2S base URL: peer first; public settings trap ignored in Docker.
 */

const resolvePeer = jest.fn();
const getSettings = jest.fn();
const isDocker = jest.fn();
const isPublic = jest.fn();
const resolveMode = jest.fn();
const resolvePolicy = jest.fn();

jest.mock("@/lib/request-organization", () => ({
  requestOrganizationId: () => "fnb-org",
}));

jest.mock("@/lib/fnb-integration-settings", () => ({
  getFnbIntegrationSettings: (...args: unknown[]) => getSettings(...args),
  normalizePublicOrigin: (url: string | null | undefined) => {
    const t = url?.trim() ?? "";
    return t ? t.replace(/\/$/, "") : null;
  },
}));

jest.mock("@era/satellite-kit", () => ({
  PEER_SATELLITE_HOTEL: "industry_hotel_pms",
  resolvePeerSatelliteBaseUrl: (...args: unknown[]) => resolvePeer(...args),
  resolveOperatingMode: (...args: unknown[]) => resolveMode(...args),
  resolveSettlementPolicy: (...args: unknown[]) => resolvePolicy(...args),
  isRunningInsideDocker: () => isDocker(),
  isPublicOrchestratorUrl: (url: string) => isPublic(url),
}));

import {
  resolveHotelOrganizationId,
  resolvePmsBaseUrl,
} from "@/lib/pms-bridge-client";

describe("resolveHotelOrganizationId", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    resolveMode.mockResolvedValue({ parentOrgId: "parent-hotel" });
    resolvePolicy.mockResolvedValue({ hubOrganizationId: "hub-hotel" });
  });

  it("prefers hub then parent over F&B self", async () => {
    await expect(resolveHotelOrganizationId()).resolves.toBe("hub-hotel");
    resolvePolicy.mockResolvedValue({ hubOrganizationId: null });
    await expect(resolveHotelOrganizationId()).resolves.toBe("parent-hotel");
  });

  it("honours explicit org", async () => {
    await expect(resolveHotelOrganizationId("explicit")).resolves.toBe("explicit");
    expect(resolveMode).not.toHaveBeenCalled();
  });
});

describe("resolvePmsBaseUrl", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.FB_POS_PMS_STUB = "";
    resolveMode.mockResolvedValue({ parentOrgId: null });
    resolvePolicy.mockResolvedValue({ hubOrganizationId: null });
    isDocker.mockReturnValue(true);
    isPublic.mockImplementation(
      (url: string) =>
        url.startsWith("https:") || url.includes("era-365.online"),
    );
  });

  it("uses peer even when settings has public hotel URL", async () => {
    getSettings.mockResolvedValue({
      hotelPmsUrl: "https://hotel-pms.era-365.online/",
    });
    resolvePeer.mockResolvedValue({ baseUrl: "http://hotel-pms:3201" });
    await expect(resolvePmsBaseUrl("hub-hotel")).resolves.toBe(
      "http://hotel-pms:3201",
    );
    expect(resolvePeer).toHaveBeenCalledWith({
      organizationId: "hub-hotel",
      satelliteKey: "industry_hotel_pms",
    });
  });

  it("tries F&B org peer when hotel hub peer fails", async () => {
    resolvePeer
      .mockRejectedValueOnce(new Error("no hub peer"))
      .mockResolvedValueOnce({ baseUrl: "http://hotel-pms:3201" });
    getSettings.mockResolvedValue({ hotelPmsUrl: "" });
    await expect(resolvePmsBaseUrl("hub-hotel")).resolves.toBe(
      "http://hotel-pms:3201",
    );
    expect(resolvePeer).toHaveBeenNthCalledWith(2, {
      organizationId: "fnb-org",
      satelliteKey: "industry_hotel_pms",
    });
  });

  it("rejects public settings fallback inside Docker when peer fails", async () => {
    resolvePeer.mockRejectedValue(new Error("no peer"));
    getSettings.mockResolvedValue({
      hotelPmsUrl: "https://hotel-pms.era-365.online/",
    });
    await expect(resolvePmsBaseUrl("hub-hotel")).resolves.toBeNull();
    expect(getSettings).toHaveBeenCalledWith("fnb-org");
  });

  it("allows non-public settings fallback when peer fails", async () => {
    resolvePeer.mockRejectedValue(new Error("no peer"));
    getSettings.mockResolvedValue({
      hotelPmsUrl: "http://127.0.0.1:3201",
    });
    isPublic.mockReturnValue(false);
    isDocker.mockReturnValue(false);
    await expect(resolvePmsBaseUrl("hub-hotel")).resolves.toBe(
      "http://127.0.0.1:3201",
    );
    expect(getSettings).toHaveBeenCalledWith("fnb-org");
  });
});
