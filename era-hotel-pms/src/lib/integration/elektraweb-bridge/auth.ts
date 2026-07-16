import { SignJWT, jwtVerify } from 'jose';
import {
  getBridgeOrganizationId,
  getExpectedElektrawebHotelId,
  getOptionalBridgeSharedToken,
  isElektrawebBridgeEnabled,
  roleMayUseBridge,
} from '@/lib/integration/elektraweb-bridge/config';
import { verifyToken as verifySessionToken, type SessionPayload } from '@/lib/auth/jwt';

const PURPOSE = 'elektraweb-bridge';

export type BridgeAuthContext = {
  organizationId: string;
  elektrawebHotelId: number;
  login: string;
  role: string;
  userId?: string;
  via: 'bridge_jwt' | 'shared_token' | 'session_jwt';
};

function getSecret() {
  const secret = process.env.AUTH_JWT_SECRET;
  if (!secret || secret.length < 16) {
    throw new Error('AUTH_JWT_SECRET must be set (min 16 chars)');
  }
  return new TextEncoder().encode(secret);
}

export async function signBridgeToken(input: {
  userId: string;
  login: string;
  role: string;
  fullName: string;
}): Promise<string> {
  const organizationId = getBridgeOrganizationId();
  const elektrawebHotelId = getExpectedElektrawebHotelId();
  return new SignJWT({
    purpose: PURPOSE,
    login: input.login,
    role: input.role,
    fullName: input.fullName,
    organizationId,
    elektrawebHotelId,
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(input.userId)
    .setIssuedAt()
    .setExpirationTime('12h')
    .sign(getSecret());
}

function bearer(request: Request): string | null {
  const auth = request.headers.get('authorization');
  if (!auth?.startsWith('Bearer ')) return null;
  return auth.slice(7).trim() || null;
}

export async function authenticateBridgeRequest(request: Request): Promise<BridgeAuthContext> {
  if (!isElektrawebBridgeEnabled()) {
    throw new Error('Elektraweb bridge is disabled (ELEKTRAWEB_BRIDGE_ENABLED≠1)');
  }

  const organizationId = getBridgeOrganizationId();
  const elektrawebHotelId = getExpectedElektrawebHotelId();
  const token = bearer(request);
  if (!token) throw new Error('Unauthorized');

  const shared = getOptionalBridgeSharedToken();
  if (shared && token === shared) {
    return {
      organizationId,
      elektrawebHotelId,
      login: 'bridge-token',
      role: 'bridge',
      via: 'shared_token',
    };
  }

  try {
    const { payload } = await jwtVerify(token, getSecret());
    if (payload.purpose === PURPOSE) {
      const org = String(payload.organizationId ?? '');
      const hotelId = Number(payload.elektrawebHotelId);
      if (org !== organizationId) {
        throw new Error(
          `Forbidden: bridge token org ${org} does not match deployment ${organizationId}`,
        );
      }
      if (hotelId !== elektrawebHotelId) {
        throw new Error(
          `Forbidden: bridge token hotel ${hotelId} does not match ELEKTRAWEB_HOTEL_ID ${elektrawebHotelId}`,
        );
      }
      const role = String(payload.role ?? '');
      if (!roleMayUseBridge(role) && role !== 'bridge') {
        throw new Error('Forbidden: insufficient role for Elektraweb bridge');
      }
      return {
        organizationId,
        elektrawebHotelId,
        login: String(payload.login ?? ''),
        role,
        userId: typeof payload.sub === 'string' ? payload.sub : undefined,
        via: 'bridge_jwt',
      };
    }
  } catch (err) {
    if (err instanceof Error && err.message.startsWith('Forbidden')) throw err;
    // fall through to session JWT
  }

  let session: SessionPayload;
  try {
    session = await verifySessionToken(token);
  } catch {
    throw new Error('Unauthorized');
  }
  if (!roleMayUseBridge(session.role)) {
    throw new Error('Forbidden: insufficient role for Elektraweb bridge');
  }
  return {
    organizationId,
    elektrawebHotelId,
    login: session.login,
    role: session.role,
    userId: session.sub,
    via: 'session_jwt',
  };
}
