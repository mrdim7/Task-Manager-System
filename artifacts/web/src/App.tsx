import { Switch, Route, Router as WouterRouter, Redirect } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "@/contexts/auth-context";
import { Layout } from "@/components/layout";
import Login from "@/pages/login";
import Dashboard from "@/pages/dashboard";
import Tasks from "@/pages/tasks";
import TaskDetail from "@/pages/task-detail";
import Users from "@/pages/users";
import SecurityGroups from "@/pages/security-groups";
import Settings from "@/pages/settings";
import NotFound from "@/pages/not-found";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: 1,
    },
  },
});

function ProtectedRoute({ component: Component, adminOnly = false }: { component: React.ComponentType; adminOnly?: boolean }) {
  const { user, isLoading } = useAuth();
  if (isLoading) return <div className="min-h-screen flex items-center justify-center"><div className="animate-spin h-6 w-6 border-2 border-primary border-t-transparent rounded-full" /></div>;
  if (!user) return <Redirect to="/login" />;
  if (adminOnly && !user.isAdmin) return <Redirect to="/" />;
  return (
    <Layout>
      <Component />
    </Layout>
  );
}

function Router() {
  const { user, isLoading } = useAuth();
  if (isLoading) return <div className="min-h-screen flex items-center justify-center"><div className="animate-spin h-6 w-6 border-2 border-primary border-t-transparent rounded-full" /></div>;

  return (
    <Switch>
      <Route path="/login">
        {user ? <Redirect to="/" /> : <Login />}
      </Route>
      <Route path="/" component={() => <ProtectedRoute component={Dashboard} />} />
      <Route path="/tasks" component={() => <ProtectedRoute component={Tasks} />} />
      <Route path="/tasks/:id" component={() => <ProtectedRoute component={TaskDetail} />} />
      <Route path="/users" component={() => <ProtectedRoute component={Users} adminOnly />} />
      <Route path="/security-groups" component={() => <ProtectedRoute component={SecurityGroups} adminOnly />} />
      <Route path="/settings" component={() => <ProtectedRoute component={Settings} adminOnly />} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
          <AuthProvider>
            <Router />
          </AuthProvider>
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
