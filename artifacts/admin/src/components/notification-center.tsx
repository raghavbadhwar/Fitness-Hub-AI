import {
  getAdminListClassesQueryKey,
  getAdminListMembersQueryKey,
  useAdminListClasses,
  useAdminListMembers,
  type GymClass,
  type Member,
} from "@workspace/api-client-react";
import {
  AlertTriangle,
  Bell,
  Bot,
  CalendarClock,
  CheckCircle2,
  ShieldAlert,
  Users,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useAuthenticatedRequest } from "@/lib/use-authenticated-request";
import { cn } from "@/lib/utils";

type NotificationCenterProps = {
  classesOverride?: GymClass[];
  membersOverride?: Member[];
};

function isToday(date: string) {
  return date === new Date().toISOString().split("T")[0];
}

function isFull(gymClass: GymClass) {
  return gymClass.enrolledCount >= gymClass.maxParticipants;
}

function isAlmostFull(gymClass: GymClass) {
  if (gymClass.maxParticipants <= 0) return false;
  return gymClass.enrolledCount / gymClass.maxParticipants >= 0.8 && !isFull(gymClass);
}

function buildNotifications(classes: GymClass[] = [], members: Member[] = []) {
  const pendingMembers = members.filter((member) => member.accessStatus === "pending");
  const revokedMembers = members.filter((member) => member.accessStatus === "revoked");
  const fullClasses = classes.filter(
    (gymClass) => gymClass.status === "scheduled" && isFull(gymClass),
  );
  const almostFullClasses = classes.filter(
    (gymClass) => gymClass.status === "scheduled" && isAlmostFull(gymClass),
  );
  const cancelledToday = classes.filter(
    (gymClass) => gymClass.status === "cancelled" && isToday(gymClass.date),
  );

  return [
    {
      id: "pending-members",
      title: `${pendingMembers.length} member${pendingMembers.length === 1 ? "" : "s"} waiting`,
      detail: "Approve or block access before they reach the app.",
      icon: Users,
      tone: pendingMembers.length > 0 ? "warning" : "muted",
      count: pendingMembers.length,
    },
    {
      id: "full-classes",
      title: `${fullClasses.length} full class${fullClasses.length === 1 ? "" : "es"}`,
      detail: "Open a waitlist or add capacity before members hit a dead end.",
      icon: CalendarClock,
      tone: fullClasses.length > 0 ? "critical" : "muted",
      count: fullClasses.length,
    },
    {
      id: "capacity-pressure",
      title: `${almostFullClasses.length} class${almostFullClasses.length === 1 ? "" : "es"} near capacity`,
      detail: "Watch rooms and trainers before peak-hour demand spikes.",
      icon: AlertTriangle,
      tone: almostFullClasses.length > 0 ? "warning" : "muted",
      count: almostFullClasses.length,
    },
    {
      id: "revoked-members",
      title: `${revokedMembers.length} blocked profile${revokedMembers.length === 1 ? "" : "s"}`,
      detail: "Keep access decisions reviewed and intentional.",
      icon: ShieldAlert,
      tone: revokedMembers.length > 0 ? "critical" : "muted",
      count: revokedMembers.length,
    },
    {
      id: "cancelled-today",
      title: `${cancelledToday.length} cancellation${cancelledToday.length === 1 ? "" : "s"} today`,
      detail: "Make sure enrolled members have seen the schedule change.",
      icon: CalendarClock,
      tone: cancelledToday.length > 0 ? "critical" : "muted",
      count: cancelledToday.length,
    },
    {
      id: "ai-health",
      title: "AI coach memory active",
      detail: "Gemini output stays server-side and advisory.",
      icon: Bot,
      tone: "success",
      count: 0,
    },
  ] as const;
}

export function NotificationCenter({ classesOverride, membersOverride }: NotificationCenterProps) {
  const request = useAuthenticatedRequest();
  const { data: classes } = useAdminListClasses({
    query: { enabled: !classesOverride, queryKey: getAdminListClassesQueryKey() },
    request,
  });
  const { data: members } = useAdminListMembers({
    query: { enabled: !membersOverride, queryKey: getAdminListMembersQueryKey() },
    request,
  });
  const notifications = buildNotifications(classesOverride ?? classes, membersOverride ?? members);
  const attentionCount = notifications.reduce((sum, item) => sum + item.count, 0);

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="relative"
          aria-label="Open notification center"
          data-testid="button-notification-center"
        >
          <Bell className="size-5" />
          {attentionCount > 0 ? (
            <span className="absolute right-1 top-1 flex size-4 items-center justify-center rounded-full bg-destructive text-[10px] font-bold text-destructive-foreground">
              {Math.min(attentionCount, 9)}
            </span>
          ) : null}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[360px] p-0">
        <div className="border-b p-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="text-sm font-semibold">Notification Center</div>
              <p className="mt-1 text-xs text-muted-foreground">
                Operational signals from members, capacity, and AI.
              </p>
            </div>
            <Badge variant={attentionCount > 0 ? "destructive" : "secondary"}>
              {attentionCount > 0 ? `${attentionCount} open` : "Clear"}
            </Badge>
          </div>
        </div>
        <div className="max-h-[420px] overflow-y-auto p-2">
          {notifications.map((item) => {
            const Icon = item.icon;
            return (
              <div
                key={item.id}
                className="flex gap-3 rounded-md px-3 py-3 text-sm hover:bg-muted/50"
              >
                <div
                  className={cn(
                    "flex size-9 shrink-0 items-center justify-center rounded-md border",
                    item.tone === "critical" &&
                      "border-destructive/20 bg-destructive/10 text-destructive",
                    item.tone === "warning" &&
                      "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-300",
                    item.tone === "success" &&
                      "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-300",
                    item.tone === "muted" && "bg-muted text-muted-foreground",
                  )}
                >
                  <Icon className="size-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="font-medium text-foreground">{item.title}</div>
                  <div className="mt-1 text-xs leading-5 text-muted-foreground">{item.detail}</div>
                </div>
              </div>
            );
          })}
        </div>
        <div className="flex items-center gap-2 border-t px-4 py-3 text-xs text-muted-foreground">
          <CheckCircle2 className="size-4 text-emerald-600" />
          Live checks update from owner-only admin data.
        </div>
      </PopoverContent>
    </Popover>
  );
}
