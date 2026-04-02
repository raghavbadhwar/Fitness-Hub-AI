import { ClerkLoaded, ClerkProvider } from "@clerk/expo";
import { tokenCache } from "@clerk/expo/token-cache";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Stack, useRouter, useSegments } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import React, { useEffect } from "react";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { KeyboardProvider } from "react-native-keyboard-controller";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { useAuth } from "@clerk/expo";

import { ErrorBoundary } from "@/components/ErrorBoundary";
import { AppProvider } from "@/contexts/AppContext";
import { NutritionProvider } from "@/contexts/NutritionContext";
import { WorkoutProvider } from "@/contexts/WorkoutContext";
import { ScheduleProvider } from "@/contexts/ScheduleContext";

SplashScreen.preventAutoHideAsync();

const queryClient = new QueryClient();

function AuthGate({ children }: { children: React.ReactNode }) {
  const { isSignedIn, isLoaded } = useAuth();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (!isLoaded) return;
    SplashScreen.hideAsync();

    const inAuthGroup = segments[0] === "(auth)";

    if (!isSignedIn && !inAuthGroup) {
      router.replace("/(auth)/sign-in");
    } else if (isSignedIn && inAuthGroup) {
      router.replace("/(tabs)");
    }
  }, [isSignedIn, isLoaded, segments]);

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
