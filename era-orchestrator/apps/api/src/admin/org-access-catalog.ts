export type AccessGroup = "bank" | "gov" | "other";

export type AccessConnector = {
  code: string;
  group: AccessGroup;
  /** False until the platform owns a live adapter. The org still must not type an API URL. */
  active: boolean;
  fields: { key: string; max: number }[];
  hasSecret: boolean;
};

export const ACCESS_CONNECTORS: AccessConnector[] = [
  { code: "BANK_PASHA", group: "bank", active: true, hasSecret: true, fields: [{ key: "clientId", max: 120 }] },
  { code: "BANK_ABB", group: "bank", active: true, hasSecret: true, fields: [{ key: "login", max: 120 }, { key: "cif", max: 32 }] },
  { code: "BANK_BIRBANK", group: "bank", active: true, hasSecret: true, fields: [{ key: "clientId", max: 120 }] },
  { code: "BANK_UNIBANK", group: "bank", active: false, hasSecret: true, fields: [{ key: "clientId", max: 120 }] },
  { code: "BANK_ACCESS", group: "bank", active: false, hasSecret: true, fields: [{ key: "clientId", max: 120 }] },
  { code: "BANK_BAKU", group: "bank", active: false, hasSecret: true, fields: [{ key: "clientId", max: 120 }] },
  { code: "GOV_EMAS", group: "gov", active: true, hasSecret: true, fields: [{ key: "employerId", max: 120 }] },
  { code: "GOV_ETAXES", group: "gov", active: true, hasSecret: true, fields: [{ key: "asanUserId", max: 120 }] },
  { code: "GOV_EQAIME", group: "gov", active: true, hasSecret: true, fields: [{ key: "accountId", max: 120 }] },
  { code: "GOV_CUSTOMS", group: "gov", active: true, hasSecret: true, fields: [{ key: "traderId", max: 120 }] },
  { code: "GOV_MIGRATION", group: "gov", active: true, hasSecret: true, fields: [{ key: "externalId", max: 120 }] },
  { code: "GOV_DSMF", group: "gov", active: true, hasSecret: true, fields: [{ key: "externalId", max: 120 }] },
  {
    code: "ONEC",
    group: "other",
    active: true,
    hasSecret: true,
    fields: [
      { key: "baseUrl", max: 300 },
      { key: "username", max: 120 },
    ],
  },
  { code: "ELEKTRAWEB", group: "other", active: true, hasSecret: true, fields: [{ key: "login", max: 120 }] },
  { code: "CHANNEX", group: "other", active: true, hasSecret: false, fields: [{ key: "propertyId", max: 120 }] },
  { code: "SMS", group: "other", active: true, hasSecret: true, fields: [{ key: "senderName", max: 64 }] },
];

export function accessConnector(code: string): AccessConnector | undefined {
  return ACCESS_CONNECTORS.find((row) => row.code === code);
}

export function sanitizePublicFields(
  connector: AccessConnector,
  raw: Record<string, unknown> | undefined,
): Record<string, string> {
  const source = raw ?? {};
  const allowed = new Set(connector.fields.map((field) => field.key));
  for (const key of Object.keys(source)) {
    if (!allowed.has(key)) {
      throw new Error(`UNKNOWN_FIELD:${key}`);
    }
  }
  const out: Record<string, string> = {};
  for (const field of connector.fields) {
    const value = source[field.key];
    if (value == null || value === "") continue;
    if (typeof value !== "string") {
      throw new Error(`BAD_FIELD:${field.key}`);
    }
    const trimmed = value.trim();
    if (!trimmed) continue;
    if (trimmed.length > field.max) {
      throw new Error(`LONG_FIELD:${field.key}`);
    }
    out[field.key] = trimmed;
  }
  return out;
}
