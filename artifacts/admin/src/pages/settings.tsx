import React, { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import {
  useAdminGetSettings,
  getAdminGetSettingsQueryKey,
  useAdminUpdateSettings,
} from "@workspace/api-client-react";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Save } from "lucide-react";

const settingsSchema = z.object({
  gymName: z.string().min(2, "Gym name must be at least 2 characters."),
  address: z.string().min(5, "Please provide a valid address."),
  phone: z.string().min(5, "Please provide a valid phone number."),
  workingHours: z.string().min(2, "Please specify working hours."),
  description: z.string(),
});

type SettingsFormValues = z.infer<typeof settingsSchema>;

export default function Settings() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: settings, isLoading } = useAdminGetSettings({
    query: { queryKey: getAdminGetSettingsQueryKey() },
  });

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
    if (settings) {
      form.reset({
        gymName: settings.gymName,
        address: settings.address,
        phone: settings.phone,
        workingHours: settings.workingHours,
        description: settings.description,
      });
    }
  }, [settings, form]);

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
  });

  function onSubmit(data: SettingsFormValues) {
    updateSettings.mutate({ data });
  }

  return (
    <div className="space-y-6 max-w-3xl mx-auto">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Studio Settings</h1>
        <p className="text-muted-foreground mt-1">
          Configure your gym's public profile and operational details.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>General Information</CardTitle>
          <CardDescription>
            These details will be displayed to your members in the mobile app.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
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
                  className="w-full sm:w-auto"
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
    </div>
  );
}
