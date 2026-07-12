/** HS / customs catalog types (era-data-hub). */
export type HsTariffPoint = {
  hsCode: string;
  description?: string | null;
  dutyRatePercent: number;
  vatRatePercent: number;
  excisePercent: number;
  effectiveFrom?: string;
  effectiveTo?: string | null;
};

export type HsMetaPoint = {
  hsCode: string;
  description?: string | null;
};

/** VÖEN company directory (hub shelf C — masked for external). */
export type HubCompany = {
  voen: string;
  name: string;
  legalAddress?: string | null;
  vatStatus?: boolean;
  legalForm?: string | null;
};

export type HubBank = {
  code: string;
  voen: string;
  nameAz: string;
  swift?: string | null;
  correspondentIban?: string | null;
};

export type HubBankBranch = {
  code: string;
  bankCode: string;
  nameAz?: string | null;
  address?: string | null;
};

export type HubIbanValidation = {
  valid: boolean;
  iban?: string;
  bankCode?: string;
  message?: string;
};

export type HubUom = {
  code: string;
  nameAz: string;
  nameRu?: string;
  nameEn?: string;
};

/** ISO 4217 currency catalog (hub SoR; distinct from FX rates). */
export type HubCurrency = {
  code: string;
  symbol: string;
  decimals: number;
  nameAz: string;
  nameRu?: string;
  nameEn?: string;
  isActive?: boolean;
  sortOrder?: number;
};

export type HubTaxRate = {
  code: string;
  percent: number;
  kind?: string;
};

export type HubGeoCountry = {
  code: string;
  nameAz: string;
  nameRu?: string;
  nameEn?: string;
};

export type HubGeoCity = {
  code: string;
  countryCode: string;
  nameAz: string;
  nameRu?: string;
  nameEn?: string;
};

export type HubChartOfAccountsProfile = {
  profile: string;
  accounts: unknown;
};
