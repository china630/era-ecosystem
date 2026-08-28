import {
  classifyPersonDocuments,
  composePersonFullName,
  foldPersonName,
  mapNationalityToIso,
  mergeFullNameWithPatronymic,
  splitGivenAndPatronymic,
} from '@/lib/person-documents';

describe('classifyPersonDocuments', () => {
  it('keeps FIN and passport in separate slots', () => {
    expect(
      classifyPersonDocuments({ nationalId: '1ABC234', passportNo: 'AA1234567' }),
    ).toEqual({ fin: '1ABC234', passport: 'AA1234567' });
  });

  it('treats a FIN dumped in Passport No as FIN, not passport', () => {
    expect(classifyPersonDocuments({ nationalId: null, passportNo: 'abc1234' })).toEqual({
      fin: 'ABC1234',
    });
  });

  it('treats a non-FIN National Id as a misfiled passport', () => {
    expect(classifyPersonDocuments({ nationalId: 'AA1234567', passportNo: null })).toEqual({
      passport: 'AA1234567',
    });
  });
});

describe('person full name', () => {
  it('orders given + patronymic + surname', () => {
    expect(splitGivenAndPatronymic('Ali Vali')).toEqual({
      firstName: 'Ali',
      middleName: 'Vali',
    });
    expect(composePersonFullName('Ali', 'Vali', 'Mammadov')).toBe('Ali Vali Mammadov');
  });

  it('fills patronymic into a shorter MDM name and does not shrink', () => {
    expect(mergeFullNameWithPatronymic('Ali Mammadov', 'Ali Vali Mammadov')).toBe(
      'Ali Vali Mammadov',
    );
    expect(mergeFullNameWithPatronymic('Ali Vali Mammadov', 'Ali Mammadov')).toBe(
      'Ali Vali Mammadov',
    );
  });

  it('folds copy-paste AZ letters for matching', () => {
    expect(foldPersonName('Gülarə Həşimova')).toBe(foldPersonName('Gulare Hesimova'));
  });
});

describe('mapNationalityToIso', () => {
  it('maps EW labels to ISO', () => {
    expect(mapNationalityToIso('Azerbaijan')).toBe('AZ');
    expect(mapNationalityToIso('Russia')).toBe('RU');
    expect(mapNationalityToIso('Kazakhstan')).toBe('KZ');
  });
});
