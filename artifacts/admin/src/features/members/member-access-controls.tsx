import type { FormEvent } from "react";
import { Loader2, ShieldCheck, ShieldOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { normalizeMemberEmail, ROLE_LABELS } from "./member-utils";
import type { MemberRole, SetMemberAccessInput } from "./types";

type RoleSelectProps = {
  value: MemberRole;
  onChange: (role: MemberRole) => void;
  testId?: string;
};

export function RoleSelect({ value, onChange, testId }: RoleSelectProps) {
  return (
    <Select value={value} onValueChange={(nextRole: MemberRole) => onChange(nextRole)}>
      <SelectTrigger className="w-[140px]" data-testid={testId}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="member">{ROLE_LABELS.member}</SelectItem>
        <SelectItem value="trainer">{ROLE_LABELS.trainer}</SelectItem>
      </SelectContent>
    </Select>
  );
}

type MemberAccessGrantFormProps = {
  email: string;
  role: MemberRole;
  savingEmail: string | null;
  onEmailChange: (email: string) => void;
  onRoleChange: (role: MemberRole) => void;
  onSubmit: (event: FormEvent) => void;
};

export function MemberAccessGrantForm({
  email,
  role,
  savingEmail,
  onEmailChange,
  onRoleChange,
  onSubmit,
}: MemberAccessGrantFormProps) {
  const normalizedEmail = normalizeMemberEmail(email);
  const isSaving = Boolean(normalizedEmail) && savingEmail === normalizedEmail;

  return (
    <div className="rounded-md border bg-card p-4 text-card-foreground shadow-sm">
      <div className="mb-3">
        <h2 className="text-base font-semibold">Allow a member</h2>
        <p className="text-sm text-muted-foreground">
          Add an email once. The person can sign in with the same email when ready.
        </p>
      </div>
      <form className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_160px_auto]" onSubmit={onSubmit}>
        <div className="space-y-1">
          <label className="text-sm font-medium" htmlFor="grant-member-email">
            Email
          </label>
          <Input
            id="grant-member-email"
            type="email"
            placeholder="member@email.com"
            value={email}
            onChange={(event) => onEmailChange(event.target.value)}
            data-testid="input-grant-member-email"
          />
        </div>
        <div className="space-y-1">
          <label className="text-sm font-medium">Access level</label>
          <RoleSelect value={role} onChange={onRoleChange} testId="select-grant-member-role" />
        </div>
        <div className="flex items-end">
          <Button
            type="submit"
            className="w-full lg:w-auto"
            disabled={!normalizedEmail || isSaving}
            data-testid="button-grant-member-access"
          >
            {isSaving ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <ShieldCheck className="mr-2 h-4 w-4" />
            )}
            Allow member
          </Button>
        </div>
      </form>
    </div>
  );
}

type MemberAccessActionsProps = {
  email: string;
  role: MemberRole;
  accessStatus: string;
  hasRoleChange: boolean;
  isSaving: boolean;
  testIdSuffix: string;
  onSetAccess: (input: SetMemberAccessInput) => void;
};

export function MemberAccessActions({
  email,
  role,
  accessStatus,
  hasRoleChange,
  isSaving,
  testIdSuffix,
  onSetAccess,
}: MemberAccessActionsProps) {
  const approveLabel = hasRoleChange ? "Save access" : "Allow";

  return (
    <div className="flex justify-end gap-2">
      {hasRoleChange || accessStatus !== "approved" ? (
        <Button
          size="sm"
          variant="default"
          disabled={isSaving}
          onClick={() => onSetAccess({ email, role, accessStatus: "approved" })}
          data-testid={`button-approve-member-${testIdSuffix}`}
        >
          {isSaving ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <ShieldCheck className="mr-2 h-4 w-4" />
          )}
          {approveLabel}
        </Button>
      ) : null}
      {accessStatus !== "revoked" ? (
        <Button
          size="sm"
          variant="outline"
          disabled={isSaving}
          onClick={() => onSetAccess({ email, role, accessStatus: "revoked" })}
          data-testid={`button-revoke-member-${testIdSuffix}`}
        >
          <ShieldOff className="mr-2 h-4 w-4" />
          Block
        </Button>
      ) : (
        <Button
          size="sm"
          variant="secondary"
          disabled={isSaving}
          onClick={() => onSetAccess({ email, role, accessStatus: "approved" })}
          data-testid={`button-restore-member-${testIdSuffix}`}
        >
          {isSaving ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <ShieldCheck className="mr-2 h-4 w-4" />
          )}
          Allow again
        </Button>
      )}
    </div>
  );
}
