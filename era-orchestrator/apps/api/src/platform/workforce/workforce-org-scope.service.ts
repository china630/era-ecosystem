import { Injectable } from "@nestjs/common";
import { UserRole } from "@era365/database";
import { PrismaService } from "../../prisma/prisma.service";
import { WorkforceOrgUnitsService } from "./workforce-org-units.service";

@Injectable()
export class WorkforceOrgScopeService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly orgUnits: WorkforceOrgUnitsService,
  ) {}

  /**
   * Returns orgUnit ids the actor may manage (DEPARTMENT_HEAD subtree).
   * Interim: match managerUserId or managerEmploymentId.platformUserId.
   */
  async resolveManagedOrgUnitIds(
    organizationId: string,
    userId: string,
    role: UserRole | undefined,
  ): Promise<string[] | null> {
    if (role !== UserRole.DEPARTMENT_HEAD) return null;

    const managed = await this.prisma.orgUnit.findMany({
      where: {
        OR: [
          { managerUserId: userId },
          {
            managerEmployment: {
              platformUserId: userId,
              organizationId,
            },
          },
        ],
        status: "ACTIVE",
      },
      select: { id: true },
    });
    if (managed.length === 0) return [];

    const ids = new Set<string>();
    for (const m of managed) {
      for (const id of await this.orgUnits.collectSubtreeIds(m.id)) {
        ids.add(id);
      }
    }
    return [...ids];
  }
}
