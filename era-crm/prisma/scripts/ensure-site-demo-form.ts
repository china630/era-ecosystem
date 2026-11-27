/**
 * Idempotent: ensure form_generic connection for ERA public site demo
 * and print publicId + webhook secret for orchestrator system_config.
 *
 * Usage (from era-crm):
 *   npx tsx prisma/scripts/ensure-site-demo-form.ts
 *
 * Optional env:
 *   SITE_CRM_ORGANIZATION_ID — force org id
 *   ORCH_DATABASE_URL — look up owner email in orchestrator DB
 */
import { PrismaClient as CrmPrisma } from "@prisma/client";
import { ensureCrmIntegrationsKek } from "../../src/lib/integrations/crm-kek";
import {
  createConnection,
  setEnabled,
} from "../../src/lib/integrations/connections.service";
import { decryptSecretsJson } from "@era/integrations-kit";

const DISPLAY = "ERA 365 public site demo";

async function resolveOrganizationId(crm: CrmPrisma): Promise<string> {
  const forced = process.env.SITE_CRM_ORGANIZATION_ID?.trim();
  if (forced) return forced;

  // Prefer an existing form_generic connection with our display name.
  const existing = await crm.integrationConnection.findFirst({
    where: { providerKey: "form_generic", displayName: DISPLAY },
    select: { organizationId: true },
  });
  if (existing) return existing.organizationId;

  // Any non-demo org that already has leads / connections.
  const orgs = await crm.$queryRawUnsafe<Array<{ organization_id: string }>>(
    `SELECT DISTINCT organization_id FROM "IntegrationConnection" LIMIT 20`,
  ).catch(() => [] as Array<{ organization_id: string }>);

  for (const o of orgs) {
    const id = o.organization_id;
    if (/demo/i.test(id)) continue;
    return id;
  }

  throw new Error(
    "Could not resolve CRM organizationId. Set SITE_CRM_ORGANIZATION_ID.",
  );
}

async function main() {
  const crm = new CrmPrisma();
  try {
    await ensureCrmIntegrationsKek();
    const organizationId = await resolveOrganizationId(crm);

    let row = await crm.integrationConnection.findFirst({
      where: {
        organizationId,
        providerKey: "form_generic",
        displayName: DISPLAY,
      },
    });

    if (!row) {
      const created = await createConnection({
        organizationId,
        providerKey: "form_generic",
        displayName: DISPLAY,
        config: { source: "era_public_site" },
      });
      await setEnabled(organizationId, created.id, true);
      row = await crm.integrationConnection.findFirstOrThrow({
        where: { id: created.id },
      });
    } else if (!row.enabled) {
      await setEnabled(organizationId, row.id, true);
      row = await crm.integrationConnection.findFirstOrThrow({
        where: { id: row.id },
      });
    }

    if (!row.secretsEnc) {
      throw new Error("Connection secretsEnc missing");
    }
    const secrets = decryptSecretsJson(row.secretsEnc);
    const webhookSecret = secrets.webhookSecret;
    if (!webhookSecret) {
      throw new Error("webhookSecret missing in secretsEnc");
    }

    // eslint-disable-next-line no-console
    console.log(
      JSON.stringify(
        {
          ok: true,
          organizationId,
          publicId: row.publicId,
          webhookSecret,
          note: "Write these into orch system_config site.crm_organization_id / site.demo_form_public_id / site.demo_form_webhook_secret (encrypt secret).",
        },
        null,
        2,
      ),
    );
  } finally {
    await crm.$disconnect();
  }
}

main().catch((e) => {
  // eslint-disable-next-line no-console
  console.error(e);
  process.exit(1);
});
