/**
 * Record-level lead scope (CRM-SCOPE-01): own | group | all.
 */
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { PermissionDeniedError } from "@/lib/auth/require";

export type LeadScope = "own" | "group" | "all";

/** Resolve scope from grants: assign/access managers see all; others see group (falls back to own). */
export function resolveLeadScopeFromGrants(opts: {
  permissions: readonly string[];
  isOwner?: boolean;
  queryScope?: string | null;
}): LeadScope {
  // LEADS_EXPORT does NOT elevate record scope — export stays within own/group/all.
  const canAll =
    opts.isOwner === true ||
    opts.permissions.includes(PERMISSIONS.LEADS_ASSIGN) ||
    opts.permissions.includes(PERMISSIONS.ACCESS_MANAGE);

  const requested = opts.queryScope;
  if (requested === "all" || requested === "group" || requested === "own") {
    if (requested === "all" && !canAll) return "group";
    return requested;
  }
  return canAll ? "all" : "group";
}

export async function leadScopeWhere(
  organizationId: string,
  userId: string,
  scope: LeadScope,
): Promise<Prisma.LeadWhereInput> {
  if (scope === "all") return { organizationId };
  if (scope === "own") return { organizationId, ownerId: userId };
  const memberships = await prisma.userGroupMember.findMany({
    where: { userId },
    select: { groupId: true },
  });
  const groupIds = memberships.map((m) => m.groupId);
  if (!groupIds.length) return { organizationId, ownerId: userId };
  const peers = await prisma.userGroupMember.findMany({
    where: { groupId: { in: groupIds } },
    select: { userId: true },
  });
  const ownerIds = Array.from(new Set(peers.map((p) => p.userId).concat(userId)));
  return { organizationId, ownerId: { in: ownerIds } };
}

/**
 * Fail closed if lead is outside the caller's record scope (GET/PATCH by id).
 * Throws PermissionDeniedError for route handlers.
 */
export async function assertLeadInScope(opts: {
  organizationId: string;
  userId: string;
  leadId: string;
  permissions: readonly string[];
  isOwner?: boolean;
}): Promise<void> {
  const scope = resolveLeadScopeFromGrants({
    permissions: opts.permissions,
    isOwner: opts.isOwner,
  });
  const where = await leadScopeWhere(
    opts.organizationId,
    opts.userId,
    scope,
  );
  const hit = await prisma.lead.findFirst({
    where: { ...where, id: opts.leadId },
    select: { id: true },
  });
  if (!hit) {
    throw new PermissionDeniedError("Lead not found or out of scope");
  }
}

/**
 * Merge list filters with record-scope. Query `ownerId` must stay inside scope
 * (intersect) — never overwrite `ownerId: { in: [...] }` (audit v3 §5.1).
 * `mine=true` safely narrows to the session user.
 */
export async function applyOwnerListFilter(opts: {
  scopeWhere: Prisma.LeadWhereInput;
  scope: LeadScope;
  sessionUserId: string;
  mine?: boolean;
  queryOwnerId?: string | null;
}): Promise<Prisma.LeadWhereInput> {
  const where: Prisma.LeadWhereInput = { ...opts.scopeWhere };
  if (opts.mine) {
    where.ownerId = opts.sessionUserId;
    return where;
  }
  const requested = opts.queryOwnerId?.trim();
  if (!requested) return where;

  if (opts.scope === "all") {
    where.ownerId = requested;
    return where;
  }
  if (opts.scope === "own") {
    if (requested !== opts.sessionUserId) {
      throw new PermissionDeniedError("ownerId outside lead scope");
    }
    where.ownerId = opts.sessionUserId;
    return where;
  }
  // group: requested owner must be in the allowed peer set
  const allowed = opts.scopeWhere.ownerId;
  if (typeof allowed === "string") {
    if (requested !== allowed) {
      throw new PermissionDeniedError("ownerId outside lead scope");
    }
    where.ownerId = requested;
    return where;
  }
  if (
    allowed &&
    typeof allowed === "object" &&
    "in" in allowed &&
    Array.isArray(allowed.in)
  ) {
    if (!allowed.in.includes(requested)) {
      throw new PermissionDeniedError("ownerId outside lead scope");
    }
    where.ownerId = requested;
    return where;
  }
  throw new PermissionDeniedError("ownerId outside lead scope");
}

/**
 * Prisma filter for Visit/Call/Task/Conversation rows whose lead is in scope.
 * Orphans (`leadId: null`) are NOT org-wide: only scope `all`, or when
 * `orphanAssignedField` matches the session user (assigneeId / userId).
 */
export async function leadScopedRelationWhere(opts: {
  organizationId: string;
  userId: string;
  permissions: readonly string[];
  isOwner?: boolean;
  /** Conversation uses assigneeId; Call uses userId. Omit = hide orphans unless all. */
  orphanAssignedField?: "assigneeId" | "userId";
}): Promise<{
  organizationId: string;
  OR: Array<Record<string, unknown>>;
}> {
  const scope = resolveLeadScopeFromGrants({
    permissions: opts.permissions,
    isOwner: opts.isOwner,
  });
  const leadWhere = await leadScopeWhere(
    opts.organizationId,
    opts.userId,
    scope,
  );
  const OR: Array<Record<string, unknown>> = [{ lead: leadWhere }];
  if (scope === "all") {
    OR.push({ leadId: null });
  } else if (opts.orphanAssignedField === "assigneeId") {
    OR.push({ leadId: null, assigneeId: opts.userId });
  } else if (opts.orphanAssignedField === "userId") {
    OR.push({ leadId: null, userId: opts.userId });
  }
  return {
    organizationId: opts.organizationId,
    OR,
  };
}

/** Orphan conversation/call: require assignee/user match unless scope all. */
export function assertOrphanRecordAccess(opts: {
  scope: LeadScope;
  userId: string;
  assigneeOrUserId: string | null | undefined;
}): void {
  if (opts.scope === "all") return;
  if (opts.assigneeOrUserId && opts.assigneeOrUserId === opts.userId) return;
  throw new PermissionDeniedError("Record not found or out of scope");
}
