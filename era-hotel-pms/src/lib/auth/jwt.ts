import { SignJWT, jwtVerify } from 'jose';

export interface SessionPayload {
  sub: string;
  login: string;
  role: string;
  fullName: string;
  /** When known (login/SSO) — platform super-admin allowlist matches email. */
  email?: string;
}

function getSecret() {
  const secret = process.env.AUTH_JWT_SECRET;
  if (!secret || secret.length < 16) {
    throw new Error('AUTH_JWT_SECRET must be set (min 16 chars)');
  }
  return new TextEncoder().encode(secret);
}

export async function signToken(payload: SessionPayload): Promise<string> {
  const claims: Record<string, unknown> = {
    login: payload.login,
    role: payload.role,
    fullName: payload.fullName,
  };
  if (payload.email) claims.email = payload.email;

  return new SignJWT(claims)
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(payload.sub)
    .setIssuedAt()
    .setExpirationTime('12h')
    .sign(getSecret());
}

export async function verifyToken(token: string): Promise<SessionPayload> {
  const { payload } = await jwtVerify(token, getSecret());
  const sub = payload.sub;
  if (!sub || typeof sub !== 'string') throw new Error('Invalid token subject');
  return {
    sub,
    login: String(payload.login ?? ''),
    role: String(payload.role ?? ''),
    fullName: String(payload.fullName ?? ''),
    email: payload.email != null ? String(payload.email) : undefined,
  };
}
