"use client";

import { toast } from "sonner";

/** Success feedback as a top-right Sonner toast (ERA standard). */
export function showSuccess(message: string): void {
  toast.success(message);
}

/** Non-blocking warning as a top-right Sonner toast. */
export function showWarning(message: string): void {
  toast.warning(message);
}
