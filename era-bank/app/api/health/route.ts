import { jsonOk } from "@/lib/api-utils";

export async function GET() {
  return jsonOk({
    status: "ok",
    service: "era-bank",
    engineUrl: process.env.ERA_BANK_CORE_URL ?? null,
  });
}
