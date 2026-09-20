import {
  allocatePublicOrgNumber,
  isValidPublicOrgNumber,
  parsePublicOrgNumberParam,
  PUBLIC_ORG_NUMBER_MAX,
  PUBLIC_ORG_NUMBER_MIN,
} from "./public-org-number";

describe("public-org-number", () => {
  it("accepts only 6-digit range without leading zero", () => {
    expect(isValidPublicOrgNumber(100000)).toBe(true);
    expect(isValidPublicOrgNumber(999999)).toBe(true);
    expect(isValidPublicOrgNumber(99999)).toBe(false);
    expect(isValidPublicOrgNumber(1000000)).toBe(false);
    expect(isValidPublicOrgNumber(12345.6)).toBe(false);
  });

  it("parses path params strictly", () => {
    expect(parsePublicOrgNumberParam("104221")).toBe(104221);
    expect(parsePublicOrgNumberParam("012345")).toBeNull();
    expect(parsePublicOrgNumberParam("abc")).toBeNull();
    expect(
      parsePublicOrgNumberParam("aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"),
    ).toBeNull();
  });

  it("allocates within range and retries on clash", async () => {
    const taken = new Set<number>();
    const prisma = {
      organization: {
        findUnique: async ({
          where,
        }: {
          where: { publicOrgNumber: number };
        }) => (taken.has(where.publicOrgNumber) ? { id: "x" } : null),
      },
    };
    const n = await allocatePublicOrgNumber(prisma);
    expect(n).toBeGreaterThanOrEqual(PUBLIC_ORG_NUMBER_MIN);
    expect(n).toBeLessThanOrEqual(PUBLIC_ORG_NUMBER_MAX);
    taken.add(n);
    const n2 = await allocatePublicOrgNumber(prisma);
    expect(n2).not.toBe(n);
  });
});
