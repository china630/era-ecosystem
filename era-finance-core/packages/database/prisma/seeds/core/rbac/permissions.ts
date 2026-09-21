import { PermissionCategory } from "@prisma/client";
import type { SeedContext } from "../../_engine/upsert";
import {
  LEGACY_BARE_PERMISSION_CODES,
  PERMISSIONS,
} from "./permissions.data";

export async function seedPermissions(ctx: SeedContext): Promise<void> {
  if (ctx.dryRun) return;
  for (const row of PERMISSIONS) {
    await ctx.prisma.permission.upsert({
      where: { code: row.code },
      create: {
        code: row.code,
        category: PermissionCategory[row.category as keyof typeof PermissionCategory],
        description: row.description,
      },
      update: {
        category: PermissionCategory[row.category as keyof typeof PermissionCategory],
        description: row.description,
      },
    });
  }

  const legacy = [...LEGACY_BARE_PERMISSION_CODES];
  await ctx.prisma.rolePermission.deleteMany({
    where: { permission: { code: { in: legacy } } },
  });
  await ctx.prisma.permission.deleteMany({
    where: { code: { in: legacy } },
  });
}
