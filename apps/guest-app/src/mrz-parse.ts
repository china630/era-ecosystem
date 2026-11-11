const WEIGHTS = [7, 3, 1];

function mrzCharValue(ch: string): number {
  if (ch >= "0" && ch <= "9") return ch.charCodeAt(0) - 48;
  if (ch >= "A" && ch <= "Z") return ch.charCodeAt(0) - 55;
  if (ch === "<") return 0;
  return -1;
}

function mrzCheckDigit(input: string): number {
  let sum = 0;
  for (let i = 0; i < input.length; i += 1) {
    const value = mrzCharValue(input[i] ?? "<");
    sum += (value < 0 ? 0 : value) * WEIGHTS[i % 3]!;
  }
  return sum % 10;
}

function mrzCheckOk(input: string, digit: string): boolean {
  return digit >= "0" && digit <= "9" && mrzCheckDigit(input) === Number(digit);
}

function titleCase(raw: string): string {
  return raw
    .split("<")
    .filter(Boolean)
    .map((part) => part.charAt(0) + part.slice(1).toLowerCase())
    .join(" ");
}

function parseNameField(field: string): { lastName: string; firstName: string; middleName: string } {
  const trimmed = field.replace(/<+$/g, "");
  const [lastRaw, givenRaw = ""] = trimmed.split("<<");
  const given = givenRaw.split("<").filter(Boolean);
  return {
    lastName: titleCase(lastRaw ?? ""),
    firstName: titleCase(given[0] ?? ""),
    middleName: titleCase(given.slice(1).join("<")),
  };
}

function yyMmDdToIso(raw: string, kind: "birth" | "expiry"): string {
  if (!/^\d{6}$/.test(raw)) return "";
  const yy = Number(raw.slice(0, 2));
  const mm = raw.slice(2, 4);
  const dd = raw.slice(4, 6);
  const currentYY = new Date().getUTCFullYear() % 100;
  const year = kind === "birth" && yy > currentYY ? 1900 + yy : 2000 + yy;
  return `${String(year).padStart(4, "0")}-${mm}-${dd}`;
}

function sexOf(ch: string): "MALE" | "FEMALE" | "" {
  if (ch === "M") return "MALE";
  if (ch === "F") return "FEMALE";
  return "";
}

function cleanLines(text: string): string[] {
  return text
    .toUpperCase()
    .split(/\r?\n/)
    .map((line) => line.replace(/[^A-Z0-9<]/g, ""))
    .filter((line) => line.length >= 28);
}

export type GuestMrzDocument = {
  documentNumber: string;
  lastName: string;
  firstName: string;
  middleName: string;
  birthDate: string;
  nationality: string;
  sex: "MALE" | "FEMALE" | "";
  checksOk: boolean;
};

function parseTd3(line1: string, line2: string): GuestMrzDocument | null {
  if (line1.length < 44 || line2.length < 44) return null;
  const a = line1.slice(0, 44);
  const b = line2.slice(0, 44);
  const names = parseNameField(a.slice(5));
  const number = b.slice(0, 9).replace(/<+$/g, "");
  const checks = [
    mrzCheckOk(b.slice(0, 9), b[9] ?? ""),
    mrzCheckOk(b.slice(13, 19), b[19] ?? ""),
    mrzCheckOk(b.slice(21, 27), b[27] ?? ""),
    mrzCheckOk(b.slice(0, 10) + b.slice(13, 20) + b.slice(21, 43), b[43] ?? ""),
  ];
  return {
    documentNumber: number,
    ...names,
    birthDate: yyMmDdToIso(b.slice(13, 19), "birth"),
    nationality: b.slice(10, 13).replace(/</g, ""),
    sex: sexOf(b[20] ?? "<"),
    checksOk: checks.every(Boolean),
  };
}

/** Same red/green rule as hotel `parseMrz`: green only when ICAO checks pass. */
export function parseGuestMrz(text: string): GuestMrzDocument | null {
  const lines = cleanLines(text);
  const td3 = lines.filter((line) => line.length >= 44);
  if (td3.length >= 2) {
    return parseTd3(td3[0]!, td3[1]!);
  }
  if (lines.length >= 2 && lines[0]!.length >= 44) {
    return parseTd3(lines[0]!, lines[1]!);
  }
  return null;
}
