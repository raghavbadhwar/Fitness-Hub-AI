import React, { useMemo, useState } from "react";
import {
  useAdminListMembers,
  useAdminUpdateMember,
  getAdminListMembersQueryKey,
} from "@workspace/api-client-react";
import { Search, UserCircle, Mail, Calendar, Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { format } from "date-fns";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";

export default function Members() {
  const [search, setSearch] = useState("");
  const [draftRoles, setDraftRoles] = useState<Record<string, "member" | "trainer">>({});
  const [savingMemberId, setSavingMemberId] = useState<string | null>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const updateMemberMutation = useAdminUpdateMember();
  const { data: members, isLoading } = useAdminListMembers({
    query: { queryKey: getAdminListMembersQueryKey() },
  });

  const filteredMembers = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) {
      return members ?? [];
    }

    return (members ?? []).filter((member) => {
      const fullName =
        member.name?.toLowerCase() ||
        `${member.firstName || ""} ${member.lastName || ""}`.trim().toLowerCase();
      return fullName.includes(query) || member.email.toLowerCase().includes(query);
    });
  }, [members, search]);

  const handleRoleSave = async (memberId: string) => {
    const nextRole = draftRoles[memberId];
    if (!nextRole) {
      return;
    }

    setSavingMemberId(memberId);

    try {
      await updateMemberMutation.mutateAsync({
        id: memberId,
        data: { role: nextRole },
      });

      toast({ title: "Member access updated" });
      setDraftRoles((current) => {
        const next = { ...current };
        delete next[memberId];
        return next;
      });
      await queryClient.invalidateQueries({ queryKey: getAdminListMembersQueryKey() });
    } catch (error) {
      toast({
        title: error instanceof Error ? error.message : "Failed to update member role",
        variant: "destructive",
      });
    } finally {
      setSavingMemberId(null);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Members Directory</h1>
        <p className="text-muted-foreground mt-1">
          View all registered users of your gym application.
        </p>
      </div>

      <div className="relative max-w-md">
        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
        <Input
          type="search"
          placeholder="Search by name or email..."
          className="pl-8"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          data-testid="input-search-members"
        />
      </div>

      <div className="rounded-md border bg-card text-card-foreground shadow-sm">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Member</TableHead>
              <TableHead>Contact</TableHead>
              <TableHead>Access</TableHead>
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
            ) : filteredMembers.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
                  No members found.
                </TableCell>
              </TableRow>
            ) : (
              filteredMembers.map((member) => {
                const displayName =
                  member.name ||
                  `${member.firstName || ""} ${member.lastName || ""}`.trim() ||
                  "No name provided";
                const draftRole =
                  member.role === "owner"
                    ? undefined
                    : (draftRoles[member.id] ?? (member.role as "member" | "trainer"));
                const hasRoleChange =
                  member.role !== "owner" &&
                  Boolean(draftRoles[member.id]) &&
                  draftRoles[member.id] !== member.role;

                return (
                  <TableRow key={member.id} data-testid={`row-member-${member.id}`}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <div className="bg-primary/10 p-2 rounded-full">
                          <UserCircle className="h-5 w-5 text-primary" />
                        </div>
                        <div className="font-medium">{displayName}</div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center text-sm text-muted-foreground">
                        <Mail className="h-3.5 w-3.5 mr-1.5" />
                        {member.email}
                      </div>
                    </TableCell>
                    <TableCell>
                      {member.role === "owner" ? (
                        <Badge variant="default" className="capitalize">
                          owner
                        </Badge>
                      ) : (
                        <Select
                          value={draftRole}
                          onValueChange={(value: "member" | "trainer") =>
                            setDraftRoles((current) => ({ ...current, [member.id]: value }))
                          }
                        >
                          <SelectTrigger
                            className="w-[140px]"
                            data-testid={`select-member-role-${member.id}`}
                          >
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="member">Member</SelectItem>
                            <SelectItem value="trainer">Trainer</SelectItem>
                          </SelectContent>
                        </Select>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="space-y-1">
                        {member.aiMemorySummary ? (
                          <>
                            <Badge variant="secondary">
                              {member.aiRecentMessageCount} memory notes
                            </Badge>
                            <p className="max-w-[260px] truncate text-sm text-muted-foreground">
                              {member.aiMemorySummary}
                            </p>
                          </>
                        ) : (
                          <span className="text-sm text-muted-foreground">
                            No learned profile yet
                          </span>
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
                      {member.role === "owner" ? (
                        <span className="text-sm text-muted-foreground">Locked</span>
                      ) : (
                        <Button
                          size="sm"
                          variant={hasRoleChange ? "default" : "secondary"}
                          disabled={!hasRoleChange || savingMemberId === member.id}
                          onClick={() => handleRoleSave(member.id)}
                          data-testid={`button-save-member-role-${member.id}`}
                        >
                          {savingMemberId === member.id ? (
                            <>
                              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                              Saving
                            </>
                          ) : (
                            "Save"
                          )}
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
