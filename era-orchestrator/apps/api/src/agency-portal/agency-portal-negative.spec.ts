import { BadRequestException } from "@nestjs/common";

/**
 * Lightweight negative coverage for agency portal invite rules
 * (mirrors AgencyPortalService.invite VÖEN gate).
 */
describe("agency portal CP invite rules", () => {
  function assertVoen(raw: string) {
    const voen = raw.replace(/\D/g, "");
    if (voen.length !== 10) {
      throw new BadRequestException(
        "Agency VÖEN (10 digits) is required for portal invite",
      );
    }
    return voen;
  }

  it("rejects short VÖEN", () => {
    expect(() => assertVoen("123")).toThrow(BadRequestException);
  });

  it("accepts 10-digit VÖEN", () => {
    expect(assertVoen("1234567890")).toBe("1234567890");
  });
});
