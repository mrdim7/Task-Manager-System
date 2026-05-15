import React from "react";
import { Link } from "wouter";
import {
  useGetDashboardSummary,
  useGetMyTasks,
  useGetOverdueTasks,
} from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import {
  CheckSquare,
  Clock,
  AlertTriangle,
  TrendingUp,
  ArrowRight,
  User,
} from "lucide-react";
import { useAuth } from "@/contexts/auth-context";
import type { Task } from "@workspace/api-client-react";

function priorityColor(name?: string | null) {
  switch (name?.toLowerCase()) {
    case "critical": return "destructive";
    case "high": return "secondary";
    default: return "outline";
  }
}

function TaskRow({ task }: { task: Task }) {
  return (
    <Link href={`/tasks/${task.id}`} className="flex items-center gap-3 py-3 px-4 rounded-lg hover:bg-muted/50 transition-colors group">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium truncate">{task.name}</span>
          {task.priorityName && (
            <Badge variant={priorityColor(task.priorityName) as "destructive" | "secondary" | "outline"} className="text-xs shrink-0">
              {task.priorityName}
            </Badge>
          )}
        </div>
        {task.dueDate && (
          <div className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1">
            <Clock className="w-3 h-3" />
            Due {new Date(task.dueDate).toLocaleDateString()}
          </div>
        )}
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <div className="w-16 hidden sm:block">
          <Progress value={task.progress ?? 0} className="h-1.5" />
        </div>
        <span className="text-xs text-muted-foreground w-8 text-right">{task.progress ?? 0}%</span>
        <ArrowRight className="w-4 h-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
      </div>
    </Link>
  );
}

export default function Dashboard() {
  const { user } = useAuth();
  const { data: summary, isLoading: summaryLoading } = useGetDashboardSummary();
  const { data: myTasks, isLoading: myTasksLoading } = useGetMyTasks({ limit: 5 });
  const { data: overdueTasks, isLoading: overdueLoading } = useGetOverdueTasks();

  const statCards = [
    {
      title: "Total Tasks",
      value: summary?.totalTasks ?? 0,
      icon: CheckSquare,
      color: "text-blue-500",
      bg: "bg-blue-50 dark:bg-blue-950/30",
    },
    {
      title: "In Progress",
      value: summary?.tasksInProgress ?? 0,
      icon: TrendingUp,
      color: "text-amber-500",
      bg: "bg-amber-50 dark:bg-amber-950/30",
    },
    {
      title: "Completed",
      value: summary?.completedTasks ?? 0,
      icon: CheckSquare,
      color: "text-green-500",
      bg: "bg-green-50 dark:bg-green-950/30",
    },
    {
      title: "Overdue",
      value: summary?.overdueTasks ?? 0,
      icon: AlertTriangle,
      color: "text-red-500",
      bg: "bg-red-50 dark:bg-red-950/30",
    },
  ];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">
          Good {new Date().getHours() < 12 ? "morning" : new Date().getHours() < 18 ? "afternoon" : "evening"},{" "}
          {user?.firstName}
        </h1>
        <p className="text-muted-foreground mt-1">Here's what's happening with your projects today.</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map((card) => (
          <Card key={card.title} className="border-border/50">
            <CardContent className="p-5">
              <div className="flex items-start justify-between">
                <div>
                  {summaryLoading ? (
                    <Skeleton className="h-8 w-12 mb-1" />
                  ) : (
                    <div className="text-3xl font-bold">{card.value}</div>
                  )}
                  <div className="text-sm text-muted-foreground mt-0.5">{card.title}</div>
                </div>
                <div className={`${card.bg} p-2.5 rounded-lg`}>
                  <card.icon className={`w-5 h-5 ${card.color}`} />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="border-border/50">
          <CardHeader className="flex flex-row items-center justify-between pb-3">
            <div>
              <CardTitle className="text-base flex items-center gap-2">
                <User className="w-4 h-4" /> My Tasks
              </CardTitle>
              <CardDescription>Tasks assigned to you</CardDescription>
            </div>
            <Button variant="ghost" size="sm" asChild>
              <Link href="/tasks">View all <ArrowRight className="w-3 h-3 ml-1" /></Link>
            </Button>
          </CardHeader>
          <CardContent className="pt-0">
            {myTasksLoading ? (
              <div className="space-y-3">
                {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}
              </div>
            ) : myTasks?.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6">No tasks assigned to you.</p>
            ) : (
              <div className="divide-y divide-border/50">
                {myTasks?.map((task) => <TaskRow key={task.id} task={task} />)}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="border-border/50">
          <CardHeader className="flex flex-row items-center justify-between pb-3">
            <div>
              <CardTitle className="text-base flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-destructive" /> Overdue Tasks
              </CardTitle>
              <CardDescription>Tasks past their due date</CardDescription>
            </div>
          </CardHeader>
          <CardContent className="pt-0">
            {overdueLoading ? (
              <div className="space-y-3">
                {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}
              </div>
            ) : overdueTasks?.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6">No overdue tasks. Great work!</p>
            ) : (
              <div className="divide-y divide-border/50">
                {overdueTasks?.slice(0, 5).map((task) => <TaskRow key={task.id} task={task} />)}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {summary && (
        <Card className="border-border/50">
          <CardHeader>
            <CardTitle className="text-base">Summary</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 text-sm">
              <div className="flex flex-col">
                <span className="text-muted-foreground">My Open Tasks</span>
                <span className="text-2xl font-bold mt-1">{summary.myOpenTasks}</span>
              </div>
              <div className="flex flex-col">
                <span className="text-muted-foreground">Due Soon</span>
                <span className="text-2xl font-bold mt-1">{summary.upcomingDueSoon}</span>
              </div>
              <div className="flex flex-col">
                <span className="text-muted-foreground">Completed</span>
                <span className="text-2xl font-bold mt-1">{summary.completedTasks}</span>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
