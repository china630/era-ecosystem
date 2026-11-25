import { BadRequestException } from "@nestjs/common";
import { InstitutionType, ProductKind } from "@era/bank-core-database";
import {
  assertInstitutionAllowsProductKind,
  BOKT_FORBIDDEN_DEPOSIT_KINDS,
  BOKT_REG_TEMPLATE_CODES,
  filterRegTemplateCodesForInstitution,
} from "../src/common/institution-type.util";

describe("institution product activation gate (P0-2)", () => {
  it("allows BANK to activate retail deposit kinds", () => {
    for (const kind of BOKT_FORBIDDEN_DEPOSIT_KINDS) {
      expect(() =>
        assertInstitutionAllowsProductKind(InstitutionType.BANK, kind),
      ).not.toThrow();
    }
  });

  it("blocks BOKT from activating retail deposit kinds", () => {
    for (const kind of BOKT_FORBIDDEN_DEPOSIT_KINDS) {
      expect(() =>
        assertInstitutionAllowsProductKind(InstitutionType.BOKT, kind),
      ).toThrow(BadRequestException);
    }
  });

  it("allows BOKT to activate non-deposit loan kinds", () => {
    expect(() =>
      assertInstitutionAllowsProductKind(
        InstitutionType.BOKT,
        ProductKind.LOAN_MFI,
      ),
    ).not.toThrow();
  });

  it("includes TERM_DEPOSIT in BOKT forbidden list", () => {
    expect(BOKT_FORBIDDEN_DEPOSIT_KINDS).toContain(ProductKind.TERM_DEPOSIT);
  });

  it("LEASING_COMPANY only allows lease/current kinds", () => {
    expect(() =>
      assertInstitutionAllowsProductKind(
        InstitutionType.LEASING_COMPANY,
        ProductKind.LOAN_LEASE,
      ),
    ).not.toThrow();
    expect(() =>
      assertInstitutionAllowsProductKind(
        InstitutionType.LEASING_COMPANY,
        ProductKind.TERM_DEPOSIT,
      ),
    ).toThrow(BadRequestException);
    expect(() =>
      assertInstitutionAllowsProductKind(
        InstitutionType.LEASING_COMPANY,
        ProductKind.LOAN_ANNUITY,
      ),
    ).toThrow(BadRequestException);
  });

  it("CREDIT_UNION blocks cards and trade/islamic FO kinds", () => {
    expect(() =>
      assertInstitutionAllowsProductKind(
        InstitutionType.CREDIT_UNION,
        ProductKind.CARD,
      ),
    ).toThrow(BadRequestException);
    expect(() =>
      assertInstitutionAllowsProductKind(
        InstitutionType.CREDIT_UNION,
        ProductKind.TERM_DEPOSIT,
      ),
    ).not.toThrow();
  });

  it("filters BOKT reg template pack", () => {
    const codes = [
      "CBAR_TRIAL_BALANCE",
      "CBAR_CAR_STUB",
      "CBAR_CREDIT_PORTFOLIO_BY_CATEGORY",
    ];
    expect(filterRegTemplateCodesForInstitution(InstitutionType.BOKT, codes)).toEqual(
      codes.filter((c) =>
        (BOKT_REG_TEMPLATE_CODES as readonly string[]).includes(c),
      ),
    );
    expect(
      filterRegTemplateCodesForInstitution(InstitutionType.BANK, codes),
    ).toEqual(codes);
  });
});