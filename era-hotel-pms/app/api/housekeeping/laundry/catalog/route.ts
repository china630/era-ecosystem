import { z } from 'zod';
import { jsonOk, handleRouteError } from '@/lib/api-utils';
import { serialize } from '@/lib/serialize';
import { getSatelliteSession } from '@/lib/auth/session';
import { assertPermission } from '@/lib/auth/require';
import { PERMISSIONS } from '@/lib/auth/permissions';
import { ensureNaftaLaundryCatalog } from '@/lib/services/hk-nafta.service';
import { prisma } from '@/lib/prisma';
import { toDecimal } from '@/lib/decimal';

const priceSchema = z.number().finite().positive().nullable();

const itemBody = z.object({
  code: z.string().min(1).max(40),
  nameAz: z.string().min(1).max(120),
  nameRu: z.string().min(1).max(120),
  nameEn: z.string().min(1).max(120),
  category: z.enum(['MEN', 'WOMEN', 'CHILD']),
  washPrice: priceSchema,
  ironPrice: priceSchema,
  expressWashPrice: priceSchema,
  expressIronPrice: priceSchema,
  active: z.boolean().optional(),
});

function assertExpressPrices(data: z.infer<typeof itemBody>) {
  if (data.expressWashPrice != null && data.washPrice == null) {
    throw Object.assign(new Error('Express wash requires a regular wash price'), { status: 400 });
  }
  if (data.expressIronPrice != null && data.ironPrice == null) {
    throw Object.assign(new Error('Express iron requires a regular iron price'), { status: 400 });
  }
  if (data.washPrice == null && data.ironPrice == null) {
    throw Object.assign(new Error('At least one of wash or iron price is required'), { status: 400 });
  }
}

function priceData(data: z.infer<typeof itemBody>) {
  return {
    washPrice: data.washPrice == null ? null : toDecimal(data.washPrice),
    ironPrice: data.ironPrice == null ? null : toDecimal(data.ironPrice),
    expressWashPrice: data.expressWashPrice == null ? null : toDecimal(data.expressWashPrice),
    expressIronPrice: data.expressIronPrice == null ? null : toDecimal(data.expressIronPrice),
  };
}

export async function GET() {
  try {
    const session = await getSatelliteSession();
    assertPermission(session, PERMISSIONS.HOUSEKEEPING_MANAGE);
    await ensureNaftaLaundryCatalog();
    const items = await prisma.laundryItem.findMany({ orderBy: [{ category: 'asc' }, { code: 'asc' }] });
    return jsonOk(serialize({ items }));
  } catch (err) {
    return handleRouteError(err);
  }
}

export async function POST(request: Request) {
  try {
    const session = await getSatelliteSession();
    assertPermission(session, PERMISSIONS.HOUSEKEEPING_MANAGE);
    const data = itemBody.parse(await request.json());
    assertExpressPrices(data);
    const item = await prisma.laundryItem.create({
      data: {
        code: data.code.trim().toUpperCase(),
        name: data.nameEn.trim(),
        nameAz: data.nameAz.trim(),
        nameRu: data.nameRu.trim(),
        nameEn: data.nameEn.trim(),
        category: data.category,
        active: data.active ?? true,
        ...priceData(data),
      },
    });
    return jsonOk(serialize(item));
  } catch (err) {
    return handleRouteError(err);
  }
}

const patchBody = itemBody.partial().extend({
  id: z.string().uuid(),
});

export async function PATCH(request: Request) {
  try {
    const session = await getSatelliteSession();
    assertPermission(session, PERMISSIONS.HOUSEKEEPING_MANAGE);
    const raw = patchBody.parse(await request.json());
    const existing = await prisma.laundryItem.findUnique({ where: { id: raw.id } });
    if (!existing) {
      return Response.json({ error: 'Not found' }, { status: 404 });
    }
    const merged = {
      code: raw.code ?? existing.code,
      nameAz: raw.nameAz ?? existing.nameAz ?? existing.name,
      nameRu: raw.nameRu ?? existing.nameRu ?? existing.name,
      nameEn: raw.nameEn ?? existing.nameEn ?? existing.name,
      category: (raw.category ?? existing.category) as 'MEN' | 'WOMEN' | 'CHILD',
      washPrice:
        raw.washPrice !== undefined
          ? raw.washPrice
          : existing.washPrice == null
            ? null
            : Number(existing.washPrice),
      ironPrice:
        raw.ironPrice !== undefined
          ? raw.ironPrice
          : existing.ironPrice == null
            ? null
            : Number(existing.ironPrice),
      expressWashPrice:
        raw.expressWashPrice !== undefined
          ? raw.expressWashPrice
          : existing.expressWashPrice == null
            ? null
            : Number(existing.expressWashPrice),
      expressIronPrice:
        raw.expressIronPrice !== undefined
          ? raw.expressIronPrice
          : existing.expressIronPrice == null
            ? null
            : Number(existing.expressIronPrice),
      active: raw.active ?? existing.active,
    };
    assertExpressPrices(merged);
    const item = await prisma.laundryItem.update({
      where: { id: raw.id },
      data: {
        code: merged.code.trim().toUpperCase(),
        name: merged.nameEn.trim(),
        nameAz: merged.nameAz.trim(),
        nameRu: merged.nameRu.trim(),
        nameEn: merged.nameEn.trim(),
        category: merged.category,
        active: merged.active,
        ...priceData(merged),
      },
    });
    return jsonOk(serialize(item));
  } catch (err) {
    return handleRouteError(err);
  }
}
