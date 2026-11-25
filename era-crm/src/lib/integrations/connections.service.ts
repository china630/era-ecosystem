import { randomBytes } from "node:crypto";
import {
  decryptSecretsJson,
  encryptSecretsJson,
  getAdapter,
  listManifests,
  maskSecret,
  createHttpClient,
} from "@era/integrations-kit";
import { prisma } from "@/lib/prisma";
import { recordAudit } from "@/lib/satellite-audit";

function publicBase(): string {
  return (
    process.env.PUBLIC_BASE_URL?.replace(/\/$/, "") ||
    process.env.CRM_PUBLIC_URL?.replace(/\/$/, "") ||
    "http://127.0.0.1:3207"
  );
}

export function catalogForAdmin() {
  return listManifests().map((m) => ({
    key: m.key,
    name: m.name,
    category: m.category,
    tier: m.tier,
    regions: m.regions,
    verified: m.verified,
    docsUrl: m.docsUrl,
    fields: m.fields.map((f) => ({ ...f })),
    setupSteps: m.setupSteps,
    inbound: m.inbound,
    outbound: m.outbound,
  }));
}

export async function listConnections(organizationId: string) {
  const rows = await prisma.integrationConnection.findMany({
    where: { organizationId },
    orderBy: { updatedAt: "desc" },
  });
  return rows.map(sanitizeConnection);
}

type ConnectionRow = {
  id: string;
  organizationId: string;
  providerKey: string;
  category: string;
  displayName: string;
  publicId: string;
  status: string;
  enabled: boolean;
  configJson: string;
  secretsEnc: string | null;
  webhookSecret: string | null;
  lastTestAt: Date | null;
  lastTestOk: boolean | null;
  lastError: string | null;
  lastEventAt: Date | null;
  createdAt?: Date;
  updatedAt?: Date;
};

/** Resolve webhook secret from encrypted secrets (preferred) or legacy plaintext column. */
export function resolveWebhookSecret(row: {
  secretsEnc: string | null;
  webhookSecret: string | null;
}): string {
  if (row.secretsEnc) {
    try {
      const secrets = decryptSecretsJson(row.secretsEnc);
      if (secrets.webhookSecret) return secrets.webhookSecret;
    } catch {
      /* fall through */
    }
  }
  return row.webhookSecret ?? "";
}

export function resolveSecrets(row: {
  secretsEnc: string | null;
  webhookSecret: string | null;
}): Record<string, string> {
  const secrets = row.secretsEnc ? decryptSecretsJson(row.secretsEnc) : {};
  if (!secrets.webhookSecret) {
    const legacy = row.webhookSecret ?? "";
    if (legacy) secrets.webhookSecret = legacy;
  }
  return secrets;
}

function sanitizeConnection(row: ConnectionRow) {
  let secretsMask: Record<string, string> = {};
  try {
    const secrets = resolveSecrets(row);
    for (const [k, v] of Object.entries(secrets)) {
      secretsMask[k] = maskSecret(v);
    }
  } catch {
    secretsMask = { _error: "decrypt_failed" };
  }
  // Explicit allowlist — never leak webhookSecret / secretsEnc plaintext.
  return {
    id: row.id,
    organizationId: row.organizationId,
    providerKey: row.providerKey,
    category: row.category,
    displayName: row.displayName,
    publicId: row.publicId,
    status: row.status,
    enabled: row.enabled,
    config: JSON.parse(row.configJson || "{}"),
    secretsMask,
    webhookUrl: `${publicBase()}/api/integrations/hooks/${row.providerKey}/${row.publicId}`,
    lastTestAt: row.lastTestAt,
    lastTestOk: row.lastTestOk,
    lastError: row.lastError,
    lastEventAt: row.lastEventAt,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export async function createConnection(input: {
  organizationId: string;
  providerKey: string;
  displayName: string;
  config?: Record<string, unknown>;
  secrets?: Record<string, string>;
  actorUserId?: string;
}) {
  const adapter = getAdapter(input.providerKey);
  if (!adapter) throw Object.assign(new Error("Unknown provider"), { status: 400 });
  const secrets: Record<string, string> = { ...(input.secrets ?? {}) };
  if (!secrets.webhookSecret) secrets.webhookSecret = randomToken();
  const secretsEnc = encryptSecretsJson(secrets);
  const row = await prisma.integrationConnection.create({
    data: {
      organizationId: input.organizationId,
      providerKey: input.providerKey,
      category: adapter.manifest.category as never,
      displayName: input.displayName || adapter.manifest.name,
      configJson: JSON.stringify(input.config ?? {}),
      secretsEnc,
      // Plaintext column left empty — secret lives only in secretsEnc (TZ DoD).
      webhookSecret: null,
    },
  });
  await recordAudit(
    { userId: input.actorUserId },
    "integration_connection",
    row.id,
    "created",
    { providerKey: input.providerKey },
  );
  return sanitizeConnection(row);
}

export async function testConnection(organizationId: string, id: string, actorUserId?: string) {
  const row = await prisma.integrationConnection.findFirst({
    where: { id, organizationId },
  });
  if (!row) throw Object.assign(new Error("Not found"), { status: 404 });
  const adapter = getAdapter(row.providerKey);
  if (!adapter) throw Object.assign(new Error("Unknown provider"), { status: 400 });
  const secrets = resolveSecrets(row);
  const result = await adapter.testConnection({
    connectionId: row.id,
    organizationId,
    config: JSON.parse(row.configJson || "{}"),
    secrets,
    webhookUrl: `${publicBase()}/api/integrations/hooks/${row.providerKey}/${row.publicId}`,
    webhookSecret: secrets.webhookSecret ?? "",
    http: createHttpClient(),
    log: console,
  });
  await prisma.integrationConnection.update({
    where: { id: row.id },
    data: {
      lastTestAt: new Date(),
      lastTestOk: result.ok,
      lastError: result.ok ? null : result.message,
      status: result.ok ? "TESTING" : "ERROR",
    },
  });
  await recordAudit(
    { userId: actorUserId },
    "integration_connection",
    id,
    result.ok ? "test_ok" : "test_failed",
    { message: result.message },
  );
  return result;
}

export async function setEnabled(
  organizationId: string,
  id: string,
  enabled: boolean,
  actorUserId?: string,
) {
  const row = await prisma.integrationConnection.findFirst({
    where: { id, organizationId },
  });
  if (!row) throw Object.assign(new Error("Not found"), { status: 404 });
  if (enabled && !process.env.CRM_INTEGRATIONS_KEK) {
    throw Object.assign(new Error("CRM_INTEGRATIONS_KEK required to enable"), {
      status: 503,
    });
  }
  const adapter = getAdapter(row.providerKey);
  const secrets = resolveSecrets(row);
  const ctx = {
    connectionId: row.id,
    organizationId,
    config: JSON.parse(row.configJson || "{}"),
    secrets,
    webhookUrl: `${publicBase()}/api/integrations/hooks/${row.providerKey}/${row.publicId}`,
    webhookSecret: secrets.webhookSecret ?? "",
    http: createHttpClient(),
    log: console,
  };
  if (enabled) await adapter?.onEnable?.(ctx);
  else await adapter?.onDisable?.(ctx);
  const updated = await prisma.integrationConnection.update({
    where: { id },
    data: {
      enabled,
      status: enabled ? "ACTIVE" : "DISABLED",
    },
  });
  await recordAudit(
    { userId: actorUserId },
    "integration_connection",
    id,
    enabled ? "enabled" : "disabled",
  );
  return sanitizeConnection(updated);
}

function randomToken(): string {
  return randomBytes(32).toString("base64url");
}
