/**
 * Pure outlet → print overlay mapper (no Prisma) for CP-ORG-PROFILE-01 Track C.
 */
import type { OutletContactOverlay } from "@era/satellite-kit";

export function outletToPrintOverlay(outlet: {
  name?: string | null;
  phone?: string | null;
  email?: string | null;
  address?: string | null;
  website?: string | null;
} | null): OutletContactOverlay | null {
  if (!outlet) return null;
  return {
    name: outlet.name,
    phone: outlet.phone,
    email: outlet.email,
    address: outlet.address,
    website: outlet.website,
  };
}
