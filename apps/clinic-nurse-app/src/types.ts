export type NurseInstruction = {
  bodyPart: string | null;
  sites: string[];
  applyMode: string | null;
  fields: string[];
  note: string | null;
};

export type Proc = {
  id: string;
  procedureName: string;
  procedureCode: string;
  scheduledAt: string;
  endsAt?: string | null;
  effectiveEndsAt?: string;
  checkInOpen?: boolean;
  checkInDeadline?: string;
  status: string;
  schedulingMode?: string | null;
  resourceId?: string | null;
  patientRef: { id: string; fullName: string; refCode?: string };
  clinicalEpisode?: { roomNumber?: string | null } | null;
  resource?: { id: string; code: string; name: string } | null;
  instruction?: NurseInstruction | null;
  /** Local outbox failure. Not from the API. */
  cardError?: string | null;
};

export type BoardSnapshot = {
  date: string;
  orders: Proc[];
  mineUnlinked: boolean;
  dayEndHour: number;
  syncedAt: string | null;
};

export type OutboxRow = {
  id: string;
  procedureId: string;
  createdAt: string;
  ownerLogin: string;
};
