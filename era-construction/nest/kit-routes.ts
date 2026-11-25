import { createOrganizationBindHandlers, createRuntimeConfigHandlers } from "@era/satellite-kit";
import { prisma } from "@/lib/prisma";

export const runtimeConfig = createRuntimeConfigHandlers({
  getPrisma: () => prisma,
});

export const organizationBind = createOrganizationBindHandlers({
  getPrisma: () => prisma,
});
