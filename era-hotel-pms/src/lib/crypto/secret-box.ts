import { createCipheriv, createDecipheriv, createHash, createHmac, randomBytes, timingSafeEqual } from 'crypto';

const ALG = 'aes-256-gcm';
const VERSION = 'v1';

function keyBytes(): Buffer {
  const raw =
    process.env.HOTEL_SECRET_BOX_KEY?.trim() ||
    process.env.AUTH_JWT_SECRET?.trim() ||
    'era-hotel-dev-secret-box';
  return createHash('sha256').update(raw).digest();
}

/** AES-256-GCM payload `v1.iv.ct.tag` (base64url). */
export function encryptSecret(value: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv(ALG, keyBytes(), iv);
  const ciphertext = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [
    VERSION,
    iv.toString('base64url'),
    ciphertext.toString('base64url'),
    tag.toString('base64url'),
  ].join('.');
}

export function decryptSecret(payload: string): string | null {
  const parts = payload.split('.');
  if (parts.length !== 4 || parts[0] !== VERSION) {
    // Legacy plaintext (pre-hardening) — still accepted until rotated.
    return payload.trim() ? payload : null;
  }
  try {
    const iv = Buffer.from(parts[1], 'base64url');
    const ciphertext = Buffer.from(parts[2], 'base64url');
    const tag = Buffer.from(parts[3], 'base64url');
    const decipher = createDecipheriv(ALG, keyBytes(), iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString('utf8');
  } catch {
    return null;
  }
}

export function secretsEqual(a: string, b: string): boolean {
  const ha = createHmac('sha256', 'era-webhook-compare').update(a).digest();
  const hb = createHmac('sha256', 'era-webhook-compare').update(b).digest();
  return timingSafeEqual(ha, hb);
}
