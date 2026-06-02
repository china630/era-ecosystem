export type TabId = 'guests' | 'pricing' | 'folio' | 'notes';
export type FolioSubTab = 'all' | 'agency' | 'guest' | 'first' | 'second';
export type BottomTab = 'details' | 'notes' | 'folio';

export type PaxRow = {
  id?: string;
  title: string;
  gender: string;
  firstName: string;
  lastName: string;
  nationality: string;
  birthDate: string;
  age: string;
  idCardNo: string;
  passportNo: string;
  memberNo: string;
  payStatus: string;
  externalResId: string;
  guestState: string;
  isPrimary: boolean;
};

export type DailyRateRow = {
  stayDate: string;
  amount: number;
  currencyCode?: string;
  fixPrice?: boolean;
  discountPct?: number | null;
  manualFlag?: boolean;
};

export type AttachmentRow = {
  id: string;
  fileName: string;
  mimeType?: string | null;
  fileSize?: number | null;
  createdAt?: string;
};

export type SelectOption = { id: string; label: string };

export type RoomOption = { id: string; roomNumber: string; status: string };
