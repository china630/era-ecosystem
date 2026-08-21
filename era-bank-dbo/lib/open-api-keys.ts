import { randomBytes } from "crypto";
import { prisma } from "@/lib/prisma";
import { hashApiKey } from "@/lib/customer-session";
import { engineDboJson } from "@/lib/engine-dbo-client";
export { isOpenApiPermission, OPEN_API_PERMISSIONS } from "@/lib/open-api-permissions";

export function generateRawApiKey(): string {
  return `dbo_${randomBytes(24).toString("hex")}`;
}

export async function listCorporateApiKeys(customerId: string) {
  return prisma.corporateApiKey.findMany({
    where: { customerId },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      customerId: true,
      permissionsJson: true,
      status: true,
      createdAt: true,
      expiresAt: true,
    },
  });
}

export async function createCorporateApiKey(input: {
  customerId: string;
  permissions: string[];
}) {
  const rawKey = generateRawApiKey();
  const keyHash = hashApiKey(rawKey);
  const row = await prisma.corporateApiKey.create({
    data: {
      customerId: input.customerId,
      keyHash,
      permissionsJson: input.permissions,
      ipAllowlist: [],
      status: "ACTIVE",
    },
  });
  try {
    await engineDboJson("POST", "/api/v1/dbo/open/keys/register", {
      id: row.id,
      keyHash,
      customerId: input.customerId,
      permissions: input.permissions,
    });
  } catch {
    await prisma.corporateApiKey.update({
      where: { id: row.id },
      data: { status: "REVOKED" },
    });
    throw new Error("Engine key register failed");
  }
  return { row, rawKey };
}

export async function revokeCorporateApiKey(id: string, customerId: string) {
  const existing = await prisma.corporateApiKey.findFirst({
    where: { id, customerId },
  });
  if (!existing) return null;
  const row = await prisma.corporateApiKey.update({
    where: { id: existing.id },
    data: { status: "REVOKED" },
  });
  try {
    await engineDboJson("POST", `/api/v1/dbo/open/keys/${id}/revoke`, {});
  } catch {
    // Channel SoR is revoked; engine memory may be empty after restart.
  }
  return row;
}
