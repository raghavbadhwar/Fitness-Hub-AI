import React, { useEffect, useState } from "react";
import type { GymClass } from "@workspace/api-client-react";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { buildApiUrl } from "@/lib/api-base";
import { useAuth } from "@clerk/react";

interface EnrolledMember {
  id: string;
  firstName: string | null;
  lastName: string | null;
  email: string;
  role: string;
}

interface EnrollmentsSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  gymClass: GymClass | null;
}

export function EnrollmentsSheet({ open, onOpenChange, gymClass }: EnrollmentsSheetProps) {
  const { getToken } = useAuth();
  const [members, setMembers] = useState<EnrolledMember[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !gymClass) return;

    setLoading(true);
    setError(null);
    setMembers([]);

    (async () => {
      try {
        const token = await getToken();
        const res = await fetch(buildApiUrl(`/api/admin/classes/${gymClass.id}/enrollments`), {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) {
          throw new Error(`HTTP ${res.status}`);
        }
        const data: EnrolledMember[] = await res.json();
        setMembers(data);
      } catch {
        setError("Failed to load enrolled members.");
      } finally {
        setLoading(false);
      }
    })();
  }, [open, gymClass, getToken]);

  const fullName = (m: EnrolledMember) => {
    const parts = [m.firstName, m.lastName].filter(Boolean);
    return parts.length > 0 ? parts.join(" ") : m.email;
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-[400px] sm:w-[480px]">
        <SheetHeader>
          <SheetTitle>Enrolled Members</SheetTitle>
          <SheetDescription>
            {gymClass ? (
              <>
                <strong>{gymClass.name}</strong> &mdash; {gymClass.date} at {gymClass.startTime}
                <br />
                {gymClass.enrolledCount} / {gymClass.maxParticipants} spots filled
              </>
            ) : null}
          </SheetDescription>
        </SheetHeader>

        <div className="mt-6 space-y-3">
          {loading && (
            <div className="text-sm text-muted-foreground animate-pulse">Loading members...</div>
          )}

          {error && <div className="text-sm text-destructive">{error}</div>}

          {!loading && !error && members.length === 0 && (
            <div className="text-sm text-muted-foreground">No members enrolled yet.</div>
          )}

          {!loading &&
            members.map((m) => (
              <div
                key={m.id}
                className="flex items-center justify-between rounded-md border px-3 py-2 text-sm"
                data-testid={`enrollment-member-${m.id}`}
              >
                <div>
                  <div className="font-medium">{fullName(m)}</div>
                  <div className="text-xs text-muted-foreground">{m.email}</div>
                </div>
                <Badge
                  variant={m.role === "owner" ? "default" : "secondary"}
                  className="capitalize"
                >
                  {m.role}
                </Badge>
              </div>
            ))}
        </div>
      </SheetContent>
    </Sheet>
  );
}
