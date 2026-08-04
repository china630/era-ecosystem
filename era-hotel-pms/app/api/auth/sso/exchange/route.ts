import {
  consumeSsoSignatureOnce,
  resolveVerifiedSsoFinanceRole,
  ssoExchangeBodySchema,
} from '@era/satellite-kit';
import { jsonOk, handleRouteError, jsonError } from '@/lib/api-utils';
import { signToken } from '@/lib/auth/jwt';
import { prisma } from '@/lib/prisma';
import { ROLE_CODES } from '@/lib/auth/permissions';
import { permissionsForRole } from '@/lib/auth/permissions';

const COOKIE_NAME = process.env.AUTH_COOKIE_NAME ?? 'era_session';

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

    const deployOrg = process.env.ERA_SATELLITE_ORGANIZATION_ID?.trim();
    if (deployOrg && body.organizationId !== deployOrg) {
      return jsonError('SSO organization mismatch', 401);
    }

    let role = await prisma.role.findUnique({
      where: { code: ROLE_CODES.FINANCIAL_AUDITOR },
    });
    if (!role) {
      role = await prisma.role.create({
        data: {
          code: ROLE_CODES.FINANCIAL_AUDITOR,
          name: 'Financial Auditor',
          permissionsJson: JSON.stringify(permissionsForRole(ROLE_CODES.FINANCIAL_AUDITOR)),
        },
      });
    }

    const login = `sso_${body.email.split('@')[0]}`;
    let user = await prisma.user.findUnique({
      where: { login },
      include: { role: true },
    });
    if (!user) {
      user = await prisma.user.create({
        data: {
          login,
          email: body.email,
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
        data: { lastLoginAt: new Date(), fullName: body.fullName },
        include: { role: true },
      });
    }

    const token = await signToken({
      sub: user.id,
      login: user.login,
      role: user.role.code,
      fullName: user.fullName,
    });

    const res = jsonOk({
      user: {
        id: user.id,
        login: user.login,
        fullName: user.fullName,
        role: user.role.code,
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
