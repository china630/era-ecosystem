/**
 * E15 / T-I29 — tenant API keys (hash only stored; plaintext once).
 */
import { createHash, randomBytes } from "node:crypto";
import { prisma } from "@/lib/prisma";

function hashKey(raw: string): string {
  return createHash("sha256").update(raw).digest("hex");
}

export async function listTenantApiKeys(organizationId: string) {
  const rows = await prisma.tenantApiKey.findMany({
    where: { organizationId },
    orderBy: { createdAt: "desc" },
  });
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    scopes: JSON.parse(r.scopesJson || "[]") as string[],
    expiresAt: r.expiresAt,
    createdAt: r.createdAt,
    keyPreview: `${r.keyHash.slice(0, 8)}…`,
  }));
}

export async function createTenantApiKey(input: {
  organizationId: string;
  name: string;
  scopes?: string[];
  expiresAt?: Date | null;
}) {
  const raw = `era_${randomBytes(24).toString("base64url")}`;
  const row = await prisma.tenantApiKey.create({
    data: {
      organizationId: input.organizationId,
      name: input.name.trim() || "api-key",
      keyHash: hashKey(raw),
      scopesJson: JSON.stringify(input.scopes ?? ["api:leads.read"]),
      expiresAt: input.expiresAt ?? null,
    },
  });
  return {
    id: row.id,
    name: row.name,
    scopes: JSON.parse(row.scopesJson || "[]") as string[],
    expiresAt: row.expiresAt,
    tokenOnce: raw,
  };
}

export async function revokeTenantApiKey(organizationId: string, id: string) {
  await prisma.tenantApiKey.deleteMany({ where: { id, organizationId } });
  return { ok: true };
}

export async function resolveTenantApiKey(
  bearer: string,
): Promise<{ organizationId: string; scopes: string[]; keyId: string } | null> {
  const raw = bearer.replace(/^Bearer\s+/i, "").trim();
  if (!raw.startsWith("era_")) return null;
  const keyHash = hashKey(raw);
  const row = await prisma.tenantApiKey.findFirst({ where: { keyHash } });
  if (!row) return null;
  if (row.expiresAt && row.expiresAt.getTime() < Date.now()) return null;
  return {
    organizationId: row.organizationId,
    scopes: JSON.parse(row.scopesJson || "[]") as string[],
    keyId: row.id,
  };
}
