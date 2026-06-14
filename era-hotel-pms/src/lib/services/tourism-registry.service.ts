import { prisma } from '@/lib/prisma';

const REGISTRY_URL = process.env.TOURISM_REGISTRY_URL?.replace(/\/$/, '');
const REGISTRY_TOKEN = process.env.TOURISM_REGISTRY_TOKEN?.trim();
const MOCK = process.env.TOURISM_REGISTRY_MOCK !== 'false';

export type RegistrySubmitResult = {
  mode: 'mock' | 'live';
  externalRef: string;
  status: 'SUBMITTED' | 'REJECTED';
  responseNote?: string;
};

export async function submitMigrationToRegistry(registrationId: string): Promise<RegistrySubmitResult> {
  const row = await prisma.migrationRegistration.findUnique({
    where: { id: registrationId },
    include: { guest: true },
  });
  if (!row) throw new Error('Registration not found');

  const payload = row.payloadJson ? JSON.parse(row.payloadJson) : {};

  if (MOCK || !REGISTRY_URL || !REGISTRY_TOKEN) {
    const externalRef = `mock-tourism-${Date.now()}`;
    await prisma.migrationRegistration.update({
      where: { id: registrationId },
      data: {
        status: 'SUBMITTED',
        submittedAt: new Date(),
        externalRef,
        registryResponseJson: JSON.stringify({ mode: 'mock', accepted: true }),
      },
    });
    return { mode: 'mock', externalRef, status: 'SUBMITTED' };
  }

  const res = await fetch(`${REGISTRY_URL}/api/v1/registrations`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${REGISTRY_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });
  const body = await res.json().catch(() => ({}));
  const externalRef = (body as { id?: string }).id ?? `live-${Date.now()}`;
  const status = res.ok ? 'SUBMITTED' : 'REJECTED';

  await prisma.migrationRegistration.update({
    where: { id: registrationId },
    data: {
      status: status === 'SUBMITTED' ? 'SUBMITTED' : 'REJECTED',
      submittedAt: new Date(),
      externalRef,
      registryResponseJson: JSON.stringify(body),
      responseNote: res.ok ? null : `HTTP ${res.status}`,
    },
  });

  return {
    mode: 'live',
    externalRef,
    status: status as 'SUBMITTED' | 'REJECTED',
    responseNote: res.ok ? undefined : `HTTP ${res.status}`,
  };
}

export async function exportMigrationPayload(registrationId: string) {
  const row = await prisma.migrationRegistration.findUnique({ where: { id: registrationId } });
  if (!row?.payloadJson) throw new Error('No payload');
  return JSON.parse(row.payloadJson) as Record<string, unknown>;
}
