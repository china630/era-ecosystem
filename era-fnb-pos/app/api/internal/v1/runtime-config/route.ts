import { createRuntimeConfigHandlers } from "@era/satellite-kit";
import { prisma } from "@/lib/prisma";
import { upsertFnbOrgSnapshot } from "@/lib/fnb-org-profile";
import { ensureKafeOpsSkeleton } from "@/lib/kafe-org-bootstrap";

export const { GET, POST } = createRuntimeConfigHandlers({
  getPrisma: () => prisma,
  onSharedOrgSnapshot: async (organizationId, snap) => {
    const profile = await upsertFnbOrgSnapshot(organizationId, snap);
    if (profile.edition.toLowerCase() === "kafe") {
      await ensureKafeOpsSkeleton({
        organizationId,
        cafeName: "",
        activeModules: profile.activeModules,
      });
    }
  },
});
