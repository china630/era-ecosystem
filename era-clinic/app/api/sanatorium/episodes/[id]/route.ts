import { z } from 'zod';
import { jsonOk, jsonError, handleRouteError } from '@/lib/api-utils';
import { prisma } from '@/lib/prisma';
import { instantiateProgramFromTemplate } from '@/lib/sanatorium-scheduler.service';
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
const instantiateProgramSchema = z.object({
  programCode: z.string().min(1),
  startsOn: z.string().min(1),
});

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
    if (action === 'instantiate-program') {
      const parsed = instantiateProgramSchema.parse(body);
      const existing = await prisma.programInstance.findUnique({
        where: { episodeId: id },
      });
      if (existing) return jsonError('Program already assigned', 409);
      const episode = await prisma.clinicalEpisode.findUnique({ where: { id } });
      if (!episode) return jsonError('Episode not found', 404);
      const instance = await instantiateProgramFromTemplate({
        episodeId: id,
        programCode: parsed.programCode,
        reservationId: episode.reservationId ?? undefined,
        startsOn: new Date(parsed.startsOn),
      });
      return jsonOk(instance);
    }

    return jsonError('Unknown action', 400);
  } catch (err) {
    return handleRouteError(err);
  }
}
