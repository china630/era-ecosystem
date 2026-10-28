import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  formatBankLine,
  isDataUrl,
  isHttpLogoUrl,
  normalizeWebsiteUrl,
  planProfileFill,
  resolveLogoUrlForCp,
  type ExistingProfileState,
} from "./org-profile-backfill";

const emptyExisting = (): ExistingProfileState => ({
  hasProfile: false,
  directorName: null,
  logoUrl: null,
  bankLine: null,
  hasPhone: false,
  hasEmail: false,
  hasWebsite: false,
  hasLegalAddress: false,
});

describe("org-profile-backfill helpers", () => {
  it("accepts http(s) logos and rejects data URLs", () => {
    assert.equal(isHttpLogoUrl("https://cdn.example/logo.png"), true);
    assert.equal(isHttpLogoUrl("http://cdn.example/logo.png"), true);
    assert.equal(isHttpLogoUrl("data:image/png;base64,aaa"), false);
    assert.equal(isDataUrl("data:image/png;base64,aaa"), true);
  });

  it("absolutizes Finance /files logos when public base set", () => {
    const ok = resolveLogoUrlForCp("/files/org-logos/a.png", {
      financePublicBase: "http://127.0.0.1:3001",
    });
    assert.equal(ok.url, "http://127.0.0.1:3001/files/org-logos/a.png");
    const skip = resolveLogoUrlForCp("/files/org-logos/a.png", {});
    assert.equal(skip.skipRelative, true);
    assert.equal(skip.url, undefined);
  });

  it("formats bank line like Finance invoice print", () => {
    assert.equal(
      formatBankLine({
        bankName: "Kapital",
        accountNumber: null,
        currency: "AZN",
        iban: "AZ00XXXX",
        swift: "XXXXAZ22",
      }),
      "Kapital · AZN · IBAN AZ00XXXX · SWIFT XXXXAZ22",
    );
    assert.equal(formatBankLine(null), null);
  });

  it("normalizes bare website hosts to https", () => {
    assert.equal(normalizeWebsiteUrl("nafta.az"), "https://nafta.az");
    assert.equal(normalizeWebsiteUrl("https://nafta.az/x"), "https://nafta.az/x");
  });

  it("fills only empty slots and never overwrites", () => {
    const plan = planProfileFill(
      {
        ...emptyExisting(),
        hasProfile: true,
        directorName: "Already",
        hasPhone: true,
      },
      {
        directorName: "New",
        phone: "+994501112233",
        legalAddress: "Baku 1",
        logoUrl: "https://cdn.example/a.png",
      },
    );
    assert.equal(plan.profilePatch.directorName, undefined);
    assert.equal(plan.createPhone, undefined);
    assert.equal(plan.profilePatch.logoUrl, "https://cdn.example/a.png");
    assert.deepEqual(plan.createLegal, {
      line1: "Baku 1",
      lineAz: null,
      lineRu: null,
      lineEn: null,
    });
    assert.equal(plan.hasAnyWrite, true);
  });

  it("skips data-URL logos without writing logoUrl", () => {
    const plan = planProfileFill(
      emptyExisting(),
      { phone: "+994501112233", logoUrl: null },
      { skipDataUrl: true },
    );
    assert.equal(plan.skipDataUrlLogo, true);
    assert.equal(plan.profilePatch.logoUrl, undefined);
    assert.equal(plan.createPhone, "+994501112233");
    assert.equal(plan.hasAnyWrite, true);
  });

  it("does not treat relative-logo-only as skipped_existing shape", () => {
    const plan = planProfileFill(emptyExisting(), { logoUrl: null }, {
      skipRelative: true,
    });
    assert.equal(plan.skipRelativeLogo, true);
    assert.equal(plan.hasAnyWrite, false);
    assert.equal(plan.hasNonLogoSeed, false);
    assert.equal(plan.hasAnySeed, true);
  });

  it("uses clinic i18n address when legalAddress missing (AZ first)", () => {
    const plan = planProfileFill(emptyExisting(), {
      addressAz: "Bakı",
      addressEn: "Baku",
    });
    assert.equal(plan.createLegal?.line1, "Bakı");
    assert.equal(plan.createLegal?.lineAz, "Bakı");
    assert.equal(plan.createLegal?.lineEn, "Baku");
  });
});
