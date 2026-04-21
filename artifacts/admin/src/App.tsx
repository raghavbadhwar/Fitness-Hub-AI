import {
  Suspense,
  lazy,
  useEffect,
  useRef,
  useState,
  type ComponentType,
  type LazyExoticComponent,
} from "react";
import { ClerkProvider, SignIn, useAuth, useClerk, useUser } from '@clerk/react';
import { Switch, Route, useLocation, Router as WouterRouter, Redirect } from 'wouter';
import { QueryClientProvider, useQueryClient } from "@tanstack/react-query";
import { queryClient } from "./lib/queryClient";
import { buildApiUrl, getApiBaseUrl } from "./lib/api-base";
import { setAuthTokenGetter, setBaseUrl } from "@workspace/api-client-react";
import { Layout } from "./components/layout";
import { ThemeProvider } from "./components/theme-provider";
import { Button } from "@/components/ui/button";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";

const Dashboard = lazy(() => import("./pages/dashboard"));
const Classes = lazy(() => import("./pages/classes"));
const Members = lazy(() => import("./pages/members"));
const Settings = lazy(() => import("./pages/settings"));

const clerkPubKey = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;
const clerkProxyUrl = import.meta.env.VITE_CLERK_PROXY_URL;
const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

function stripBase(path: string): string {
  return basePath && path.startsWith(basePath)
    ? path.slice(basePath.length) || "/"
    : path;
}

if (!clerkPubKey) {
  throw new Error('Missing VITE_CLERK_PUBLISHABLE_KEY in .env file');
}

function ClerkQueryClientCacheInvalidator() {
  const { addListener } = useClerk();
  const queryClient = useQueryClient();
  const prevUserIdRef = useRef<string | null | undefined>(undefined);

  useEffect(() => {
    const unsubscribe = addListener(({ user }) => {
      const userId = user?.id ?? null;
      if (
        prevUserIdRef.current !== undefined &&
        prevUserIdRef.current !== userId
      ) {
        queryClient.clear();
      }
      prevUserIdRef.current = userId;
    });
    return unsubscribe;
  }, [addListener, queryClient]);

  return null;
}

function ApiClientConfigurator() {
  const { getToken } = useAuth();

  useEffect(() => {
    setBaseUrl(getApiBaseUrl());
    setAuthTokenGetter(() => getToken());

    return () => {
      setAuthTokenGetter(null);
    };
  }, [getToken]);

  return null;
}

function AccessDeniedState({
  canRetryWithDifferentAccount,
  message,
  onGoToSignIn,
  onSwitchAccount,
}: {
  canRetryWithDifferentAccount: boolean;
  message: string;
  onGoToSignIn: () => void;
  onSwitchAccount: () => void;
}) {
  return (
    <div className="flex min-h-[100dvh] items-center justify-center bg-background p-4">
      <div className="flex max-w-md flex-col items-center gap-4 rounded-2xl border border-border bg-card px-8 py-10 text-center shadow-sm">
        <div className="rounded-full bg-destructive/10 p-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-destructive text-xl font-bold text-destructive-foreground">
            !
          </div>
        </div>
        <h1 className="text-3xl font-bold text-foreground">Access Denied</h1>
        <p className="max-w-md text-center text-muted-foreground">{message}</p>
        <p className="text-sm text-muted-foreground">
          {canRetryWithDifferentAccount
            ? "Sign in with an owner-approved account to continue."
            : "Please retry in a moment or switch accounts if you may have signed in with the wrong profile."}
        </p>
        <div className="flex w-full flex-col gap-3 sm:flex-row sm:justify-center">
          <Button onClick={onGoToSignIn} data-testid="admin-access-denied-sign-in">
            Go to sign in
          </Button>
          <Button
            variant="outline"
            onClick={onSwitchAccount}
            data-testid="admin-access-denied-switch-account"
          >
            Sign out and switch account
          </Button>
        </div>
      </div>
    </div>
  );
}

function E2EAccessDeniedPreview() {
  const [, setLocation] = useLocation();

  return (
    <AccessDeniedState
      canRetryWithDifferentAccount
      message="Only owner-approved accounts can open the GymOS Admin Panel."
      onGoToSignIn={() => setLocation("/sign-in", { replace: true })}
      onSwitchAccount={() => setLocation("/sign-in", { replace: true })}
    />
  );
}

function FullScreenLoadingState() {
  return (
    <div className="flex min-h-[100dvh] items-center justify-center">
      Loading...
    </div>
  );
}

type RouteComponent =
  | ComponentType
  | LazyExoticComponent<ComponentType>;

function ProtectedRoute({ component }: { component: RouteComponent }) {
  const Component = component as ComponentType;
  const { user, isLoaded } = useUser();
  const { getToken } = useAuth();
  const { signOut } = useClerk();
  const [, setLocation] = useLocation();
  const [accessState, setAccessState] = useState<{
    status: "idle" | "loading" | "allowed" | "denied";
    message: string;
  }>({
    status: "idle",
    message: "",
  });

  useEffect(() => {
    if (!isLoaded) {
      return;
    }

    if (!user) {
      setAccessState({ status: "idle", message: "" });
      return;
    }

    let cancelled = false;

    const verifyAccess = async () => {
      setAccessState({ status: "loading", message: "" });

      try {
        const token = await getToken();
        const response = await fetch(buildApiUrl("/api/admin/access"), {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });
        const payload = await response.json().catch(() => null);

        if (cancelled) {
          return;
        }

        if (response.ok) {
          setAccessState({ status: "allowed", message: "" });
          return;
        }

        setAccessState({
          status: "denied",
          message:
            payload?.error ||
            "You do not have permission to access the GymOS Admin Panel.",
        });
      } catch {
        if (!cancelled) {
          setAccessState({
            status: "denied",
            message: "Unable to verify admin access right now. Please try again.",
          });
        }
      }
    };

    void verifyAccess();

    return () => {
      cancelled = true;
    };
  }, [getToken, isLoaded, user?.id]);

  if (!isLoaded) {
    return <FullScreenLoadingState />;
  }

  if (!user) return <Redirect to="/sign-in" />;

  if (accessState.status === "idle" || accessState.status === "loading") {
    return <FullScreenLoadingState />;
  }

  if (accessState.status === "denied") {
    const canRetryWithDifferentAccount = !accessState.message.includes("Unable to verify");

    const handleSwitchAccount = async () => {
      await signOut();
      setLocation("/sign-in", { replace: true });
    };

    return (
      <AccessDeniedState
        canRetryWithDifferentAccount={canRetryWithDifferentAccount}
        message={accessState.message}
        onGoToSignIn={() => setLocation("/sign-in", { replace: true })}
        onSwitchAccount={() => void handleSwitchAccount()}
      />
    );
  }

  return (
    <Suspense fallback={<FullScreenLoadingState />}>
      <Layout>
        <Component />
      </Layout>
    </Suspense>
  );
}

function SignInPage() {
  return (
    <div className="flex min-h-[100dvh] items-center justify-center bg-muted/30 p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-primary mb-2">GymOS</h1>
          <p className="text-muted-foreground">Admin Operations Hub</p>
        </div>
        <SignIn routing="path" path={`${basePath}/sign-in`} fallbackRedirectUrl={`${basePath}/`} />
      </div>
    </div>
  );
}

function ClerkProviderWithRoutes() {
  const [, setLocation] = useLocation();

  return (
    <ClerkProvider
      publishableKey={clerkPubKey}
      proxyUrl={clerkProxyUrl}
      afterSignOutUrl={`${basePath}/sign-in`}
      routerPush={(to) => setLocation(stripBase(to))}
      routerReplace={(to) => setLocation(stripBase(to), { replace: true })}
    >
      <QueryClientProvider client={queryClient}>
        <ApiClientConfigurator />
        <ClerkQueryClientCacheInvalidator />
        <ThemeProvider defaultTheme="light">
          <TooltipProvider>
            <Switch>
              <Route path="/__e2e/access-denied" component={E2EAccessDeniedPreview} />
              <Route path="/sign-in/*?" component={SignInPage} />
              <Route path="/" component={() => <ProtectedRoute component={Dashboard} />} />
              <Route path="/classes" component={() => <ProtectedRoute component={Classes} />} />
              <Route path="/members" component={() => <ProtectedRoute component={Members} />} />
              <Route path="/settings" component={() => <ProtectedRoute component={Settings} />} />
              <Route>
                <div className="flex h-screen items-center justify-center flex-col gap-4">
                  <h1 className="text-4xl font-bold">404</h1>
                  <p className="text-muted-foreground">Page not found</p>
                </div>
              </Route>
            </Switch>
            <Toaster />
          </TooltipProvider>
        </ThemeProvider>
      </QueryClientProvider>
    </ClerkProvider>
  );
}

export default function App() {
  return (
    <WouterRouter base={basePath}>
      <ClerkProviderWithRoutes />
    </WouterRouter>
  );
}
