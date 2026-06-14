import type { Prisma } from '@prisma/client';
import type { Permission } from '@/lib/auth/permissions';
import type { z } from 'zod';

export type UpsertOutcome = 'created' | 'updated' | 'skipped';

export type ImportTx = Omit<
  Prisma.TransactionClient,
  '$connect' | '$disconnect' | '$on' | '$transaction' | '$extends'
>;

export type ImportRowError = {
  row: number;
  message: string;
};

export type ImportResult = {
  entity: string;
  label: string;
  dryRun: boolean;
  totalRows: number;
  created: number;
  updated: number;
  skipped: number;
  errors: ImportRowError[];
};

export type ImportAdapter<T> = {
  entity: string;
  label: string;
  order: number;
  permission: Permission;
  templateHint: string;
  /** When true, import runs without Excel upload (bootstrap scripts). */
  fileless?: boolean;
  headerAliases: Record<string, string>;
  rowSchema: z.ZodType<T>;
  mapRow: (raw: Record<string, unknown>) => unknown;
  upsert: (tx: ImportTx, row: T, dryRun: boolean) => Promise<UpsertOutcome>;
};

export type ImportEntityMeta = {
  entity: string;
  label: string;
  order: number;
  templateHint: string;
  fileless?: boolean;
};
