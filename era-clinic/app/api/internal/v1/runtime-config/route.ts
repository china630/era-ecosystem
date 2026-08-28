import { createRuntimeConfigHandlers } from "@era/satellite-kit";
import { prisma } from "@/lib/prisma";
import { upsertClinicCutoverPolicy } from "@/domain/physio/clinic-cutover.service";

export const { GET, POST } = createRuntimeConfigHandlers({
  getPrisma: () => prisma,
  onClinicCutover: async (organizationId, policy) => {
    await upsertClinicCutoverPolicy(organizationId, policy);
  },
});
