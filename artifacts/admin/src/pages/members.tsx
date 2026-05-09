import { useEffect, useMemo, useState } from "react";
import {
  getAdminListMembersQueryKey,
  useAdminListMembers,
  type Member,
} from "@workspace/api-client-react";
import { format } from "date-fns";
import { Activity, Clock3, Cpu, Loader2, Search, ShieldCheck, UserRound } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { MemberAccessGrantForm } from "@/features/members/member-access-controls";
import {
  filterMembers,
  getAccessLabel,
  getMemberDisplayName,
  normalizeMemberEmail,
  summarizeMemberAccess,
  statusBadgeVariant,
} from "@/features/members/member-utils";
import { MembersTable } from "@/features/members/members-table";
import type { MemberAccessFilter, SetMemberAccessInput } from "@/features/members/types";
import { useMemberAccessController } from "@/features/members/use-member-access-controller";
import { useAuthenticatedRequest } from "@/lib/use-authenticated-request";

export default function Members({ previewMembers }: { previewMembers?: Member[] }) {
  const [search, setSearch] = useState("");
  const [accessFilter, setAccessFilter] = useState<MemberAccessFilter>("all");
  const [selectedMemberId, setSelectedMemberId] = useState<string | null>(null);
  const [bulkConfirmOpen, setBulkConfirmOpen] = useState(false);
  const [bulkSaving, setBulkSaving] = useState(false);
  const [previewRows, setPreviewRows] = useState(previewMembers);
  const request = useAuthenticatedRequest();
  const memberAccess = useMemberAccessController(request);
  const { data: fetchedMembers, isLoading } = useAdminListMembers({
    query: { enabled: !previewMembers, queryKey: getAdminListMembersQueryKey() },
    request,
  });
  const members = previewMembers ? previewRows : fetchedMembers;
  const membersLoading = !previewMembers && isLoading;

  useEffect(() => {
    setPreviewRows(previewMembers);
  }, [previewMembers]);

  const accessSummary = useMemo(() => summarizeMemberAccess(members), [members]);
  const pendingMembers = useMemo(
    () => (members ?? []).filter((member) => member.accessStatus === "pending"),
    [members],
  );
  const filteredMembers = useMemo(
    () => filterMembers(members, search, accessFilter),
    [accessFilter, members, search],
  );
  const selectedMember = useMemo(
    () =>
      filteredMembers.find((member) => member.id === selectedMemberId) ??
      filteredMembers[0] ??
      null,
    [filteredMembers, selectedMemberId],
  );
  const setMemberAccess = async (input: SetMemberAccessInput) => {
    if (previewMembers) {
      const normalizedEmail = normalizeMemberEmail(input.email);
      setPreviewRows((current) =>
        current?.map((member) =>
          normalizeMemberEmail(member.email) === normalizedEmail
            ? {
                ...member,
                role: input.role,
                accessStatus: input.accessStatus,
                accessUpdatedAt: new Date().toISOString(),
              }
            : member,
        ),
      );
      memberAccess.setDraftRoles((current) => {
        const next = { ...current };
        delete next[normalizedEmail];
        return next;
      });
      return;
    }

    await memberAccess.setAccess(input);
  };

  const approvePendingMembers = async () => {
    setBulkSaving(true);
    try {
      for (const member of pendingMembers) {
        await setMemberAccess({
          email: member.email,
          role: member.role === "trainer" ? "trainer" : "member",
          accessStatus: "approved",
        });
      }
      setBulkConfirmOpen(false);
    } finally {
      setBulkSaving(false);
    }
  };

  useEffect(() => {
    if (!selectedMemberId && filteredMembers.length > 0) {
      setSelectedMemberId(filteredMembers[0].id);
    }
  }, [filteredMembers, selectedMemberId]);

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

      <PendingAccessQueue
        pendingMembers={pendingMembers}
        isSaving={bulkSaving}
        onOpenConfirm={() => setBulkConfirmOpen(true)}
      />

      <AlertDialog open={bulkConfirmOpen} onOpenChange={setBulkConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Allow all waiting members?</AlertDialogTitle>
            <AlertDialogDescription>
              This will allow {pendingMembers.length} pending account
              {pendingMembers.length === 1 ? "" : "s"} to open the member app using the role already
              shown in the table. Review the queue before confirming.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={bulkSaving}>Review queue</AlertDialogCancel>
            <AlertDialogAction
              disabled={bulkSaving || pendingMembers.length === 0}
              onClick={() => void approvePendingMembers()}
              data-testid="button-confirm-bulk-approve-members"
            >
              {bulkSaving ? <Loader2 className="mr-2 size-4 animate-spin" /> : null}
              Allow waiting members
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="space-y-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <Tabs
              value={accessFilter}
              onValueChange={(value) => setAccessFilter(value as MemberAccessFilter)}
              className="overflow-x-auto"
            >
              <TabsList className="w-max">
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
            isLoading={membersLoading}
            selectedMemberId={selectedMember?.id ?? null}
            onDraftRoleChange={(email, role) =>
              memberAccess.setDraftRoles((current) => ({ ...current, [email]: role }))
            }
            onSelectMember={setSelectedMemberId}
            onSetAccess={(input) => void setMemberAccess(input)}
          />
        </div>

        <MemberTimelinePanel member={selectedMember} isLoading={membersLoading} />
      </div>
    </div>
  );
}

function PendingAccessQueue({
  pendingMembers,
  isSaving,
  onOpenConfirm,
}: {
  pendingMembers: Member[];
  isSaving: boolean;
  onOpenConfirm: () => void;
}) {
  if (pendingMembers.length === 0) {
    return (
      <div
        className="rounded-md border bg-card p-4 text-sm text-muted-foreground shadow-sm"
        data-testid="member-access-queue-clear"
      >
        Access queue clear. No pending member approvals need owner action.
      </div>
    );
  }

  return (
    <div
      className="flex flex-col gap-3 rounded-md border border-amber-200 bg-amber-50 p-4 text-amber-950 shadow-sm dark:border-amber-900 dark:bg-amber-950 dark:text-amber-100 lg:flex-row lg:items-center lg:justify-between"
      data-testid="member-access-pending-queue"
    >
      <div>
        <div className="text-sm font-semibold uppercase opacity-75">Pending access queue</div>
        <div className="mt-1 text-lg font-bold">
          {pendingMembers.length} waiting member{pendingMembers.length === 1 ? "" : "s"}
        </div>
        <div className="mt-1 text-sm opacity-80">
          Bulk approval is confirmed first and uses the role currently shown for each member.
        </div>
      </div>
      <Button onClick={onOpenConfirm} disabled={isSaving} data-testid="button-bulk-approve-members">
        {isSaving ? (
          <Loader2 className="mr-2 size-4 animate-spin" />
        ) : (
          <ShieldCheck className="mr-2 size-4" />
        )}
        Allow all waiting
      </Button>
    </div>
  );
}

function MemberTimelinePanel({ member, isLoading }: { member: Member | null; isLoading: boolean }) {
  if (isLoading) {
    return (
      <div className="rounded-md border bg-card p-4 shadow-sm">
        <Skeleton className="h-5 w-36" />
        <Skeleton className="mt-4 h-20 w-full" />
        <Skeleton className="mt-3 h-20 w-full" />
      </div>
    );
  }

  if (!member) {
    return (
      <div className="rounded-md border border-dashed bg-card p-6 text-sm text-muted-foreground">
        Select a member to review their access, AI profile, and recent account signals.
      </div>
    );
  }

  const aiActive = Boolean(member.aiMemorySummary);
  const timeline = [
    {
      icon: UserRound,
      title: "Profile created",
      detail: format(new Date(member.createdAt), "MMM d, yyyy"),
    },
    {
      icon: ShieldCheck,
      title: `Access ${getAccessLabel(member.accessStatus)}`,
      detail: member.email,
    },
    {
      icon: Cpu,
      title: aiActive ? "AI coach profile learned" : "AI coach waiting",
      detail: aiActive
        ? `${member.aiRecentMessageCount} saved context note${member.aiRecentMessageCount === 1 ? "" : "s"}`
        : "No advisory memory has been built for this member yet.",
    },
    {
      icon: Activity,
      title: member.role === "trainer" ? "Trainer workspace enabled" : "Member app enabled",
      detail:
        member.role === "trainer"
          ? "Can review assigned training work once allowed."
          : "Can book classes, track workouts, and use AI coaching when allowed.",
    },
  ];

  return (
    <aside className="rounded-md border bg-card p-4 text-card-foreground shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-xs font-semibold uppercase text-primary">Member timeline</div>
          <h2 className="mt-1 truncate text-lg font-bold">{getMemberDisplayName(member)}</h2>
          <p className="mt-1 truncate text-sm text-muted-foreground">{member.email}</p>
        </div>
        <Badge variant={statusBadgeVariant(member.accessStatus)} className="capitalize">
          {getAccessLabel(member.accessStatus)}
        </Badge>
      </div>

      <div className="mt-4 rounded-md bg-muted/40 p-3">
        <div className="flex items-center gap-2 text-xs font-semibold uppercase text-muted-foreground">
          <Clock3 className="size-3.5" />
          Latest AI context
        </div>
        <p className="mt-2 line-clamp-4 text-sm text-muted-foreground">
          {member.aiMemorySummary ||
            "No learned AI profile yet. Once this member chats with the coach, advisory summaries appear here for faster trainer context."}
        </p>
      </div>

      <div className="mt-4 space-y-3">
        {timeline.map((event) => {
          const Icon = event.icon;
          return (
            <div key={event.title} className="flex gap-3">
              <div className="flex size-9 shrink-0 items-center justify-center rounded-md border bg-background">
                <Icon className="size-4 text-primary" />
              </div>
              <div className="min-w-0 border-b pb-3 last:border-b-0 last:pb-0">
                <div className="text-sm font-semibold">{event.title}</div>
                <div className="mt-1 text-sm leading-5 text-muted-foreground">{event.detail}</div>
              </div>
            </div>
          );
        })}
      </div>
    </aside>
  );
}

function AccessSummary({
  summary,
}: {
  summary: { total: number; approved: number; pending: number; revoked: number };
}) {
  return (
    <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
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
