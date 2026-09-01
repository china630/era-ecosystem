/** Orchestrator MDM natural-person identifier types. */
export type PersonIdentifierType =
  | "FIN"
  | "PASSPORT"
  | "RESIDENCE_PERMIT"
  | "NATIONAL_ID"
  | "SURROGATE";

export type PersonSegment = "CITIZEN" | "FOREIGNER" | "UNKNOWN";

export type MdmResolveInput = {
  fin?: string;
  passport?: string;
  issuingCountry?: string;
  residencePermit?: string;
  nationalId?: string;
  /** Legacy blob. Prefer firstName + lastName (+ middleName). */
  fullName?: string;
  firstName?: string;
  middleName?: string;
  lastName?: string;
  phone?: string;
  /** ISO 3166-1 alpha-2 citizenship. */
  nationality?: string;
  sex?: string;
  birthDate?: string | null;
  globalPersonId?: string;
};

export type MdmResolveResult = {
  globalPersonId: string | null;
  created?: boolean;
};

export type MdmLookupFinResult = {
  globalPersonId: string | null;
  masked?: boolean;
  fullName?: string | null;
  firstName?: string | null;
  middleName?: string | null;
  lastName?: string | null;
};

export type MdmMergeInput = {
  sourcePersonId: string;
  targetPersonId: string;
  actorOrgId?: string;
};

export type MdmLinkPersonResult = {
  globalPersonId: string | null;
  created?: boolean;
  masked?: boolean;
};
