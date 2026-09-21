export type PlaceRow = { id: string; code: string; name: string; status: string };

export type DeviceRow = {
  id: string;
  name: string;
  code: string | null;
  status: string;
  placeId: string;
  lastSeenAt: string | null;
  hmacSecretHash: string | null;
  place?: { id: string; code: string; name: string };
};

export type IdentityRow = {
  id: string;
  personRef: string;
  employmentId: string;
  employment?: {
    id: string;
    globalPersonId: string;
    orgUnit?: { name: string } | null;
    position?: { name: string } | null;
  };
};

export type PunchRow = {
  id: string;
  personRef: string;
  direction: string;
  status: string;
  occurredAt: string;
  placeMismatch: boolean;
  place?: { code: string; name: string };
  device?: { name: string };
};

export type EmpOpt = { id: string; globalPersonId: string };

export type PersonProfile = { displayName: string | null };

export function staffCodeFromEmployment(id: string): string {
  return id.replace(/-/g, "").slice(0, 8).toUpperCase();
}
