import type { Member, MemberAccessStatus } from "@workspace/api-client-react";
import type { DraftMemberRoles, MemberAccessFilter, MemberRole } from "./types";

export const ROLE_LABELS: Record<MemberRole, string> = {
  member: "Member app",
  trainer: "Trainer tools",
};

const ACCESS_LABELS: Record<MemberAccessStatus, string> = {
  approved: "Allowed",
  pending: "Waiting",
  revoked: "Blocked",
};

export function normalizeMemberEmail(email: string) {
  return email.trim().toLowerCase();
}

export function isMemberRole(role: string | undefined): role is MemberRole {
  return role === "member" || role === "trainer";
}

export function getMemberDisplayName(member: Member) {
  return (
    member.name || `${member.firstName || ""} ${member.lastName || ""}`.trim() || "No name provided"
  );
}

export function getAccessLabel(status: MemberAccessStatus) {
  return ACCESS_LABELS[status] ?? status;
}

export function filterMembers(
  members: Member[] | undefined,
  search: string,
  accessFilter: MemberAccessFilter,
) {
  const query = search.trim().toLowerCase();

  return (members ?? []).filter((member) => {
    if (accessFilter !== "all" && member.accessStatus !== accessFilter) {
      return false;
    }

    if (!query) {
      return true;
    }

    const fullName = getMemberDisplayName(member).toLowerCase();
    return fullName.includes(query) || member.email.toLowerCase().includes(query);
  });
}

export function summarizeMemberAccess(members: Member[] | undefined) {
  const summary = {
    total: 0,
    approved: 0,
    pending: 0,
    revoked: 0,
  };

  for (const member of members ?? []) {
    summary.total += 1;
    if (member.accessStatus === "approved") summary.approved += 1;
    if (member.accessStatus === "pending") summary.pending += 1;
    if (member.accessStatus === "revoked") summary.revoked += 1;
  }

  return summary;
}

export function getEditableRole(member: Member, draftRoles: DraftMemberRoles): MemberRole {
  return draftRoles[member.email] ?? (isMemberRole(member.role) ? member.role : "member");
}

export function hasDraftRoleChange(member: Member, draftRoles: DraftMemberRoles) {
  return (
    isMemberRole(member.role) &&
    Boolean(draftRoles[member.email]) &&
    draftRoles[member.email] !== member.role
  );
}

export function statusBadgeVariant(status: MemberAccessStatus) {
  if (status === "approved") return "default" as const;
  if (status === "revoked") return "destructive" as const;
  return "secondary" as const;
}
