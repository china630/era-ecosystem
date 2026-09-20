import { scrypt, randomBytes, timingSafeEqual } from "crypto";
import { promisify } from "util";

const scryptAsync = promisify(scrypt);

/**
 * Fixed dummy scrypt row used to pad login miss paths so unknown org / unknown
 * user take roughly the same time as a real password verify.
 */
const DUMMY_STORED_HASH =
  "0123456789abcdef0123456789abcdef:707ebfa6d16e2552e246bf9ff39fbc430c5273fb53bfc09981924061550daf365beb7ae026ab4a456fb5b585c624960e937cbfb1666bc7be7db82119f045f165";

/** scrypt-based password hash: `{salt}:{hex}` */
export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16).toString("hex");
  const derived = (await scryptAsync(password, salt, 64)) as Buffer;
  return `${salt}:${derived.toString("hex")}`;
}

export async function verifyPassword(
  password: string,
  stored: string,
): Promise<boolean> {
  if (stored === "sso:no-password") return false;
  const [salt, hash] = stored.split(":");
  if (!salt || !hash) return false;
  const derived = (await scryptAsync(password, salt, 64)) as Buffer;
  const hashBuf = Buffer.from(hash, "hex");
  if (hashBuf.length !== derived.length) return false;
  return timingSafeEqual(hashBuf, derived);
}

/** Run one scrypt verify against a dummy hash (result discarded). */
export async function burnPasswordVerifyCost(password: string): Promise<void> {
  await verifyPassword(password || "timing-pad", DUMMY_STORED_HASH);
}
