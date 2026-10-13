import {
  ageYearsOn,
  gapsForStay,
  guestIdentityGaps,
  isMinorGuest,
  operationalGaps,
} from '@/lib/guest-stay-requirements';

const TODAY = '2026-10-07';

function guest(partial: Record<string, unknown> = {}) {
  return {
    id: 'g1',
    fullName: 'Ali Mammadov',
    firstName: 'Ali',
    lastName: 'Mammadov',
    nationality: 'AZ',
    sex: 'M',
    birthDate: new Date('1990-04-01T00:00:00.000Z'),
    phone: '+994501112233',
    documents: [] as Array<{ docType: string; docNumber: string }>,
    contacts: [] as Array<{ kind: string; value: string }>,
    ...partial,
  };
}

describe('guest stay requirements', () => {
  it('requires only a first and last name to save a guest', () => {
    expect(
      guestIdentityGaps({
        firstName: 'Ali',
        lastName: 'Mammadov',
        sex: '',
        birthDate: '',
        nationality: '',
      }),
    ).toEqual([]);
    expect(
      guestIdentityGaps({ firstName: ' ', lastName: '', sex: '', birthDate: '', nationality: '' }),
    ).toEqual(['firstName', 'lastName']);
  });

  it('treats a guest under 18 as a minor from the birth date', () => {
    expect(ageYearsOn('2010-10-08', TODAY)).toBe(15);
    expect(ageYearsOn('2008-10-07', TODAY)).toBe(18);
    expect(isMinorGuest({ birthDate: '2010-01-01' }, TODAY)).toBe(true);
    expect(isMinorGuest({ birthDate: '2000-01-01', age: 10 }, TODAY)).toBe(false);
    expect(isMinorGuest({ age: 12 }, TODAY)).toBe(true);
    expect(isMinorGuest({}, TODAY)).toBe(false);
  });

  it('requires a phone only for an AZ adult, and a document for everyone', () => {
    expect(
      operationalGaps(
        { name: 'Ali', sex: 'M', nationality: 'AZ', birthDate: '1990-01-01', phone: '', documents: [] },
        TODAY,
      ),
    ).toEqual(['phone', 'document']);
    expect(
      operationalGaps(
        { name: 'Ali', sex: 'M', nationality: 'AZ', birthDate: '', phone: '', documents: [] },
        TODAY,
      ),
    ).toEqual(['birthDate', 'phone', 'document']);
    expect(
      operationalGaps(
        {
          name: 'Child',
          sex: 'F',
          nationality: 'AZ',
          birthDate: '2016-01-01',
          documents: [{ docType: 'FIN', docNumber: 'ABC1234' }],
        },
        TODAY,
      ),
    ).toEqual([]);
    expect(
      operationalGaps(
        {
          name: 'Ivan',
          sex: 'M',
          nationality: 'RU',
          birthDate: '1980-01-01',
          idCardNo: 'FIN1',
          passportNo: 'P1',
        },
        TODAY,
      ),
    ).toEqual([]);
    expect(
      operationalGaps(
        { name: 'Ivan', sex: 'M', nationality: 'RU', birthDate: '2015-01-01', idCardNo: 'FIN1' },
        TODAY,
      ),
    ).toEqual(['document']);
  });

  it('uses the party passport and skips an empty or departed companion', () => {
    const gaps = gapsForStay(
      {
        guest: guest({ phone: null, documents: [] }),
        paxGuests: [
          {
            id: 'p1',
            guestId: 'g1',
            firstName: 'Ali',
            lastName: 'Mammadov',
            nationality: 'AZ',
            birthDate: new Date('1990-04-01T00:00:00.000Z'),
            age: null,
            sex: 'M',
            idCardNo: null,
            passportNo: 'AA1234567',
            departedAt: null,
            guest: null,
          },
          {
            id: 'p2',
            guestId: null,
            firstName: '',
            lastName: '',
            nationality: null,
            birthDate: null,
            age: null,
            idCardNo: null,
            passportNo: null,
            departedAt: null,
            guest: null,
          },
          {
            id: 'p3',
            guestId: 'g2',
            firstName: 'Sara',
            lastName: 'Mammadova',
            nationality: 'AZ',
            birthDate: new Date('2018-05-01T00:00:00.000Z'),
            age: 8,
            idCardNo: null,
            passportNo: null,
            departedAt: new Date('2026-10-01T00:00:00.000Z'),
            guest: guest({
              id: 'g2',
              fullName: 'Sara Mammadova',
              firstName: 'Sara',
              lastName: 'Mammadova',
              phone: null,
              birthDate: new Date('2018-05-01T00:00:00.000Z'),
            }),
          },
        ],
      },
      TODAY,
    );
    expect(gaps).toEqual([{ name: 'Ali Mammadov', gaps: ['phone'] }]);
  });

  it('asks for gender and citizenship only when they are missing at check-in', () => {
    expect(
      operationalGaps(
        { name: 'Ali', sex: '', nationality: '', birthDate: '1990-01-01' },
        TODAY,
      ),
    ).toEqual(['sex', 'nationality']);
  });
});
