import React from "react";
import { Link, useLocation } from "wouter";
import { UserButton } from "@clerk/react";
import type { GymClass, Member } from "@workspace/api-client-react";
import { Dumbbell, Calendar, Users, Settings as SettingsIcon, Sun, Moon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { NotificationCenter } from "@/components/notification-center";
import { useTheme } from "@/components/theme-provider";
import { cn } from "@/lib/utils";

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={() => setTheme(theme === "light" ? "dark" : "light")}
      aria-label="Toggle theme"
      data-testid="button-toggle-theme"
    >
      <Sun className="h-5 w-5 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
      <Moon className="absolute h-5 w-5 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
    </Button>
  );
}

type LayoutProps = {
  children: React.ReactNode;
  notificationData?: {
    classes?: GymClass[];
    members?: Member[];
  };
};

export function Layout({ children, notificationData }: LayoutProps) {
  const [location] = useLocation();

  const navItems = [
    { href: "/", label: "Dashboard", icon: Dumbbell },
    { href: "/classes", label: "Classes", icon: Calendar },
    { href: "/members", label: "Members", icon: Users },
    { href: "/settings", label: "Settings", icon: SettingsIcon },
  ];

  return (
    <div className="flex min-h-screen flex-col bg-muted/20">
      <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="mx-auto flex h-16 w-full max-w-7xl items-center justify-between px-4 sm:h-16 sm:px-6">
          <div className="flex items-center gap-6 md:gap-10">
            <Link href="/" className="flex items-center gap-2" data-testid="link-home">
              <div className="flex size-8 items-center justify-center rounded-md bg-primary sm:size-9">
                <Dumbbell className="size-4 text-primary-foreground sm:size-5" />
              </div>
              <span className="inline-block text-lg font-bold tracking-tight text-primary sm:text-xl">
                GymOS
              </span>
            </Link>
            <nav className="hidden md:flex gap-6">
              {navItems.map((item) => {
                const Icon = item.icon;
                const isActive =
                  location === item.href || (item.href !== "/" && location.startsWith(item.href));
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    aria-current={isActive ? "page" : undefined}
                    className={cn(
                      "flex items-center rounded-md px-2 py-1.5 text-sm font-medium transition-colors hover:text-primary",
                      isActive ? "bg-primary/10 text-primary" : "text-muted-foreground",
                    )}
                    data-testid={`link-nav-${item.label.toLowerCase()}`}
                  >
                    <Icon className="mr-2 size-4" />
                    {item.label}
                  </Link>
                );
              })}
            </nav>
          </div>
          <div className="flex items-center gap-2 sm:gap-3">
            <NotificationCenter
              classesOverride={notificationData?.classes}
              membersOverride={notificationData?.members}
            />
            <ThemeToggle />
            <UserButton />
          </div>
        </div>
      </header>
      <main className="mx-auto w-full max-w-7xl flex-1 px-4 pb-28 pt-6 sm:px-6 md:pb-8 md:pt-8">
        {children}
      </main>
      <nav className="fixed inset-x-0 bottom-0 z-50 border-t bg-background/95 px-2 py-2 shadow-lg backdrop-blur md:hidden">
        <div className="grid grid-cols-4 gap-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive =
              location === item.href || (item.href !== "/" && location.startsWith(item.href));

            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={isActive ? "page" : undefined}
                className={cn(
                  "flex min-h-14 flex-col items-center justify-center gap-1 rounded-md text-[11px] font-semibold transition-colors",
                  isActive ? "bg-primary/10 text-primary" : "text-muted-foreground",
                )}
                data-testid={`link-mobile-nav-${item.label.toLowerCase()}`}
              >
                <Icon className="size-5" />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
