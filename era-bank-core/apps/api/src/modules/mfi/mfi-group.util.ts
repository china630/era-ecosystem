import { GroupMemberRole } from "@era/bank-core-database";

export type GroupMemberRow = {
  customerId: string;
  role: GroupMemberRole;
};

export function validateGroupMembershipBatch(
  members: GroupMemberRow[],
  options?: { minMembers?: number; maxMembers?: number },
): void {
  const min = options?.minMembers ?? 2;
  const max = options?.maxMembers ?? 30;
  if (members.length < min) {
    throw new Error(`Group requires at least ${min} members`);
  }
  if (members.length > max) {
    throw new Error(`Group cannot exceed ${max} members`);
  }
  const ids = new Set<string>();
  for (const m of members) {
    if (ids.has(m.customerId)) {
      throw new Error(`Duplicate customerId in group: ${m.customerId}`);
    }
    ids.add(m.customerId);
  }
  const leaders = members.filter((m) => m.role === GroupMemberRole.LEADER);
  if (leaders.length !== 1) {
    throw new Error("Group must have exactly one LEADER");
  }
}