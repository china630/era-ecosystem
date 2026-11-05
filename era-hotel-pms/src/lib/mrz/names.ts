/** Display form: one capital letter per word, hyphen and apostrophe kept. */
export function titleCaseMrzName(raw: string): string {
  const cleaned = raw.replace(/</g, ' ').replace(/\s+/g, ' ').trim();
  if (!cleaned) return '';
  return cleaned
    .split(' ')
    .map((word) =>
      word
        .split(/([-'])/)
        .map((part) => {
          if (part === '-' || part === "'") return part;
          if (!part) return '';
          return part.charAt(0).toUpperCase() + part.slice(1).toLowerCase();
        })
        .join(''),
    )
    .join(' ');
}

/** Search key: upper case, hyphens and extra spaces removed. */
export function normalizeNameKey(raw: string): string {
  return raw
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/</g, ' ')
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '');
}

export function splitMrzGivenNames(given: string): { firstName: string; middleName: string } {
  const titled = titleCaseMrzName(given);
  const parts = titled.split(' ').filter(Boolean);
  return {
    firstName: parts[0] ?? '',
    middleName: parts.slice(1).join(' '),
  };
}
