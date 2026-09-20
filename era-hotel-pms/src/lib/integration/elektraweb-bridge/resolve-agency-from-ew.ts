import { slugCode } from '@/lib/import/helpers';
import { bridgeRequestOrganizationId } from '@/lib/integration/elektraweb-bridge/config';
import { str } from '@/lib/integration/elektraweb-bridge/normalize';
import { prisma } from '@/lib/prisma';

/**
 * FOCP / Guest Card rows expose agency under several keys.
 * Prefer human label over numeric AGENCYID.
 */
export function agencyLabelFromElektrawebRow(
  row: Record<string, unknown>,
): string | null {
  return (
    str(row.AGENCY) ??
    str(row.AGENCYNAME) ??
    str(row.AGENCY_NAME) ??
    str(row.AGENCYID_AGENCY) ??
    str(row.AGENCYID_AGENCYNAME) ??
    str(row.AGENCYID_AGENCYCODE) ??
    str(row.AGENCYCODE) ??
    str(row.COMPANY) ??
    str(row.COMPANYNAME) ??
    null
  );
}

type AgencyTx = {
  agency: {
    findFirst: (args: {
      where: Record<string, unknown>;
    }) => Promise<{ id: string; code: string; name: string } | null>;
    create: (args: {
      data: {
        organizationId: string;
        code: string;
        name: string;
        active: boolean;
      };
    }) => Promise<{ id: string; code: string; name: string }>;
  };
};

/**
 * Match Excel/agency-statement style: code slug or exact name, else create.
 * Avoids loose `contains` that missed "Vita Travel medical" when catalog empty
 * and could attach the wrong row for short labels.
 */
export async function resolveOrCreateAgencyIdFromLabel(
  label: string,
  db: AgencyTx = prisma as unknown as AgencyTx,
  organizationId: string = bridgeRequestOrganizationId(),
): Promise<string> {
  const name = label.trim();
  if (!name) {
    throw new Error('Agency label is empty');
  }
  const code = slugCode(name);

  const existing = await db.agency.findFirst({
    where: {
      organizationId,
      OR: [
        { code: { equals: code, mode: 'insensitive' } },
        { name: { equals: name, mode: 'insensitive' } },
      ],
    },
  });
  if (existing) return existing.id;

  const created = await db.agency.create({
    data: {
      organizationId,
      code,
      name,
      active: true,
    },
  });
  return created.id;
}

export async function resolveAgencyIdFromElektrawebRow(
  row: Record<string, unknown>,
  db: AgencyTx = prisma as unknown as AgencyTx,
): Promise<string | undefined> {
  const label = agencyLabelFromElektrawebRow(row);
  if (!label) return undefined;
  return resolveOrCreateAgencyIdFromLabel(label, db);
}
