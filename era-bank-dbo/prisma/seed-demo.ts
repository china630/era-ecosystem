/**
 * Bank DBO lab demo — Open API key inside one lab bank.
 * Never entrypoint / RUN_SEED. Use: npm run db:seed:demo
 * Requires ERA_BANK_ORGANIZATION_ID or ERA_SATELLITE_ORGANIZATION_ID (real org, not a demo sentinel).
 */
import { ApiKeyStatus, DboChannel } from "@prisma/client";
import { runWithSatelliteTenant } from "@era/satellite-kit";
import { hashApiKey } from "../lib/customer-session";
import { prisma } from "../lib/prisma";

const DEMO_RETAIL_CUSTOMER_ID = "demo-retail-customer";
const DEMO_CORPORATE_CUSTOMER_ID = "demo-corporate-customer";
const DEMO_API_KEY = "dbo-demo-api-key-change-in-prod";

function requireLabBankOrg(): string {
  const id =
    process.env.ERA_BANK_ORGANIZATION_ID?.trim() ||
    process.env.ERA_SATELLITE_ORGANIZATION_ID?.trim() ||
    "";
  if (!id || id === "demo-org" || id === "demo-bank-org-001") {
    throw new Error(
      "ERA_BANK_ORGANIZATION_ID (or ERA_SATELLITE_ORGANIZATION_ID) required for DBO demo seed; demo-bank-org-001 is forbidden",
    );
  }
  return id;
}

async function main() {
  const organizationId = requireLabBankOrg();
  const apiKeyHash = hashApiKey(DEMO_API_KEY);

  await runWithSatelliteTenant({ organizationId }, async () => {
    await prisma.corporateApiKey.upsert({
      where: {
        organizationId_keyHash: { organizationId, keyHash: apiKeyHash },
      },
      create: {
        organizationId,
        customerId: DEMO_CORPORATE_CUSTOMER_ID,
        keyHash: apiKeyHash,
        permissionsJson: ["payments:create", "payments:read", "accounts:read"],
        ipAllowlist: ["127.0.0.1", "::1"],
        status: ApiKeyStatus.ACTIVE,
      },
      update: {
        status: ApiKeyStatus.ACTIVE,
        permissionsJson: ["payments:create", "payments:read", "accounts:read"],
      },
    });
  });

  console.log("era-bank-dbo demo seed complete");
  console.log(`  lab bank organizationId: ${organizationId}`);
  console.log(`  demo retail customerId: ${DEMO_RETAIL_CUSTOMER_ID}`);
  console.log(`  demo corporate customerId: ${DEMO_CORPORATE_CUSTOMER_ID}`);
  console.log(`  demo Open API key: ${DEMO_API_KEY}`);
  console.log(`  demo OTP code: ${process.env.DEV_OTP_CODE ?? "123456"}`);
  console.log(`  channels: ${DboChannel.RETAIL}, ${DboChannel.CORPORATE}`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
