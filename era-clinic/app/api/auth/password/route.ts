import { z } from "zod";
import {
  jsonError,
  jsonOk,
  handleRouteError,
  getRouteSession,
} from "@/lib/api-utils";
import {
  changeLocalPassword,
  LocalPasswordError,
  LOCAL_PASSWORD_MIN_LENGTH,
} from "@/lib/change-local-password";

const schema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(LOCAL_PASSWORD_MIN_LENGTH),
});

export async function PATCH(request: Request) {
  try {
    const session = await getRouteSession();
    if (!session) return jsonError("Unauthorized", 401);
    const body = schema.parse(await request.json());
    await changeLocalPassword({
      userId: session.sub,
      currentPassword: body.currentPassword,
      newPassword: body.newPassword,
    });
    return jsonOk({ ok: true });
  } catch (err) {
    if (err instanceof LocalPasswordError) {
      return jsonError(err.message, err.status);
    }
    return handleRouteError(err);
  }
}
