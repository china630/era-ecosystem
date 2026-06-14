import { z } from 'zod';
import { jsonOk, handleRouteError } from '@/lib/api-utils';
import {
  listCompatibilityRules,
  createCompatibilityRule,
  deleteCompatibilityRule,
} from '@/lib/procedure-compatibility.service';

const createSchema = z.object({
  procedureCodeA: z.string().min(1),
  procedureCodeB: z.string().min(1),
  ruleType: z.enum(['FORBID_SAME_DAY', 'MIN_HOURS_GAP', 'FORBID_SEQUENCE']),
  minHours: z.number().int().positive().optional(),
  note: z.string().optional(),
});

export async function GET() {
  try {
    return jsonOk(await listCompatibilityRules());
  } catch (err) {
    return handleRouteError(err);
  }
}

export async function POST(request: Request) {
  try {
    const body = createSchema.parse(await request.json());
    return jsonOk(await createCompatibilityRule(body), 201);
  } catch (err) {
    return handleRouteError(err);
  }
}

export async function DELETE(request: Request) {
  try {
    const id = new URL(request.url).searchParams.get('id');
    if (!id) throw new Error('id required');
    await deleteCompatibilityRule(id);
    return jsonOk({ deleted: true });
  } catch (err) {
    return handleRouteError(err);
  }
}
