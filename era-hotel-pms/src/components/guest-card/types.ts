export type GuestTabId = 'identity' | 'crm' | 'reservations' | 'details' | 'loyalty' | 'timeshare';

export type GuestStats = {
  totalVisit: number;
  totalNights: number;
  totalRevenue: number;
  avgRate: number;
  bonus: number;
  surveysAverage: number;
  comments: number;
  preferences: number;
};
