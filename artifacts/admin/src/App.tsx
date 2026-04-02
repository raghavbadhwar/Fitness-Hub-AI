import { useEffect, useRef } from "react";
import { ClerkProvider, SignIn, useClerk, useUser } from '@clerk/react';
import { Switch, Route, useLocation, Router as WouterRouter, Redirect } from 'wouter';
import { QueryClientProvider, useQueryClient } from "@tanstack/react-query";
import { queryClient } from "./lib/queryClient";
import { Layout } from "./components/layout";
import { ThemeProvider } from "./components/theme-provider";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";

import Dashboard from "./pages/dashboard";
import Classes from "./pages/classes";
import Members from "./pages/members";
import Settings from "./pages/settings";

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

function ProtectedRoute({ component: Component }: { component: React.ComponentType }) {
  const { user, isLoaded } = useUser();
  
  if (!isLoaded) return <div className="flex min-h-[100dvh] items-center justify-center">Loading...</div>;
  
  if (!user) return <Redirect to="/sign-in" />;
  
  if (user.publicMetadata?.role !== "owner") {
    return (
      <div className="flex min-h-[100dvh] items-center justify-center flex-col gap-4 bg-background">
        <div className="bg-destructive/10 p-4 rounded-full">
          <div className="bg-destructive w-12 h-12 flex items-center justify-center rounded-full text-destructive-foreground font-bold text-xl">!</div>
        </div>
        <h1 className="text-3xl font-bold text-foreground">Access Denied</h1>
        <p className="text-muted-foreground max-w-md text-center">
          You do not have owner privileges to access the GymOS Admin Panel.
          Please contact support if you believe this is an error.
        </p>
      </div>
    );
  }
  
  return <Layout><Component /></Layout>;
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
      routerPush={(to) => setLocation(stripBase(to))}
      routerReplace={(to) => setLocation(stripBase(to), { replace: true })}
    >
      <QueryClientProvider client={queryClient}>
        <ClerkQueryClientCacheInvalidator />
        <ThemeProvider defaultTheme="light">
          <TooltipProvider>
            <Switch>
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
