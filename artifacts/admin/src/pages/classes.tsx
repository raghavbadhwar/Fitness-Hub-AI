import React, { useState } from "react";
import {
  useAdminListClasses,
  getAdminListClassesQueryKey,
  useAdminDeleteClass,
} from "@workspace/api-client-react";
import type { GymClass } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import {
  Plus,
  Pencil,
  Trash2,
  Search,
  ChevronUp,
  ChevronDown,
  ChevronsUpDown,
  Users,
} from "lucide-react";
import { Input } from "@/components/ui/input";
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
import { EnrollmentsSheet } from "@/components/enrollments-sheet";
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

export default function Classes() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingClass, setEditingClass] = useState<GymClass | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<GymClass | null>(null);
  const [enrollmentsTarget, setEnrollmentsTarget] = useState<GymClass | null>(null);
  const [sortField, setSortField] = useState<SortField>("date");
  const [sortDir, setSortDir] = useState<SortDir>("asc");

  const { data: classes, isLoading } = useAdminListClasses({
    query: { queryKey: getAdminListClassesQueryKey() },
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
        c.name.toLowerCase().includes(search.toLowerCase()) ||
        c.trainer.toLowerCase().includes(search.toLowerCase()) ||
        c.category.toLowerCase().includes(search.toLowerCase()),
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

  return (
    <div className="space-y-6">
      <ClassDialog open={dialogOpen} onOpenChange={setDialogOpen} editingClass={editingClass} />

      <EnrollmentsSheet
        open={!!enrollmentsTarget}
        onOpenChange={(open) => {
          if (!open) setEnrollmentsTarget(null);
        }}
        gymClass={enrollmentsTarget}
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

      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Class Schedule</h1>
          <p className="text-muted-foreground mt-1">Manage all your gym classes and sessions.</p>
        </div>
        <Button onClick={handleCreate} data-testid="button-create-class">
          <Plus className="mr-2 h-4 w-4" /> Create Class
        </Button>
      </div>

      <div className="flex items-center gap-2 max-w-sm">
        <div className="relative w-full">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            type="search"
            placeholder="Search classes..."
            className="pl-8"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            data-testid="input-search-classes"
          />
        </div>
      </div>

      <div className="rounded-md border bg-card text-card-foreground shadow-sm">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead
                className="cursor-pointer select-none hover:bg-muted/50"
                onClick={() => handleSort("name")}
                data-testid="sort-name"
              >
                Name & Category <SortIcon field="name" sortField={sortField} sortDir={sortDir} />
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
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={7} className="h-24 text-center">
                  Loading classes...
                </TableCell>
              </TableRow>
            ) : filteredClasses?.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="h-24 text-center text-muted-foreground">
                  No classes found matching your criteria.
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
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant={
                        cls.status === "scheduled"
                          ? "default"
                          : cls.status === "completed"
                            ? "secondary"
                            : cls.status === "cancelled"
                              ? "destructive"
                              : "outline"
                      }
                    >
                      {cls.status}
                    </Badge>
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
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
