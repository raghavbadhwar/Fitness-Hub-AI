import { format } from "date-fns";
import { Calendar, Mail, UserCircle } from "lucide-react";
import type { Member } from "@workspace/api-client-react";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  getEditableRole,
  getAccessLabel,
  getMemberDisplayName,
  hasDraftRoleChange,
  ROLE_LABELS,
  statusBadgeVariant,
} from "./member-utils";
import { MemberAccessActions, RoleSelect } from "./member-access-controls";
import type { DraftMemberRoles, MemberRole, SetMemberAccessInput } from "./types";

type MembersTableProps = {
  members: Member[];
  draftRoles: DraftMemberRoles;
  savingEmail: string | null;
  isLoading: boolean;
  onDraftRoleChange: (email: string, role: MemberRole) => void;
  onSetAccess: (input: SetMemberAccessInput) => void;
};

export function MembersTable({
  members,
  draftRoles,
  savingEmail,
  isLoading,
  onDraftRoleChange,
  onSetAccess,
}: MembersTableProps) {
  return (
    <div className="rounded-md border bg-card text-card-foreground shadow-sm">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Member</TableHead>
            <TableHead>Contact</TableHead>
            <TableHead>App access</TableHead>
            <TableHead>AI Coach</TableHead>
            <TableHead>Joined Date</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {isLoading ? (
            <TableRow>
              <TableCell colSpan={6} className="h-24 text-center">
                Loading members...
              </TableCell>
            </TableRow>
          ) : members.length === 0 ? (
            <TableRow>
              <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
                No members found.
              </TableCell>
            </TableRow>
          ) : (
            members.map((member) => (
              <MemberRow
                key={member.id}
                member={member}
                draftRoles={draftRoles}
                savingEmail={savingEmail}
                onDraftRoleChange={onDraftRoleChange}
                onSetAccess={onSetAccess}
              />
            ))
          )}
        </TableBody>
      </Table>
    </div>
  );
}

type MemberRowProps = {
  member: Member;
  draftRoles: DraftMemberRoles;
  savingEmail: string | null;
  onDraftRoleChange: (email: string, role: MemberRole) => void;
  onSetAccess: (input: SetMemberAccessInput) => void;
};

function MemberRow({
  member,
  draftRoles,
  savingEmail,
  onDraftRoleChange,
  onSetAccess,
}: MemberRowProps) {
  const draftRole = getEditableRole(member, draftRoles);
  const isSaving = savingEmail === member.email.toLowerCase();
  const canManage = member.role !== "owner";
  const roleChanged = hasDraftRoleChange(member, draftRoles);

  return (
    <TableRow data-testid={`row-member-${member.id}`}>
      <TableCell>
        <div className="flex items-center gap-3">
          <div className="bg-primary/10 p-2 rounded-full">
            <UserCircle className="h-5 w-5 text-primary" />
          </div>
          <div className="font-medium">{getMemberDisplayName(member)}</div>
        </div>
      </TableCell>
      <TableCell>
        <div className="flex items-center text-sm text-muted-foreground">
          <Mail className="h-3.5 w-3.5 mr-1.5" />
          {member.email}
        </div>
      </TableCell>
      <TableCell>
        <div className="flex flex-col gap-2">
          <div className="flex flex-wrap gap-2">
            <Badge variant={statusBadgeVariant(member.accessStatus)} className="capitalize">
              {getAccessLabel(member.accessStatus)}
            </Badge>
            <Badge variant="outline" className="capitalize">
              {isRoleForLabel(member.role) ? ROLE_LABELS[member.role] : member.role}
            </Badge>
          </div>
          {canManage ? (
            <RoleSelect
              value={draftRole}
              onChange={(nextRole) => onDraftRoleChange(member.email, nextRole)}
              testId={`select-member-role-${member.id}`}
            />
          ) : null}
        </div>
      </TableCell>
      <TableCell>
        <div className="space-y-1">
          {member.aiMemorySummary ? (
            <>
              <Badge variant="secondary">{member.aiRecentMessageCount} memory notes</Badge>
              <p className="max-w-[260px] truncate text-sm text-muted-foreground">
                {member.aiMemorySummary}
              </p>
            </>
          ) : (
            <span className="text-sm text-muted-foreground">No learned profile yet</span>
          )}
        </div>
      </TableCell>
      <TableCell>
        <div className="flex items-center text-sm">
          <Calendar className="h-3.5 w-3.5 mr-1.5 text-muted-foreground" />
          {format(new Date(member.createdAt), "MMM d, yyyy")}
        </div>
      </TableCell>
      <TableCell className="text-right">
        {canManage ? (
          <MemberAccessActions
            email={member.email}
            role={draftRole}
            accessStatus={member.accessStatus}
            hasRoleChange={roleChanged}
            isSaving={isSaving}
            testIdSuffix={member.id}
            onSetAccess={onSetAccess}
          />
        ) : (
          <span className="text-sm text-muted-foreground">Locked</span>
        )}
      </TableCell>
    </TableRow>
  );
}

function isRoleForLabel(role: string): role is MemberRole {
  return role === "member" || role === "trainer";
}
