export type CareTimetableRow = {
  id: string;
  scheduledAt: string;
  procedureName: string;
  room: string | null;
  status: string;
};
