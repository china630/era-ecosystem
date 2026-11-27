import {
  isMedicalGuestPackageCode,
  medicalPackageChoices,
} from '@/lib/services/medical-package-resolve.service';

describe('hotel sellable package catalog helpers', () => {
  it('builds FO choices only from catalog codes', () => {
    expect(
      medicalPackageChoices(
        [{ code: 'PKG-STANDART', label: 'Standart' }],
        ['PKG-STANDART', 'PKG-CUSTOM'],
      ),
    ).toEqual([
      { value: 'PKG-STANDART', label: 'Standart' },
      { value: 'PKG-CUSTOM', label: 'PKG-CUSTOM' },
    ]);
  });

  it('returns empty when catalog is empty (no hardcode fallback)', () => {
    expect(medicalPackageChoices([{ code: 'PKG-STANDART', label: 'Standart' }], [])).toEqual(
      [],
    );
  });

  it('treats catalog PKG codes as medical guest stamps (not Infotur)', () => {
    expect(isMedicalGuestPackageCode('PKG-CUSTOM')).toBe(true);
    expect(isMedicalGuestPackageCode('PKG-STANDART')).toBe(true);
    expect(isMedicalGuestPackageCode('PKG-INFOTUR')).toBe(false);
    expect(isMedicalGuestPackageCode('BAR')).toBe(false);
  });
});
