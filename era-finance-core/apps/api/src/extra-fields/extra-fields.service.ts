import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { Prisma } from "@erafinance/database";
import {
  EXTRA_ENTITY_FINANCE_INVOICE,
  assertExtraFieldKey,
  defaultCatalogFieldKind,
  normalizeExtraAttributes,
  type ExtraFieldDefinitionView,
  type ExtraFieldValueKind,
} from "@era/satellite-kit";
import { PrismaService } from "../prisma/prisma.service";
import type {
  CreateExtraFieldDefinitionDto,
  PatchExtraFieldDefinitionDto,
} from "./dto/extra-field.dto";

const MAX_DEFS = 20;
const OPTION_VALUE_RE = /^[A-Za-z0-9._-]{1,64}$/;

type DefRow = {
  key: string;
  valueKind: string;
  catalogFieldKind: string;
  required: boolean;
  active: boolean;
  optionsJson: Prisma.JsonValue | null;
};

@Injectable()
export class ExtraFieldsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(organizationId: string, entityType: string) {
    this.assertEntityType(entityType);
    return this.prisma.extraFieldDefinition.findMany({
      where: { organizationId, entityType },
      orderBy: [{ sortOrder: "asc" }, { key: "asc" }],
    });
  }

  async create(organizationId: string, dto: CreateExtraFieldDefinitionDto) {
    this.assertEntityType(dto.entityType);
    const key = dto.key.trim();
    const keyIssue = assertExtraFieldKey(key);
    if (keyIssue && !keyIssue.ok) {
      throw new BadRequestException(keyIssue.issue);
    }
    const labelAz = dto.labelAz.trim();
    const labelEn = dto.labelEn.trim();
    const labelRu = dto.labelRu.trim();
    if (!labelAz || !labelEn || !labelRu) {
      throw new BadRequestException({
        code: "EXTRA_FIELD_TYPE",
        keys: ["label"],
        message: "Labels must not be empty",
      });
    }
    const optionsJson = this.sanitizeOptions(dto.valueKind, dto.options);
    const count = await this.prisma.extraFieldDefinition.count({
      where: { organizationId, entityType: dto.entityType },
    });
    if (count >= MAX_DEFS) {
      throw new BadRequestException({
        code: "EXTRA_FIELD_KEY",
        keys: [],
        message: `At most ${MAX_DEFS} extra fields per entity`,
      });
    }
    const catalogFieldKind = defaultCatalogFieldKind(dto.valueKind);
    try {
      return await this.prisma.extraFieldDefinition.create({
        data: {
          organizationId,
          entityType: dto.entityType,
          key,
          valueKind: dto.valueKind,
          catalogFieldKind,
          labelAz,
          labelEn,
          labelRu,
          required: !!dto.required,
          sortOrder: dto.sortOrder ?? count,
          optionsJson,
        },
      });
    } catch (e) {
      if (
        e instanceof Prisma.PrismaClientKnownRequestError &&
        e.code === "P2002"
      ) {
        throw new BadRequestException({
          code: "EXTRA_FIELD_KEY",
          keys: [key],
          message: "Extra field key already exists",
        });
      }
      throw e;
    }
  }

  async patch(
    organizationId: string,
    id: string,
    dto: PatchExtraFieldDefinitionDto,
  ) {
    const existing = await this.prisma.extraFieldDefinition.findFirst({
      where: { id, organizationId },
    });
    if (!existing) throw new NotFoundException("Extra field not found");
    for (const label of [dto.labelAz, dto.labelEn, dto.labelRu]) {
      if (label !== undefined && !label.trim()) {
        throw new BadRequestException({
          code: "EXTRA_FIELD_TYPE",
          keys: ["label"],
          message: "Labels must not be empty",
        });
      }
    }
    if (dto.options !== undefined && existing.valueKind !== "SELECT") {
      throw new BadRequestException({
        code: "EXTRA_FIELD_TYPE",
        keys: ["options"],
        message: "Options are only valid on SELECT fields",
      });
    }
    return this.prisma.extraFieldDefinition.update({
      where: { id },
      data: {
        ...(dto.labelAz !== undefined ? { labelAz: dto.labelAz.trim() } : {}),
        ...(dto.labelEn !== undefined ? { labelEn: dto.labelEn.trim() } : {}),
        ...(dto.labelRu !== undefined ? { labelRu: dto.labelRu.trim() } : {}),
        ...(dto.required !== undefined ? { required: dto.required } : {}),
        ...(dto.active !== undefined ? { active: dto.active } : {}),
        ...(dto.sortOrder !== undefined ? { sortOrder: dto.sortOrder } : {}),
        ...(dto.options !== undefined
          ? {
              optionsJson: this.sanitizeOptions("SELECT", dto.options),
            }
          : {}),
      },
    });
  }

  async normalizeForEntity(
    organizationId: string,
    entityType: string,
    raw: unknown,
  ): Promise<Record<string, unknown>> {
    const rows = await this.prisma.extraFieldDefinition.findMany({
      where: { organizationId, entityType },
    });
    const result = normalizeExtraAttributes(rows.map(toView), raw ?? {});
    if (!result.ok) {
      throw new BadRequestException(result.issue);
    }
    return result.value;
  }

  async putInvoiceAttributes(
    organizationId: string,
    invoiceId: string,
    raw: unknown,
  ) {
    const inv = await this.prisma.invoice.findFirst({
      where: { id: invoiceId, organizationId },
      select: { id: true, status: true },
    });
    if (!inv) throw new NotFoundException("Invoice not found");
    if (inv.status === "CANCELLED" || inv.status === "LOCKED_BY_SIGNATURE") {
      throw new BadRequestException("Invoice cannot be edited");
    }
    const extraAttributes = await this.normalizeForEntity(
      organizationId,
      EXTRA_ENTITY_FINANCE_INVOICE,
      raw,
    );
    return this.prisma.invoice.update({
      where: { id: invoiceId, organizationId },
      data: {
        extraAttributes: extraAttributes as Prisma.InputJsonValue,
      },
      select: { id: true, extraAttributes: true },
    });
  }

  private sanitizeOptions(
    valueKind: string,
    options: CreateExtraFieldDefinitionDto["options"],
  ): Prisma.InputJsonValue | typeof Prisma.JsonNull {
    if (valueKind !== "SELECT") {
      if (options?.length) {
        throw new BadRequestException({
          code: "EXTRA_FIELD_TYPE",
          keys: ["options"],
          message: "Options are only valid on SELECT fields",
        });
      }
      return Prisma.JsonNull;
    }
    const cleaned = (options ?? [])
      .map((o) => ({
        value: o.value.trim(),
        labelAz: (o.labelAz ?? o.value).trim(),
        labelEn: (o.labelEn ?? o.value).trim(),
        labelRu: (o.labelRu ?? o.value).trim(),
      }))
      .filter((o) => o.value.length > 0);
    if (cleaned.length === 0) {
      throw new BadRequestException({
        code: "EXTRA_FIELD_TYPE",
        keys: ["options"],
        message: "SELECT fields require options",
      });
    }
    const seen = new Set<string>();
    for (const o of cleaned) {
      if (!OPTION_VALUE_RE.test(o.value)) {
        throw new BadRequestException({
          code: "EXTRA_FIELD_TYPE",
          keys: ["options"],
          message: `Invalid option value: ${o.value}`,
        });
      }
      if (seen.has(o.value)) {
        throw new BadRequestException({
          code: "EXTRA_FIELD_TYPE",
          keys: ["options"],
          message: "Duplicate SELECT options",
        });
      }
      seen.add(o.value);
    }
    return cleaned as unknown as Prisma.InputJsonValue;
  }

  private assertEntityType(entityType: string) {
    if (entityType !== EXTRA_ENTITY_FINANCE_INVOICE) {
      throw new BadRequestException({
        code: "EXTRA_FIELD_KEY",
        keys: [entityType],
        message: "Unsupported extra-field entity type",
      });
    }
  }
}

function toView(row: DefRow): ExtraFieldDefinitionView {
  const optionsRaw = row.optionsJson;
  const options = Array.isArray(optionsRaw)
    ? optionsRaw
        .map((o) => {
          if (o && typeof o === "object" && "value" in o) {
            const v = (o as { value: unknown }).value;
            return typeof v === "string" ? { value: v } : null;
          }
          return null;
        })
        .filter((x): x is { value: string } => x != null)
    : undefined;
  return {
    key: row.key,
    valueKind: row.valueKind as ExtraFieldValueKind,
    catalogFieldKind: row.catalogFieldKind as ExtraFieldDefinitionView["catalogFieldKind"],
    required: row.required,
    active: row.active,
    options,
  };
}
