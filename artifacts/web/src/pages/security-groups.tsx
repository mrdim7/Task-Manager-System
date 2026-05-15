import React, { useState } from "react";
import {
  useListSecurityGroups,
  useCreateSecurityGroup,
  useUpdateSecurityGroup,
  useDeleteSecurityGroup,
  getListSecurityGroupsQueryKey,
} from "@workspace/api-client-react";
import type { SecurityGroup } from "@workspace/api-client-react";
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { Plus, Pencil, Trash2, Shield } from "lucide-react";

export default function SecurityGroups() {
  const { toast } = useToast();
  const qc = useQueryClient();

  const { data: groups = [], isLoading } = useListSecurityGroups();

  const [showCreate, setShowCreate] = useState(false);
  const [editGroup, setEditGroup] = useState<SecurityGroup | null>(null);
  const [deleteGroup, setDeleteGroup] = useState<SecurityGroup | null>(null);

  const [createName, setCreateName] = useState("");
  const [editName, setEditName] = useState("");

  const invalidate = () => qc.invalidateQueries({ queryKey: getListSecurityGroupsQueryKey() });

  const createMutation = useCreateSecurityGroup({
    mutation: {
      onSuccess: () => { invalidate(); setShowCreate(false); setCreateName(""); toast({ title: "Group created" }); },
      onError: () => toast({ variant: "destructive", title: "Failed to create group" }),
    },
  });

  const updateMutation = useUpdateSecurityGroup({
    mutation: {
      onSuccess: () => { invalidate(); setEditGroup(null); toast({ title: "Group updated" }); },
      onError: () => toast({ variant: "destructive", title: "Failed to update group" }),
    },
  });

  const deleteMutation = useDeleteSecurityGroup({
    mutation: {
      onSuccess: () => { invalidate(); setDeleteGroup(null); toast({ title: "Group deleted" }); },
      onError: () => toast({ variant: "destructive", title: "Failed to delete group" }),
    },
  });

  const openEdit = (g: SecurityGroup) => {
    setEditName(g.name);
    setEditGroup(g);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Shield className="w-6 h-6" /> Security Groups
          </h1>
          <p className="text-muted-foreground mt-1">Control task visibility with security groups</p>
        </div>
        <Button onClick={() => setShowCreate(true)}>
          <Plus className="w-4 h-4 mr-2" /> New Group
        </Button>
      </div>

      <div className="border border-border/50 rounded-lg overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Members</TableHead>
              <TableHead className="w-[80px]">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              Array.from({ length: 3 }).map((_, i) => (
                <TableRow key={i}>
                  {Array.from({ length: 3 }).map((_, j) => <TableCell key={j}><Skeleton className="h-4 w-full" /></TableCell>)}
                </TableRow>
              ))
            ) : groups.length === 0 ? (
              <TableRow>
                <TableCell colSpan={3} className="text-center text-muted-foreground py-8">No security groups yet.</TableCell>
              </TableRow>
            ) : groups.map((g) => (
              <TableRow key={g.id}>
                <TableCell className="font-medium">{g.name}</TableCell>
                <TableCell>
                  <div className="flex flex-wrap gap-1">
                    {g.members?.map((m) => (
                      <Badge key={m.id} variant="secondary" className="text-xs">
                        {m.firstName} {m.surname}
                      </Badge>
                    ))}
                    {(!g.members || g.members.length === 0) && <span className="text-muted-foreground text-sm">No members</span>}
                  </div>
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-1">
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(g)}>
                      <Pencil className="w-3.5 h-3.5" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive" onClick={() => setDeleteGroup(g)}>
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent>
          <DialogHeader><DialogTitle>Create Security Group</DialogTitle></DialogHeader>
          <div className="space-y-1.5 py-2">
            <Label>Name *</Label>
            <Input value={createName} onChange={(e) => setCreateName(e.target.value)} placeholder="e.g. Engineering" />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreate(false)}>Cancel</Button>
            <Button onClick={() => createMutation.mutate({ data: { name: createName } })} disabled={!createName || createMutation.isPending}>
              {createMutation.isPending ? "Creating..." : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!editGroup} onOpenChange={(o) => !o && setEditGroup(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Edit Security Group</DialogTitle></DialogHeader>
          <div className="space-y-1.5 py-2">
            <Label>Name</Label>
            <Input value={editName} onChange={(e) => setEditName(e.target.value)} />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditGroup(null)}>Cancel</Button>
            <Button onClick={() => updateMutation.mutate({ id: editGroup!.id, data: { name: editName } })} disabled={!editName || updateMutation.isPending}>
              {updateMutation.isPending ? "Saving..." : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!deleteGroup} onOpenChange={(o) => !o && setDeleteGroup(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Delete Group</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">Delete group "<strong>{deleteGroup?.name}</strong>"? This cannot be undone.</p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteGroup(null)}>Cancel</Button>
            <Button variant="destructive" onClick={() => deleteMutation.mutate({ id: deleteGroup!.id })} disabled={deleteMutation.isPending}>
              {deleteMutation.isPending ? "Deleting..." : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
