"use client";

import { toast } from "sonner";

/** Success feedback as a top-right Sonner toast (ERA standard). */
export function showSuccess(message: string): void {
  toast.success(message);
}
