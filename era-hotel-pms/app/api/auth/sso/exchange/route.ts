import { createHmac, timingSafeEqual } from 'crypto';
import { z } from 'zod';
import { jsonOk, handleRouteError, jsonError } from '@/lib/api-utils';
import { signToken } from '@/lib/auth/jwt';
import { prisma } from '@/lib/prisma';
import { ROLE_CODES } from '@/lib/auth/permissions';
import { permissionsForRole } from '@/lib/auth/permissions';

const schema = z.object({
  email: z.string().email(),
  fullName: z.string().min(1),
  organizationId: z.string().min(1),
  expiresAt: z.number().int(),
  signature: z.string().min(1),
});

const COOKIE_NAME = process.env.AUTH_COOKIE_NAME ?? 'era_session';

function verifySsoSignature(payload: string, signature: string): boolean {
  const secret = process.env.ERA_SSO_SHARED_SECRET;
  if (!secret) return false;
  const expected = createHmac('sha256', secret).update(payload).digest('hex');
  try {
    return timingSafeEqual(Buffer.from(expected, 'hex'), Buffer.from(signature, 'hex'));
  } catch {
    return false;
  }
}

export async function POST(request: Request) {
  try {
    const body = schema.parse(await request.json());
    if (body.expiresAt < Math.floor(Date.now() / 1000)) {
      return jsonError('SSO token expired', 401);
    }

    const payload = `${body.email}|${body.organizationId}|${body.expiresAt}`;
    if (!verifySsoSignature(payload, body.signature)) {
      return jsonError('Invalid SSO signature', 401);
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
