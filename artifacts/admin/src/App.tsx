import {
  Suspense,
  lazy,
  useEffect,
  useRef,
  type ComponentType,
  type LazyExoticComponent,
} from "react";
import { ClerkProvider, SignIn, useAuth, useClerk, useUser } from "@clerk/react";
import { Switch, Route, useLocation, Router as WouterRouter, Redirect } from "wouter";
import { QueryClientProvider, useQuery, useQueryClient } from "@tanstack/react-query";
import { queryClient } from "./lib/queryClient";
import { buildApiUrl, getApiBaseUrl } from "./lib/api-base";
import { getClerkProxyUrl } from "./lib/clerk-config";
import { setBaseUrl } from "@workspace/api-client-react";
import { Layout } from "./components/layout";
import { ThemeProvider } from "./components/theme-provider";
import { Button } from "@/components/ui/button";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";

const Dashboard = lazy(() => import("./pages/dashboard"));
const Classes = lazy(() => import("./pages/classes"));
const Members = lazy(() => import("./pages/members"));
const Settings = lazy(() => import("./pages/settings"));
const AdminDashboardPreview = lazy(() =>
  import("./pages/e2e-previews").then((module) => ({ default: module.AdminDashboardPreview })),
);
const AdminMembersPreview = lazy(() =>
  import("./pages/e2e-previews").then((module) => ({ default: module.AdminMembersPreview })),
);
const AdminClassesPreview = lazy(() =>
  import("./pages/e2e-previews").then((module) => ({ default: module.AdminClassesPreview })),
);
const AdminSettingsPreview = lazy(() =>
  import("./pages/e2e-previews").then((module) => ({ default: module.AdminSettingsPreview })),
);

const clerkPubKey = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;
const clerkProxyUrl = getClerkProxyUrl();
const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

function stripBase(path: string): string {
  return basePath && path.startsWith(basePath) ? path.slice(basePath.length) || "/" : path;
}

if (!clerkPubKey) {
  throw new Error("Missing VITE_CLERK_PUBLISHABLE_KEY in .env file");
}

function ClerkQueryClientCacheInvalidator() {
  const { addListener } = useClerk();
  const queryClient = useQueryClient();
  const prevUserIdRef = useRef<string | null | undefined>(undefined);

  useEffect(() => {
    const unsubscribe = addListener(({ user }) => {
      const userId = user?.id ?? null;
      if (prevUserIdRef.current !== undefined && prevUserIdRef.current !== userId) {
        queryClient.clear();
      }
      prevUserIdRef.current = userId;
    });
    return unsubscribe;
  }, [addListener, queryClient]);

  return null;
}

function ApiClientConfigurator() {
  useEffect(() => {
    setBaseUrl(getApiBaseUrl());
  }, []);

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
    <div
      role="status"
      aria-live="polite"
      data-testid="admin-loading-state"
      className="flex min-h-[100dvh] items-center justify-center bg-background p-6 text-center"
    >
      <div className="flex w-full max-w-sm flex-col items-center gap-4">
        <div className="flex h-14 w-14 items-center justify-center rounded-lg border border-primary/20 bg-primary/10 text-xl font-bold text-primary shadow-sm">
          G
        </div>
        <div className="h-1.5 w-40 overflow-hidden rounded-full bg-muted">
          <div className="h-full w-1/2 animate-pulse rounded-full bg-primary" />
        </div>
        <div className="space-y-1">
          <p className="text-sm font-semibold text-foreground">Preparing admin workspace</p>
          <p className="text-xs text-muted-foreground">Checking access and syncing operations data</p>
        </div>
      </div>
    </div>
  );
}

type RouteComponent = ComponentType | LazyExoticComponent<ComponentType>;

function ProtectedRoute({ component }: { component: RouteComponent }) {
  const Component = component as ComponentType;
  const { user, isLoaded } = useUser();
  const { getToken } = useAuth();
  const { signOut } = useClerk();
  const [, setLocation] = useLocation();
  const accessQuery = useQuery({
    enabled: isLoaded && Boolean(user),
    queryKey: ["admin-access", user?.id],
    queryFn: async ({ signal }) => {
      const token = await getToken();
      const response = await fetch(buildApiUrl("/api/admin/access"), {
        signal,
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      }).catch(() => {
        throw new Error("Unable to verify admin access right now. Please try again.");
      });
      const payload = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(
          payload?.error || "You do not have permission to access the GymOS Admin Panel.",
        );
      }

      return payload;
    },
    retry: false,
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });

  if (!isLoaded) {
    return <FullScreenLoadingState />;
  }

  if (!user) return <Redirect to="/sign-in" />;

  if (accessQuery.error) {
    const accessMessage =
      accessQuery.error instanceof Error
        ? accessQuery.error.message
        : "Unable to verify admin access right now. Please try again.";
    const canRetryWithDifferentAccount = !accessMessage.includes("Unable to verify");

    const handleSwitchAccount = async () => {
      await signOut();
      setLocation("/sign-in", { replace: true });
    };

    return (
      <AccessDeniedState
        canRetryWithDifferentAccount={canRetryWithDifferentAccount}
        message={accessMessage}
        onGoToSignIn={() => setLocation("/sign-in", { replace: true })}
        onSwitchAccount={() => void handleSwitchAccount()}
      />
    );
  }

  if (accessQuery.isLoading || !accessQuery.data) {
    return <FullScreenLoadingState />;
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
              <Route path="/__e2e/loading" component={FullScreenLoadingState} />
              <Route path="/__e2e/dashboard" component={AdminDashboardPreview} />
              <Route path="/__e2e/classes" component={AdminClassesPreview} />
              <Route path="/__e2e/members" component={AdminMembersPreview} />
              <Route path="/__e2e/settings" component={AdminSettingsPreview} />
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
