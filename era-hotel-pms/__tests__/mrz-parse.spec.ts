import { parseMrz, mrzCheckDigit } from '@/lib/mrz/parse';
import { normalizeNameKey, titleCaseMrzName } from '@/lib/mrz/names';
import { isSimilarPersonName, latinMetaphone, namesClearlyDiffer, sameMetaphoneName } from '@/lib/guest-name-match';
import { mapNationalityToIso } from '@/lib/person-documents';
import { cyrillicToLatinKey, namesMatchWithTranslit, normalizeMrzNameField } from '@/lib/mrz/transliterate';

const TD3 = [
  'P<UTOERIKSSON<<ANNA<MARIA<<<<<<<<<<<<<<<<<<<',
  'L898902C36UTO7408122F1204159ZE184226B<<<<<10',
].join('\n');

describe('mrz parse', () => {
  it('reads the ICAO TD3 sample and title-cases the name', () => {
    const doc = parseMrz(TD3);
    expect(doc?.checksOk).toBe(true);
    expect(doc?.lastName).toBe('Eriksson');
    expect(doc?.firstName).toBe('Anna');
    expect(doc?.middleName).toBe('Maria');
    expect(doc?.nameFieldRaw).toBe('ERIKSSON<<ANNA<MARIA');
    expect(doc?.documentNumber).toBe('L898902C3');
    expect(normalizeMrzNameField(doc!.nameFieldRaw)).toBe('ERIKSSON<<ANNA<MARIA');
    expect(doc?.nationality).toBe('UTO');
    expect(doc?.birthDate).toBe('1974-08-12');
    expect(doc?.sex).toBe('FEMALE');
    expect(doc?.expiryDate).toBe('2012-04-15');
  });

  it('rejects a broken check digit', () => {
    const broken = TD3.replace('L898902C36', 'L898902C37');
    expect(parseMrz(broken)?.checksOk).toBe(false);
  });

  it('check digit of the sample document number is 6', () => {
    expect(mrzCheckDigit('L898902C3')).toBe(6);
  });
});

describe('name keys', () => {
  it('folds hyphen and case', () => {
    expect(titleCaseMrzName('JEAN-PIERRE')).toBe('Jean-Pierre');
    expect(titleCaseMrzName("O'BRIEN")).toBe("O'Brien");
    expect(normalizeNameKey('Jean-Paul')).toBe(normalizeNameKey('JEAN PAUL'));
    expect(normalizeNameKey('Jean-Paul')).toBe('JEANPAUL');
  });

  it('does not treat Jean-Paul and Jean-Pierre as the same or as a one-letter slip', () => {
    expect(normalizeNameKey('Jean-Paul')).not.toBe(normalizeNameKey('Jean-Pierre'));
    expect(isSimilarPersonName('Jean-Paul', 'Martin', 'Jean-Pierre', 'Martin')).toBe(false);
  });

  it('catches an adjacent typo and a phonetic Jean/Zhan', () => {
    expect(isSimilarPersonName('Pierre', 'Martin', 'Peirre', 'Martin')).toBe(true);
    expect(latinMetaphone('Jean')).toBe(latinMetaphone('Zhan'));
    expect(sameMetaphoneName('Jean', 'Martin', 'Zhan', 'Martin')).toBe(true);
    expect(sameMetaphoneName('Paul', 'Martin', 'Pierre', 'Martin')).toBe(false);
  });

  it('flags a shared passport number when the names clearly differ', () => {
    expect(namesClearlyDiffer('Ali', 'Mammadov', 'Leyla', 'Mammadova')).toBe(true);
    expect(namesClearlyDiffer('Jean-Paul', 'Martin', 'Jean Paul', 'Martin')).toBe(false);
  });

  it('maps common MRZ alpha-3 nationality codes to guest ISO alpha-2', () => {
    expect(mapNationalityToIso('AZE')).toBe('AZ');
    expect(mapNationalityToIso('DEU')).toBe('DE');
    expect(mapNationalityToIso('GBR')).toBe('GB');
  });

  it('matches Jean / Жан via transliteration without gluing Paul and Pierre', () => {
    expect(cyrillicToLatinKey('Жан')).toBe('ZHAN');
    expect(namesMatchWithTranslit('Jean', 'Martin', 'Жан', 'Мартин')).toBe(true);
    expect(namesMatchWithTranslit('Jean-Paul', 'Martin', 'Jean-Pierre', 'Martin')).toBe(false);
  });
});
