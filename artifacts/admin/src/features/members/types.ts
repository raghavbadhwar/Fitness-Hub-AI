import type {
  SetMemberAccessBodyAccessStatus,
  SetMemberAccessBodyRole,
} from "@workspace/api-client-react";

export type MemberRole = SetMemberAccessBodyRole;
export type ManageableAccessStatus = SetMemberAccessBodyAccessStatus;
export type MemberAccessFilter = "all" | "approved" | "pending" | "revoked";
export type DraftMemberRoles = Record<string, MemberRole>;

export type SetMemberAccessInput = {
  email: string;
  role: MemberRole;
  accessStatus: ManageableAccessStatus;
};
