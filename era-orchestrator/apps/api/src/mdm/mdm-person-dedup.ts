import {
  isSimilarPersonName,
  namesClearlyDiffer,
  normalizeNameKey,
  personPhoneDedupDigits,
  sameMetaphoneName,
} from "@era/satellite-kit";

export type MdmDedupMatchType =
  | "PHONE"
  | "PASSPORT"
  | "FIN"
  | "EMAIL"
  | "DOC_CITIZENSHIP"
  | "NAME_BIRTH"
  | "LAST_BIRTH"
  | "LAST_PHONE"
  | "SIMILAR_NAME"
  | "METAPHONE";

export type MdmDedupPerson = {
  id: string;
  firstName: string;
  lastName: string;
  fullName: string;
  birthDate: string;
  sex: string;
  nationality: string;
  phone: string;
  email: string;
  fin: string;
  passport: string;
  docNumbers: Array<{ number: string; country: string }>;
};

export type MdmDedupGroup = {
  matchType: MdmDedupMatchType;
  key: string;
  nameClash: boolean;
  personIds: string[];
};

function docNorm(raw: string): string {
  return raw.replace(/[\s-]/g, "").toUpperCase();
}

function pairKey(a: string, b: string): string {
  return a < b ? `${a}:${b}` : `${b}:${a}`;
}

export function buildMdmDedupGroups(
  people: MdmDedupPerson[],
  dismissed: Set<string>,
  limit = 50,
): MdmDedupGroup[] {
  const buckets = new Map<string, { matchType: MdmDedupMatchType; key: string; ids: string[] }>();
  function add(matchType: MdmDedupMatchType, key: string, id: string) {
    if (!key) return;
    const bucketKey = `${matchType}:${key}`;
    const bucket = buckets.get(bucketKey) ?? { matchType, key, ids: [] };
    if (!bucket.ids.includes(id)) bucket.ids.push(id);
    buckets.set(bucketKey, bucket);
  }

  for (const person of people) {
    const phone = personPhoneDedupDigits({
      raw: person.phone,
      nationalityIso: person.nationality,
    });
    if (phone.length >= 9) add("PHONE", phone, person.id);
    if (person.fin.length >= 5) add("FIN", docNorm(person.fin), person.id);
    if (person.passport.length >= 4) add("PASSPORT", docNorm(person.passport), person.id);
    const email = person.email.trim().toLowerCase();
    if (email.includes("@")) add("EMAIL", email, person.id);
    const birth = person.birthDate;
    const last = normalizeNameKey(person.lastName);
    const first = normalizeNameKey(person.firstName);
    const name = last && first ? `${last}|${first}` : normalizeNameKey(person.fullName);
    if (birth && name) add("NAME_BIRTH", `${name}|${birth}`, person.id);
    if (birth && last.length >= 2) add("LAST_BIRTH", `${last}|${birth}`, person.id);
    const tail = phone.length >= 9 ? phone.slice(-9) : "";
    if (last.length >= 2 && tail.length === 9) add("LAST_PHONE", `${last}|${tail}`, person.id);
    for (const doc of person.docNumbers) {
      const number = docNorm(doc.number);
      const country = doc.country.trim().toUpperCase();
      if (number.length >= 4 && country) add("DOC_CITIZENSHIP", `${number}|${country}`, person.id);
    }
  }

  const byBirth = new Map<string, MdmDedupPerson[]>();
  for (const person of people) {
    if (!person.birthDate || !person.firstName || !person.lastName) continue;
    const list = byBirth.get(person.birthDate) ?? [];
    list.push(person);
    byBirth.set(person.birthDate, list);
  }
  for (const [birth, rows] of byBirth) {
    for (let i = 0; i < rows.length; i += 1) {
      for (let j = i + 1; j < rows.length; j += 1) {
        const a = rows[i]!;
        const b = rows[j]!;
        const natA = a.nationality.trim().toUpperCase();
        const natB = b.nationality.trim().toUpperCase();
        if (natA && natB && natA !== natB) continue;
        if (a.sex && b.sex && a.sex !== "UNKNOWN" && b.sex !== "UNKNOWN" && a.sex !== b.sex) continue;
        const key = `${birth}|${normalizeNameKey(a.lastName)}`;
        if (isSimilarPersonName(a.firstName, a.lastName, b.firstName, b.lastName)) {
          add("SIMILAR_NAME", key, a.id);
          add("SIMILAR_NAME", key, b.id);
        } else if (sameMetaphoneName(a.firstName, a.lastName, b.firstName, b.lastName)) {
          add("METAPHONE", key, a.id);
          add("METAPHONE", key, b.id);
        }
      }
    }
  }

  const byId = new Map(people.map((person) => [person.id, person]));
  const groups: MdmDedupGroup[] = [];
  for (const bucket of buckets.values()) {
    if (bucket.ids.length < 2) continue;
    const visible = bucket.ids.filter((id, index) =>
      bucket.ids.slice(index + 1).some((other) => !dismissed.has(pairKey(id, other))),
    );
    const ids = bucket.ids.filter((id) => {
      return bucket.ids.some((other) => other !== id && !dismissed.has(pairKey(id, other)));
    });
    if (ids.length < 2) continue;
    void visible;
    const nameClash =
      bucket.matchType === "PASSPORT" &&
      ids.some((id) =>
        ids.some((other) => {
          if (other <= id) return false;
          const a = byId.get(id);
          const b = byId.get(other);
          if (!a || !b) return false;
          return namesClearlyDiffer(a.firstName, a.lastName, b.firstName, b.lastName);
        }),
      );
    groups.push({
      matchType: bucket.matchType,
      key: bucket.key,
      nameClash,
      personIds: ids,
    });
    if (groups.length >= limit) break;
  }
  return groups;
}

export function dedupPairKey(a: string, b: string): { personIdLow: string; personIdHigh: string } {
  return a < b
    ? { personIdLow: a, personIdHigh: b }
    : { personIdLow: b, personIdHigh: a };
}
