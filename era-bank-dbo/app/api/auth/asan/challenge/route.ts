import { z } from "zod";
import { startAsanChallenge } from "@/lib/asan-stub.adapter";
import { handleRouteError, jsonOk } from "@/lib/api-utils";

const schema = z.object({
  identifier: z.string().min(1),
  channel: z.enum(["RETAIL", "CORPORATE"]),
});

export async function POST(request: Request) {
  try {
    const body = schema.parse(await request.json());
    const challenge = startAsanChallenge(body.identifier, body.channel);
    return jsonOk(challenge);
  } catch (err) {
    return handleRouteError(err);
  }
}
