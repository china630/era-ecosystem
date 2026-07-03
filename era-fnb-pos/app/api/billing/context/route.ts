import { NextResponse } from "next/server";
import {
  resolveSettlementPolicy,
  shouldDeferWalkInToHub,
  satelliteOrganizationId,
} from "@era/satellite-kit";

export async function GET() {
  const orgId = satelliteOrganizationId();
  if (!orgId) {
    return NextResponse.json({ deferWalkInToHub: false });
  }
  const policy = await resolveSettlementPolicy(orgId);
  return NextResponse.json({
    deferWalkInToHub: shouldDeferWalkInToHub(policy),
    settlementHub: policy.settlementHub,
  });
}
