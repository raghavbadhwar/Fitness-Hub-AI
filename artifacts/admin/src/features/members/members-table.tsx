import { format } from "date-fns";
import { Calendar, Eye, Mail, UserCircle } from "lucide-react";
import type { Member } from "@workspace/api-client-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
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
  selectedMemberId?: string | null;
  onDraftRoleChange: (email: string, role: MemberRole) => void;
  onSelectMember?: (memberId: string) => void;
  onSetAccess: (input: SetMemberAccessInput) => void;
};

export function MembersTable({
  members,
  draftRoles,
  savingEmail,
  isLoading,
  selectedMemberId,
  onDraftRoleChange,
  onSelectMember,
  onSetAccess,
}: MembersTableProps) {
  return (
    <>
      <div className="hidden rounded-md border bg-card text-card-foreground shadow-sm md:block">
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
                  isSelected={selectedMemberId === member.id}
                  onDraftRoleChange={onDraftRoleChange}
                  onSelectMember={onSelectMember}
                  onSetAccess={onSetAccess}
                />
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <div className="flex flex-col gap-3 md:hidden">
        {isLoading ? (
          [1, 2, 3].map((item) => <Skeleton key={item} className="h-40 w-full" />)
        ) : members.length === 0 ? (
          <div className="rounded-md border bg-card p-8 text-center text-sm text-muted-foreground">
            No members found.
          </div>
        ) : (
          members.map((member) => (
            <MemberCard
              key={member.id}
              member={member}
              draftRoles={draftRoles}
              savingEmail={savingEmail}
              isSelected={selectedMemberId === member.id}
              onDraftRoleChange={onDraftRoleChange}
              onSelectMember={onSelectMember}
              onSetAccess={onSetAccess}
            />
          ))
        )}
      </div>
    </>
  );
}

type MemberRowProps = {
  member: Member;
  draftRoles: DraftMemberRoles;
  savingEmail: string | null;
  isSelected?: boolean;
  onDraftRoleChange: (email: string, role: MemberRole) => void;
  onSelectMember?: (memberId: string) => void;
  onSetAccess: (input: SetMemberAccessInput) => void;
};

function MemberRow({
  member,
  draftRoles,
  savingEmail,
  isSelected,
  onDraftRoleChange,
  onSelectMember,
  onSetAccess,
}: MemberRowProps) {
  const draftRole = getEditableRole(member, draftRoles);
  const isSaving = savingEmail === member.email.toLowerCase();
  const canManage = member.role !== "owner";
  const roleChanged = hasDraftRoleChange(member, draftRoles);

  return (
    <TableRow
      className={isSelected ? "bg-primary/5" : undefined}
      data-testid={`row-member-${member.id}`}
    >
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
        <div className="flex justify-end gap-2">
          {onSelectMember ? (
            <Button
              size="sm"
              variant={isSelected ? "secondary" : "outline"}
              onClick={() => onSelectMember(member.id)}
              data-testid={`button-member-timeline-${member.id}`}
            >
              <Eye className="mr-2 size-4" />
              Timeline
            </Button>
          ) : null}
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
        </div>
      </TableCell>
    </TableRow>
  );
}

function MemberCard({
  member,
  draftRoles,
  savingEmail,
  isSelected,
  onDraftRoleChange,
  onSelectMember,
  onSetAccess,
}: MemberRowProps) {
  const draftRole = getEditableRole(member, draftRoles);
  const isSaving = savingEmail === member.email.toLowerCase();
  const canManage = member.role !== "owner";
  const roleChanged = hasDraftRoleChange(member, draftRoles);

  return (
    <div
      className={
        isSelected
          ? "rounded-md border border-primary/40 bg-primary/5 p-4 text-card-foreground shadow-sm"
          : "rounded-md border bg-card p-4 text-card-foreground shadow-sm"
      }
      data-testid={`card-member-${member.id}`}
    >
      <div className="flex items-start gap-3">
        <div className="flex size-10 items-center justify-center rounded-full bg-primary/10">
          <UserCircle className="size-5 text-primary" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="truncate font-semibold">{getMemberDisplayName(member)}</div>
          <div className="mt-1 flex items-center text-sm text-muted-foreground">
            <Mail className="mr-1.5 size-3.5" />
            <span className="truncate">{member.email}</span>
          </div>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <Badge variant={statusBadgeVariant(member.accessStatus)} className="capitalize">
          {getAccessLabel(member.accessStatus)}
        </Badge>
        <Badge variant="outline" className="capitalize">
          {isRoleForLabel(member.role) ? ROLE_LABELS[member.role] : member.role}
        </Badge>
      </div>

      <div className="mt-4 rounded-md bg-muted/50 p-3">
        <div className="text-xs font-semibold uppercase text-muted-foreground">AI Coach</div>
        {member.aiMemorySummary ? (
          <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">
            {member.aiMemorySummary}
          </p>
        ) : (
          <p className="mt-1 text-sm text-muted-foreground">No learned profile yet</p>
        )}
      </div>

      <div className="mt-4 flex items-center text-sm text-muted-foreground">
        <Calendar className="mr-1.5 size-3.5" />
        Joined {format(new Date(member.createdAt), "MMM d, yyyy")}
      </div>

      {canManage ? (
        <div className="mt-4 flex flex-col gap-3">
          <RoleSelect
            value={draftRole}
            onChange={(nextRole) => onDraftRoleChange(member.email, nextRole)}
            testId={`select-mobile-member-role-${member.id}`}
          />
          <MemberAccessActions
            email={member.email}
            role={draftRole}
            accessStatus={member.accessStatus}
            hasRoleChange={roleChanged}
            isSaving={isSaving}
            testIdSuffix={member.id}
            onSetAccess={onSetAccess}
          />
        </div>
      ) : (
        <div className="mt-4 text-sm text-muted-foreground">Owner access is locked.</div>
      )}

      {onSelectMember ? (
        <Button
          size="sm"
          variant={isSelected ? "secondary" : "outline"}
          className="mt-4 w-full"
          onClick={() => onSelectMember(member.id)}
          data-testid={`button-mobile-member-timeline-${member.id}`}
        >
          <Eye className="mr-2 size-4" />
          Inspect timeline
        </Button>
      ) : null}
    </div>
  );
}

function isRoleForLabel(role: string): role is MemberRole {
  return role === "member" || role === "trainer";
}
