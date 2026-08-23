import { resolveSatelliteTenantFilter } from "./satellite-tenant-context";
import { stampTenantCreateTree } from "./organization-id-guard";

export {
  assertTenantRawOrganizationId,
  assertTenantRawSqlMentionsOrg,
  SatelliteTenantRawSqlError,
} from "./tenant-raw-sql";
export {
  asSatellitePrisma,
  type SatellitePrisma,
  type SatelliteTransactionClient,
  type WithOptionalOrganizationId,
} from "./satellite-prisma-types";

type PrismaLike = {
  dmmf: {
    datamodel: {
      models: ReadonlyArray<{
        name: string;
        fields: ReadonlyArray<{ name: string; kind: string; type: string }>;
      }>;
    };
  };
  defineExtension: (args: unknown) => unknown;
};

export function mergeWhere(where: unknown, orgId: string): Record<string, unknown> {
  if (where == null || typeof where !== "object") {
    return { organizationId: orgId };
  }
  const w = where as Record<string, unknown>;
  return { AND: [{ organizationId: orgId }, w] };
}

/** Plain `{ a: 1 }` records only — Date / Decimal / Buffer stay unique scalars. */
function isPlainRecord(v: unknown): v is Record<string, unknown> {
  if (v === null || typeof v !== "object" || Array.isArray(v)) return false;
  const proto = Object.getPrototypeOf(v);
  return proto === Object.prototype || proto === null;
}

/**
 * findUnique / update / delete: Prisma needs a unique selector.
 * After @@unique([organizationId, code]), `{ code }` becomes `{ organizationId_code: { organizationId, code } }`.
 * Date values (BusinessDay.date) must remap the same way — they are objects but not compound selectors.
 */
export function mergeWhereForUnique(
  where: unknown,
  orgId: string,
): Record<string, unknown> {
  if (where == null || typeof where !== "object") {
    return { organizationId: orgId };
  }
  const w = where as Record<string, unknown>;
  const keys = Object.keys(w);

  if (keys.length === 2 && keys.includes("organizationId")) {
    const field = keys.find((k) => k !== "organizationId")!;
    const v = w[field];
    if (field !== "id" && !field.startsWith("organizationId_") && !isPlainRecord(v)) {
      return { [`organizationId_${field}`]: { organizationId: orgId, [field]: v } };
    }
  }

  if (keys.length === 1) {
    const k = keys[0];
    const v = w[k];
    if (k === "id") {
      return { id: v, organizationId: orgId };
    }
    if (k.startsWith("organizationId_") && isPlainRecord(v)) {
      return { [k]: { ...v, organizationId: orgId } };
    }
    if (isPlainRecord(v) && Object.prototype.hasOwnProperty.call(v, "organizationId")) {
      return { [k]: { ...v, organizationId: orgId } };
    }
    if (!isPlainRecord(v)) {
      return { [`organizationId_${k}`]: { organizationId: orgId, [k]: v } };
    }
  }
  return { ...w, organizationId: orgId };
}

function tenantModelNames(Prisma: PrismaLike, extraExclude: string[]): Set<string> {
  const exclude = new Set(extraExclude);
  return new Set(
    Prisma.dmmf.datamodel.models
      .filter((m) =>
        m.fields.some(
          (f) =>
            f.name === "organizationId" &&
            f.kind === "scalar" &&
            (f.type === "String" || f.type === "String?"),
        ),
      )
      .map((m) => m.name)
      .filter((n) => !exclude.has(n)),
  );
}

export function createSatelliteTenantExtension(
  Prisma: PrismaLike,
  opts: { excludeModels?: string[] } = {},
): unknown {
  const TENANT_MODELS = tenantModelNames(Prisma, opts.excludeModels ?? []);

  return Prisma.defineExtension({
    query: {
      $allModels: {
        async $allOperations({
          model,
          operation,
          args,
          query,
        }: {
          model: string;
          operation: string;
          args: Record<string, unknown> | undefined;
          query: (x: unknown) => Promise<unknown>;
        }) {
          if (!TENANT_MODELS.has(model)) {
            return query(args);
          }
          const filter = resolveSatelliteTenantFilter();
          if (filter.mode === "skip") {
            return query(args);
          }
          const orgId = filter.organizationId;
          const a = (args ?? {}) as Record<string, unknown>;

          switch (operation) {
            case "findMany":
            case "count":
            case "aggregate":
            case "groupBy":
            case "updateMany":
            case "deleteMany":
            case "findFirst":
            case "findFirstOrThrow":
              return query({ ...a, where: mergeWhere(a.where, orgId) });
            case "findUnique":
            case "findUniqueOrThrow":
            case "update":
            case "delete":
              return query({ ...a, where: mergeWhereForUnique(a.where, orgId) });
            case "create": {
              return query({
                ...a,
                data: stampTenantCreateTree(a.data ?? {}, orgId),
              });
            }
            case "createMany":
            case "createManyAndReturn": {
              return query({
                ...a,
                data: stampTenantCreateTree(a.data, orgId),
              });
            }
            case "upsert": {
              return query({
                ...a,
                where: mergeWhereForUnique(a.where, orgId),
                create: stampTenantCreateTree(a.create ?? {}, orgId),
                update: a.update,
              });
            }
            default:
              return query(args);
          }
        },
      },
    },
  });
}
