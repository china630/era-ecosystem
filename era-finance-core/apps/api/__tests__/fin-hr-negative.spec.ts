import { ForbiddenException } from "@nestjs/common";
import { UserRole } from "@erafinance/database";
import { CP_PERMISSION } from "@era/contracts";
import { assertMayAccessPayrollFinance } from "../src/auth/policies/hr-payroll.policy";

describe("Finance HR negative paths (AC-FIN-HR)", () => {
  it("assertMayAccessPayrollFinance denies USER (unauthorized for payroll finance)", () => {
    expect(() => assertMayAccessPayrollFinance(UserRole.USER)).toThrow(
      ForbiddenException,
    );
    try {
      assertMayAccessPayrollFinance(UserRole.USER);
    } catch (err) {
      expect((err as ForbiddenException).message).toMatch(/payroll\.money/i);
    }
  });

  it("assertMayAccessPayrollFinance allows OWNER and ACCOUNTANT", () => {
    expect(() => assertMayAccessPayrollFinance(UserRole.OWNER)).not.toThrow();
    expect(() => assertMayAccessPayrollFinance(UserRole.ACCOUNTANT)).not.toThrow();
  });

  it("HR_MANAGER with hr_card only is denied payroll money", () => {
    expect(() =>
      assertMayAccessPayrollFinance({
        role: UserRole.HR_MANAGER,
        permissions: [CP_PERMISSION.API_PAYROLL_HR_CARD],
      }),
    ).toThrow(ForbiddenException);
  });
});
