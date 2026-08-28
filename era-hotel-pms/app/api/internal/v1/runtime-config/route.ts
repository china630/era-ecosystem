import { createRuntimeConfigHandlers } from "@era/satellite-kit";
import { prisma } from "@/lib/prisma";
import { upsertElektrawebBridgePolicy } from "@/lib/integration/elektraweb-bridge/config";

export const { GET, POST } = createRuntimeConfigHandlers({
  getPrisma: () => prisma,
  onElektrawebBridge: async (organizationId, policy) => {
    await upsertElektrawebBridgePolicy(organizationId, policy);
  },
});
