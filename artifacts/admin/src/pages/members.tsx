import { useMemo, useState } from "react";
import { getAdminListMembersQueryKey, useAdminListMembers } from "@workspace/api-client-react";
import { Search } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { MemberAccessGrantForm } from "@/features/members/member-access-controls";
import { filterMembers, summarizeMemberAccess } from "@/features/members/member-utils";
import { MembersTable } from "@/features/members/members-table";
import type { MemberAccessFilter } from "@/features/members/types";
import { useMemberAccessController } from "@/features/members/use-member-access-controller";

export default function Members() {
  const [search, setSearch] = useState("");
  const [accessFilter, setAccessFilter] = useState<MemberAccessFilter>("all");
  const memberAccess = useMemberAccessController();
  const { data: members, isLoading } = useAdminListMembers({
    query: { queryKey: getAdminListMembersQueryKey() },
  });

  const accessSummary = useMemo(() => summarizeMemberAccess(members), [members]);
  const filteredMembers = useMemo(
    () => filterMembers(members, search, accessFilter),
    [accessFilter, members, search],
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Member Access</h1>
        <p className="text-muted-foreground mt-1">
          Allow, block, and adjust who can use the member app.
        </p>
      </div>

      <AccessSummary summary={accessSummary} />

      <MemberAccessGrantForm
        email={memberAccess.grantEmail}
        role={memberAccess.grantRole}
        savingEmail={memberAccess.savingEmail}
        onEmailChange={memberAccess.setGrantEmail}
        onRoleChange={memberAccess.setGrantRole}
        onSubmit={memberAccess.handleGrantSubmit}
      />

      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <Tabs
          value={accessFilter}
          onValueChange={(value) => setAccessFilter(value as MemberAccessFilter)}
        >
          <TabsList>
            <TabsTrigger value="all">All</TabsTrigger>
            <TabsTrigger value="approved">Allowed</TabsTrigger>
            <TabsTrigger value="pending">Waiting</TabsTrigger>
            <TabsTrigger value="revoked">Blocked</TabsTrigger>
          </TabsList>
        </Tabs>
        <div className="relative max-w-md lg:w-[360px]">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            type="search"
            placeholder="Search by name or email..."
            className="pl-8"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            data-testid="input-search-members"
          />
        </div>
      </div>

      <MembersTable
        members={filteredMembers}
        draftRoles={memberAccess.draftRoles}
        savingEmail={memberAccess.savingEmail}
        isLoading={isLoading}
        onDraftRoleChange={(email, role) =>
          memberAccess.setDraftRoles((current) => ({ ...current, [email]: role }))
        }
        onSetAccess={memberAccess.setAccess}
      />
    </div>
  );
}

function AccessSummary({
  summary,
}: {
  summary: { total: number; approved: number; pending: number; revoked: number };
}) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <AccessSummaryItem label="Total people" value={summary.total} />
      <AccessSummaryItem label="Allowed now" value={summary.approved} tone="allowed" />
      <AccessSummaryItem label="Waiting" value={summary.pending} tone="waiting" />
      <AccessSummaryItem label="Blocked" value={summary.revoked} tone="blocked" />
    </div>
  );
}

function AccessSummaryItem({
  label,
  value,
  tone = "neutral",
}: {
  label: string;
  value: number;
  tone?: "neutral" | "allowed" | "waiting" | "blocked";
}) {
  const variant = tone === "blocked" ? "destructive" : tone === "neutral" ? "outline" : "secondary";

  return (
    <div className="flex items-center justify-between rounded-md border bg-card px-4 py-3 text-card-foreground">
      <span className="text-sm font-medium text-muted-foreground">{label}</span>
      <Badge variant={variant} className="text-base">
        {value}
      </Badge>
    </div>
  );
}
