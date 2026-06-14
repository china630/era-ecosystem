import { z } from "zod";
import { jsonOk, jsonError, handleRouteError } from "@/lib/api-utils";
import { prisma } from "@/lib/prisma";

const bodySchema = z.object({
  name: z.string().min(1),
  format: z.enum(["CSV", "HL7_FRAGMENT"]).default("CSV"),
  delimiter: z.string().default(","),
  columnMapping: z.record(z.string()).default({}),
});

export async function GET() {
  try {
    const profiles = await prisma.lisFileProfile.findMany({
      orderBy: { name: "asc" },
    });
    return jsonOk(profiles);
  } catch (err) {
    return handleRouteError(err);
  }
}

export async function POST(req: Request) {
  try {
    const body = bodySchema.parse(await req.json());
    const profile = await prisma.lisFileProfile.create({
      data: {
        name: body.name,
        format: body.format,
        delimiter: body.delimiter,
        columnMapping: JSON.stringify(body.columnMapping),
      },
    });
    return jsonOk(profile, 201);
  } catch (err) {
    return handleRouteError(err);
  }
}
