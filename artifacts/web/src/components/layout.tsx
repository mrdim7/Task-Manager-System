import React from "react";
import { Link, useLocation } from "wouter";
import { useAuth } from "@/contexts/auth-context";
import { useLogout } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import {
  LayoutDashboard,
  CheckSquare,
  Users,
  Shield,
  Settings,
  LogOut,
} from "lucide-react";

interface LayoutProps {
  children: React.ReactNode;
}

export function Layout({ children }: LayoutProps) {
  const [location] = useLocation();
  const { user, logout: contextLogout } = useAuth();
  const logoutMutation = useLogout();

  const handleLogout = () => {
    logoutMutation.mutate(undefined, {
      onSuccess: () => {
        contextLogout();
      },
    });
  };

  const navItems = [
    { href: "/", label: "Dashboard", icon: LayoutDashboard },
    { href: "/tasks", label: "Tasks", icon: CheckSquare },
    ...(user?.isAdmin
      ? [
          { href: "/users", label: "Users", icon: Users },
          { href: "/security-groups", label: "Groups", icon: Shield },
          { href: "/settings", label: "Settings", icon: Settings },
        ]
      : []),
  ];

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <aside className="w-64 flex-shrink-0 border-r border-sidebar-border bg-sidebar text-sidebar-foreground flex flex-col">
        <div className="h-16 flex items-center px-6 border-b border-sidebar-border/50">
          <div className="flex items-center gap-2 text-sidebar-primary font-bold text-xl tracking-tight">
            <CheckSquare className="w-6 h-6" />
            <span>TaskFlow</span>
          </div>
        </div>
        
        <div className="p-4 flex-1 overflow-y-auto space-y-1">
          {navItems.map((item) => {
            const isActive = location === item.href || (item.href !== "/" && location.startsWith(item.href));
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium transition-colors ${
                  isActive
                    ? "bg-sidebar-accent text-sidebar-accent-foreground"
                    : "text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
                }`}
              >
                <item.icon className="w-5 h-5" />
                {item.label}
              </Link>
            );
          })}
        </div>

        <div className="p-4 border-t border-sidebar-border/50 space-y-4">
          <div className="px-3">
            <div className="text-sm font-semibold truncate">{user?.firstName} {user?.surname}</div>
            <div className="text-xs text-sidebar-foreground/60 truncate">{user?.email}</div>
          </div>
          <Button
            variant="ghost"
            className="w-full justify-start text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
            onClick={handleLogout}
            disabled={logoutMutation.isPending}
          >
            <LogOut className="w-4 h-4 mr-2" />
            Logout
          </Button>
        </div>
      </aside>

      <main className="flex-1 flex flex-col min-w-0 overflow-hidden bg-background">
        <div className="flex-1 overflow-y-auto p-8">
          <div className="max-w-7xl mx-auto h-full flex flex-col">
            {children}
          </div>
        </div>
      </main>
    </div>
  );
}
