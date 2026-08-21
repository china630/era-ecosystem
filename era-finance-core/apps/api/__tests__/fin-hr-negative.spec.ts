import { ForbiddenException } from "@nestjs/common";
import { UserRole } from "@erafinance/database";
import { assertMayAccessPayrollFinance } from "../src/auth/policies/hr-payroll.policy";

describe("Finance HR negative paths (AC-FIN-HR)", () => {
  it("assertMayAccessPayrollFinance denies USER (unauthorized for payroll finance)", () => {
    expect(() => assertMayAccessPayrollFinance(UserRole.USER)).toThrow(
      ForbiddenException,
    );
    try {
      assertMayAccessPayrollFinance(UserRole.USER);
    } catch (err) {
      expect((err as ForbiddenException).message).toMatch(/OWNER and ACCOUNTANT/i);
    }
  });

  it("assertMayAccessPayrollFinance allows OWNER and ACCOUNTANT", () => {
    expect(() => assertMayAccessPayrollFinance(UserRole.OWNER)).not.toThrow();
    expect(() => assertMayAccessPayrollFinance(UserRole.ACCOUNTANT)).not.toThrow();
  });
});
