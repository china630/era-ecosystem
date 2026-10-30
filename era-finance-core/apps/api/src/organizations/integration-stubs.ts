/** Org settings.tax flags. Both default off: no fake taxpayer and no fake signature. */

export type IntegrationStubs = {
  taxLookupMock: boolean;
  signatureGatewayMock: boolean;
};

export function readIntegrationStubs(settings: unknown): IntegrationStubs {
  const root =
    settings && typeof settings === "object" && !Array.isArray(settings)
      ? (settings as Record<string, unknown>)
      : {};
  const tax =
    root.tax && typeof root.tax === "object" && !Array.isArray(root.tax)
      ? (root.tax as Record<string, unknown>)
      : {};
  return {
    taxLookupMock: tax.taxLookupMock === true,
    signatureGatewayMock: tax.signatureGatewayMock === true,
  };
}
