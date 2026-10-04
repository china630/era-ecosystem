import { NextResponse } from "next/server";
import {
  resolveSettlementPolicy,
  shouldDeferWalkInToHub,
} from "@era/satellite-kit";
import { requestOrganizationId } from "@/lib/request-organization";
import { getSatelliteSession } from "@/lib/session";
import { denyUnlessAnyPermission } from "@/lib/auth/require";
import { TILL_READ_TICKETS } from "@/lib/auth/read-permission-sets";
import { handleRouteError } from "@/lib/api-utils";

export async function GET(request: Request) {
  try {
    const session = await getSatelliteSession();
    const denied = denyUnlessAnyPermission(session, TILL_READ_TICKETS);
    if (denied) return denied;
    const orgId = requestOrganizationId();
    const policy = await resolveSettlementPolicy(orgId);
    return NextResponse.json({
      deferWalkInToHub: shouldDeferWalkInToHub(policy),
      settlementHub: policy.settlementHub,
    });
  } catch (err) {
    return handleRouteError(err);
  }
}
