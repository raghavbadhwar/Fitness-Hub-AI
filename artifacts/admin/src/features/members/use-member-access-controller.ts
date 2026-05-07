import { useState, type FormEvent } from "react";
import {
  getAdminListMembersQueryKey,
  useAdminSetMemberAccess,
  type CustomFetchOptions,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { normalizeMemberEmail } from "./member-utils";
import type { DraftMemberRoles, MemberRole, SetMemberAccessInput } from "./types";

export function useMemberAccessController(request?: Pick<CustomFetchOptions, "authToken">) {
  const [draftRoles, setDraftRoles] = useState<DraftMemberRoles>({});
  const [savingEmail, setSavingEmail] = useState<string | null>(null);
  const [grantEmail, setGrantEmail] = useState("");
  const [grantRole, setGrantRole] = useState<MemberRole>("member");
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const setMemberAccessMutation = useAdminSetMemberAccess({ request });

  const refreshMembers = async () => {
    await queryClient.invalidateQueries({ queryKey: getAdminListMembersQueryKey() });
  };

  const setAccess = async ({ email, role, accessStatus }: SetMemberAccessInput) => {
    const normalizedEmail = normalizeMemberEmail(email);
    if (!normalizedEmail) {
      return;
    }

    setSavingEmail(normalizedEmail);

    try {
      await setMemberAccessMutation.mutateAsync({
        data: { email: normalizedEmail, role, accessStatus },
      });

      toast({
        title:
          accessStatus === "approved"
            ? "Member can now open the app"
            : "Member is blocked from the app",
      });
      setDraftRoles((current) => {
        const next = { ...current };
        delete next[normalizedEmail];
        return next;
      });
      await refreshMembers();
    } catch (error) {
      toast({
        title: error instanceof Error ? error.message : "Failed to update member access",
        variant: "destructive",
      });
    } finally {
      setSavingEmail(null);
    }
  };

  const handleGrantSubmit = async (event: FormEvent) => {
    event.preventDefault();
    await setAccess({
      email: grantEmail,
      role: grantRole,
      accessStatus: "approved",
    });
    setGrantEmail("");
    setGrantRole("member");
  };

  return {
    draftRoles,
    grantEmail,
    grantRole,
    savingEmail,
    handleGrantSubmit,
    setAccess,
    setDraftRoles,
    setGrantEmail,
    setGrantRole,
  };
}
