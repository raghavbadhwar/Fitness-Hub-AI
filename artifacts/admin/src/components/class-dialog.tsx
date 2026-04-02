import React, { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { 
  useAdminCreateClass,
  useAdminUpdateClass,
  getAdminListClassesQueryKey
} from "@workspace/api-client-react";
import type { GymClass } from "@workspace/api-client-react";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Save } from "lucide-react";

const classCategories = [
  "Yoga", "Zumba", "CrossFit", "HIIT", "Spinning", 
  "Boxing", "Pilates", "Strength", "Cardio", "Other"
] as const;

const classStatuses = [
  "scheduled", "in_progress", "completed", "cancelled"
] as const;

const classSchema = z.object({
  name: z.string().min(2, "Name is required"),
  category: z.enum(classCategories),
  description: z.string().optional(),
  trainer: z.string().min(2, "Trainer name is required"),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Format must be YYYY-MM-DD"),
  startTime: z.string().regex(/^\d{2}:\d{2}$/, "Format must be HH:MM"),
  duration: z.coerce.number().min(15, "Duration must be at least 15 mins"),
  maxParticipants: z.coerce.number().min(1, "Must allow at least 1 participant"),
  room: z.string().min(1, "Room is required"),
  status: z.enum(classStatuses).optional(),
});

type ClassFormValues = z.infer<typeof classSchema>;

interface ClassDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editingClass?: GymClass | null;
}

export function ClassDialog({ open, onOpenChange, editingClass }: ClassDialogProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const isEditing = !!editingClass;

  const form = useForm<ClassFormValues>({
    resolver: zodResolver(classSchema),
    defaultValues: {
      name: "",
      category: "Other",
      description: "",
      trainer: "",
      date: new Date().toISOString().split('T')[0],
      startTime: "09:00",
      duration: 60,
      maxParticipants: 20,
      room: "",
      status: "scheduled",
    },
  });

  useEffect(() => {
    if (open) {
      if (editingClass) {
        const category = classCategories.includes(editingClass.category as typeof classCategories[number])
          ? (editingClass.category as typeof classCategories[number])
          : "Other";
        const status = classStatuses.includes(editingClass.status as typeof classStatuses[number])
          ? (editingClass.status as typeof classStatuses[number])
          : "scheduled";
        form.reset({
          name: editingClass.name,
          category,
          description: editingClass.description || "",
          trainer: editingClass.trainer,
          date: editingClass.date,
          startTime: editingClass.startTime,
          duration: editingClass.duration,
          maxParticipants: editingClass.maxParticipants,
          room: editingClass.room,
          status,
        });
      } else {
        form.reset({
          name: "",
          category: "Other",
          description: "",
          trainer: "",
          date: new Date().toISOString().split('T')[0],
          startTime: "09:00",
          duration: 60,
          maxParticipants: 20,
          room: "",
          status: "scheduled",
        });
      }
    }
  }, [open, editingClass, form]);

  const createClass = useAdminCreateClass({
    mutation: {
      onSuccess: () => {
        toast({ title: "Class created successfully" });
        queryClient.invalidateQueries({ queryKey: getAdminListClassesQueryKey() });
        onOpenChange(false);
      },
      onError: (error) => {
        toast({ title: "Failed to create class", variant: "destructive" });
      }
    }
  });

  const updateClass = useAdminUpdateClass({
    mutation: {
      onSuccess: () => {
        toast({ title: "Class updated successfully" });
        queryClient.invalidateQueries({ queryKey: getAdminListClassesQueryKey() });
        onOpenChange(false);
      },
      onError: (error) => {
        toast({ title: "Failed to update class", variant: "destructive" });
      }
    }
  });

  function onSubmit(data: ClassFormValues) {
    if (isEditing && editingClass) {
      updateClass.mutate({ id: editingClass.id, data });
    } else {
      createClass.mutate({ data });
    }
  }

  const isPending = createClass.isPending || updateClass.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEditing ? 'Edit Class' : 'Create New Class'}</DialogTitle>
          <DialogDescription>
            {isEditing ? 'Update the details for this gym class.' : 'Add a new class to your gym schedule.'}
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Class Name</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g. Morning Yoga" {...field} data-testid="input-class-name" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="category"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Category</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger data-testid="select-class-category">
                          <SelectValue placeholder="Select a category" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {classCategories.map(cat => (
                          <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="trainer"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Trainer</FormLabel>
                    <FormControl>
                      <Input placeholder="Trainer name" {...field} data-testid="input-class-trainer" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="room"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Room/Studio</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g. Studio A" {...field} data-testid="input-class-room" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="date"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Date (YYYY-MM-DD)</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} data-testid="input-class-date" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="startTime"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Start Time (HH:MM)</FormLabel>
                    <FormControl>
                      <Input type="time" {...field} data-testid="input-class-time" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="duration"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Duration (minutes)</FormLabel>
                    <FormControl>
                      <Input type="number" {...field} data-testid="input-class-duration" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="maxParticipants"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Max Participants</FormLabel>
                    <FormControl>
                      <Input type="number" {...field} data-testid="input-class-max" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            
            {isEditing && (
              <FormField
                control={form.control}
                name="status"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Status</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger data-testid="select-class-status">
                          <SelectValue placeholder="Select status" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {classStatuses.map(s => (
                          <SelectItem key={s} value={s}>{s}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Description</FormLabel>
                  <FormControl>
                    <Textarea 
                      placeholder="Class description..." 
                      className="resize-none" 
                      {...field} 
                      data-testid="input-class-desc"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="flex justify-end pt-4">
              <Button type="button" variant="outline" className="mr-2" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={isPending} data-testid="button-save-class">
                <Save className="mr-2 h-4 w-4" />
                {isPending ? "Saving..." : "Save Class"}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
