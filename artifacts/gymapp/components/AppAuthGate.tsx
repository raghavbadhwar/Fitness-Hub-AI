import { useAuth } from "@clerk/expo";
import { type Href, usePathname, useRouter } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import React, { useEffect, useRef } from "react";

import { useApp } from "@/contexts/AppContext";

function normalizeRoutePath(path: string) {
  const normalized = path.replace(/\/\((auth|tabs)\)/g, "").replace(/\/+/g, "/");

  return normalized === "" ? "/" : normalized;
}

function isPublicAuthPath(path: string) {
  return path === "/sign-in" || path === "/sign-up" || path === "/forgot-password";
}

export function AppAuthGate({ children }: { children: React.ReactNode }) {
  const { isSignedIn, isLoaded } = useAuth();
  const pathname = usePathname();
  const router = useRouter();
  const { accessState, profile, isLoading: isProfileLoading } = useApp();
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

    const inPublicAuthGroup = isPublicAuthPath(currentPath);
    const inAuthGroup =
      inPublicAuthGroup || currentPath === "/onboarding" || currentPath === "/approval-required";
    const isE2EPreviewRoute = currentPath.startsWith("/__e2e");
    const onOnboardingScreen = currentPath === "/onboarding";
    const accessBlocked =
      accessState.status === "unknown" ||
      accessState.status === "pending_approval" ||
      accessState.status === "revoked";
    let nextPath: string | null = null;

    if (isE2EPreviewRoute) {
      return;
    }

    if (!isSignedIn && !inPublicAuthGroup) {
      nextPath = "/sign-in";
    } else if (isSignedIn && accessBlocked && currentPath !== "/approval-required") {
      nextPath = "/approval-required";
    } else if (isSignedIn && !accessBlocked && !profile.onboardingComplete && !onOnboardingScreen) {
      nextPath = "/onboarding";
    } else if (isSignedIn && inAuthGroup && profile.onboardingComplete && !accessBlocked) {
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
      router.replace(nextPath as Href);
    }
  }, [
    accessState.status,
    isLoaded,
    isProfileLoading,
    isSignedIn,
    pathname,
    profile.onboardingComplete,
    router,
  ]);

  return <>{children}</>;
}
