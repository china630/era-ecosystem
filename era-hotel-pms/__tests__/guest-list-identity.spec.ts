import {
  extractGuestIdentityDocs,
  formatGuestGenderLabel,
  mapGuestToListItem,
} from '@/lib/guest-list-identity';

describe('guest-list-identity', () => {
  it('extracts FIN and passport from documents', () => {
    expect(
      extractGuestIdentityDocs([
        { docType: 'ID_CARD', docNumber: 'ABC1234', isPrimary: false },
        { docType: 'PASSPORT', docNumber: 'AA1234567', isPrimary: true },
      ]),
    ).toEqual({
      nationalIdFin: 'ABC1234',
      passportNumber: 'AA1234567',
    });
  });

  it('maps guest row for list API', () => {
    const row = mapGuestToListItem({
      id: 'g1',
      fullName: 'Ali Mammadov',
      firstName: 'Ali',
      lastName: 'Mammadov',
      title: 'Mr',
      sex: 'M',
      nationality: 'AZ',
      birthDate: new Date('2001-01-25T00:00:00.000Z'),
      birthPlace: 'Baku',
      phone: '+994501234567',
      email: 'a@example.com',
      externalRef: '12345',
      globalPersonId: 'mdm-1',
      vehiclePlate: null,
      registrationNumber: null,
      visaNumber: null,
      documents: [{ docType: 'PASSPORT', docNumber: 'AA1234567', isPrimary: true }],
    });
    expect(row.birthDate).toBe('2001-01-25');
    expect(row.passportNumber).toBe('AA1234567');
    expect(row.nationalIdFin).toBeNull();
  });

  it('formats gender labels', () => {
    const labels = { male: 'Male', female: 'Female', other: 'Other' };
    expect(formatGuestGenderLabel('M', labels)).toBe('Male');
    expect(formatGuestGenderLabel('1', labels)).toBe('Female');
    expect(formatGuestGenderLabel('', labels)).toBe('—');
  });
});
