import { z } from "zod";
import { jsonOk, handleRouteError } from "@/lib/api-utils";
import { dboPaths, engineDboJson } from "@/lib/engine-dbo-client";

const schema = z.object({
  identifier: z.string().min(1),
  channel: z.enum(["RETAIL", "CORPORATE"]),
});

export async function POST(request: Request) {
  try {
    const body = schema.parse(await request.json());
    const data = await engineDboJson("POST", dboPaths.authOtpRequest, body);
    return jsonOk(data);
  } catch (err) {
    return handleRouteError(err);
  }
}
