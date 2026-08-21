import {
  consumeSsoSignatureOnce,
  resolveVerifiedSsoFinanceRole,
  ssoExchangeBodySchema,
  satelliteOrganizationId,
} from '@era/satellite-kit';
import { jsonOk, handleRouteError, jsonError } from '@/lib/api-utils';
import { signToken } from '@/lib/auth/jwt';
import { prisma } from '@/lib/prisma';
import {
  ROLE_CODES,
  permissionsForRole,
  serializePermissions,
} from '@/lib/auth/permissions';
import { isPlatformSuperAdminUser } from '@/lib/auth/platform-super-admin';

const COOKIE_NAME = process.env.AUTH_COOKIE_NAME ?? 'era_session';

async function ensureRole(code: string) {
  const existing = await prisma.role.findFirst({ where: { code } });
  if (existing) return existing;
  return prisma.role.create({
    data: {
      code,
      name: code.replace(/_/g, ' '),
      permissionsJson: serializePermissions(permissionsForRole(code)),
    },
  });
}

/**
 * SEC-SSO-02/01: Orchestrator mints HMAC (v2/v3); replay guard via consumeSsoSignatureOnce.
 * SEC-SSO-05: ticket org must match satelliteOrganizationId() when bound.
 */
export async function POST(request: Request) {
  try {
    const body = ssoExchangeBodySchema.parse(await request.json());
    if (body.expiresAt < Math.floor(Date.now() / 1000)) {
      return jsonError('SSO token expired', 401);
    }

    const financeRole = resolveVerifiedSsoFinanceRole({
      email: body.email,
      organizationId: body.organizationId,
      expiresAt: body.expiresAt,
      signature: body.signature,
      financeRole: body.financeRole,
      jti: body.jti,
    });
    if (!financeRole) {
      return jsonError('Invalid SSO signature', 401);
    }
    if (!consumeSsoSignatureOnce(body.signature, body.expiresAt)) {
      return jsonError('SSO ticket already used', 401);
    }

    const deployOrg = satelliteOrganizationId();
    if (deployOrg && deployOrg !== 'demo-org' && body.organizationId !== deployOrg) {
      return jsonError('SSO organization mismatch', 401);
    }

    const email = body.email.trim().toLowerCase();
    const isPlatformSuperAdmin = isPlatformSuperAdminUser({
      email,
      login: email,
    });

    // Platform super-admins get full hotel ops; other launcher SSO users stay
    // on Financial_Auditor (exec / read-oriented) until role mapping is expanded.
    const roleCode = isPlatformSuperAdmin
      ? ROLE_CODES.HOTEL_ADMIN
      : ROLE_CODES.FINANCIAL_AUDITOR;
    const role = await ensureRole(roleCode);

    const login = `sso_${email.split('@')[0]}`;
    let user = await prisma.user.findFirst({
      where: { login },
      include: { role: true },
    });
    if (!user) {
      user = await prisma.user.create({
        data: {
          login,
          email,
          fullName: body.fullName,
          passwordHash: 'sso:no-password',
          roleId: role.id,
          isCrossSystem: true,
          status: 'ACTIVE',
        },
        include: { role: true },
      });
    } else {
      user = await prisma.user.update({
        where: { id: user.id },
        data: {
          lastLoginAt: new Date(),
          fullName: body.fullName,
          email,
          // Re-assert role on every SSO so PSA is never stuck on read-only.
          roleId: role.id,
        },
        include: { role: true },
      });
    }

    if (!user) {
      return jsonError('SSO user provisioning failed', 500);
    }

    const token = await signToken({
      sub: user.id,
      login: user.login,
      role: user.role.code,
      fullName: user.fullName,
      email,
    });

    const res = jsonOk({
      user: {
        id: user.id,
        login: user.login,
        fullName: user.fullName,
        role: user.role.code,
        isPlatformSuperAdmin,
        financeRole,
      },
      token,
    });

    res.cookies.set(COOKIE_NAME, token, {
      httpOnly: true,
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60 * 4,
    });

    return res;
  } catch (err) {
    return handleRouteError(err);
  }
}
