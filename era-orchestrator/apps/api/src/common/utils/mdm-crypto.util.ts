import { createCipheriv, createDecipheriv, createHash, createHmac, randomBytes } from "node:crypto";

const ALG = "aes-256-gcm";
const VERSION = "v1";

function resolveKey(primaryName: string): Buffer {
  const raw = process.env[primaryName]?.trim();
  if (raw) {
    const asB64 = Buffer.from(raw, "base64");
    if (asB64.length >= 32) return createHash("sha256").update(asB64).digest();
    return createHash("sha256").update(raw).digest();
  }
  return createHash("sha256")
    .update(`${primaryName}:erafinance-dev-fallback`)
    .digest();
}

export function encryptText(value: string): string {
  const key = resolveKey("PII_ENCRYPTION_KEY");
  const iv = randomBytes(12);
  const cipher = createCipheriv(ALG, key, iv);
  const ciphertext = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [VERSION, iv.toString("base64url"), ciphertext.toString("base64url"), tag.toString("base64url")].join(".");
}

export function blindIndexFin(fin: string): string {
  const normalized = fin.trim().toUpperCase();
  const key = resolveKey("PII_BLIND_INDEX_KEY");
  return createHmac("sha256", key).update(`fin:${normalized}`).digest("hex");
}

export function blindIndexVoen(voen: string): string {
  const normalized = voen.replace(/\D/g, "");
  const key = resolveKey("PII_BLIND_INDEX_KEY");
  return createHmac("sha256", key).update(`voen:${normalized}`).digest("hex");
}

export type PersonIdentifierTypeKey =
  | "AZ_FIN"
  | "PASSPORT"
  | "RESIDENCE_PERMIT"
  | "NATIONAL_ID"
  | "ERA_SURROGATE";

export function normalizeIdentifierValue(
  type: PersonIdentifierTypeKey,
  value: string,
): string {
  const trimmed = value.trim();
  if (type === "AZ_FIN") return trimmed.toUpperCase();
  if (type === "PASSPORT" || type === "RESIDENCE_PERMIT" || type === "NATIONAL_ID") {
    return trimmed.toUpperCase().replace(/\s+/g, "");
  }
  return trimmed;
}

export function normalizeCountryCode(country?: string): string {
  const c = (country ?? "AZ").trim().toUpperCase();
  return c.length === 2 ? c : c.slice(0, 2) || "AZ";
}

/** Namespaced blind index: id:{type}:{country}:{normalized} */
export function blindIndexIdentifier(
  type: PersonIdentifierTypeKey,
  issuingCountry: string,
  value: string,
): string {
  const country = normalizeCountryCode(issuingCountry);
  const normalized = normalizeIdentifierValue(type, value);
  const key = resolveKey("PII_BLIND_INDEX_KEY");
  return createHmac("sha256", key)
    .update(`id:${type}:${country}:${normalized}`)
    .digest("hex");
}
