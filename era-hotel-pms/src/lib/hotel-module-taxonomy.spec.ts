import {
  HOTEL_MODULE_KEY_ALIASES,
  resolveHotelModuleForPathname,
  resolveHotelModuleKey,
} from '../../../packages/satellite-kit/src/integration/hotel-module-keys';

describe('hotel module taxonomy (hotel-pms)', () => {
  it('maps core routes to hotel_core', () => {
    expect(resolveHotelModuleForPathname('/operations')).toBe('hotel_core');
    expect(resolveHotelModuleForPathname('/in-house')).toBe('hotel_core');
  });

  it('maps distribution routes to hotel_distribution', () => {
    expect(resolveHotelModuleForPathname('/channel')).toBe('hotel_distribution');
    expect(resolveHotelModuleForPathname('/admin/promotion-codes')).toBe('hotel_distribution');
  });

  it('legacy aliases resolve to consolidated keys', () => {
    expect(resolveHotelModuleKey('hotel_channel_ota')).toBe('hotel_distribution');
    expect(HOTEL_MODULE_KEY_ALIASES.hotel_front_office).toBe('hotel_core');
  });
});
