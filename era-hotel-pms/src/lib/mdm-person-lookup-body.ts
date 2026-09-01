import { composePersonFullName, normalizeNationalityIso } from '@era/satellite-kit';

export type MdmPersonLookupInput = {
  fin?: string;
  passport?: string;
  issuingCountry?: string;
  firstName?: string;
  middleName?: string;
  lastName?: string;
  fullName?: string;
  phone?: string;
  nationality?: string;
};

/** Build resolve body: parts preferred; nationality ISO only; no nationality → issuingCountry. */
export function buildMdmPersonLookupBody(input: MdmPersonLookupInput): Record<string, string> {
  const first = input.firstName?.trim();
  const middle = input.middleName?.trim();
  const last = input.lastName?.trim();
  const composed = composePersonFullName(first, middle, last);
  const fullName = composed || input.fullName?.trim() || '';
  const body: Record<string, string> = {};
  if (input.fin?.trim()) body.fin = input.fin.trim();
  if (input.passport?.trim()) body.passport = input.passport.trim();
  if (input.issuingCountry?.trim()) body.issuingCountry = input.issuingCountry.trim();
  if (first) body.firstName = first;
  if (middle) body.middleName = middle;
  if (last) body.lastName = last;
  if (fullName) body.fullName = fullName;
  if (input.phone?.trim()) body.phone = input.phone.trim();
  const isoNat = normalizeNationalityIso(input.nationality);
  if (isoNat) body.nationality = isoNat;
  return body;
}
