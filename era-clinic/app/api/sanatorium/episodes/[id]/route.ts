import { z } from 'zod';
import { jsonOk, jsonError, handleRouteError } from '@/lib/api-utils';
import {
  addComplaint,
  addDiagnosis,
  createEpisodeLabOrder,
  getEpisode,
} from '@/lib/services/sanatorium.service';

const complaintSchema = z.object({ text: z.string().min(1) });
const diagnosisSchema = z.object({
  icdCode: z.string().optional(),
  description: z.string().min(1),
});
const labSchema = z.object({ testCode: z.string().min(1) });

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const episode = await getEpisode(id);
    return jsonOk(episode);
  } catch (err) {
    return handleRouteError(err);
  }
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const url = new URL(req.url);
    const action = url.searchParams.get('action');
    const body = await req.json();

    if (action === 'complaint') {
      const parsed = complaintSchema.parse(body);
      return jsonOk(await addComplaint(id, parsed.text));
    }
    if (action === 'diagnosis') {
      const parsed = diagnosisSchema.parse(body);
      return jsonOk(await addDiagnosis(id, parsed));
    }
    if (action === 'lab') {
      const parsed = labSchema.parse(body);
      return jsonOk(await createEpisodeLabOrder(id, parsed.testCode));
    }

    return jsonError('Unknown action', 400);
  } catch (err) {
    return handleRouteError(err);
  }
}
