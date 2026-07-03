import { ForbiddenException, Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";

@Injectable()
export class DepartmentHeadScopeService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Resolves managed department for DEPARTMENT_HEAD via stable CP employment id mirror.
   */
  async resolveManagedDepartmentId(
    organizationId: string,
    userId: string,
  ): Promise<string> {
    const ids = await this.resolveManagedDepartmentIds(organizationId, userId);
    if (ids.length !== 1) {
      throw new ForbiddenException(
        "DEPARTMENT_HEAD must be assigned to exactly one managed department",
      );
    }
    return ids[0];
  }

  async resolveManagedDepartmentIds(
    organizationId: string,
    userId: string,
  ): Promise<string[]> {
    const employee = await this.prisma.employee.findFirst({
      where: { organizationId, userId, deletedAt: null },
      select: { id: true, cpEmploymentId: true },
    });
    if (!employee?.cpEmploymentId) {
      throw new ForbiddenException(
        "DEPARTMENT_HEAD profile is not linked to a CP employment",
      );
    }

    const managedRoots = await this.prisma.department.findMany({
      where: {
        organizationId,
        deletedAt: null,
        managerEmploymentId: employee.cpEmploymentId,
      },
      select: { id: true },
    });
    if (managedRoots.length === 0) {
      throw new ForbiddenException(
        "DEPARTMENT_HEAD is not mapped as manager of any department",
      );
    }

    const all = await this.prisma.department.findMany({
      where: { organizationId, deletedAt: null },
      select: { id: true, parentId: true },
    });
    const byParent = new Map<string | null, string[]>();
    for (const d of all) {
      const key = d.parentId;
      const arr = byParent.get(key) ?? [];
      arr.push(d.id);
      byParent.set(key, arr);
    }

    const out = new Set<string>();
    for (const root of managedRoots) {
      const stack = [root.id];
      while (stack.length) {
        const cur = stack.pop()!;
        out.add(cur);
        for (const child of byParent.get(cur) ?? []) stack.push(child);
      }
    }
    return [...out];
  }
}
