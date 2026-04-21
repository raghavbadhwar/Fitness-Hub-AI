import { ClerkLoaded, ClerkProvider } from "@clerk/expo";
import { tokenCache } from "@clerk/expo/token-cache";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { type Href, Stack, usePathname, useRouter } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import React, { useEffect, useRef } from "react";
import { KeyboardProvider } from "react-native-keyboard-controller";
import { useAuth } from "@clerk/expo";

import { ErrorBoundary } from "@/components/ErrorBoundary";
import { GestureHandlerRootView, SafeAreaProvider } from "@/components/native-compat";
import { AppProvider, useApp } from "@/contexts/AppContext";
import { NutritionProvider } from "@/contexts/NutritionContext";
import { WorkoutProvider } from "@/contexts/WorkoutContext";
import { ScheduleProvider } from "@/contexts/ScheduleContext";

SplashScreen.preventAutoHideAsync();

const queryClient = new QueryClient();

function normalizeRoutePath(path: string) {
  const normalized = path
    .replace(/\/\((auth|tabs)\)/g, "")
    .replace(/\/+/g, "/");

  return normalized === "" ? "/" : normalized;
}

function AuthGate({ children }: { children: React.ReactNode }) {
  const { isSignedIn, isLoaded } = useAuth();
  const pathname = usePathname();
  const router = useRouter();
  const { profile, isLoading: isProfileLoading } = useApp();
  const redirectTargetRef = useRef<string | null>(null);

  useEffect(() => {
    if (!isLoaded || isProfileLoading) return;
    void SplashScreen.hideAsync();
  }, [isLoaded, isProfileLoading]);

  useEffect(() => {
    if (!isLoaded || isProfileLoading) return;
    const currentPath = normalizeRoutePath(pathname || "/");
    const activeRedirect = redirectTargetRef.current;

    if (activeRedirect && activeRedirect === currentPath) {
      redirectTargetRef.current = null;
    }

    const inAuthGroup =
      currentPath === "/sign-in" ||
      currentPath === "/sign-up" ||
      currentPath === "/forgot-password" ||
      currentPath === "/onboarding";
    const isE2EPreviewRoute = currentPath.startsWith("/__e2e");
    const onOnboardingScreen = currentPath === "/onboarding";
    let nextPath: Href | null = null;

    if (isE2EPreviewRoute) {
      return;
    }

    if (!isSignedIn && !inAuthGroup) {
      nextPath = "/sign-in";
    } else if (isSignedIn && !profile.onboardingComplete && !onOnboardingScreen) {
      nextPath = "/onboarding";
    } else if (isSignedIn && inAuthGroup && profile.onboardingComplete) {
      nextPath = "/";
    }

    const normalizedNextPath = nextPath ? normalizeRoutePath(nextPath) : null;

    if (
      nextPath &&
      normalizedNextPath &&
      normalizedNextPath !== currentPath &&
      redirectTargetRef.current !== normalizedNextPath
    ) {
      redirectTargetRef.current = normalizedNextPath;
      router.replace(nextPath);
    }
  }, [isLoaded, isProfileLoading, isSignedIn, pathname, profile.onboardingComplete, router]);

  return <>{children}</>;
}

function RootLayoutNav() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="(auth)" options={{ headerShown: false }} />
      <Stack.Screen
        name="add-meal"
        options={{ headerShown: true, title: "Log Food", presentation: "modal", headerStyle: { backgroundColor: "#0C0E1A" }, headerTintColor: "#F0F2FF" }}
      />
      <Stack.Screen
        name="workout-session"
        options={{ headerShown: true, title: "Workout", presentation: "modal", headerStyle: { backgroundColor: "#0C0E1A" }, headerTintColor: "#F0F2FF" }}
      />
      <Stack.Screen
        name="progress"
        options={{ headerShown: true, title: "Progress", headerStyle: { backgroundColor: "#0C0E1A" }, headerTintColor: "#F0F2FF" }}
      />
      <Stack.Screen
        name="profile"
        options={{ headerShown: true, title: "Profile", presentation: "modal", headerStyle: { backgroundColor: "#0C0E1A" }, headerTintColor: "#F0F2FF" }}
      />
      <Stack.Screen
        name="manage-class"
        options={{ headerShown: true, title: "Manage Class", presentation: "modal", headerStyle: { backgroundColor: "#0C0E1A" }, headerTintColor: "#F0F2FF" }}
      />
      <Stack.Screen
        name="workout-complete"
        options={{ headerShown: false, presentation: "modal", gestureEnabled: false }}
      />
    </Stack>
  );
}

const publishableKey = process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY ?? "";

if (!publishableKey) {
  throw new Error(
    "EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY is required. Add it to .env.local.",
  );
}

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <ErrorBoundary>
        <ClerkProvider publishableKey={publishableKey} tokenCache={tokenCache}>
          <ClerkLoaded>
            <QueryClientProvider client={queryClient}>
              <AppProvider>
                <NutritionProvider>
                  <WorkoutProvider>
                    <ScheduleProvider>
                      <GestureHandlerRootView style={{ flex: 1 }}>
                        <KeyboardProvider>
                          <AuthGate>
                            <RootLayoutNav />
                          </AuthGate>
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
