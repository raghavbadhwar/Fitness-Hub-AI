import React, { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import {
  useAdminGetSettings,
  getAdminGetSettingsQueryKey,
  useAdminUpdateSettings,
  type GymSettings,
} from "@workspace/api-client-react";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { useAuthenticatedRequest } from "@/lib/use-authenticated-request";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Clock, MapPin, Phone, Save, ShieldCheck, Smartphone, type LucideIcon } from "lucide-react";

const settingsSchema = z.object({
  gymName: z.string().min(2, "Gym name must be at least 2 characters."),
  address: z.string().min(5, "Please provide a valid address."),
  phone: z.string().min(5, "Please provide a valid phone number."),
  workingHours: z.string().min(2, "Please specify working hours."),
  description: z.string(),
});

type SettingsFormValues = z.infer<typeof settingsSchema>;

export default function Settings({ previewSettings }: { previewSettings?: GymSettings }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const request = useAuthenticatedRequest();

  const { data: settings, isLoading } = useAdminGetSettings({
    query: { enabled: !previewSettings, queryKey: getAdminGetSettingsQueryKey() },
    request,
  });
  const activeSettings = previewSettings ?? settings;
  const settingsLoading = !previewSettings && isLoading;

  const form = useForm<SettingsFormValues>({
    resolver: zodResolver(settingsSchema),
    defaultValues: {
      gymName: "",
      address: "",
      phone: "",
      workingHours: "",
      description: "",
    },
  });

  useEffect(() => {
    if (activeSettings) {
      form.reset({
        gymName: activeSettings.gymName,
        address: activeSettings.address,
        phone: activeSettings.phone,
        workingHours: activeSettings.workingHours,
        description: activeSettings.description,
      });
    }
  }, [activeSettings, form]);

  const updateSettings = useAdminUpdateSettings({
    mutation: {
      onSuccess: (data) => {
        queryClient.setQueryData(getAdminGetSettingsQueryKey(), data);
        toast({ title: "Settings updated successfully" });
      },
      onError: () => {
        toast({ title: "Failed to update settings", variant: "destructive" });
      },
    },
    request,
  });

  function onSubmit(data: SettingsFormValues) {
    updateSettings.mutate({ data });
  }

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6">
      <div className="flex flex-col gap-4 rounded-md border bg-card px-5 py-5 shadow-sm lg:flex-row lg:items-center lg:justify-between">
        <div>
          <p className="text-sm font-semibold uppercase text-primary">Owner console</p>
          <h1 className="mt-1 text-3xl font-bold tracking-tight">Studio Settings</h1>
          <p className="mt-1 max-w-2xl text-muted-foreground">
            Keep the public profile, member app copy, and operating details aligned from one place.
          </p>
        </div>
        <div className="grid grid-cols-3 gap-2 text-center text-sm">
          <SettingSignal icon={Smartphone} label="Member app" value="Synced" />
          <SettingSignal icon={ShieldCheck} label="Access" value="Admin led" />
          <SettingSignal icon={Clock} label="Hours" value="Visible" />
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <Card>
          <CardHeader>
            <CardTitle>General Information</CardTitle>
            <CardDescription>
              These details will be displayed to members across the mobile app.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {settingsLoading ? (
              <div className="py-8 text-center text-muted-foreground">Loading settings...</div>
            ) : (
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                  <FormField
                    control={form.control}
                    name="gymName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Gym Name</FormLabel>
                        <FormControl>
                          <Input
                            placeholder="e.g. Iron & Steel Fitness"
                            {...field}
                            data-testid="input-gym-name"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <div className="grid gap-6 md:grid-cols-2">
                    <FormField
                      control={form.control}
                      name="phone"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Contact Phone</FormLabel>
                          <FormControl>
                            <Input
                              placeholder="+1 (555) 123-4567"
                              {...field}
                              data-testid="input-phone"
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="workingHours"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Working Hours</FormLabel>
                          <FormControl>
                            <Input
                              placeholder="Mon-Fri: 5am-10pm, Sat-Sun: 7am-8pm"
                              {...field}
                              data-testid="input-working-hours"
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <FormField
                    control={form.control}
                    name="address"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Address</FormLabel>
                        <FormControl>
                          <Input
                            placeholder="123 Fitness Blvd, Muscle City, MC 90210"
                            {...field}
                            data-testid="input-address"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="description"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>About the Gym</FormLabel>
                        <FormControl>
                          <Textarea
                            placeholder="Tell your members what makes your gym special..."
                            className="min-h-[120px]"
                            {...field}
                            data-testid="input-description"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <Button
                    type="submit"
                    disabled={updateSettings.isPending}
                    className="w-full bg-primary shadow-sm sm:w-auto"
                    data-testid="button-save-settings"
                  >
                    {updateSettings.isPending ? (
                      "Saving..."
                    ) : (
                      <>
                        <Save className="mr-2 h-4 w-4" />
                        Save Changes
                      </>
                    )}
                  </Button>
                </form>
              </Form>
            )}
          </CardContent>
        </Card>

        <div className="flex flex-col gap-4">
          <div className="rounded-md border bg-card p-5 shadow-sm">
            <p className="text-sm font-semibold uppercase text-muted-foreground">Live Preview</p>
            <div className="mt-4 rounded-md border bg-muted/30 p-4">
              <div className="flex items-center gap-3">
                <div className="flex size-11 items-center justify-center rounded-md bg-primary text-lg font-bold text-primary-foreground">
                  G
                </div>
                <div>
                  <div className="font-semibold">{form.watch("gymName") || "GymOS"}</div>
                  <div className="text-sm text-muted-foreground">Member app profile</div>
                </div>
              </div>
              <div className="mt-4 space-y-3 text-sm">
                <PreviewRow icon={Phone} text={form.watch("phone") || "Contact phone"} />
                <PreviewRow icon={Clock} text={form.watch("workingHours") || "Working hours"} />
                <PreviewRow icon={MapPin} text={form.watch("address") || "Studio address"} />
              </div>
            </div>
          </div>

          <div className="rounded-md border bg-primary p-5 text-primary-foreground shadow-sm">
            <p className="text-sm font-semibold uppercase opacity-80">Publishing note</p>
            <p className="mt-2 text-sm leading-6 opacity-90">
              Member-facing details should stay short and operational. Use the description for what
              makes the gym useful, not marketing filler.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

function SettingSignal({
  icon: Icon,
  label,
  value,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-md border bg-muted/40 px-4 py-3">
      <Icon className="mx-auto size-4 text-primary" />
      <div className="mt-1 font-semibold">{value}</div>
      <div className="text-xs text-muted-foreground">{label}</div>
    </div>
  );
}

function PreviewRow({ icon: Icon, text }: { icon: LucideIcon; text: string }) {
  return (
    <div className="flex items-start gap-2">
      <Icon className="mt-0.5 size-4 shrink-0 text-primary" />
      <span className="text-muted-foreground">{text}</span>
    </div>
  );
}
