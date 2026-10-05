export interface ReportLetterhead {
  name: string;
  address: string | null;
  phone: string | null;
  email: string | null;
  website: string | null;
  /** PNG/JPEG bytes; null when no logo is set or the file is gone. */
  logo: Buffer | null;
}

export function emptyLetterhead(name = ''): ReportLetterhead {
  return { name, address: null, phone: null, email: null, website: null, logo: null };
}

export function letterheadContactLines(lh: ReportLetterhead): string[] {
  const lines: string[] = [];
  if (lh.address) lines.push(lh.address);
  const contacts = [lh.phone, lh.email, lh.website].filter((v): v is string => Boolean(v));
  if (contacts.length) lines.push(contacts.join('  ·  '));
  return lines;
}
