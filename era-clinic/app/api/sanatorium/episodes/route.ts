import { z } from "zod";
import { satelliteOrganizationId } from "@era/satellite-kit";
import { jsonOk, handleRouteError } from "@/lib/api-utils";
import { listOpenEpisodes, registerWalkInEpisode } from "@/lib/services/sanatorium.service";

const walkInSchema = z.object({
  fullName: z.string().min(1),
  fin: z.string().optional(),
  passport: z.string().optional(),
  phone: z.string().optional(),
  sex: z.enum(["MALE", "FEMALE"]),
  birthDate: z.string().optional(),
  nationality: z.string().optional(),
  issuingCountry: z.string().optional(),
  globalPersonId: z.string().optional(),
  programCode: z.string().optional(),
});

export async function GET(req: Request) {
  try {
    const orgId = new URL(req.url).searchParams.get("organizationId") ?? undefined;
    const episodes = await listOpenEpisodes(orgId);
    return jsonOk(episodes);
  } catch (err) {
    return handleRouteError(err);
  }
}

export async function POST(req: Request) {
  try {
    const body = walkInSchema.parse(await req.json());
    let boundOrg: string | undefined;
    try {
      const id = satelliteOrganizationId();
      boundOrg = id === "demo-org" ? undefined : id;
    } catch {
      boundOrg = undefined;
    }
    const organizationId =
      boundOrg ??
      new URL(req.url).searchParams.get("organizationId") ??
      "local-clinic";
    const episode = await registerWalkInEpisode({
      organizationId,
      fullName: body.fullName,
      fin: body.fin,
      passport: body.passport,
      phone: body.phone,
      sex: body.sex,
      birthDate: body.birthDate,
      nationality: body.nationality,
      issuingCountry: body.issuingCountry,
      globalPersonId: body.globalPersonId,
      programCode: body.programCode,
    });
    return jsonOk(episode, 201);
  } catch (err) {
    return handleRouteError(err);
  }
}
