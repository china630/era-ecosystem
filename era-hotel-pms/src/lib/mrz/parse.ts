import { splitMrzGivenNames, titleCaseMrzName } from '@/lib/mrz/names';

export type MrzDocument = {
  format: 'TD3' | 'TD1';
  issuingCountry: string;
  nationality: string;
  documentNumber: string;
  /** Raw ICAO name field with << separators, e.g. ERIKSSON<<ANNA<MARIA */
  nameFieldRaw: string;
  lastName: string;
  firstName: string;
  middleName: string;
  birthDate: string;
  expiryDate: string;
  sex: 'MALE' | 'FEMALE' | '';
  checksOk: boolean;
};

const WEIGHTS = [7, 3, 1];

export function mrzCharValue(ch: string): number {
  if (ch >= '0' && ch <= '9') return ch.charCodeAt(0) - 48;
  if (ch >= 'A' && ch <= 'Z') return ch.charCodeAt(0) - 55;
  if (ch === '<') return 0;
  return -1;
}

export function mrzCheckDigit(input: string): number {
  let sum = 0;
  for (let i = 0; i < input.length; i += 1) {
    const value = mrzCharValue(input[i] ?? '<');
    sum += (value < 0 ? 0 : value) * WEIGHTS[i % 3]!;
  }
  return sum % 10;
}

export function mrzCheckOk(input: string, digit: string): boolean {
  return digit >= '0' && digit <= '9' && mrzCheckDigit(input) === Number(digit);
}

function yyMmDdToIso(raw: string, kind: 'birth' | 'expiry'): string {
  if (!/^\d{6}$/.test(raw)) return '';
  const yy = Number(raw.slice(0, 2));
  const mm = raw.slice(2, 4);
  const dd = raw.slice(4, 6);
  const now = new Date().getUTCFullYear();
  const currentYY = now % 100;
  const century =
    kind === 'expiry' ? (yy >= currentYY ? 2000 : 2000) : yy > currentYY ? 1900 : 2000;
  const year = kind === 'birth' && yy > currentYY ? 1900 + yy : 2000 + yy;
  const y = kind === 'birth' ? year : century + yy;
  return `${String(y).padStart(4, '0')}-${mm}-${dd}`;
}

function sexOf(ch: string): 'MALE' | 'FEMALE' | '' {
  if (ch === 'M') return 'MALE';
  if (ch === 'F') return 'FEMALE';
  return '';
}

function cleanLines(text: string): string[] {
  return text
    .toUpperCase()
    .split(/\r?\n/)
    .map((line) => line.replace(/[^A-Z0-9<]/g, ''))
    .filter((line) => line.length >= 28);
}

function parseNameField(field: string): {
  nameFieldRaw: string;
  lastName: string;
  firstName: string;
  middleName: string;
} {
  const trimmed = field.replace(/<+$/g, '');
  const [lastRaw, givenRaw = ''] = trimmed.split('<<');
  const given = splitMrzGivenNames(givenRaw);
  return {
    nameFieldRaw: trimmed,
    lastName: titleCaseMrzName(lastRaw ?? ''),
    firstName: given.firstName,
    middleName: given.middleName,
  };
}

function parseTd3(line1: string, line2: string): MrzDocument | null {
  if (line1.length < 44 || line2.length < 44) return null;
  const a = line1.slice(0, 44);
  const b = line2.slice(0, 44);
  const names = parseNameField(a.slice(5));
  const number = b.slice(0, 9).replace(/<+$/g, '');
  const checks = [
    mrzCheckOk(b.slice(0, 9), b[9] ?? ''),
    mrzCheckOk(b.slice(13, 19), b[19] ?? ''),
    mrzCheckOk(b.slice(21, 27), b[27] ?? ''),
    mrzCheckOk(b.slice(0, 10) + b.slice(13, 20) + b.slice(21, 43), b[43] ?? ''),
  ];
  return {
    format: 'TD3',
    issuingCountry: a.slice(2, 5).replace(/</g, ''),
    nationality: b.slice(10, 13).replace(/</g, ''),
    documentNumber: number,
    ...names,
    birthDate: yyMmDdToIso(b.slice(13, 19), 'birth'),
    expiryDate: yyMmDdToIso(b.slice(21, 27), 'expiry'),
    sex: sexOf(b[20] ?? '<'),
    checksOk: checks.every(Boolean),
  };
}

function parseTd1(lines: [string, string, string]): MrzDocument | null {
  const [a, b, c] = lines.map((line) => line.slice(0, 30)) as [string, string, string];
  if (a.length < 30 || b.length < 30 || c.length < 30) return null;
  const names = parseNameField(c);
  const number = a.slice(5, 14).replace(/<+$/g, '');
  const checks = [
    mrzCheckOk(a.slice(5, 14), a[14] ?? ''),
    mrzCheckOk(b.slice(0, 6), b[6] ?? ''),
    mrzCheckOk(b.slice(8, 14), b[14] ?? ''),
    mrzCheckOk(a.slice(5, 30) + b.slice(0, 7) + b.slice(8, 15) + b.slice(18, 29), b[29] ?? ''),
  ];
  return {
    format: 'TD1',
    issuingCountry: a.slice(2, 5).replace(/</g, ''),
    nationality: b.slice(15, 18).replace(/</g, ''),
    documentNumber: number,
    ...names,
    birthDate: yyMmDdToIso(b.slice(0, 6), 'birth'),
    expiryDate: yyMmDdToIso(b.slice(8, 14), 'expiry'),
    sex: sexOf(b[7] ?? '<'),
    checksOk: checks.every(Boolean),
  };
}

export function parseMrz(text: string): MrzDocument | null {
  const lines = cleanLines(text);
  const td3 = lines.filter((line) => line.length >= 44);
  if (td3.length >= 2) {
    const doc = parseTd3(td3[0]!, td3[1]!);
    if (doc) return doc;
  }
  const td1 = lines.filter((line) => line.length >= 30 && line.length < 44);
  if (td1.length >= 3) {
    const doc = parseTd1([td1[0]!, td1[1]!, td1[2]!]);
    if (doc) return doc;
  }
  if (lines.length >= 2 && lines[0]!.length >= 44) {
    return parseTd3(lines[0]!, lines[1]!);
  }
  return null;
}
