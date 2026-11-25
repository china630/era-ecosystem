import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
  timingSafeEqual,
} from "node:crypto";

const ALG = "aes-256-gcm";

function resolveKek(): Buffer {
  const raw = process.env.CRM_INTEGRATIONS_KEK?.trim();
  if (!raw) {
    throw new Error(
      "CRM_INTEGRATIONS_KEK is required (fail-closed; no JWT_SECRET fallback)",
    );
  }
  const asB64 = Buffer.from(raw, "base64");
  if (asB64.length >= 32) return createHash("sha256").update(asB64).digest();
  return createHash("sha256").update(raw).digest();
}

/** Format: v1:<iv_b64url>:<tag_b64url>:<ct_b64url> */
export function encryptSecretsJson(obj: Record<string, string>): string {
  const key = resolveKek();
  const iv = randomBytes(12);
  const cipher = createCipheriv(ALG, key, iv);
  const plaintext = Buffer.from(JSON.stringify(obj), "utf8");
  const ct = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [
    "v1",
    iv.toString("base64url"),
    tag.toString("base64url"),
    ct.toString("base64url"),
  ].join(":");
}

export function decryptSecretsJson(payload: string): Record<string, string> {
  const key = resolveKek();
  const [ver, ivB64, tagB64, ctB64] = payload.split(":");
  if (ver !== "v1" || !ivB64 || !tagB64 || !ctB64) {
    throw new Error("Invalid secretsEnc payload");
  }
  const decipher = createDecipheriv(ALG, key, Buffer.from(ivB64, "base64url"));
  decipher.setAuthTag(Buffer.from(tagB64, "base64url"));
  const pt = Buffer.concat([
    decipher.update(Buffer.from(ctB64, "base64url")),
    decipher.final(),
  ]);
  return JSON.parse(pt.toString("utf8")) as Record<string, string>;
}

export function maskSecret(value: string): string {
  if (!value) return "";
  return "••••" + value.slice(-4);
}

export function safeEqual(a: string, b: string): boolean {
  const ba = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ba.length !== bb.length) return false;
  return timingSafeEqual(ba, bb);
}

export function redactForLog(input: unknown): unknown {
  if (input == null) return input;
  if (typeof input === "string") {
    return input.replace(
      /(token|key|secret|password|authorization)=([^&\s]+)/gi,
      "$1=***",
    );
  }
  if (Array.isArray(input)) return input.map(redactForLog);
  if (typeof input === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(input as Record<string, unknown>)) {
      if (/token|key|secret|password|authorization|botToken|authToken/i.test(k)) {
        out[k] = typeof v === "string" ? maskSecret(v) : "***";
      } else {
        out[k] = redactForLog(v);
      }
    }
    return out;
  }
  return input;
}
