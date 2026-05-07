import React from "react";
import {
  getAdminGetDashboardQueryKey,
  getAdminListClassesQueryKey,
  getAdminListMembersQueryKey,
  useAdminGetDashboard,
  useAdminListClasses,
  useAdminListMembers,
  type DashboardStats,
  type GymClass,
  type Member,
} from "@workspace/api-client-react";
import { Link } from "wouter";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuthenticatedRequest } from "@/lib/use-authenticated-request";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import {
  AlertCircle,
  ArrowRight,
  CalendarDays,
  CheckCircle2,
  Clock,
  Dumbbell,
  Flame,
  Megaphone,
  ShieldCheck,
  UserCheck,
  Users,
  type LucideIcon,
} from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { format } from "date-fns";

function compareClassStart(a: GymClass, b: GymClass) {
  return `${a.date} ${a.startTime}`.localeCompare(`${b.date} ${b.startTime}`);
}

function CommandSignal({
  icon: Icon,
  label,
  value,
  detail,
  tone,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
  detail: string;
  tone: "primary" | "success" | "warning";
}) {
  return (
    <div className="rounded-md border bg-background p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-xs font-semibold uppercase text-muted-foreground">{label}</div>
          <div className="mt-2 line-clamp-2 text-xl font-bold">{value}</div>
        </div>
        <div
          className={
            tone === "warning"
              ? "rounded-md bg-amber-100 p-2 text-amber-700 dark:bg-amber-950 dark:text-amber-300"
              : tone === "success"
                ? "rounded-md bg-emerald-100 p-2 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300"
                : "rounded-md bg-primary/10 p-2 text-primary"
          }
        >
          <Icon className="size-4" />
        </div>
      </div>
      <div className="mt-3 text-sm text-muted-foreground">{detail}</div>
    </div>
  );
}

function QuickAction({
  href,
  icon: Icon,
  label,
}: {
  href: string;
  icon: LucideIcon;
  label: string;
}) {
  return (
    <Button variant="outline" className="h-auto justify-between gap-3 px-3 py-3" asChild>
      <Link href={href}>
        <span className="flex min-w-0 items-center gap-3 text-left">
          <Icon className="size-4 shrink-0 text-primary" />
          <span className="truncate">{label}</span>
        </span>
        <ArrowRight className="size-4 shrink-0 text-muted-foreground" />
      </Link>
    </Button>
  );
}

function capacityRatio(gymClass: GymClass) {
  if (gymClass.maxParticipants <= 0) return 0;
  return gymClass.enrolledCount / gymClass.maxParticipants;
}

function getClassLabel(gymClass?: GymClass) {
  if (!gymClass) return "No class scheduled";
  return `${format(new Date(`${gymClass.date}T00:00:00`), "MMM d")} · ${gymClass.startTime}`;
}

export default function Dashboard() {
  const request = useAuthenticatedRequest();
  const {
    data: stats,
    isLoading,
    error,
  } = useAdminGetDashboard({
    query: { queryKey: getAdminGetDashboardQueryKey() },
    request,
  });
  const { data: classes, isLoading: classesLoading } = useAdminListClasses({
    query: { queryKey: getAdminListClassesQueryKey() },
    request,
  });
  const { data: members, isLoading: membersLoading } = useAdminListMembers({
    query: { queryKey: getAdminListMembersQueryKey() },
    request,
  });

  const upcomingClasses = React.useMemo(
    () =>
      (classes ?? [])
        .filter((gymClass) => gymClass.status !== "cancelled")
        .sort(compareClassStart)
        .slice(0, 5),
    [classes],
  );

  if (isLoading) {
    return (
      <div className="flex flex-col gap-6">
        <div className="flex flex-col gap-2">
          <Skeleton className="h-9 w-48" />
          <Skeleton className="h-5 w-80 max-w-full" />
        </div>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {[1, 2, 3, 4].map((item) => (
            <Card key={item}>
              <CardHeader className="pb-2">
                <Skeleton className="h-4 w-28" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-8 w-16" />
                <Skeleton className="mt-3 h-3 w-32" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <Empty className="border bg-card">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <AlertCircle className="size-5 text-destructive" />
          </EmptyMedia>
          <EmptyTitle>Error Loading Dashboard</EmptyTitle>
          <EmptyDescription>
            There was a problem fetching the dashboard statistics. Please try again later.
          </EmptyDescription>
        </EmptyHeader>
      </Empty>
    );
  }

  if (!stats) return null;

  return (
    <DashboardContent
      stats={stats}
      upcomingClasses={upcomingClasses}
      classesLoading={classesLoading}
      members={members ?? []}
      membersLoading={membersLoading}
    />
  );
}

export function DashboardContent({
  stats,
  upcomingClasses,
  classesLoading = false,
  members = [],
  membersLoading = false,
}: {
  stats: DashboardStats;
  upcomingClasses: GymClass[];
  classesLoading?: boolean;
  members?: Member[];
  membersLoading?: boolean;
}) {
  const nextClass = upcomingClasses[0];
  const fullClasses = upcomingClasses.filter((gymClass) => capacityRatio(gymClass) >= 1);
  const pressureClasses = upcomingClasses.filter(
    (gymClass) => capacityRatio(gymClass) >= 0.8 && capacityRatio(gymClass) < 1,
  );
  const pendingMembers = members.filter((member) => member.accessStatus === "pending");
  const aiActiveMembers = members.filter((member) => member.aiRecentMessageCount > 0);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
          <p className="mt-1 text-muted-foreground">
            A live operating view of classes, members, and capacity this week.
          </p>
        </div>
        <div className="flex items-center gap-2 rounded-md border bg-card px-3 py-2 text-sm text-muted-foreground">
          <Clock className="size-4 text-primary" />
          Updated from owner-only admin data
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.25fr)_minmax(360px,0.75fr)]">
        <Card className="overflow-hidden border-primary/20">
          <CardHeader className="border-b bg-primary/5">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <CardTitle>Today Command Center</CardTitle>
                <CardDescription>
                  What needs the owner or trainer to act before members feel it.
                </CardDescription>
              </div>
              <Badge variant="secondary" className="w-fit">
                Live ops
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="grid gap-3 p-4 md:grid-cols-3">
            <CommandSignal
              icon={CalendarDays}
              label="Next class"
              value={nextClass?.name ?? "No session"}
              detail={getClassLabel(nextClass)}
              tone="primary"
            />
            <CommandSignal
              icon={Flame}
              label="Capacity pressure"
              value={`${fullClasses.length + pressureClasses.length} class${fullClasses.length + pressureClasses.length === 1 ? "" : "es"}`}
              detail={
                fullClasses.length > 0
                  ? `${fullClasses.length} full, open waitlist`
                  : pressureClasses.length > 0
                    ? `${pressureClasses.length} nearly full`
                    : "Rooms have breathing room"
              }
              tone={fullClasses.length > 0 || pressureClasses.length > 0 ? "warning" : "success"}
            />
            <CommandSignal
              icon={UserCheck}
              label="Access queue"
              value={membersLoading ? "Checking" : `${pendingMembers.length} waiting`}
              detail={
                pendingMembers.length > 0 ? "Approve before sign-in friction" : "No access queue"
              }
              tone={pendingMembers.length > 0 ? "warning" : "success"}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Quick Actions</CardTitle>
            <CardDescription>Keep the day moving without hunting through tables.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-2">
            <QuickAction href="/classes" icon={CalendarDays} label="Create or duplicate a class" />
            <QuickAction href="/members" icon={ShieldCheck} label="Approve member access" />
            <QuickAction href="/classes" icon={Megaphone} label="Notify a full class waitlist" />
            <QuickAction
              href="/members"
              icon={CheckCircle2}
              label={`${aiActiveMembers.length} AI-informed member profile${aiActiveMembers.length === 1 ? "" : "s"}`}
            />
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Card className="border-primary/20" data-testid="stat-card-classes">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Classes This Week</CardTitle>
            <CalendarDays className="size-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-stat-classes">
              {stats.totalClassesThisWeek}
            </div>
            <p className="text-xs text-muted-foreground">Scheduled sessions</p>
          </CardContent>
        </Card>

        <Card data-testid="stat-card-enrollments">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Enrollments</CardTitle>
            <Users className="size-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-stat-enrollments">
              {stats.totalEnrollments}
            </div>
            <p className="text-xs text-muted-foreground">Across all classes</p>
          </CardContent>
        </Card>

        <Card data-testid="stat-card-members">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Members</CardTitle>
            <Users className="size-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-stat-members">
              {stats.totalActiveMembers}
            </div>
            <p className="text-xs text-muted-foreground">Registered accounts</p>
          </CardContent>
        </Card>

        <Card data-testid="stat-card-popular">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Most Popular</CardTitle>
            <Dumbbell className="size-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold capitalize" data-testid="text-stat-popular">
              {stats.mostPopularCategory || "N/A"}
            </div>
            <p className="text-xs text-muted-foreground">Top class category</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.4fr)_minmax(340px,0.8fr)]">
        <Card data-testid="chart-weekly-classes">
          <CardHeader>
            <CardTitle>Weekly Class Distribution</CardTitle>
            <CardDescription>Number of classes scheduled per day</CardDescription>
          </CardHeader>
          <CardContent className="pl-2">
            <div className="h-[320px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={stats.weeklyClassCounts}
                  margin={{ top: 10, right: 12, left: -20, bottom: 0 }}
                >
                  <CartesianGrid
                    strokeDasharray="3 3"
                    vertical={false}
                    stroke="hsl(var(--border))"
                  />
                  <XAxis
                    dataKey="day"
                    tickLine={false}
                    axisLine={false}
                    tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }}
                    dy={10}
                  />
                  <YAxis
                    tickLine={false}
                    axisLine={false}
                    tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }}
                  />
                  <Tooltip
                    cursor={{ fill: "hsl(var(--muted))" }}
                    contentStyle={{
                      backgroundColor: "hsl(var(--card))",
                      borderColor: "hsl(var(--border))",
                      borderRadius: "var(--radius)",
                    }}
                  />
                  <Bar dataKey="count" fill="#FF6B00" radius={[4, 4, 0, 0]} name="Classes" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Upcoming Classes</CardTitle>
            <CardDescription>Fast scan for today and the next scheduled sessions.</CardDescription>
          </CardHeader>
          <CardContent>
            {classesLoading ? (
              <div className="flex flex-col gap-3">
                {[1, 2, 3].map((item) => (
                  <Skeleton key={item} className="h-16 w-full" />
                ))}
              </div>
            ) : upcomingClasses.length === 0 ? (
              <Empty className="border bg-muted/30 p-6">
                <EmptyHeader>
                  <EmptyMedia variant="icon">
                    <CalendarDays className="size-5 text-primary" />
                  </EmptyMedia>
                  <EmptyTitle>No classes scheduled</EmptyTitle>
                  <EmptyDescription>
                    Create the next class from the Classes screen.
                  </EmptyDescription>
                </EmptyHeader>
              </Empty>
            ) : (
              <div className="flex flex-col gap-3">
                <div className="hidden grid-cols-[1fr_1.4fr_1fr_auto] gap-3 border-b pb-2 text-xs font-semibold uppercase text-muted-foreground sm:grid">
                  <span>Time</span>
                  <span>Class</span>
                  <span>Trainer</span>
                  <span className="text-right">Enrolled</span>
                </div>
                {upcomingClasses.map((gymClass) => (
                  <div
                    key={gymClass.id}
                    className="rounded-md border bg-background p-3 sm:grid sm:grid-cols-[1fr_1.4fr_1fr_auto] sm:items-center sm:gap-3"
                  >
                    <div className="text-sm text-muted-foreground">
                      {format(new Date(gymClass.date), "MMM d")} · {gymClass.startTime}
                    </div>
                    <div className="mt-2 min-w-0 sm:mt-0">
                      <div className="truncate font-semibold">{gymClass.name}</div>
                      <Badge
                        variant={gymClass.status === "scheduled" ? "default" : "secondary"}
                        className="mt-2 sm:hidden"
                      >
                        {gymClass.status}
                      </Badge>
                    </div>
                    <div className="mt-2 truncate text-sm text-muted-foreground sm:mt-0">
                      {gymClass.trainer}
                    </div>
                    <div className="mt-3 flex items-center justify-between gap-2 sm:mt-0 sm:flex-col sm:items-end">
                      <Badge
                        variant={gymClass.status === "scheduled" ? "default" : "secondary"}
                        className="hidden sm:inline-flex"
                      >
                        {gymClass.status}
                      </Badge>
                      <span className="text-xs text-muted-foreground">
                        {gymClass.enrolledCount}/{gymClass.maxParticipants}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
