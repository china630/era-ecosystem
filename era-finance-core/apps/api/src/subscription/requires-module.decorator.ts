import { SetMetadata } from "@nestjs/common";
import { REQUIRES_MODULE_KEY } from "./subscription.constants";

/** Marks a class/method — any listed module unlocks (OR). */
export const RequiresModule = (name: string | readonly string[]) =>
  SetMetadata(REQUIRES_MODULE_KEY, name);
