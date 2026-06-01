import { createHash, createHmac } from "node:crypto";

export function normalizeVoen(value: string): string {
  return value.replace(/\D/g, "");
}

export function blindIndexForVoen(value: string, keyEnv?: string): string {
  const normalized = normalizeVoen(value);
  const raw = keyEnv?.trim();
  let key: Buffer;
  if (raw) {
    const asB64 = Buffer.from(raw, "base64");
    key =
      asB64.length >= 32
        ? createHash("sha256").update(asB64).digest()
        : createHash("sha256").update(raw).digest();
  } else {
    key = createHash("sha256")
      .update(`PII_BLIND_INDEX_KEY:erafinance-dev-fallback`)
      .digest();
  }
  return createHmac("sha256", key).update(`voen:${normalized}`).digest("hex");
}
