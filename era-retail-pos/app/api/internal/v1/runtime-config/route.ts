import { createRuntimeConfigHandlers } from "@era/satellite-kit";
import { prisma } from "@/lib/prisma";

export const { GET, POST } = createRuntimeConfigHandlers({
  getPrisma: () => prisma,
});
