import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { Prisma, type UserRole } from "@erafinance/database";
import {
  assertSavedListViewGridKey,
  normalizeSavedListView,
} from "@era/satellite-kit";
import { PrismaService } from "../prisma/prisma.service";
import {
  INVOICE_LIST_GRID_KEY,
  INVOICE_LIST_VIEW_SCHEMA,
} from "./invoice-list-view.schema";
import { assertInvoiceListFilterValues } from "./invoice-list-filters";
import type {
  CreateSavedListViewDto,
  PatchSavedListViewDto,
} from "./dto/saved-list-view.dto";

const MAX_PER_USER = 10;
const MAX_SHARED_PER_ORG = 5;
const ALLOWED_GRIDS = [INVOICE_LIST_GRID_KEY] as const;

@Injectable()
export class SavedListViewsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(organizationId: string, userId: string, gridKey?: string) {
    const key = (gridKey?.trim() || INVOICE_LIST_GRID_KEY) as string;
    const gridIssue = assertSavedListViewGridKey(key, ALLOWED_GRIDS);
    if (gridIssue && !gridIssue.ok) {
      throw new BadRequestException(gridIssue.issue);
    }
    return this.prisma.savedListView.findMany({
      where: {
        organizationId,
        gridKey: key,
        OR: [{ userId }, { isShared: true }],
      },
      orderBy: [{ isDefault: "desc" }, { name: "asc" }],
    });
  }

  async create(
    organizationId: string,
    userId: string,
    role: UserRole | null,
    dto: CreateSavedListViewDto,
  ) {
    const gridIssue = assertSavedListViewGridKey(dto.gridKey, ALLOWED_GRIDS);
    if (gridIssue && !gridIssue.ok) {
      throw new BadRequestException(gridIssue.issue);
    }
    const name = dto.name.trim();
    if (!name) {
      throw new BadRequestException("Name is required");
    }
    const config = this.normalizeConfig(dto.config);
    const isShared = !!dto.isShared;
    if (isShared && role !== "OWNER" && role !== "ADMIN") {
      throw new ForbiddenException("Only OWNER/ADMIN can share views");
    }

    const ownCount = await this.prisma.savedListView.count({
      where: { organizationId, userId, gridKey: dto.gridKey },
    });
    if (ownCount >= MAX_PER_USER) {
      throw new BadRequestException({
        code: "SAVED_VIEW_TYPE",
        keys: [],
        message: `At most ${MAX_PER_USER} views per user per grid`,
      });
    }
    if (isShared) {
      await this.assertSharedCap(organizationId, dto.gridKey);
    }

    try {
      return await this.prisma.$transaction(async (tx) => {
        if (dto.isDefault) {
          await tx.savedListView.updateMany({
            where: { organizationId, userId, gridKey: dto.gridKey, isDefault: true },
            data: { isDefault: false },
          });
        }
        return tx.savedListView.create({
          data: {
            organizationId,
            userId,
            gridKey: dto.gridKey,
            name,
            isShared,
            isDefault: !!dto.isDefault,
            configJson: config as Prisma.InputJsonValue,
          },
        });
      });
    } catch (e) {
      if (
        e instanceof Prisma.PrismaClientKnownRequestError &&
        e.code === "P2002"
      ) {
        throw new BadRequestException({
          code: "SAVED_VIEW_TYPE",
          keys: ["name"],
          message: "A view with this name already exists",
        });
      }
      throw e;
    }
  }

  async patch(
    organizationId: string,
    userId: string,
    role: UserRole | null,
    id: string,
    dto: PatchSavedListViewDto,
  ) {
    const existing = await this.prisma.savedListView.findFirst({
      where: { id, organizationId },
    });
    if (!existing) throw new NotFoundException("Saved view not found");
    if (existing.userId !== userId) {
      throw new ForbiddenException("Only the owner can edit this view");
    }

    const isShared =
      dto.isShared !== undefined ? !!dto.isShared : existing.isShared;
    if (isShared && role !== "OWNER" && role !== "ADMIN") {
      throw new ForbiddenException("Only OWNER/ADMIN can share views");
    }
    if (isShared && !existing.isShared) {
      await this.assertSharedCap(organizationId, existing.gridKey);
    }

    const name =
      dto.name !== undefined ? dto.name.trim() : existing.name;
    if (!name) {
      throw new BadRequestException("Name is required");
    }

    const config =
      dto.config !== undefined
        ? this.normalizeConfig(dto.config)
        : (existing.configJson as Record<string, unknown>);

    try {
      return await this.prisma.$transaction(async (tx) => {
        if (dto.isDefault === true) {
          await tx.savedListView.updateMany({
            where: {
              organizationId,
              userId,
              gridKey: existing.gridKey,
              isDefault: true,
            },
            data: { isDefault: false },
          });
        }
        return tx.savedListView.update({
          where: { id },
          data: {
            name,
            isShared,
            ...(dto.isDefault !== undefined ? { isDefault: dto.isDefault } : {}),
            ...(dto.config !== undefined
              ? { configJson: config as Prisma.InputJsonValue }
              : {}),
          },
        });
      });
    } catch (e) {
      if (
        e instanceof Prisma.PrismaClientKnownRequestError &&
        e.code === "P2002"
      ) {
        throw new BadRequestException({
          code: "SAVED_VIEW_TYPE",
          keys: ["name"],
          message: "A view with this name already exists",
        });
      }
      throw e;
    }
  }

  async remove(organizationId: string, userId: string, id: string) {
    const existing = await this.prisma.savedListView.findFirst({
      where: { id, organizationId },
    });
    if (!existing) throw new NotFoundException("Saved view not found");
    if (existing.userId !== userId) {
      throw new ForbiddenException("Only the owner can delete this view");
    }
    await this.prisma.savedListView.delete({ where: { id } });
    return { ok: true };
  }

  private normalizeConfig(raw: unknown): Record<string, unknown> {
    const result = normalizeSavedListView(INVOICE_LIST_VIEW_SCHEMA, raw);
    if (!result.ok) {
      throw new BadRequestException(result.issue);
    }
    assertInvoiceListFilterValues(result.value.filters);
    return result.value as unknown as Record<string, unknown>;
  }

  private async assertSharedCap(organizationId: string, gridKey: string) {
    const sharedCount = await this.prisma.savedListView.count({
      where: { organizationId, gridKey, isShared: true },
    });
    if (sharedCount >= MAX_SHARED_PER_ORG) {
      throw new BadRequestException({
        code: "SAVED_VIEW_TYPE",
        keys: [],
        message: `At most ${MAX_SHARED_PER_ORG} shared views per org per grid`,
      });
    }
  }
}
