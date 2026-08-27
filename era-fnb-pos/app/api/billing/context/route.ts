import { assertFnbEntitled } from "@/lib/api-utils";
import { NextResponse } from "next/server";
import {
  resolveSettlementPolicy,
  shouldDeferWalkInToHub,
} from "@era/satellite-kit";
import { requestOrganizationId } from "@/lib/request-organization";

export async function GET() {
  await assertFnbEntitled();
  const orgId = requestOrganizationId();
  const policy = await resolveSettlementPolicy(orgId);
  return NextResponse.json({
    deferWalkInToHub: shouldDeferWalkInToHub(policy),
    settlementHub: policy.settlementHub,
  });
}
