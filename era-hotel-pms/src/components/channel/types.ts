export type ChannelPageTab = 'overview' | 'channels' | 'inventory' | 'journal';

export const CHANNEL_PAGE_TABS: ChannelPageTab[] = [
  'overview',
  'channels',
  'inventory',
  'journal',
];

export function parseChannelPageTab(raw: string | null | undefined): ChannelPageTab {
  if (raw === 'channels' || raw === 'inventory' || raw === 'journal' || raw === 'overview') {
    return raw;
  }
  return 'overview';
}

export type SyncError = {
  id: string;
  otaReference: string | null;
  errorMessage: string;
  status: 'OPEN' | 'RESOLVED';
  createdAt: string;
};

export type ChannelHealth = {
  adapter: string;
  mode: 'dryRun' | 'live';
  envReady: boolean;
  envFlags: Record<string, boolean>;
  channelAutoPushEnabled: boolean;
  lastPushAt: string | null;
  lastPullAt: string | null;
  lastError: {
    errorMessage: string;
    status: string;
    otaReference: string | null;
    createdAt: string;
  } | null;
};

export type StopSell = {
  id: string;
  date: string;
  note: string | null;
  roomType: { code: string } | null;
};

export type RoomTypeOption = {
  id: string;
  code: string;
};

export type RatePlanOption = {
  id: string;
  code: string;
};

export type ChannelMappingRow = {
  id: string;
  code: string;
  name: string;
  active: boolean;
  roomMappings: Array<{
    id: string;
    otaRoomCode: string;
    roomType: { id: string; code: string };
  }>;
  rateMappings: Array<{
    id: string;
    otaRateCode: string;
    ratePlan: { id: string; code: string };
  }>;
};

export type AvailabilityRow = {
  roomTypeCode: string;
  days: Array<{ date: string; available: number; stopSell: boolean }>;
};
