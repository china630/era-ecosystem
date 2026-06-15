import { ApiKeyStatus, DboChannel } from "@prisma/client";
import { hashApiKey } from "../lib/customer-session";
import { prisma } from "../lib/prisma";

const DEMO_RETAIL_CUSTOMER_ID = "demo-retail-customer";
const DEMO_CORPORATE_CUSTOMER_ID = "demo-corporate-customer";
const DEMO_API_KEY = "dbo-demo-api-key-change-in-prod";

async function main() {
  const apiKeyHash = hashApiKey(DEMO_API_KEY);

  await prisma.corporateApiKey.upsert({
    where: { keyHash: apiKeyHash },
    create: {
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

  console.log("era-bank-dbo seed complete");
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
