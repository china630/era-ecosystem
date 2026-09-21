import { createRuntimeConfigHandlers } from "@era/satellite-kit";
import { prisma } from "@/lib/prisma";
import { upsertFnbOrgSnapshot } from "@/lib/fnb-org-profile";

export const { GET, POST } = createRuntimeConfigHandlers({
  getPrisma: () => prisma,
  onSharedOrgSnapshot: async (organizationId, snap) => {
    await upsertFnbOrgSnapshot(organizationId, snap);
  },
});
