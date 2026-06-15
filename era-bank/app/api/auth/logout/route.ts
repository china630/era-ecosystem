import { authCookieName } from "@era/satellite-kit";
import { jsonOk } from "@/lib/api-utils";

export async function POST() {
  const res = jsonOk({ ok: true });
  res.cookies.set(authCookieName(), "", {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
  return res;
}
