import { jsonOk, handleRouteError } from "@/lib/api-utils";
import { prisma } from "@/lib/prisma";

export async function GET(req: Request) {
  try {
    const vin = new URL(req.url).searchParams.get("vin") ?? "";
    const mockUrl = process.env.TECDOC_MOCK_URL;
    if (mockUrl && vin) {
      const res = await fetch(`${mockUrl}?vin=${encodeURIComponent(vin)}`).catch(() => null);
      if (res?.ok) {
        const data = await res.json();
        return jsonOk({ source: "tecdoc_mock", items: data });
      }
    }
    const items = await prisma.partsCatalogEntry.findMany({
      where: vin ? { OR: [{ vinPrefix: vin.slice(0, 8) }, { vinPrefix: null }] } : {},
      take: 50,
    });
    return jsonOk({ source: "local", items });
  } catch (err) {
    return handleRouteError(err);
  }
}
