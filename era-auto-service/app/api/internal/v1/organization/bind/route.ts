import { createOrganizationBindHandlers } from "@era/satellite-kit";
import { prisma } from "@/lib/prisma";

export const { GET, POST } = createOrganizationBindHandlers({
  getPrisma: () => prisma,
});
