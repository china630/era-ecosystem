import {
  HOTEL_MODULE_KEY_ALIASES,
  resolveHotelModuleForPathname,
  resolveHotelModuleKey,
} from '../../packages/satellite-kit/src/integration/hotel-module-keys';

describe('hotel module taxonomy (hotel-pms)', () => {
  it('maps FO / Cash / NA routes to hotel_core', () => {
    expect(resolveHotelModuleForPathname('/fo/rack')).toBe('hotel_core');
    expect(resolveHotelModuleForPathname('/fo/in-house')).toBe('hotel_core');
    expect(resolveHotelModuleForPathname('/front-cash/pending')).toBe('hotel_core');
    expect(resolveHotelModuleForPathname('/night-audit')).toBe('hotel_core');
    expect(resolveHotelModuleForPathname('/night-audit/logs')).toBe('hotel_core');
  });

  it('maps housekeeping to hotel_housekeeping under /hk', () => {
    expect(resolveHotelModuleForPathname('/hk')).toBe('hotel_housekeeping');
    expect(resolveHotelModuleForPathname('/hk/mobile')).toBe('hotel_housekeeping');
  });

  it('maps migration routes to hotel_migration_pro', () => {
    expect(resolveHotelModuleForPathname('/migration')).toBe('hotel_migration_pro');
    expect(resolveHotelModuleKey('migration_pro')).toBe('hotel_migration_pro');
  });

  it('maps distribution routes to hotel_distribution', () => {
    expect(resolveHotelModuleForPathname('/distribution/channel')).toBe('hotel_distribution');
    expect(resolveHotelModuleForPathname('/distribution/promotion-codes')).toBe(
      'hotel_distribution',
    );
  });

  it('maps agency portal routes to hotel_agency_portal', () => {
    expect(resolveHotelModuleForPathname('/agency')).toBe('hotel_agency_portal');
    expect(resolveHotelModuleForPathname('/api/agency/reservations')).toBe(
      'hotel_agency_portal',
    );
  });

  it('maps FO agency inbox to hotel_core', () => {
    expect(resolveHotelModuleForPathname('/fo/agency-inbox')).toBe('hotel_core');
  });

  it('maps settings to hotel_setup_advanced', () => {
    expect(resolveHotelModuleForPathname('/settings/master-data')).toBe('hotel_setup_advanced');
  });

  it('legacy aliases resolve to consolidated keys', () => {
    expect(resolveHotelModuleKey('hotel_channel_ota')).toBe('hotel_distribution');
    expect(HOTEL_MODULE_KEY_ALIASES.hotel_front_office).toBe('hotel_core');
  });
});
