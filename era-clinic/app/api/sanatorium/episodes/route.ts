import { z } from "zod";
import { requestOrganizationId } from "@/lib/request-organization";
import { jsonOk, handleRouteError } from "@/lib/api-utils";
import { listOpenEpisodes, registerWalkInEpisode } from "@/lib/services/sanatorium.service";

const listQuerySchema = z.object({
  organizationId: z.string().optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(25),
  q: z.string().optional(),
  origin: z.string().optional(),
  roomNumber: z.string().optional(),
  programCode: z.string().optional(),
  includeHotelRooms: z.boolean().optional(),
  includeProgramCodes: z.boolean().optional(),
});

const walkInSchema = z
  .object({
    givenName: z.string().min(1).optional(),
    surname: z.string().min(1).optional(),
    fatherName: z.string().optional().nullable(),
    fullName: z.string().optional(),
    fin: z.string().optional(),
    passport: z.string().optional(),
    phone: z.string().optional(),
    sex: z.enum(["MALE", "FEMALE"]),
    birthDate: z.string().optional(),
    nationality: z.string().optional(),
    issuingCountry: z.string().optional(),
    globalPersonId: z.string().optional(),
    programCode: z.string().optional(),
  })
  .refine(
    (b) =>
      Boolean(b.fullName?.trim()) ||
      (Boolean(b.givenName?.trim()) && Boolean(b.surname?.trim())),
    { message: "givenName+surname or fullName required" },
  );

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const query = listQuerySchema.parse({
      organizationId: url.searchParams.get("organizationId") ?? undefined,
      page: url.searchParams.get("page") ?? undefined,
      pageSize: url.searchParams.get("pageSize") ?? undefined,
      q: url.searchParams.get("q") ?? undefined,
      origin: url.searchParams.get("origin") ?? undefined,
      roomNumber: url.searchParams.get("roomNumber") ?? undefined,
      programCode: url.searchParams.get("programCode") ?? undefined,
      includeHotelRooms: url.searchParams.get("includeHotelRooms") === "1",
      includeProgramCodes: url.searchParams.get("includeProgramCodes") === "1",
    });
    const result = await listOpenEpisodes(query);
    return jsonOk(result);
  } catch (err) {
    return handleRouteError(err);
  }
}

export async function POST(req: Request) {
  try {
    const body = walkInSchema.parse(await req.json());
    let boundOrg: string | undefined;
    try {
      const id = requestOrganizationId();
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
      givenName: body.givenName,
      surname: body.surname,
      fatherName: body.fatherName,
      fullName:
        body.fullName?.trim() ||
        [body.givenName, body.fatherName, body.surname]
          .map((p) => p?.trim())
          .filter(Boolean)
          .join(" "),
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
