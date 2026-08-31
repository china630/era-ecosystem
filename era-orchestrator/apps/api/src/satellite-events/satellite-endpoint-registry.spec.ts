import { ConfigService } from "@nestjs/config";
import {
  SATELLITE_KEY_CLINIC,
  SatelliteEndpointRegistryService,
} from "./satellite-endpoint-registry.service";

describe("SatelliteEndpointRegistryService", () => {
  const prisma = {
    satelliteEndpoint: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      upsert: jest.fn(),
      deleteMany: jest.fn(),
    },
  };

  function svc(env: Record<string, string | undefined> = {}) {
    const config = {
      get: (key: string) => env[key],
    } as ConfigService;
    return new SatelliteEndpointRegistryService(
      prisma as never,
      config,
    );
  }

  beforeEach(() => {
    jest.resetAllMocks();
    process.env.PII_ENCRYPTION_KEY = "test-key-for-registry-spec-32chars!!";
  });

  it("returns DB endpoint when row exists", async () => {
    prisma.satelliteEndpoint.findUnique.mockResolvedValue({
      enabled: true,
      baseUrl: "https://clinic.example.com/",
      secretCipher: null,
    });
    const r = await svc().resolveEndpoint("org-1", SATELLITE_KEY_CLINIC);
    expect(r?.baseUrl).toBe("https://clinic.example.com");
  });

  it("falls back to env for industry_clinic when no row", async () => {
    prisma.satelliteEndpoint.findUnique.mockResolvedValue(null);
    const r = await svc({
      CLINIC_API_URL: "http://127.0.0.1:3203",
      SATELLITE_BRIDGE_SECRET: "bridge-secret",
    }).resolveEndpoint("org-1", SATELLITE_KEY_CLINIC);
    expect(r).toEqual({
      baseUrl: "http://127.0.0.1:3203",
      secret: "bridge-secret",
    });
  });

  it("falls back to env for hotel and fnb staff fan-out", async () => {
    prisma.satelliteEndpoint.findUnique.mockResolvedValue(null);
    const s = svc({
      HOTEL_PMS_API_URL: "http://hotel-pms:3201",
      FNB_POS_API_URL: "http://fnb-pos:3202",
      SATELLITE_BRIDGE_SECRET: "bridge-secret",
    });
    await expect(s.resolveEndpoint("org-1", "industry_hotel_pms")).resolves.toEqual({
      baseUrl: "http://hotel-pms:3201",
      secret: "bridge-secret",
    });
    await expect(s.resolveEndpoint("org-1", "industry_fnb_pos")).resolves.toEqual({
      baseUrl: "http://fnb-pos:3202",
      secret: "bridge-secret",
    });
  });

  it("uses env bridge secret when registry row has no cipher", async () => {
    prisma.satelliteEndpoint.findUnique.mockResolvedValue({
      enabled: true,
      baseUrl: "http://clinic:3203/",
      secretCipher: null,
    });
    const r = await svc({
      SATELLITE_BRIDGE_SECRET: "from-env",
    }).resolveEndpoint("org-1", SATELLITE_KEY_CLINIC);
    expect(r).toEqual({
      baseUrl: "http://clinic:3203",
      secret: "from-env",
    });
  });

  it("returns null when no row and no env", async () => {
    prisma.satelliteEndpoint.findUnique.mockResolvedValue(null);
    const r = await svc({}).resolveEndpoint("org-1", SATELLITE_KEY_CLINIC);
    expect(r).toBeNull();
  });

  it("resolveLaunchBaseUrl prefers registry over env", async () => {
    prisma.satelliteEndpoint.findUnique.mockResolvedValue({
      enabled: true,
      baseUrl: "https://clinic.customer.example/",
      secretCipher: null,
    });
    const r = await svc({
      NEXT_PUBLIC_SATELLITE_CLINIC_URL: "http://127.0.0.1:3203",
    }).resolveLaunchBaseUrl("org-1", SATELLITE_KEY_CLINIC);
    expect(r).toEqual({
      baseUrl: "https://clinic.customer.example",
      source: "registry",
      satelliteKey: SATELLITE_KEY_CLINIC,
    });
  });

  it("resolveLaunchBaseUrl falls back to NEXT_PUBLIC_* when no row", async () => {
    prisma.satelliteEndpoint.findUnique.mockResolvedValue(null);
    const r = await svc({
      NEXT_PUBLIC_SATELLITE_HOTEL_URL: "http://127.0.0.1:3201/",
    }).resolveLaunchBaseUrl("org-1", "industry_hotel_pms");
    expect(r).toEqual({
      baseUrl: "http://127.0.0.1:3201",
      source: "env",
      satelliteKey: "industry_hotel_pms",
    });
  });

  it("resolveLaunchBaseUrl returns null for unknown satelliteKey", async () => {
    const r = await svc().resolveLaunchBaseUrl("org-1", "not_a_satellite");
    expect(r).toBeNull();
    expect(prisma.satelliteEndpoint.findUnique).not.toHaveBeenCalled();
  });
});
