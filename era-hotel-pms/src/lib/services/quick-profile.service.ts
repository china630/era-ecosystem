import { prisma } from '@/lib/prisma';
import { requestOrganizationId } from '@/lib/request-organization';

function profileCode(name: string): string {
  const base =
    name
      .toUpperCase()
      .replace(/[^A-Z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 16) || 'P';
  const suffix = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `${base}-${suffix}`.slice(0, 32);
}

/** Incomplete agency: name and phone only. No commission and no contract. */
export async function createQuickAgency(input: { name: string; phone: string }) {
  const name = input.name.trim();
  const phone = input.phone.trim();
  if (!name) throw new Error('Agency name is required');
  if (phone.length < 5) throw new Error('Agency phone is required');
  const organizationId = requestOrganizationId();
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      return await prisma.agency.create({
        data: {
          organizationId,
          code: profileCode(name),
          name,
          phone,
          active: true,
        },
      });
    } catch (err) {
      const code = (err as { code?: string }).code;
      if (code === 'P2002' && attempt < 2) continue;
      throw err;
    }
  }
  throw new Error('Could not allocate an agency code');
}

/** Incomplete company: name and VÖEN only. Settlement terms stay on the master screen. */
export async function createQuickCompany(input: { name: string; voen: string }) {
  const name = input.name.trim();
  const voen = input.voen.trim();
  if (!name) throw new Error('Company name is required');
  if (!/^\d{10}$/.test(voen)) throw new Error('VÖEN must be 10 digits');
  const organizationId = requestOrganizationId();
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      return await prisma.company.create({
        data: {
          organizationId,
          code: profileCode(name),
          name,
          voen,
          active: true,
        },
      });
    } catch (err) {
      const code = (err as { code?: string }).code;
      if (code === 'P2002' && attempt < 2) continue;
      throw err;
    }
  }
  throw new Error('Could not allocate a company code');
}
