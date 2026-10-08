import fs from 'node:fs/promises';
import path from 'node:path';
import { prisma } from '@/lib/prisma';
import { requestOrganizationId } from '@/lib/request-organization';
import { emptyLetterhead, type ReportLetterhead } from '@/lib/reports/letterhead';

export type { ReportLetterhead } from '@/lib/reports/letterhead';

class ApiError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
    this.name = 'HotelLetterheadError';
  }
}

export const LOGO_MAX_BYTES = 512 * 1024;
const LOGO_MIME = new Map([
  ['image/png', 'png'],
  ['image/jpeg', 'jpg'],
]);

export function hotelDataDir(): string {
  return process.env.HOTEL_DATA_DIR?.trim() || path.join(process.cwd(), 'data');
}

function logoAbsolutePath(relative: string): string {
  const root = path.resolve(hotelDataDir());
  const full = path.resolve(root, relative);
  if (!full.startsWith(root + path.sep)) {
    throw new ApiError('Invalid logo path', 400);
  }
  return full;
}

function blankToNull(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

async function readLogo(relative: string | null): Promise<Buffer | null> {
  if (!relative) return null;
  try {
    return await fs.readFile(logoAbsolutePath(relative));
  } catch {
    return null;
  }
}

export async function getReportLetterhead(): Promise<ReportLetterhead> {
  const profile = await prisma.hotelProfile.findFirst({
    select: {
      name: true,
      printName: true,
      address: true,
      phone: true,
      email: true,
      website: true,
      logoPath: true,
    },
  });
  if (!profile) return emptyLetterhead();
  return {
    name: blankToNull(profile.printName) ?? profile.name ?? '',
    address: blankToNull(profile.address),
    phone: blankToNull(profile.phone),
    email: blankToNull(profile.email),
    website: blankToNull(profile.website),
    logo: await readLogo(profile.logoPath),
  };
}

export async function saveHotelLogo(input: { buffer: Buffer; mimeType: string }) {
  const ext = LOGO_MIME.get(input.mimeType);
  if (!ext) throw new ApiError('Logo must be PNG or JPEG', 400);
  if (input.buffer.length === 0) throw new ApiError('Logo file is empty', 400);
  if (input.buffer.length > LOGO_MAX_BYTES) throw new ApiError('Logo file is too large', 400);
  const isPng = input.buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
  const isJpeg = input.buffer[0] === 0xff && input.buffer[1] === 0xd8;
  if ((ext === 'png' && !isPng) || (ext === 'jpg' && !isJpeg)) {
    throw new ApiError('Logo content does not match its type', 400);
  }

  const { ensureHotelProfile } = await import('@/lib/services/hotel.service');
  const profile = await ensureHotelProfile();

  const organizationId = requestOrganizationId().replace(/[^a-zA-Z0-9_-]/g, '_');
  const relative = path.posix.join('hotel-logos', `${organizationId}.${ext}`);
  const full = logoAbsolutePath(relative);
  await fs.mkdir(path.dirname(full), { recursive: true });
  await fs.writeFile(full, input.buffer);
  if (profile.logoPath && profile.logoPath !== relative) {
    await fs.rm(logoAbsolutePath(profile.logoPath), { force: true }).catch(() => undefined);
  }
  return prisma.hotelProfile.update({ where: { id: profile.id }, data: { logoPath: relative } });
}

export async function deleteHotelLogo() {
  const { ensureHotelProfile } = await import('@/lib/services/hotel.service');
  const profile = await ensureHotelProfile();
  if (profile.logoPath) {
    await fs.rm(logoAbsolutePath(profile.logoPath), { force: true }).catch(() => undefined);
  }
  return prisma.hotelProfile.update({ where: { id: profile.id }, data: { logoPath: null } });
}

export async function readHotelLogo(): Promise<{ buffer: Buffer; mimeType: string } | null> {
  const profile = await prisma.hotelProfile.findFirst({ select: { logoPath: true } });
  const buffer = await readLogo(profile?.logoPath ?? null);
  if (!buffer || !profile?.logoPath) return null;
  return { buffer, mimeType: profile.logoPath.endsWith('.png') ? 'image/png' : 'image/jpeg' };
}
