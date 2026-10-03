import { authCookieName } from "@era/satellite-kit";
import { jsonOk } from "@/lib/api-utils";
import { getSessionFromRequest } from "@/lib/session";

/** Clear the staff session. The terminal pairing cookie stays. */
export async function POST(request: Request) {
  const session = await getSessionFromRequest(request);
  const res = jsonOk({ ok: true, pin: session?.pin === true });
  res.cookies.set(authCookieName(), "", {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
  return res;
}
