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
import { Button } from "@/components/ui/button";
import { buildApiUrl } from "@/lib/api-base";
import { useAuth } from "@clerk/react";
import { CheckCircle2, ClipboardCheck, Clock, UserMinus, Users } from "lucide-react";

export type AttendanceStatus = "booked" | "checked_in" | "no_show";

export interface EnrolledMember {
  id: string;
  firstName: string | null;
  lastName: string | null;
  email: string;
  role: string;
  attendanceStatus?: AttendanceStatus;
}

interface EnrollmentsSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  gymClass: GymClass | null;
  previewMembers?: EnrolledMember[];
}

export function EnrollmentsSheet({
  open,
  onOpenChange,
  gymClass,
  previewMembers,
}: EnrollmentsSheetProps) {
  const { getToken } = useAuth();
  const [members, setMembers] = useState<EnrolledMember[]>([]);
  const [checkedInIds, setCheckedInIds] = useState<string[]>([]);
  const [noShowIds, setNoShowIds] = useState<string[]>([]);
  const [savingAttendanceId, setSavingAttendanceId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !gymClass) return;

    setLoading(true);
    setError(null);
    setMembers([]);
    setCheckedInIds([]);
    setNoShowIds([]);
    setSavingAttendanceId(null);

    if (previewMembers) {
      setMembers(previewMembers);
      setCheckedInIds(
        previewMembers
          .filter((member) => member.attendanceStatus === "checked_in")
          .map((member) => member.id),
      );
      setNoShowIds(
        previewMembers
          .filter((member) => member.attendanceStatus === "no_show")
          .map((member) => member.id),
      );
      setLoading(false);
      return;
    }

    (async () => {
      try {
        const token = await getToken();
        if (!token) {
          throw new Error("Missing auth token");
        }
        const res = await fetch(buildApiUrl(`/api/admin/classes/${gymClass.id}/enrollments`), {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) {
          throw new Error(`HTTP ${res.status}`);
        }
        const data: EnrolledMember[] = await res.json();
        setMembers(data);
        setCheckedInIds(
          data
            .filter((member) => member.attendanceStatus === "checked_in")
            .map((member) => member.id),
        );
        setNoShowIds(
          data.filter((member) => member.attendanceStatus === "no_show").map((member) => member.id),
        );
      } catch {
        setError("Failed to load enrolled members.");
      } finally {
        setLoading(false);
      }
    })();
  }, [open, gymClass, getToken, previewMembers]);

  const setAttendance = async (memberId: string, status: AttendanceStatus) => {
    if (!gymClass) return;

    setSavingAttendanceId(memberId);
    setError(null);
    try {
      if (!previewMembers) {
        const token = await getToken();
        if (!token) {
          throw new Error("Missing auth token");
        }
        const response = await fetch(
          buildApiUrl(
            `/api/admin/classes/${gymClass.id}/enrollments/${encodeURIComponent(memberId)}`,
          ),
          {
            method: "PATCH",
            headers: {
              Authorization: `Bearer ${token}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ attendanceStatus: status }),
          },
        );
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }
      }

      setMembers((current) =>
        current.map((member) =>
          member.id === memberId ? { ...member, attendanceStatus: status } : member,
        ),
      );
      setCheckedInIds((current) =>
        status === "checked_in"
          ? current.includes(memberId)
            ? current
            : [...current, memberId]
          : current.filter((id) => id !== memberId),
      );
      setNoShowIds((current) =>
        status === "no_show"
          ? current.includes(memberId)
            ? current
            : [...current, memberId]
          : current.filter((id) => id !== memberId),
      );
    } catch {
      setError("Failed to update attendance. Please try again.");
    } finally {
      setSavingAttendanceId(null);
    }
  };

  const fullName = (m: EnrolledMember) => {
    const parts = [m.firstName, m.lastName].filter(Boolean);
    return parts.length > 0 ? parts.join(" ") : m.email;
  };
  const waitlistSize = gymClass
    ? ((gymClass as GymClass & { waitlistedCount?: number }).waitlistedCount ?? null)
    : null;
  const attendanceTotal = Math.max(members.length, gymClass?.enrolledCount ?? 0);
  const attendanceRate =
    attendanceTotal > 0 ? Math.round((checkedInIds.length / attendanceTotal) * 100) : 0;

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

        <div className="mt-6 space-y-4">
          {gymClass ? (
            <div className="grid grid-cols-3 gap-2">
              <div className="rounded-md border bg-muted/30 p-3">
                <Users className="size-4 text-primary" />
                <div className="mt-2 text-lg font-bold">{gymClass.enrolledCount}</div>
                <div className="text-xs text-muted-foreground">Booked</div>
              </div>
              <div className="rounded-md border bg-muted/30 p-3">
                <ClipboardCheck className="size-4 text-primary" />
                <div className="mt-2 text-lg font-bold">{checkedInIds.length}</div>
                <div className="text-xs text-muted-foreground">Checked in</div>
              </div>
              <div className="rounded-md border bg-muted/30 p-3">
                <Clock className="size-4 text-primary" />
                <div className="mt-2 text-lg font-bold">{waitlistSize ?? "—"}</div>
                <div className="text-xs text-muted-foreground">Waitlist</div>
              </div>
            </div>
          ) : null}

          {gymClass ? (
            <div className="rounded-md border bg-primary/5 p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-sm font-semibold">Class Check-in</div>
                  <div className="mt-1 text-xs text-muted-foreground">
                    QR code string for front-desk scan:{" "}
                    <span className="font-mono text-foreground">
                      GYM-{gymClass.id}-{gymClass.date}
                    </span>
                  </div>
                </div>
                <Badge variant="secondary">{attendanceRate}% in</Badge>
              </div>
              <div className="mt-3 h-2 rounded-full bg-muted">
                <div
                  className="h-2 rounded-full bg-primary"
                  style={{ width: `${Math.min(attendanceRate, 100)}%` }}
                />
              </div>
            </div>
          ) : null}

          {loading && (
            <div className="text-sm text-muted-foreground animate-pulse">Loading members...</div>
          )}

          {error && <div className="text-sm text-destructive">{error}</div>}

          {!loading && !error && members.length === 0 && (
            <div className="rounded-md border border-dashed p-6 text-sm text-muted-foreground">
              No members enrolled yet. When members book this class, this panel becomes the
              check-in, no-show, and waitlist workspace.
            </div>
          )}

          {!loading &&
            members.map((m) => (
              <div
                key={m.id}
                className="rounded-md border px-3 py-3 text-sm"
                data-testid={`enrollment-member-${m.id}`}
              >
                <div className="flex items-start justify-between gap-3">
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
                <div className="mt-3 flex flex-wrap justify-end gap-2">
                  <Button
                    size="sm"
                    variant={checkedInIds.includes(m.id) ? "default" : "outline"}
                    disabled={savingAttendanceId === m.id}
                    onClick={() => void setAttendance(m.id, "checked_in")}
                  >
                    <CheckCircle2 className="mr-2 size-4" />
                    {savingAttendanceId === m.id ? "Saving..." : "Checked in"}
                  </Button>
                  <Button
                    size="sm"
                    variant={noShowIds.includes(m.id) ? "destructive" : "outline"}
                    disabled={savingAttendanceId === m.id}
                    onClick={() => void setAttendance(m.id, "no_show")}
                  >
                    <UserMinus className="mr-2 size-4" />
                    No-show
                  </Button>
                </div>
              </div>
            ))}
          {waitlistSize !== null && waitlistSize > 0 ? (
            <div className="rounded-md border border-amber-200 bg-amber-50 p-4 text-sm dark:border-amber-900 dark:bg-amber-950">
              <div className="font-semibold text-amber-800 dark:text-amber-200">Waitlist ready</div>
              <p className="mt-1 text-amber-700 dark:text-amber-300">
                {waitlistSize} member signals should receive a spot-open or add-capacity message.
              </p>
            </div>
          ) : null}
        </div>
      </SheetContent>
    </Sheet>
  );
}
