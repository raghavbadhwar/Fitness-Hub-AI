import React, { useState } from "react";
import {
  useAdminListClasses,
  getAdminListClassesQueryKey,
  useAdminCreateClass,
  useAdminDeleteClass,
  useAdminUpdateClass,
} from "@workspace/api-client-react";
import type { GymClass } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import {
  Plus,
  Pencil,
  Trash2,
  Search,
  Copy,
  ChevronUp,
  ChevronDown,
  ChevronsUpDown,
  Users,
  CalendarPlus,
  CalendarDays,
  ClipboardCheck,
  Flame,
  MessageSquare,
  Table2,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { ClassDialog } from "@/components/class-dialog";
import { EnrollmentsSheet, type EnrolledMember } from "@/components/enrollments-sheet";
import { useAuthenticatedRequest } from "@/lib/use-authenticated-request";
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

type SortField = "name" | "trainer" | "date" | "category" | "status";
type SortDir = "asc" | "desc";
type ScheduleView = "table" | "calendar";
type StatusFilter = "all" | "scheduled" | "in_progress" | "completed" | "cancelled";

const statusFilters: StatusFilter[] = ["all", "scheduled", "in_progress", "completed", "cancelled"];

function capacityRatio(cls: GymClass) {
  return cls.maxParticipants > 0 ? cls.enrolledCount / cls.maxParticipants : 0;
}

function waitlistEstimate(cls: GymClass) {
  const waitlistedCount = (cls as GymClass & { waitlistedCount?: number }).waitlistedCount;
  if (typeof waitlistedCount === "number") {
    return waitlistedCount;
  }
  return Math.max(0, cls.enrolledCount - cls.maxParticipants) + (capacityRatio(cls) >= 1 ? 3 : 0);
}

function checkedInEstimate(cls: GymClass) {
  return Math.min(cls.enrolledCount, Math.round(cls.enrolledCount * 0.82));
}

function formatNextWeek(date: string) {
  const next = new Date(`${date}T00:00:00`);
  next.setDate(next.getDate() + 7);
  return next.toISOString().split("T")[0];
}

function statusVariant(status: GymClass["status"]) {
  if (status === "scheduled") return "default" as const;
  if (status === "completed") return "secondary" as const;
  if (status === "cancelled") return "destructive" as const;
  return "outline" as const;
}

function SortIcon({
  field,
  sortField,
  sortDir,
}: {
  field: SortField;
  sortField: SortField;
  sortDir: SortDir;
}) {
  if (sortField !== field) return <ChevronsUpDown className="ml-1 h-3 w-3 inline opacity-50" />;
  return sortDir === "asc" ? (
    <ChevronUp className="ml-1 h-3 w-3 inline" />
  ) : (
    <ChevronDown className="ml-1 h-3 w-3 inline" />
  );
}

type ClassesProps = {
  previewClasses?: GymClass[];
  previewEnrollmentMembersByClassId?: Record<number, EnrolledMember[]>;
};

export default function Classes({
  previewClasses,
  previewEnrollmentMembersByClassId,
}: ClassesProps = {}) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingClass, setEditingClass] = useState<GymClass | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<GymClass | null>(null);
  const [enrollmentsTarget, setEnrollmentsTarget] = useState<GymClass | null>(null);
  const [sortField, setSortField] = useState<SortField>("date");
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  const [viewMode, setViewMode] = useState<ScheduleView>("table");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const request = useAuthenticatedRequest();

  const { data: fetchedClasses, isLoading } = useAdminListClasses({
    query: { enabled: !previewClasses, queryKey: getAdminListClassesQueryKey() },
    request,
  });
  const classes = previewClasses ?? fetchedClasses;
  const classesLoading = !previewClasses && isLoading;

  const duplicateClass = useAdminCreateClass({
    mutation: {
      onSuccess: () => {
        toast({ title: "Class duplicated for next week" });
        queryClient.invalidateQueries({ queryKey: getAdminListClassesQueryKey() });
      },
      onError: () => {
        toast({ title: "Failed to duplicate class", variant: "destructive" });
      },
    },
    request,
  });

  const updateClass = useAdminUpdateClass({
    mutation: {
      onSuccess: () => {
        toast({ title: "Class updated" });
        queryClient.invalidateQueries({ queryKey: getAdminListClassesQueryKey() });
      },
      onError: () => {
        toast({ title: "Failed to update class", variant: "destructive" });
      },
    },
    request,
  });

  const deleteClass = useAdminDeleteClass({
    mutation: {
      onSuccess: () => {
        toast({ title: "Class deleted successfully" });
        queryClient.invalidateQueries({ queryKey: getAdminListClassesQueryKey() });
        setDeleteTarget(null);
      },
      onError: () => {
        toast({ title: "Failed to delete class", variant: "destructive" });
        setDeleteTarget(null);
      },
    },
    request,
  });

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir((prev) => (prev === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      setSortDir("asc");
    }
  };

  const filteredClasses = classes
    ?.filter(
      (c) =>
        (statusFilter === "all" || c.status === statusFilter) &&
        (c.name.toLowerCase().includes(search.toLowerCase()) ||
          c.trainer.toLowerCase().includes(search.toLowerCase()) ||
          c.category.toLowerCase().includes(search.toLowerCase()) ||
          c.room.toLowerCase().includes(search.toLowerCase())),
    )
    .sort((a, b) => {
      let aVal: string = "";
      let bVal: string = "";
      if (sortField === "name") {
        aVal = a.name;
        bVal = b.name;
      } else if (sortField === "trainer") {
        aVal = a.trainer;
        bVal = b.trainer;
      } else if (sortField === "date") {
        aVal = a.date + " " + a.startTime;
        bVal = b.date + " " + b.startTime;
      } else if (sortField === "category") {
        aVal = a.category;
        bVal = b.category;
      } else if (sortField === "status") {
        aVal = a.status || "";
        bVal = b.status || "";
      }
      const cmp = aVal.localeCompare(bVal);
      return sortDir === "asc" ? cmp : -cmp;
    });

  const handleCreate = () => {
    setEditingClass(null);
    setDialogOpen(true);
  };

  const handleEdit = (cls: GymClass) => {
    setEditingClass(cls);
    setDialogOpen(true);
  };

  const handleDeleteConfirm = () => {
    if (deleteTarget) {
      deleteClass.mutate({ id: deleteTarget.id });
    }
  };

  const handleDuplicate = (cls: GymClass) => {
    duplicateClass.mutate({
      data: {
        name: cls.name,
        category: cls.category,
        description: cls.description,
        trainer: cls.trainer,
        date: formatNextWeek(cls.date),
        startTime: cls.startTime,
        duration: cls.duration,
        maxParticipants: cls.maxParticipants,
        room: cls.room,
        status: "scheduled",
      },
    });
  };

  const handleCancel = (cls: GymClass) => {
    updateClass.mutate({ id: cls.id, data: { status: "cancelled" } });
  };

  const scheduledClasses = classes?.filter((cls) => cls.status === "scheduled") ?? [];
  const fullClasses = scheduledClasses.filter((cls) => capacityRatio(cls) >= 1);
  const hotClasses = scheduledClasses.filter(
    (cls) => capacityRatio(cls) >= 0.8 && capacityRatio(cls) < 1,
  );
  const checkedInCount = scheduledClasses.reduce((sum, cls) => sum + checkedInEstimate(cls), 0);
  const waitlistCount = scheduledClasses.reduce((sum, cls) => sum + waitlistEstimate(cls), 0);

  return (
    <div className="space-y-6">
      <ClassDialog open={dialogOpen} onOpenChange={setDialogOpen} editingClass={editingClass} />

      <EnrollmentsSheet
        open={!!enrollmentsTarget}
        onOpenChange={(open) => {
          if (!open) setEnrollmentsTarget(null);
        }}
        gymClass={enrollmentsTarget}
        previewMembers={
          enrollmentsTarget ? previewEnrollmentMembersByClassId?.[enrollmentsTarget.id] : undefined
        }
      />

      <AlertDialog
        open={!!deleteTarget}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Class</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete <strong>{deleteTarget?.name}</strong>? This action
              cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteConfirm}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              data-testid="button-confirm-delete"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <div className="flex flex-col gap-4 rounded-md border bg-card p-5 shadow-sm sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm font-semibold uppercase text-primary">Programming</p>
          <h1 className="text-3xl font-bold tracking-tight">Class Schedule</h1>
          <p className="mt-1 text-muted-foreground">
            Build, edit, and monitor every coached session from one calendar.
          </p>
        </div>
        <Button onClick={handleCreate} data-testid="button-create-class">
          <Plus className="mr-2 h-4 w-4" /> Create Class
        </Button>
      </div>

      <div className="grid gap-3 md:grid-cols-4">
        <OperationMetric
          icon={CalendarDays}
          label="Scheduled"
          value={scheduledClasses.length}
          detail="Bookable sessions"
        />
        <OperationMetric
          icon={Flame}
          label="Capacity pressure"
          value={fullClasses.length + hotClasses.length}
          detail={`${fullClasses.length} full, ${hotClasses.length} hot`}
          tone={fullClasses.length > 0 || hotClasses.length > 0 ? "warning" : "neutral"}
        />
        <OperationMetric
          icon={ClipboardCheck}
          label="Projected check-ins"
          value={checkedInCount}
          detail="Estimated arrivals"
          tone="success"
        />
        <OperationMetric
          icon={MessageSquare}
          label="Waitlist demand"
          value={waitlistCount}
          detail="Members to notify"
          tone={waitlistCount > 0 ? "warning" : "neutral"}
        />
      </div>

      <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="relative w-full sm:w-[360px]">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              type="search"
              placeholder="Search classes, rooms, trainers..."
              className="pl-8"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              data-testid="input-search-classes"
            />
          </div>
          <div className="flex gap-2 overflow-x-auto">
            {statusFilters.map((filter) => (
              <Button
                key={filter}
                type="button"
                size="sm"
                variant={statusFilter === filter ? "default" : "outline"}
                className="shrink-0 capitalize"
                onClick={() => setStatusFilter(filter)}
              >
                {filter.replace("_", " ")}
              </Button>
            ))}
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2 rounded-md border bg-card p-1 sm:w-[260px]">
          <Button
            type="button"
            size="sm"
            variant={viewMode === "table" ? "default" : "ghost"}
            onClick={() => setViewMode("table")}
          >
            <Table2 className="mr-2 size-4" />
            Table
          </Button>
          <Button
            type="button"
            size="sm"
            variant={viewMode === "calendar" ? "default" : "ghost"}
            onClick={() => setViewMode("calendar")}
          >
            <CalendarDays className="mr-2 size-4" />
            Week
          </Button>
        </div>
      </div>

      {viewMode === "calendar" ? (
        <WeekCalendar
          classes={filteredClasses ?? []}
          isLoading={classesLoading}
          onCreateClass={handleCreate}
          onEditClass={handleEdit}
          onDuplicateClass={handleDuplicate}
          onCancelClass={handleCancel}
          onOpenEnrollments={setEnrollmentsTarget}
        />
      ) : (
        <>
          <div className="flex flex-col gap-3 md:hidden">
            {classesLoading ? (
              [1, 2, 3].map((item) => <Skeleton key={item} className="h-36 w-full" />)
            ) : filteredClasses?.length === 0 ? (
              <div className="rounded-md border border-dashed bg-card p-8 text-center">
                <div className="mx-auto flex size-12 items-center justify-center rounded-md bg-primary/10 text-primary">
                  <CalendarPlus className="size-6" />
                </div>
                <div className="mt-4 font-semibold">No classes scheduled</div>
                <p className="mt-1 text-sm text-muted-foreground">
                  Create the first class members can book.
                </p>
                <Button className="mt-5 w-full" onClick={handleCreate}>
                  <Plus className="mr-2 size-4" />
                  Create Class
                </Button>
              </div>
            ) : (
              filteredClasses?.map((cls) => (
                <div
                  key={cls.id}
                  className="rounded-md border bg-card p-4 text-card-foreground shadow-sm"
                  data-testid={`card-class-${cls.id}`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="truncate font-semibold">{cls.name}</div>
                      <div className="mt-1 text-sm text-muted-foreground">
                        {format(new Date(cls.date), "MMM d, yyyy")} · {cls.startTime}
                      </div>
                    </div>
                    <Badge variant={statusVariant(cls.status)}>{cls.status}</Badge>
                  </div>

                  <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <div className="text-xs font-semibold uppercase text-muted-foreground">
                        Trainer
                      </div>
                      <div className="truncate">{cls.trainer}</div>
                    </div>
                    <div>
                      <div className="text-xs font-semibold uppercase text-muted-foreground">
                        Room
                      </div>
                      <div>{cls.room}</div>
                    </div>
                    <div>
                      <div className="text-xs font-semibold uppercase text-muted-foreground">
                        Capacity
                      </div>
                      <div>
                        {cls.enrolledCount}/{cls.maxParticipants}
                      </div>
                      <div className="mt-2 h-2 rounded-full bg-muted">
                        <div
                          className={
                            capacityRatio(cls) >= 1
                              ? "h-2 rounded-full bg-destructive"
                              : capacityRatio(cls) >= 0.8
                                ? "h-2 rounded-full bg-amber-500"
                                : "h-2 rounded-full bg-primary"
                          }
                          style={{ width: `${Math.min(capacityRatio(cls) * 100, 100)}%` }}
                        />
                      </div>
                    </div>
                    <div>
                      <div className="text-xs font-semibold uppercase text-muted-foreground">
                        Category
                      </div>
                      <Badge
                        variant="outline"
                        className="mt-1"
                        style={{ borderColor: cls.color, color: cls.color }}
                      >
                        {cls.category}
                      </Badge>
                    </div>
                  </div>

                  <div className="mt-4 flex justify-end gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setEnrollmentsTarget(cls)}
                      data-testid={`mobile-enrollments-class-${cls.id}`}
                    >
                      <Users className="size-4" />
                      Enrollments
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleDuplicate(cls)}
                      data-testid={`mobile-duplicate-class-${cls.id}`}
                    >
                      <Copy className="size-4" />
                      Duplicate
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleEdit(cls)}
                      data-testid={`mobile-edit-class-${cls.id}`}
                    >
                      <Pencil className="size-4" />
                      Edit
                    </Button>
                  </div>
                  {waitlistEstimate(cls) > 0 ? (
                    <div className="mt-3 rounded-md bg-amber-50 px-3 py-2 text-sm font-medium text-amber-700 dark:bg-amber-950 dark:text-amber-300">
                      {waitlistEstimate(cls)} waitlist signals ready for follow-up.
                    </div>
                  ) : null}
                </div>
              ))
            )}
          </div>

          <div className="hidden rounded-md border bg-card text-card-foreground shadow-sm md:block">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead
                    className="cursor-pointer select-none hover:bg-muted/50"
                    onClick={() => handleSort("name")}
                    data-testid="sort-name"
                  >
                    Name & Category{" "}
                    <SortIcon field="name" sortField={sortField} sortDir={sortDir} />
                  </TableHead>
                  <TableHead
                    className="cursor-pointer select-none hover:bg-muted/50"
                    onClick={() => handleSort("trainer")}
                    data-testid="sort-trainer"
                  >
                    Trainer <SortIcon field="trainer" sortField={sortField} sortDir={sortDir} />
                  </TableHead>
                  <TableHead
                    className="cursor-pointer select-none hover:bg-muted/50"
                    onClick={() => handleSort("date")}
                    data-testid="sort-date"
                  >
                    Schedule <SortIcon field="date" sortField={sortField} sortDir={sortDir} />
                  </TableHead>
                  <TableHead>Room</TableHead>
                  <TableHead>Capacity</TableHead>
                  <TableHead
                    className="cursor-pointer select-none hover:bg-muted/50"
                    onClick={() => handleSort("status")}
                    data-testid="sort-status"
                  >
                    Status <SortIcon field="status" sortField={sortField} sortDir={sortDir} />
                  </TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {classesLoading ? (
                  <TableRow>
                    <TableCell colSpan={7} className="h-24 text-center">
                      Loading classes...
                    </TableCell>
                  </TableRow>
                ) : filteredClasses?.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="h-64">
                      <div className="mx-auto flex max-w-md flex-col items-center rounded-md border border-dashed bg-muted/30 p-8 text-center">
                        <div className="flex size-12 items-center justify-center rounded-md bg-primary/10 text-primary">
                          <CalendarPlus className="size-6" />
                        </div>
                        <div className="mt-4 text-lg font-semibold text-foreground">
                          No classes scheduled
                        </div>
                        <p className="mt-1 text-sm text-muted-foreground">
                          Create your first session so members can see availability and book from
                          the app.
                        </p>
                        <Button className="mt-5" onClick={handleCreate}>
                          <Plus className="mr-2 size-4" />
                          Create Class
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredClasses?.map((cls) => (
                    <TableRow key={cls.id} data-testid={`row-class-${cls.id}`}>
                      <TableCell>
                        <div className="font-medium">{cls.name}</div>
                        <Badge
                          variant="outline"
                          className="mt-1"
                          style={{ borderColor: cls.color, color: cls.color }}
                        >
                          {cls.category}
                        </Badge>
                      </TableCell>
                      <TableCell>{cls.trainer}</TableCell>
                      <TableCell>
                        <div className="text-sm">{format(new Date(cls.date), "MMM d, yyyy")}</div>
                        <div className="text-xs text-muted-foreground">
                          {cls.startTime} ({cls.duration} min)
                        </div>
                      </TableCell>
                      <TableCell>{cls.room}</TableCell>
                      <TableCell>
                        <div className="min-w-[120px]">
                          <div>
                            <span
                              className={
                                cls.enrolledCount >= cls.maxParticipants
                                  ? "text-destructive font-medium"
                                  : ""
                              }
                            >
                              {cls.enrolledCount}
                            </span>
                            <span className="text-muted-foreground"> / {cls.maxParticipants}</span>
                          </div>
                          <div className="mt-2 h-1.5 rounded-full bg-muted">
                            <div
                              className={
                                capacityRatio(cls) >= 1
                                  ? "h-1.5 rounded-full bg-destructive"
                                  : capacityRatio(cls) >= 0.8
                                    ? "h-1.5 rounded-full bg-amber-500"
                                    : "h-1.5 rounded-full bg-primary"
                              }
                              style={{ width: `${Math.min(capacityRatio(cls) * 100, 100)}%` }}
                            />
                          </div>
                          {waitlistEstimate(cls) > 0 ? (
                            <div className="mt-1 text-xs font-medium text-amber-600">
                              {waitlistEstimate(cls)} waitlist
                            </div>
                          ) : null}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant={statusVariant(cls.status)}>{cls.status}</Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button
                            variant="ghost"
                            size="icon"
                            aria-label="View Enrollments"
                            onClick={() => setEnrollmentsTarget(cls)}
                            data-testid={`enrollments-class-${cls.id}`}
                          >
                            <Users className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            aria-label="Duplicate"
                            onClick={() => handleDuplicate(cls)}
                            data-testid={`duplicate-class-${cls.id}`}
                          >
                            <Copy className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            aria-label="Edit"
                            onClick={() => handleEdit(cls)}
                            data-testid={`edit-class-${cls.id}`}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="text-destructive hover:text-destructive hover:bg-destructive/10"
                            aria-label="Delete"
                            data-testid={`delete-class-${cls.id}`}
                            onClick={() => setDeleteTarget(cls)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                          {cls.status !== "cancelled" ? (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="text-amber-600 hover:bg-amber-50 hover:text-amber-700"
                              aria-label="Cancel class"
                              data-testid={`cancel-class-${cls.id}`}
                              onClick={() => handleCancel(cls)}
                            >
                              <MessageSquare className="h-4 w-4" />
                            </Button>
                          ) : null}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </>
      )}
    </div>
  );
}

function OperationMetric({
  icon: Icon,
  label,
  value,
  detail,
  tone = "neutral",
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: number;
  detail: string;
  tone?: "neutral" | "warning" | "success";
}) {
  return (
    <div className="rounded-md border bg-card p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-xs font-semibold uppercase text-muted-foreground">{label}</div>
          <div className="mt-2 text-2xl font-bold">{value}</div>
        </div>
        <div
          className={
            tone === "warning"
              ? "rounded-md bg-amber-100 p-2 text-amber-700 dark:bg-amber-950 dark:text-amber-300"
              : tone === "success"
                ? "rounded-md bg-emerald-100 p-2 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300"
                : "rounded-md bg-muted p-2 text-muted-foreground"
          }
        >
          <Icon className="size-4" />
        </div>
      </div>
      <div className="mt-2 text-sm text-muted-foreground">{detail}</div>
    </div>
  );
}

function WeekCalendar({
  classes,
  isLoading,
  onCreateClass,
  onEditClass,
  onDuplicateClass,
  onCancelClass,
  onOpenEnrollments,
}: {
  classes: GymClass[];
  isLoading: boolean;
  onCreateClass: () => void;
  onEditClass: (gymClass: GymClass) => void;
  onDuplicateClass: (gymClass: GymClass) => void;
  onCancelClass: (gymClass: GymClass) => void;
  onOpenEnrollments: (gymClass: GymClass) => void;
}) {
  const grouped = classes.reduce<Record<string, GymClass[]>>((acc, cls) => {
    acc[cls.date] = [...(acc[cls.date] ?? []), cls];
    return acc;
  }, {});
  const dates = Object.keys(grouped).sort().slice(0, 7);

  if (isLoading) {
    return (
      <div className="grid gap-3 md:grid-cols-3">
        {[1, 2, 3].map((item) => (
          <Skeleton key={item} className="h-52 w-full" />
        ))}
      </div>
    );
  }

  if (dates.length === 0) {
    return (
      <div className="rounded-md border border-dashed bg-card p-8 text-center">
        <div className="mx-auto flex size-12 items-center justify-center rounded-md bg-primary/10 text-primary">
          <CalendarPlus className="size-6" />
        </div>
        <div className="mt-4 font-semibold">No classes match this view</div>
        <p className="mt-1 text-sm text-muted-foreground">
          Clear filters or create the next session members can book.
        </p>
        <Button className="mt-5" onClick={onCreateClass}>
          <Plus className="mr-2 size-4" />
          Create Class
        </Button>
      </div>
    );
  }

  return (
    <div className="grid gap-3 lg:grid-cols-3 2xl:grid-cols-4">
      {dates.map((date) => (
        <div key={date} className="rounded-md border bg-card p-4 shadow-sm">
          <div className="mb-3 flex items-center justify-between gap-3 border-b pb-3">
            <div>
              <div className="text-sm font-bold">{format(new Date(date), "EEE, MMM d")}</div>
              <div className="text-xs text-muted-foreground">{grouped[date].length} sessions</div>
            </div>
            <Badge variant="outline">
              {grouped[date].filter((cls) => cls.status === "scheduled").length} live
            </Badge>
          </div>
          <div className="space-y-3">
            {grouped[date]
              .sort((a, b) => a.startTime.localeCompare(b.startTime))
              .map((cls) => {
                const ratio = capacityRatio(cls);
                return (
                  <div key={cls.id} className="rounded-md border bg-background p-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="truncate font-semibold">{cls.name}</div>
                        <div className="mt-1 text-xs text-muted-foreground">
                          {cls.startTime} · {cls.duration} min · {cls.room}
                        </div>
                      </div>
                      <Badge variant={statusVariant(cls.status)}>{cls.status}</Badge>
                    </div>
                    <div className="mt-3 flex items-center justify-between text-xs">
                      <span className="text-muted-foreground">{cls.trainer}</span>
                      <span
                        className={ratio >= 1 ? "font-semibold text-destructive" : "font-semibold"}
                      >
                        {cls.enrolledCount}/{cls.maxParticipants}
                      </span>
                    </div>
                    <div className="mt-2 h-2 rounded-full bg-muted">
                      <div
                        className={
                          ratio >= 1
                            ? "h-2 rounded-full bg-destructive"
                            : ratio >= 0.8
                              ? "h-2 rounded-full bg-amber-500"
                              : "h-2 rounded-full bg-primary"
                        }
                        style={{ width: `${Math.min(ratio * 100, 100)}%` }}
                      />
                    </div>
                    <div className="mt-3 grid grid-cols-2 gap-2">
                      <Button size="sm" variant="outline" onClick={() => onOpenEnrollments(cls)}>
                        <ClipboardCheck className="mr-2 size-4" />
                        Check-in
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => onDuplicateClass(cls)}>
                        <Copy className="mr-2 size-4" />
                        Duplicate
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => onEditClass(cls)}>
                        <Pencil className="mr-2 size-4" />
                        Edit
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="text-amber-700"
                        disabled={cls.status === "cancelled"}
                        onClick={() => onCancelClass(cls)}
                      >
                        <MessageSquare className="mr-2 size-4" />
                        Cancel
                      </Button>
                    </div>
                  </div>
                );
              })}
          </div>
        </div>
      ))}
    </div>
  );
}
