/**
 * Type-level mirror of the fail-closed tenant extension: create / createMany /
 * upsert.create may omit organizationId because the kit stamps it at runtime.
 *
 * Unique find/update/delete keep Prisma where types (call sites may use `as never`
 * for scalar business keys rewritten by the extension at runtime).
 */

export type WithOptionalOrganizationId<T> = T extends Date
  ? T
  : T extends Uint8Array
    ? T
    : T extends bigint
      ? T
      : T extends ReadonlyArray<infer U>
        ? ReadonlyArray<WithOptionalOrganizationId<U>>
        : T extends object
          ? {
              [K in keyof T as K extends "organizationId" ? never : K]: WithOptionalOrganizationId<
                T[K]
              >;
            } & ("organizationId" extends keyof T ? { organizationId?: string } : unknown)
          : T;

type WriteOp = "create" | "createMany" | "createManyAndReturn" | "upsert";

/** Loose write args: organizationId optional in create trees (runtime stamps). */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type LooseWriteFn = (args?: any, ...rest: any[]) => any;

type RelaxModelDelegate<D> = D extends object
  ? Omit<D, WriteOp> & {
      [M in Extract<keyof D, WriteOp>]: LooseWriteFn;
    }
  : D;

/**
 * Interactive transaction client: models are intentionally `any` so create trees
 * may omit organizationId (kit stamps). Prefer over re-using Prisma.TransactionClient.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type SatelliteTransactionClient = Record<string, any>;

type TransactionOverloads = {
  <R>(
    fn: (tx: SatelliteTransactionClient) => Promise<R>,
    options?: { maxWait?: number; timeout?: number; isolationLevel?: string },
  ): Promise<R>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (arg: readonly any[], options?: unknown): Promise<any>;
};

/**
 * Prisma client (or Nest PrismaService) with create-tree organizationId optional.
 * Runtime still stamps via createSatelliteTenantExtension.
 */
export type SatellitePrisma<C> = {
  [K in keyof C]: K extends "$transaction"
    ? TransactionOverloads
    : K extends `$${string}`
      ? C[K]
      : C[K] extends object
        ? RelaxModelDelegate<C[K]>
        : C[K];
};

/** Identity cast: extended client is SatellitePrisma at the type level. */
export function asSatellitePrisma<C>(client: C): SatellitePrisma<C> {
  return client as SatellitePrisma<C>;
}
