import React, { useState } from "react";
import { useRoute, Link, useLocation } from "wouter";
import {
  useGetTask,
  useUpdateTask,
  useDeleteTask,
  useListTaskNotes,
  useCreateTaskNote,
  useDeleteTaskNote,
  useListTasks,
  useListCategories,
  useListPriorities,
  useListUsers,
  useListSecurityGroups,
  useCreateTask,
  getGetTaskQueryKey,
  getListTasksQueryKey,
  getListTaskNotesQueryKey,
} from "@workspace/api-client-react";
import type { UpdateTaskRequest, CreateTaskRequest } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
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
import { Slider } from "@/components/ui/slider";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/auth-context";
import {
  ArrowLeft,
  Pencil,
  Trash2,
  Plus,
  Calendar,
  User,
  Tag,
  Flag,
  Shield,
  CheckSquare,
} from "lucide-react";

function timeAgo(date: string) {
  const d = new Date(date);
  const diff = Math.floor((Date.now() - d.getTime()) / 1000);
  if (diff < 60) return "just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

export default function TaskDetail() {
  const [, params] = useRoute("/tasks/:id");
  const [, setLocation] = useLocation();
  const id = Number(params?.id);
  const { user } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();

  const { data: task, isLoading } = useGetTask(id);
  const { data: allTasks = [] } = useListTasks();
  const { data: notes = [], isLoading: notesLoading } = useListTaskNotes(id);
  const { data: categories = [] } = useListCategories();
  const { data: priorities = [] } = useListPriorities();
  const { data: users = [] } = useListUsers();
  const { data: groups = [] } = useListSecurityGroups();

  const [showEdit, setShowEdit] = useState(false);
  const [showDelete, setShowDelete] = useState(false);
  const [showAddSubtask, setShowAddSubtask] = useState(false);
  const [noteContent, setNoteContent] = useState("");
  const [editForm, setEditForm] = useState<UpdateTaskRequest>({});
  const [subtaskForm, setSubtaskForm] = useState({ name: "", description: "", priorityId: "", assignedToId: "" });

  const openEdit = () => {
    if (!task) return;
    setEditForm({
      name: task.name,
      description: task.description ?? "",
      categoryId: task.categoryId ?? undefined,
      priorityId: task.priorityId ?? undefined,
      assignedToId: task.assignedToId ?? undefined,
      ownerId: task.ownerId ?? undefined,
      progress: task.progress ?? 0,
      dueDate: task.dueDate ?? undefined,
      startDate: task.startDate ?? undefined,
      securityGroupIds: task.securityGroups?.map((g) => g.id) ?? [],
    });
    setShowEdit(true);
  };

  const updateTask = useUpdateTask({
    mutation: {
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: getGetTaskQueryKey(id) });
        qc.invalidateQueries({ queryKey: getListTasksQueryKey() });
        setShowEdit(false);
        toast({ title: "Task updated" });
      },
      onError: () => toast({ variant: "destructive", title: "Failed to update task" }),
    },
  });

  const deleteTask = useDeleteTask({
    mutation: {
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: getListTasksQueryKey() });
        setLocation("/tasks");
        toast({ title: "Task deleted" });
      },
      onError: () => toast({ variant: "destructive", title: "Failed to delete task" }),
    },
  });

  const createNote = useCreateTaskNote({
    mutation: {
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: getListTaskNotesQueryKey(id) });
        setNoteContent("");
        toast({ title: "Note added" });
      },
    },
  });

  const deleteNote = useDeleteTaskNote({
    mutation: {
      onSuccess: () => qc.invalidateQueries({ queryKey: getListTaskNotesQueryKey(id) }),
    },
  });

  const createSubtask = useCreateTask({
    mutation: {
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: getListTasksQueryKey() });
        qc.invalidateQueries({ queryKey: getGetTaskQueryKey(id) });
        setShowAddSubtask(false);
        setSubtaskForm({ name: "", description: "", priorityId: "", assignedToId: "" });
        toast({ title: "Subtask created" });
      },
    },
  });

  const children = allTasks.filter((t) => t.parentId === id);

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-1/2" />
        <Skeleton className="h-4 w-1/3" />
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }

  if (!task) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">Task not found.</p>
        <Button variant="ghost" asChild className="mt-4">
          <Link href="/tasks"><ArrowLeft className="w-4 h-4 mr-2" /> Back to Tasks</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/tasks"><ArrowLeft className="w-4 h-4 mr-1" /> Tasks</Link>
        </Button>
        {task.parentId && (
          <>
            <span className="text-muted-foreground">/</span>
            <Button variant="ghost" size="sm" asChild>
              <Link href={`/tasks/${task.parentId}`}>Parent Task</Link>
            </Button>
          </>
        )}
      </div>

      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <h1 className="text-2xl font-bold tracking-tight">{task.name}</h1>
          {task.description && (
            <p className="text-muted-foreground mt-2">{task.description}</p>
          )}
        </div>
        <div className="flex gap-2 shrink-0">
          <Button variant="outline" size="sm" onClick={openEdit}>
            <Pencil className="w-4 h-4 mr-1.5" /> Edit
          </Button>
          <Button variant="outline" size="sm" className="text-destructive hover:text-destructive" onClick={() => setShowDelete(true)}>
            <Trash2 className="w-4 h-4" />
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card className="border-border/50">
          <CardHeader className="pb-3"><CardTitle className="text-sm">Details</CardTitle></CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="flex items-center gap-2">
              <Flag className="w-4 h-4 text-muted-foreground shrink-0" />
              <span className="text-muted-foreground">Priority:</span>
              {task.priorityName ? <Badge variant="outline">{task.priorityName}</Badge> : <span className="text-muted-foreground">—</span>}
            </div>
            <div className="flex items-center gap-2">
              <Tag className="w-4 h-4 text-muted-foreground shrink-0" />
              <span className="text-muted-foreground">Category:</span>
              {task.categoryName ? <Badge variant="secondary">{task.categoryName}</Badge> : <span className="text-muted-foreground">—</span>}
            </div>
            <div className="flex items-center gap-2">
              <User className="w-4 h-4 text-muted-foreground shrink-0" />
              <span className="text-muted-foreground">Assigned:</span>
              <span>{task.assignedToName ?? "—"}</span>
            </div>
            <div className="flex items-center gap-2">
              <User className="w-4 h-4 text-muted-foreground shrink-0" />
              <span className="text-muted-foreground">Owner:</span>
              <span>{task.ownerName ?? "—"}</span>
            </div>
            {task.dueDate && (
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-muted-foreground shrink-0" />
                <span className="text-muted-foreground">Due:</span>
                <span>{new Date(task.dueDate).toLocaleDateString()}</span>
              </div>
            )}
            {task.startDate && (
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-muted-foreground shrink-0" />
                <span className="text-muted-foreground">Start:</span>
                <span>{new Date(task.startDate).toLocaleDateString()}</span>
              </div>
            )}
            {task.securityGroups && task.securityGroups.length > 0 && (
              <div className="flex items-start gap-2">
                <Shield className="w-4 h-4 text-muted-foreground shrink-0 mt-0.5" />
                <span className="text-muted-foreground">Groups:</span>
                <div className="flex flex-wrap gap-1">
                  {task.securityGroups.map((g) => (
                    <Badge key={g.id} variant="outline" className="text-xs">{g.name}</Badge>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="border-border/50">
          <CardHeader className="pb-3"><CardTitle className="text-sm">Progress</CardTitle></CardHeader>
          <CardContent>
            <div className="flex items-center gap-3 mb-3">
              <Progress value={task.progress ?? 0} className="flex-1" />
              <span className="text-2xl font-bold">{task.progress ?? 0}%</span>
            </div>
            {children.length > 0 && (
              <p className="text-xs text-muted-foreground">Calculated from {children.length} subtask{children.length !== 1 ? "s" : ""}</p>
            )}
          </CardContent>
        </Card>
      </div>

      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <CheckSquare className="w-5 h-5" /> Subtasks ({children.length})
          </h2>
          <Button size="sm" variant="outline" onClick={() => setShowAddSubtask(true)}>
            <Plus className="w-4 h-4 mr-1" /> Add Subtask
          </Button>
        </div>
        {children.length === 0 ? (
          <p className="text-sm text-muted-foreground">No subtasks yet.</p>
        ) : (
          <div className="border border-border/50 rounded-lg divide-y divide-border/30">
            {children.map((child) => (
              <Link key={child.id} href={`/tasks/${child.id}`} className="flex items-center gap-3 px-4 py-3 hover:bg-muted/50 transition-colors">
                <div className="flex-1 min-w-0">
                  <span className="text-sm font-medium">{child.name}</span>
                  {child.priorityName && <Badge variant="outline" className="ml-2 text-xs">{child.priorityName}</Badge>}
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <Progress value={child.progress ?? 0} className="w-20 h-1.5" />
                  <span className="text-xs text-muted-foreground">{child.progress ?? 0}%</span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>

      <Separator />

      <div>
        <h2 className="text-lg font-semibold mb-4">Notes</h2>
        <div className="space-y-3 mb-4">
          {notesLoading ? (
            <Skeleton className="h-20 w-full" />
          ) : notes.length === 0 ? (
            <p className="text-sm text-muted-foreground">No notes yet.</p>
          ) : (
            notes.map((note) => (
              <div key={note.id} className="bg-muted/40 rounded-lg p-4 relative group">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="text-sm">{note.content}</p>
                    <p className="text-xs text-muted-foreground mt-1.5">
                      {note.authorName ?? "Unknown"} · {timeAgo(note.createdAt ?? "")}
                    </p>
                  </div>
                  {(user?.isAdmin || note.authorId === user?.id) && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="opacity-0 group-hover:opacity-100 h-7 w-7 text-muted-foreground hover:text-destructive transition-all shrink-0"
                      onClick={() => deleteNote.mutate({ taskId: id, noteId: note.id })}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
        <div className="flex gap-2">
          <Textarea
            placeholder="Add a note..."
            value={noteContent}
            onChange={(e) => setNoteContent(e.target.value)}
            rows={2}
            className="flex-1"
          />
          <Button
            onClick={() => createNote.mutate({ taskId: id, data: { content: noteContent } })}
            disabled={!noteContent.trim() || createNote.isPending}
          >
            Add
          </Button>
        </div>
      </div>

      <Dialog open={showEdit} onOpenChange={setShowEdit}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Edit Task</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>Name</Label>
              <Input value={editForm.name ?? ""} onChange={(e) => setEditForm((f) => ({ ...f, name: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label>Description</Label>
              <Textarea value={editForm.description ?? ""} onChange={(e) => setEditForm((f) => ({ ...f, description: e.target.value }))} rows={3} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Category</Label>
                <Select value={editForm.categoryId ? String(editForm.categoryId) : ""} onValueChange={(v) => setEditForm((f) => ({ ...f, categoryId: v ? Number(v) : undefined }))}>
                  <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">None</SelectItem>
                    {categories.map((c) => <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Priority</Label>
                <Select value={editForm.priorityId ? String(editForm.priorityId) : ""} onValueChange={(v) => setEditForm((f) => ({ ...f, priorityId: v ? Number(v) : undefined }))}>
                  <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">None</SelectItem>
                    {priorities.map((p) => <SelectItem key={p.id} value={String(p.id)}>{p.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Assigned To</Label>
                <Select value={editForm.assignedToId ? String(editForm.assignedToId) : ""} onValueChange={(v) => setEditForm((f) => ({ ...f, assignedToId: v ? Number(v) : undefined }))}>
                  <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">None</SelectItem>
                    {users.map((u) => <SelectItem key={u.id} value={String(u.id)}>{u.firstName} {u.surname}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Owner</Label>
                <Select value={editForm.ownerId ? String(editForm.ownerId) : ""} onValueChange={(v) => setEditForm((f) => ({ ...f, ownerId: v ? Number(v) : undefined }))}>
                  <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">None</SelectItem>
                    {users.map((u) => <SelectItem key={u.id} value={String(u.id)}>{u.firstName} {u.surname}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Start Date</Label>
                <Input type="date" value={editForm.startDate ? String(editForm.startDate) : ""} onChange={(e) => setEditForm((f) => ({ ...f, startDate: e.target.value || undefined }))} />
              </div>
              <div className="space-y-1.5">
                <Label>Due Date</Label>
                <Input type="date" value={editForm.dueDate ? String(editForm.dueDate) : ""} onChange={(e) => setEditForm((f) => ({ ...f, dueDate: e.target.value || undefined }))} />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Progress: {editForm.progress ?? 0}%</Label>
              <Slider
                min={0} max={100} step={5}
                value={[editForm.progress ?? 0]}
                onValueChange={([v]) => setEditForm((f) => ({ ...f, progress: v }))}
              />
            </div>
            {!task.parentId && (
              <div className="space-y-1.5">
                <Label>Security Groups</Label>
                <div className="flex flex-wrap gap-2">
                  {groups.map((g) => {
                    const selected = editForm.securityGroupIds?.includes(g.id);
                    return (
                      <Badge
                        key={g.id}
                        variant={selected ? "default" : "outline"}
                        className="cursor-pointer"
                        onClick={() => setEditForm((f) => ({
                          ...f,
                          securityGroupIds: selected
                            ? (f.securityGroupIds ?? []).filter((gid) => gid !== g.id)
                            : [...(f.securityGroupIds ?? []), g.id],
                        }))}
                      >
                        {g.name}
                      </Badge>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowEdit(false)}>Cancel</Button>
            <Button onClick={() => updateTask.mutate({ id, data: editForm })} disabled={updateTask.isPending}>
              {updateTask.isPending ? "Saving..." : "Save Changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showDelete} onOpenChange={setShowDelete}>
        <DialogContent>
          <DialogHeader><DialogTitle>Delete Task</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">Are you sure you want to delete "<strong>{task.name}</strong>"? This action cannot be undone.</p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDelete(false)}>Cancel</Button>
            <Button variant="destructive" onClick={() => deleteTask.mutate({ id })} disabled={deleteTask.isPending}>
              {deleteTask.isPending ? "Deleting..." : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showAddSubtask} onOpenChange={setShowAddSubtask}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>Add Subtask</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>Name *</Label>
              <Input value={subtaskForm.name} onChange={(e) => setSubtaskForm((f) => ({ ...f, name: e.target.value }))} placeholder="Subtask name" />
            </div>
            <div className="space-y-1.5">
              <Label>Description</Label>
              <Textarea value={subtaskForm.description} onChange={(e) => setSubtaskForm((f) => ({ ...f, description: e.target.value }))} rows={2} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Priority</Label>
                <Select value={subtaskForm.priorityId} onValueChange={(v) => setSubtaskForm((f) => ({ ...f, priorityId: v }))}>
                  <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                  <SelectContent>
                    {priorities.map((p) => <SelectItem key={p.id} value={String(p.id)}>{p.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Assign To</Label>
                <Select value={subtaskForm.assignedToId} onValueChange={(v) => setSubtaskForm((f) => ({ ...f, assignedToId: v }))}>
                  <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                  <SelectContent>
                    {users.map((u) => <SelectItem key={u.id} value={String(u.id)}>{u.firstName} {u.surname}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddSubtask(false)}>Cancel</Button>
            <Button
              onClick={() => createSubtask.mutate({
                data: {
                  name: subtaskForm.name,
                  description: subtaskForm.description || undefined,
                  parentId: id,
                  priorityId: subtaskForm.priorityId ? Number(subtaskForm.priorityId) : undefined,
                  assignedToId: subtaskForm.assignedToId ? Number(subtaskForm.assignedToId) : undefined,
                  ownerId: user!.id,
                } as CreateTaskRequest,
              })}
              disabled={!subtaskForm.name.trim() || createSubtask.isPending}
            >
              {createSubtask.isPending ? "Creating..." : "Create Subtask"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
