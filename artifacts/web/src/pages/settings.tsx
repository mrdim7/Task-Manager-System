import React, { useState } from "react";
import {
  useListCategories,
  useCreateCategory,
  useUpdateCategory,
  useDeleteCategory,
  useListPriorities,
  useCreatePriority,
  useUpdatePriority,
  useDeletePriority,
  getListCategoriesQueryKey,
  getListPrioritiesQueryKey,
  Category,
  Priority,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { Plus, Pencil, Trash2, Tag, Flag, GripVertical } from "lucide-react";

function CategoryManager() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const { data: categories = [], isLoading } = useListCategories();
  const [showCreate, setShowCreate] = useState(false);
  const [editCat, setEditCat] = useState<Category | null>(null);
  const [deleteCat, setDeleteCat] = useState<Category | null>(null);
  const [name, setName] = useState("");

  const invalidate = () => qc.invalidateQueries({ queryKey: getListCategoriesQueryKey() });

  const createMutation = useCreateCategory({
    mutation: {
      onSuccess: () => { invalidate(); setShowCreate(false); setName(""); toast({ title: "Category created" }); },
      onError: () => toast({ variant: "destructive", title: "Failed to create category" }),
    },
  });
  const updateMutation = useUpdateCategory({
    mutation: {
      onSuccess: () => { invalidate(); setEditCat(null); toast({ title: "Category updated" }); },
      onError: () => toast({ variant: "destructive", title: "Failed to update category" }),
    },
  });
  const deleteMutation = useDeleteCategory({
    mutation: {
      onSuccess: () => { invalidate(); setDeleteCat(null); toast({ title: "Category deleted" }); },
      onError: () => toast({ variant: "destructive", title: "Failed to delete category" }),
    },
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">{categories.length} categories</p>
        <Button size="sm" onClick={() => { setName(""); setShowCreate(true); }}>
          <Plus className="w-4 h-4 mr-1.5" /> Add Category
        </Button>
      </div>
      <div className="space-y-2">
        {isLoading ? (
          Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)
        ) : categories.map((c) => (
          <div key={c.id} className="flex items-center gap-3 px-4 py-3 border border-border/50 rounded-lg">
            <Tag className="w-4 h-4 text-muted-foreground shrink-0" />
            <span className="flex-1 font-medium text-sm">{c.name}</span>
            <div className="flex items-center gap-1">
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => { setName(c.name); setEditCat(c); }}>
                <Pencil className="w-3.5 h-3.5" />
              </Button>
              <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive" onClick={() => setDeleteCat(c)}>
                <Trash2 className="w-3.5 h-3.5" />
              </Button>
            </div>
          </div>
        ))}
      </div>

      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent>
          <DialogHeader><DialogTitle>Add Category</DialogTitle></DialogHeader>
          <div className="space-y-1.5 py-2">
            <Label>Name *</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Category name" />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreate(false)}>Cancel</Button>
            <Button onClick={() => createMutation.mutate({ data: { name } })} disabled={!name.trim() || createMutation.isPending}>
              {createMutation.isPending ? "Creating..." : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!editCat} onOpenChange={(o) => !o && setEditCat(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Edit Category</DialogTitle></DialogHeader>
          <div className="space-y-1.5 py-2">
            <Label>Name</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditCat(null)}>Cancel</Button>
            <Button onClick={() => updateMutation.mutate({ id: editCat!.id, data: { name } })} disabled={!name.trim() || updateMutation.isPending}>
              {updateMutation.isPending ? "Saving..." : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!deleteCat} onOpenChange={(o) => !o && setDeleteCat(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Delete Category</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">Delete "<strong>{deleteCat?.name}</strong>"?</p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteCat(null)}>Cancel</Button>
            <Button variant="destructive" onClick={() => deleteMutation.mutate({ id: deleteCat!.id })} disabled={deleteMutation.isPending}>
              {deleteMutation.isPending ? "Deleting..." : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function PriorityManager() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const { data: priorities = [], isLoading } = useListPriorities();
  const [showCreate, setShowCreate] = useState(false);
  const [editPrio, setEditPrio] = useState<Priority | null>(null);
  const [deletePrio, setDeletePrio] = useState<Priority | null>(null);
  const [form, setForm] = useState({ name: "", order: 1 });

  const invalidate = () => qc.invalidateQueries({ queryKey: getListPrioritiesQueryKey() });

  const createMutation = useCreatePriority({
    mutation: {
      onSuccess: () => { invalidate(); setShowCreate(false); setForm({ name: "", order: 1 }); toast({ title: "Priority created" }); },
      onError: () => toast({ variant: "destructive", title: "Failed to create priority" }),
    },
  });
  const updateMutation = useUpdatePriority({
    mutation: {
      onSuccess: () => { invalidate(); setEditPrio(null); toast({ title: "Priority updated" }); },
      onError: () => toast({ variant: "destructive", title: "Failed to update priority" }),
    },
  });
  const deleteMutation = useDeletePriority({
    mutation: {
      onSuccess: () => { invalidate(); setDeletePrio(null); toast({ title: "Priority deleted" }); },
      onError: () => toast({ variant: "destructive", title: "Failed to delete priority" }),
    },
  });

  const colorMap: Record<string, string> = {
    critical: "bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-400",
    high: "bg-orange-100 text-orange-700 dark:bg-orange-950/40 dark:text-orange-400",
    medium: "bg-yellow-100 text-yellow-700 dark:bg-yellow-950/40 dark:text-yellow-400",
    low: "bg-green-100 text-green-700 dark:bg-green-950/40 dark:text-green-400",
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">{priorities.length} priorities (sorted by order)</p>
        <Button size="sm" onClick={() => { setForm({ name: "", order: (priorities.length || 0) + 1 }); setShowCreate(true); }}>
          <Plus className="w-4 h-4 mr-1.5" /> Add Priority
        </Button>
      </div>
      <div className="space-y-2">
        {isLoading ? (
          Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)
        ) : [...priorities].sort((a, b) => (a.order ?? 0) - (b.order ?? 0)).map((p) => (
          <div key={p.id} className="flex items-center gap-3 px-4 py-3 border border-border/50 rounded-lg">
            <GripVertical className="w-4 h-4 text-muted-foreground shrink-0" />
            <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${colorMap[p.name.toLowerCase()] ?? "bg-muted text-muted-foreground"}`}>
              {p.name}
            </span>
            <span className="flex-1 text-sm text-muted-foreground">Order: {p.order}</span>
            <div className="flex items-center gap-1">
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => { setForm({ name: p.name, order: p.order ?? 1 }); setEditPrio(p); }}>
                <Pencil className="w-3.5 h-3.5" />
              </Button>
              <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive" onClick={() => setDeletePrio(p)}>
                <Trash2 className="w-3.5 h-3.5" />
              </Button>
            </div>
          </div>
        ))}
      </div>

      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent>
          <DialogHeader><DialogTitle>Add Priority</DialogTitle></DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1.5">
              <Label>Name *</Label>
              <Input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} placeholder="e.g. Critical" />
            </div>
            <div className="space-y-1.5">
              <Label>Sort Order (lower = higher priority)</Label>
              <Input type="number" min={1} value={form.order} onChange={(e) => setForm((f) => ({ ...f, order: Number(e.target.value) }))} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreate(false)}>Cancel</Button>
            <Button onClick={() => createMutation.mutate({ data: { name: form.name, order: form.order } })} disabled={!form.name.trim() || createMutation.isPending}>
              {createMutation.isPending ? "Creating..." : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!editPrio} onOpenChange={(o) => !o && setEditPrio(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Edit Priority</DialogTitle></DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1.5">
              <Label>Name</Label>
              <Input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label>Sort Order</Label>
              <Input type="number" min={1} value={form.order} onChange={(e) => setForm((f) => ({ ...f, order: Number(e.target.value) }))} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditPrio(null)}>Cancel</Button>
            <Button onClick={() => updateMutation.mutate({ id: editPrio!.id, data: { name: form.name, order: form.order } })} disabled={!form.name.trim() || updateMutation.isPending}>
              {updateMutation.isPending ? "Saving..." : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!deletePrio} onOpenChange={(o) => !o && setDeletePrio(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Delete Priority</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">Delete priority "<strong>{deletePrio?.name}</strong>"?</p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeletePrio(null)}>Cancel</Button>
            <Button variant="destructive" onClick={() => deleteMutation.mutate({ id: deletePrio!.id })} disabled={deleteMutation.isPending}>
              {deleteMutation.isPending ? "Deleting..." : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default function Settings() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Settings</h1>
        <p className="text-muted-foreground mt-1">Manage categories and priorities used across tasks</p>
      </div>

      <Tabs defaultValue="categories">
        <TabsList>
          <TabsTrigger value="categories" className="flex items-center gap-2">
            <Tag className="w-4 h-4" /> Categories
          </TabsTrigger>
          <TabsTrigger value="priorities" className="flex items-center gap-2">
            <Flag className="w-4 h-4" /> Priorities
          </TabsTrigger>
        </TabsList>
        <TabsContent value="categories" className="mt-6">
          <CategoryManager />
        </TabsContent>
        <TabsContent value="priorities" className="mt-6">
          <PriorityManager />
        </TabsContent>
      </Tabs>
    </div>
  );
}
