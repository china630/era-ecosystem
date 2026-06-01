"use client";

import { toast } from "sonner";
import { parseApiError } from "./parse-api-error";

/** Show API/server errors as a top-right Sonner toast (ERA standard). */
export function showApiError(body: unknown, fallback?: string): void {
  toast.error(parseApiError(body, fallback ?? "Request failed"));
}
