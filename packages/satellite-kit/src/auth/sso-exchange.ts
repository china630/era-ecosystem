import { SATELLITE_ROLE, mapFinanceRoleToSatellite } from "./roles";
import { signSatelliteSession } from "./session";
import type { SsoExchangeBody } from "./sso-exchange-schema";

export type SsoExchangePrisma = {
  role: {
    findUnique(args: {
      where: { code: string };
    }): Promise<{ id: string; code: string } | null>;
    create(args: {
      data: { code: string; name: string; permissionsJson?: string };
    }): Promise<{ id: string; code: string }>;
  };
  user: {
    findUnique(args: {
      where: { login: string };
      include: { role: true };
    }): Promise<{
      id: string;
      login: string;
      fullName: string;
      role: { code: string };
    } | null>;
    create(args: {
      data: {
        login: string;
        email: string;
        fullName: string;
        passwordHash: string;
        roleId: string;
        isCrossSystem: boolean;
      };
      include: { role: true };
    }): Promise<{
      id: string;
      login: string;
      fullName: string;
      role: { code: string };
    }>;
    update(args: {
      where: { id: string };
      data: {
        lastLoginAt?: Date;
        fullName?: string;
        roleId?: string;
      };
      include: { role: true };
    }): Promise<{
      id: string;
      login: string;
      fullName: string;
      role: { code: string };
    }>;
  };
};

export type SsoExchangeResult = {
  token: string;
  user: {
    id: string;
    login: string;
    fullName: string;
    role: string;
    roles: string[];
    isOwner: boolean;
    financeRole?: string;
  };
};

/** Shared SSO exchange: maps financeRole → BUSINESS_OWNER when applicable. */
export async function executeSatelliteSsoExchange(
  body: SsoExchangeBody,
  prisma: SsoExchangePrisma,
): Promise<SsoExchangeResult> {
  const financeRole = body.financeRole ?? "USER";
  const satelliteRole = mapFinanceRoleToSatellite(financeRole);
  const isOwner = satelliteRole === SATELLITE_ROLE.BUSINESS_OWNER;
  const roleCodes = [
    satelliteRole,
    ...(isOwner ? [SATELLITE_ROLE.SATELLITE_OPERATOR] : []),
    ...(satelliteRole === SATELLITE_ROLE.PLATFORM_MEMBER
      ? [SATELLITE_ROLE.SATELLITE_OPERATOR]
      : []),
  ];

  const roleNames: Record<string, string> = {
    [SATELLITE_ROLE.BUSINESS_OWNER]: "Business Owner",
    [SATELLITE_ROLE.PLATFORM_MEMBER]: "Platform Member",
    [SATELLITE_ROLE.SATELLITE_OPERATOR]: "Satellite Operator",
  };

  let role = await prisma.role.findUnique({ where: { code: satelliteRole } });
  if (!role) {
    role = await prisma.role.create({
      data: {
        code: satelliteRole,
        name: roleNames[satelliteRole] ?? satelliteRole,
        permissionsJson: "[]",
      },
    });
  }

  const login = `sso_${body.email.split("@")[0]}`;
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
        passwordHash: "sso:no-password",
        roleId: role.id,
        isCrossSystem: true,
      },
      include: { role: true },
    });
  } else {
    user = await prisma.user.update({
      where: { id: user.id },
      data: {
        lastLoginAt: new Date(),
        fullName: body.fullName,
        roleId: role.id,
      },
      include: { role: true },
    });
  }

  const token = await signSatelliteSession({
    sub: user.id,
    login: user.login,
    role: satelliteRole,
    roles: roleCodes,
    fullName: user.fullName,
    organizationId: body.organizationId,
    isOwner,
    financeRole,
  });

  return {
    token,
    user: {
      id: user.id,
      login: user.login,
      fullName: user.fullName,
      role: satelliteRole,
      roles: roleCodes,
      isOwner,
      financeRole,
    },
  };
}
