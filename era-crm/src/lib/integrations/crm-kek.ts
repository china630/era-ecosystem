import { randomBytes } from "node:crypto";
import { prisma } from "@/lib/prisma";

export const CRM_INTEGRATIONS_KEK_KEY = "integrations.kek";

let memoryKek: string | null = null;

/**
 * Resolve CRM integrations KEK:
 * 1) in-memory / process.env (already loaded)
 * 2) crm_system_config
 * 3) process.env (persist to DB if present)
 * Fail-closed in production if still missing.
 */
export async function ensureCrmIntegrationsKek(): Promise<string> {
  if (memoryKek) {
    process.env.CRM_INTEGRATIONS_KEK = memoryKek;
    return memoryKek;
  }
  const envKek = process.env.CRM_INTEGRATIONS_KEK?.trim();
  if (envKek) {
    const row = await prisma.crmSystemConfig.findUnique({
      where: { key: CRM_INTEGRATIONS_KEK_KEY },
    });
    if (!row?.value) {
      await prisma.crmSystemConfig.upsert({
        where: { key: CRM_INTEGRATIONS_KEK_KEY },
        create: { key: CRM_INTEGRATIONS_KEK_KEY, value: envKek },
        update: {},
      });
    }
    memoryKek = envKek;
    return envKek;
  }

  const row = await prisma.crmSystemConfig.findUnique({
    where: { key: CRM_INTEGRATIONS_KEK_KEY },
  });
  if (row?.value?.trim()) {
    memoryKek = row.value.trim();
    process.env.CRM_INTEGRATIONS_KEK = memoryKek;
    return memoryKek;
  }

  if (process.env.NODE_ENV === "production") {
    throw new Error(
      "CRM_INTEGRATIONS_KEK missing in env and crm_system_config (fail-closed)",
    );
  }

  const generated = randomBytes(32).toString("base64url");
  await prisma.crmSystemConfig.upsert({
    where: { key: CRM_INTEGRATIONS_KEK_KEY },
    create: { key: CRM_INTEGRATIONS_KEK_KEY, value: generated },
    update: { value: generated },
  });
  memoryKek = generated;
  process.env.CRM_INTEGRATIONS_KEK = generated;
  return generated;
}

/** Synchronous read after ensureCrmIntegrationsKek() has run. */
export function peekCrmIntegrationsKek(): string | null {
  return memoryKek ?? process.env.CRM_INTEGRATIONS_KEK?.trim() ?? null;
}
