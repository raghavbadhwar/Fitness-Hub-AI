import { ClerkLoaded, ClerkProvider } from "@clerk/expo";
import { tokenCache } from "@clerk/expo/token-cache";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import React from "react";
import { KeyboardProvider } from "react-native-keyboard-controller";

import { AppAuthGate } from "@/components/AppAuthGate";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { GestureHandlerRootView, SafeAreaProvider } from "@/components/native-compat";
import { AppProvider } from "@/contexts/AppContext";
import { NutritionProvider } from "@/contexts/NutritionContext";
import { WorkoutProvider } from "@/contexts/WorkoutContext";
import { ScheduleProvider } from "@/contexts/ScheduleContext";
import { getClerkProxyUrl } from "@/lib/clerk-config";

SplashScreen.preventAutoHideAsync();

const queryClient = new QueryClient();

function RootLayoutNav() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="(auth)" options={{ headerShown: false }} />
      <Stack.Screen
        name="add-meal"
        options={{
          headerShown: true,
          title: "Log Food",
          presentation: "modal",
          headerStyle: { backgroundColor: "#0C0E1A" },
          headerTintColor: "#F0F2FF",
        }}
      />
      <Stack.Screen
        name="workout-session"
        options={{
          headerShown: true,
          title: "Workout",
          presentation: "modal",
          headerStyle: { backgroundColor: "#0C0E1A" },
          headerTintColor: "#F0F2FF",
        }}
      />
      <Stack.Screen
        name="progress"
        options={{
          headerShown: true,
          title: "Progress",
          headerStyle: { backgroundColor: "#0C0E1A" },
          headerTintColor: "#F0F2FF",
        }}
      />
      <Stack.Screen
        name="profile"
        options={{
          headerShown: true,
          title: "Profile",
          presentation: "modal",
          headerStyle: { backgroundColor: "#0C0E1A" },
          headerTintColor: "#F0F2FF",
        }}
      />
      <Stack.Screen
        name="manage-class"
        options={{
          headerShown: true,
          title: "Manage Class",
          presentation: "modal",
          headerStyle: { backgroundColor: "#0C0E1A" },
          headerTintColor: "#F0F2FF",
        }}
      />
      <Stack.Screen
        name="workout-complete"
        options={{ headerShown: false, presentation: "modal", gestureEnabled: false }}
      />
      <Stack.Screen name="approval-required" options={{ headerShown: false }} />
    </Stack>
  );
}

const publishableKey = process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY ?? "";
const clerkProxyUrl = getClerkProxyUrl();

if (!publishableKey) {
  throw new Error("EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY is required. Add it to .env.local.");
}

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <ErrorBoundary>
        <ClerkProvider
          publishableKey={publishableKey}
          proxyUrl={clerkProxyUrl}
          tokenCache={tokenCache}
        >
          <ClerkLoaded>
            <QueryClientProvider client={queryClient}>
              <AppProvider>
                <NutritionProvider>
                  <WorkoutProvider>
                    <ScheduleProvider>
                      <GestureHandlerRootView style={{ flex: 1 }}>
                        <KeyboardProvider>
                          <AppAuthGate>
                            <RootLayoutNav />
                          </AppAuthGate>
                        </KeyboardProvider>
                      </GestureHandlerRootView>
                    </ScheduleProvider>
                  </WorkoutProvider>
                </NutritionProvider>
              </AppProvider>
            </QueryClientProvider>
          </ClerkLoaded>
        </ClerkProvider>
      </ErrorBoundary>
    </SafeAreaProvider>
  );
}
