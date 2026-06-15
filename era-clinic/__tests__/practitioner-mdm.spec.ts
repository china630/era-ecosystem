import { isValidAzFin } from "@era/satellite-kit/integration/person-identity.client";

describe("practitioner MDM helpers", () => {
  it("validates AZ FIN format", () => {
    expect(isValidAzFin("5ABC123")).toBe(true);
    expect(isValidAzFin("5ABC12I")).toBe(false);
  });
});
