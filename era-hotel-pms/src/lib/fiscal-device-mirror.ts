import { listDevices } from '@era/fiscal';
import {
  hydrateFiscalDevicesFromSync,
  resolveControlPlaneBearerToken,
  resolveOrchestratorBaseUrl,
  type FiscalDeviceSyncRow,
} from '@era/satellite-kit';
import { prisma } from '@/lib/prisma';

function isFiscalSyncRow(row: unknown): row is FiscalDeviceSyncRow {
  if (!row || typeof row !== 'object') return false;
  const candidate = row as FiscalDeviceSyncRow;
  return (
    typeof candidate.id === 'string' &&
    typeof candidate.organizationId === 'string' &&
    (candidate.kind === 'FISCAL_KKM' || candidate.kind === 'BANK_POS') &&
    (candidate.status === 'active' || candidate.status === 'retired')
  );
}

function toSyncRow(row: {
  id: string;
  organizationId: string;
  kind: string;
  providerId: string;
  label: string;
  outletCode: string | null;
  registerCode: string | null;
  serial: string | null;
  endpoint: string | null;
  status: string;
  isOrgDefault: boolean;
}): FiscalDeviceSyncRow | null {
  if (row.kind !== 'FISCAL_KKM' && row.kind !== 'BANK_POS') return null;
  if (row.status !== 'active' && row.status !== 'retired') return null;
  return {
    id: row.id,
    organizationId: row.organizationId,
    kind: row.kind,
    providerId: row.providerId,
    label: row.label,
    outletCode: row.outletCode,
    registerCode: row.registerCode,
    serial: row.serial,
    endpoint: row.endpoint,
    status: row.status,
    isOrgDefault: row.isOrgDefault,
  };
}

export async function replaceFiscalDeviceMirror(
  organizationId: string,
  rows: FiscalDeviceSyncRow[],
): Promise<void> {
  const mine = rows.filter((row) => row.organizationId === organizationId);
  await prisma.$transaction([
    prisma.fiscalDeviceMirror.deleteMany({ where: { organizationId } }),
    ...(mine.length
      ? [
          prisma.fiscalDeviceMirror.createMany({
            data: mine.map((row) => ({
              id: row.id,
              organizationId,
              kind: row.kind,
              providerId: row.providerId,
              label: row.label,
              outletCode: row.outletCode ?? null,
              registerCode: row.registerCode ?? null,
              serial: row.serial ?? null,
              endpoint: row.endpoint ?? null,
              status: row.status,
              isOrgDefault: Boolean(row.isOrgDefault),
            })),
          }),
        ]
      : []),
  ]);
  hydrateFiscalDevicesFromSync(organizationId, mine);
}

async function hydrateFromDatabase(organizationId: string): Promise<boolean> {
  const rows = await prisma.fiscalDeviceMirror.findMany({ where: { organizationId } });
  const synced = rows.map(toSyncRow).filter((row): row is FiscalDeviceSyncRow => row != null);
  if (synced.length === 0) return false;
  hydrateFiscalDevicesFromSync(organizationId, synced);
  return true;
}

async function pullFromOrchestrator(organizationId: string): Promise<void> {
  const token = resolveControlPlaneBearerToken();
  const base = resolveOrchestratorBaseUrl({ fallback: '' }).replace(/\/$/, '');
  if (!token || !base) return;
  const url = new URL(`${base}/v1/internal/satellites/desired-state`);
  url.searchParams.set('satelliteKey', 'industry_hotel_pms');
  const res = await fetch(url.toString(), {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${token}`,
      'X-Organization-Id': organizationId,
      Accept: 'application/json',
    },
    signal: AbortSignal.timeout(8000),
  });
  if (!res.ok) return;
  const body = (await res.json()) as { config?: { fiscalDevices?: unknown[] } };
  const devices = body.config?.fiscalDevices;
  if (!Array.isArray(devices)) return;
  await replaceFiscalDeviceMirror(organizationId, devices.filter(isFiscalSyncRow));
}

/** Memory, then the hotel database, then one pull from the orchestrator. */
export async function ensureFiscalDevices(organizationId: string): Promise<void> {
  const orgId = organizationId.trim();
  if (!orgId) return;
  const cached = listDevices({ organizationId: orgId });
  if (cached.some((device) => device.kind === 'BANK_POS' && device.status === 'active')) return;
  if (await hydrateFromDatabase(orgId)) return;
  try {
    await pullFromOrchestrator(orgId);
  } catch (err) {
    console.warn(
      'Fiscal device pull failed',
      err instanceof Error ? err.message : err,
    );
  }
}
