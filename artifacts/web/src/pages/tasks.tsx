import React, { useState } from "react";
import { Link } from "wouter";
import {
  useListTasks,
  useListCategories,
  useListPriorities,
  useCreateTask,
  useListUsers,
  getListTasksQueryKey,
} from "@workspace/api-client-react";
import type { Task, CreateTaskRequest } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/auth-context";
import { Plus, Search, ChevronRight, ChevronDown, Calendar } from "lucide-react";

function priorityBadgeVariant(name?: string | null): "destructive" | "secondary" | "outline" {
  switch (name?.toLowerCase()) {
    case "critical": return "destructive";
    case "high": return "secondary";
    default: return "outline";
  }
}

function TaskTreeRow({
  task,
  depth = 0,
  allTasks,
}: {
  task: Task;
  depth?: number;
  allTasks: Task[];
}) {
  const children = allTasks.filter((t) => t.parentId === task.id);
  const [open, setOpen] = useState(depth === 0);

  return (
    <>
      <Link href={`/tasks/${task.id}`} className="block">
        <div
          className="flex items-center gap-2 px-4 py-3 hover:bg-muted/50 transition-colors group cursor-pointer border-b border-border/30 last:border-b-0"
          style={{ paddingLeft: `${16 + depth * 24}px` }}
        >
          <button
            onClick={(e) => {
              e.preventDefault();
              setOpen((p) => !p);
            }}
            className="shrink-0 text-muted-foreground"
          >
            {children.length > 0 ? (
              open ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />
            ) : (
              <span className="w-4 h-4 block" />
            )}
          </button>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-sm font-medium">{task.name}</span>
              {task.priorityName && (
                <Badge variant={priorityBadgeVariant(task.priorityName)} className="text-xs">
                  {task.priorityName}
                </Badge>
              )}
              {task.categoryName && (
                <Badge variant="outline" className="text-xs">
                  {task.categoryName}
                </Badge>
              )}
            </div>
            <div className="flex items-center gap-3 mt-0.5">
              {task.dueDate && (
                <span className="text-xs text-muted-foreground flex items-center gap-1">
                  <Calendar className="w-3 h-3" />
                  {new Date(task.dueDate).toLocaleDateString()}
                </span>
              )}
              {task.assignedToName && (
                <span className="text-xs text-muted-foreground">
                  {task.assignedToName}
                </span>
              )}
            </div>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <div className="w-20 hidden sm:block">
              <Progress value={task.progress ?? 0} className="h-1.5" />
            </div>
            <span className="text-xs text-muted-foreground w-8 text-right">{task.progress ?? 0}%</span>
          </div>
        </div>
      </Link>
      {open && children.map((child) => (
        <TaskTreeRow key={child.id} task={child} depth={depth + 1} allTasks={allTasks} />
      ))}
    </>
  );
}

export default function Tasks() {
  const { user } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();

  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [priorityFilter, setPriorityFilter] = useState<string>("all");
  const [showCreate, setShowCreate] = useState(false);

  const [form, setForm] = useState({
    name: "",
    description: "",
    categoryId: "",
    priorityId: "",
    assignedToId: "",
    dueDate: "",
  });

  const { data: allTasks = [], isLoading } = useListTasks();
  const { data: categories = [] } = useListCategories();
  const { data: priorities = [] } = useListPriorities();
  const { data: users = [] } = useListUsers();

  const createTask = useCreateTask({
    mutation: {
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: getListTasksQueryKey() });
        setShowCreate(false);
        setForm({ name: "", description: "", categoryId: "", priorityId: "", assignedToId: "", dueDate: "" });
        toast({ title: "Task created" });
      },
      onError: () => toast({ variant: "destructive", title: "Failed to create task" }),
    },
  });

  const rootTasks = allTasks.filter((t) => !t.parentId);
  const filtered = rootTasks.filter((t) => {
    const matchSearch = !search || t.name.toLowerCase().includes(search.toLowerCase());
    const matchCat = categoryFilter === "all" || String(t.categoryId) === categoryFilter;
    const matchPrio = priorityFilter === "all" || String(t.priorityId) === priorityFilter;
    return matchSearch && matchCat && matchPrio;
  });

  const handleCreate = () => {
    if (!form.name.trim()) return;
    const payload: CreateTaskRequest = {
      name: form.name.trim(),
      description: form.description || undefined,
      categoryId: form.categoryId ? Number(form.categoryId) : undefined,
      priorityId: form.priorityId ? Number(form.priorityId) : undefined,
      assignedToId: form.assignedToId ? Number(form.assignedToId) : undefined,
      ownerId: user!.id,
      dueDate: form.dueDate || undefined,
    };
    createTask.mutate({ data: payload });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Tasks</h1>
          <p className="text-muted-foreground mt-1">{allTasks.length} total tasks</p>
        </div>
        <Button onClick={() => setShowCreate(true)}>
          <Plus className="w-4 h-4 mr-2" /> New Task
        </Button>
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search tasks..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={categoryFilter} onValueChange={setCategoryFilter}>
          <SelectTrigger className="w-full sm:w-40">
            <SelectValue placeholder="Category" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Categories</SelectItem>
            {categories.map((c) => (
              <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={priorityFilter} onValueChange={setPriorityFilter}>
          <SelectTrigger className="w-full sm:w-40">
            <SelectValue placeholder="Priority" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Priorities</SelectItem>
            {priorities.map((p) => (
              <SelectItem key={p.id} value={String(p.id)}>{p.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="border border-border/50 rounded-lg overflow-hidden">
        {isLoading ? (
          <div className="divide-y">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="px-4 py-3">
                <Skeleton className="h-4 w-1/3 mb-1" />
                <Skeleton className="h-3 w-1/5" />
              </div>
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <p>No tasks found.</p>
          </div>
        ) : (
          filtered.map((task) => (
            <TaskTreeRow key={task.id} task={task} allTasks={allTasks} />
          ))
        )}
      </div>

      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Create New Task</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>Name *</Label>
              <Input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} placeholder="Task name" />
            </div>
            <div className="space-y-1.5">
              <Label>Description</Label>
              <Textarea value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} placeholder="Optional description" rows={3} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Category</Label>
                <Select value={form.categoryId} onValueChange={(v) => setForm((f) => ({ ...f, categoryId: v }))}>
                  <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                  <SelectContent>
                    {categories.map((c) => <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Priority</Label>
                <Select value={form.priorityId} onValueChange={(v) => setForm((f) => ({ ...f, priorityId: v }))}>
                  <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                  <SelectContent>
                    {priorities.map((p) => <SelectItem key={p.id} value={String(p.id)}>{p.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Assign To</Label>
                <Select value={form.assignedToId} onValueChange={(v) => setForm((f) => ({ ...f, assignedToId: v }))}>
                  <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                  <SelectContent>
                    {users.map((u) => <SelectItem key={u.id} value={String(u.id)}>{u.firstName} {u.surname}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Due Date</Label>
                <Input type="date" value={form.dueDate} onChange={(e) => setForm((f) => ({ ...f, dueDate: e.target.value }))} />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreate(false)}>Cancel</Button>
            <Button onClick={handleCreate} disabled={!form.name.trim() || createTask.isPending}>
              {createTask.isPending ? "Creating..." : "Create Task"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
