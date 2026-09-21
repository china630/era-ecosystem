import { assertFnbEntitled } from "@/lib/api-utils";
import { NextResponse } from "next/server";
import {
  resolveSettlementPolicy,
  shouldDeferWalkInToHub,
} from "@era/satellite-kit";
import { requestOrganizationId } from "@/lib/request-organization";
import { getSessionFromRequest } from "@/lib/session";
import { denyUnlessAnyPermission } from "@/lib/auth/require";
import { TILL_READ_TICKETS } from "@/lib/auth/read-permission-sets";

export async function GET(request: Request) {
  await assertFnbEntitled();
  const session = await getSessionFromRequest(request);
  const denied = denyUnlessAnyPermission(session, TILL_READ_TICKETS);
  if (denied) return denied;
  const orgId = requestOrganizationId();
  const policy = await resolveSettlementPolicy(orgId);
  return NextResponse.json({
    deferWalkInToHub: shouldDeferWalkInToHub(policy),
    settlementHub: policy.settlementHub,
  });
}
