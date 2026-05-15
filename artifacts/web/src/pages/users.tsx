import React, { useState } from "react";
import {
  useListUsers,
  useCreateUser,
  useUpdateUser,
  useDeleteUser,
  useResetUserPassword,
  useListSecurityGroups,
  getListUsersQueryKey,
  User,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
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
import { useToast } from "@/hooks/use-toast";
import { Plus, Pencil, Trash2, KeyRound, Search } from "lucide-react";

export default function Users() {
  const { toast } = useToast();
  const qc = useQueryClient();

  const { data: users = [], isLoading } = useListUsers();
  const { data: groups = [] } = useListSecurityGroups();

  const [search, setSearch] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [editUser, setEditUser] = useState<User | null>(null);
  const [deleteUser, setDeleteUser] = useState<User | null>(null);
  const [resetUser, setResetUser] = useState<User | null>(null);
  const [newPassword, setNewPassword] = useState("");

  const [createForm, setCreateForm] = useState({
    firstName: "", surname: "", email: "", password: "", isAdmin: false, isActive: true,
    securityGroupIds: [] as number[],
  });

  const [editForm, setEditForm] = useState({
    firstName: "", surname: "", email: "", isAdmin: false, isActive: true,
    securityGroupIds: [] as number[],
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: getListUsersQueryKey() });

  const createMutation = useCreateUser({
    mutation: {
      onSuccess: () => { invalidate(); setShowCreate(false); setCreateForm({ firstName: "", surname: "", email: "", password: "", isAdmin: false, isActive: true, securityGroupIds: [] }); toast({ title: "User created" }); },
      onError: (e: Error) => toast({ variant: "destructive", title: "Failed to create user", description: e.message }),
    },
  });

  const updateMutation = useUpdateUser({
    mutation: {
      onSuccess: () => { invalidate(); setEditUser(null); toast({ title: "User updated" }); },
      onError: () => toast({ variant: "destructive", title: "Failed to update user" }),
    },
  });

  const deleteMutation = useDeleteUser({
    mutation: {
      onSuccess: () => { invalidate(); setDeleteUser(null); toast({ title: "User deleted" }); },
      onError: () => toast({ variant: "destructive", title: "Failed to delete user" }),
    },
  });

  const resetMutation = useResetUserPassword({
    mutation: {
      onSuccess: () => { setResetUser(null); setNewPassword(""); toast({ title: "Password reset" }); },
      onError: () => toast({ variant: "destructive", title: "Failed to reset password" }),
    },
  });

  const openEdit = (u: User) => {
    setEditForm({
      firstName: u.firstName,
      surname: u.surname,
      email: u.email,
      isAdmin: u.isAdmin ?? false,
      isActive: u.isActive ?? true,
      securityGroupIds: u.securityGroups?.map((g) => g.id) ?? [],
    });
    setEditUser(u);
  };

  const filtered = users.filter((u) =>
    !search ||
    `${u.firstName} ${u.surname} ${u.email}`.toLowerCase().includes(search.toLowerCase())
  );

  const GroupToggle = ({
    selected,
    onToggle,
  }: { selected: number[]; onToggle: (id: number) => void }) => (
    <div className="flex flex-wrap gap-2">
      {groups.map((g) => (
        <Badge
          key={g.id}
          variant={selected.includes(g.id) ? "default" : "outline"}
          className="cursor-pointer"
          onClick={() => onToggle(g.id)}
        >
          {g.name}
        </Badge>
      ))}
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Users</h1>
          <p className="text-muted-foreground mt-1">{users.length} registered users</p>
        </div>
        <Button onClick={() => setShowCreate(true)}>
          <Plus className="w-4 h-4 mr-2" /> New User
        </Button>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input placeholder="Search users..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9 max-w-sm" />
      </div>

      <div className="border border-border/50 rounded-lg overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Groups</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="w-[100px]">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              Array.from({ length: 4 }).map((_, i) => (
                <TableRow key={i}>
                  {Array.from({ length: 6 }).map((_, j) => <TableCell key={j}><Skeleton className="h-4 w-full" /></TableCell>)}
                </TableRow>
              ))
            ) : filtered.map((u) => (
              <TableRow key={u.id}>
                <TableCell className="font-medium">{u.firstName} {u.surname}</TableCell>
                <TableCell className="text-muted-foreground">{u.email}</TableCell>
                <TableCell>
                  <div className="flex flex-wrap gap-1">
                    {u.securityGroups?.map((g) => (
                      <Badge key={g.id} variant="secondary" className="text-xs">{g.name}</Badge>
                    ))}
                  </div>
                </TableCell>
                <TableCell>
                  <Badge variant={u.isAdmin ? "default" : "outline"}>{u.isAdmin ? "Admin" : "User"}</Badge>
                </TableCell>
                <TableCell>
                  <Badge variant={u.isActive ? "secondary" : "outline"}>{u.isActive ? "Active" : "Inactive"}</Badge>
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-1">
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(u)}>
                      <Pencil className="w-3.5 h-3.5" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setResetUser(u)}>
                      <KeyRound className="w-3.5 h-3.5" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive" onClick={() => setDeleteUser(u)}>
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
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>Create User</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>First Name *</Label>
                <Input value={createForm.firstName} onChange={(e) => setCreateForm((f) => ({ ...f, firstName: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label>Surname *</Label>
                <Input value={createForm.surname} onChange={(e) => setCreateForm((f) => ({ ...f, surname: e.target.value }))} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Email *</Label>
              <Input type="email" value={createForm.email} onChange={(e) => setCreateForm((f) => ({ ...f, email: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label>Password *</Label>
              <Input type="password" value={createForm.password} onChange={(e) => setCreateForm((f) => ({ ...f, password: e.target.value }))} />
            </div>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <Switch checked={createForm.isAdmin} onCheckedChange={(v) => setCreateForm((f) => ({ ...f, isAdmin: v }))} id="create-admin" />
                <Label htmlFor="create-admin">Admin</Label>
              </div>
              <div className="flex items-center gap-2">
                <Switch checked={createForm.isActive} onCheckedChange={(v) => setCreateForm((f) => ({ ...f, isActive: v }))} id="create-active" />
                <Label htmlFor="create-active">Active</Label>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Security Groups</Label>
              <GroupToggle
                selected={createForm.securityGroupIds}
                onToggle={(id) => setCreateForm((f) => ({
                  ...f,
                  securityGroupIds: f.securityGroupIds.includes(id)
                    ? f.securityGroupIds.filter((x) => x !== id)
                    : [...f.securityGroupIds, id],
                }))}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreate(false)}>Cancel</Button>
            <Button
              onClick={() => createMutation.mutate({ data: createForm })}
              disabled={!createForm.firstName || !createForm.surname || !createForm.email || !createForm.password || createMutation.isPending}
            >
              {createMutation.isPending ? "Creating..." : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!editUser} onOpenChange={(o) => !o && setEditUser(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>Edit User</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>First Name</Label>
                <Input value={editForm.firstName} onChange={(e) => setEditForm((f) => ({ ...f, firstName: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label>Surname</Label>
                <Input value={editForm.surname} onChange={(e) => setEditForm((f) => ({ ...f, surname: e.target.value }))} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Email</Label>
              <Input type="email" value={editForm.email} onChange={(e) => setEditForm((f) => ({ ...f, email: e.target.value }))} />
            </div>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <Switch checked={editForm.isAdmin} onCheckedChange={(v) => setEditForm((f) => ({ ...f, isAdmin: v }))} id="edit-admin" />
                <Label htmlFor="edit-admin">Admin</Label>
              </div>
              <div className="flex items-center gap-2">
                <Switch checked={editForm.isActive} onCheckedChange={(v) => setEditForm((f) => ({ ...f, isActive: v }))} id="edit-active" />
                <Label htmlFor="edit-active">Active</Label>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Security Groups</Label>
              <GroupToggle
                selected={editForm.securityGroupIds}
                onToggle={(id) => setEditForm((f) => ({
                  ...f,
                  securityGroupIds: f.securityGroupIds.includes(id)
                    ? f.securityGroupIds.filter((x) => x !== id)
                    : [...f.securityGroupIds, id],
                }))}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditUser(null)}>Cancel</Button>
            <Button
              onClick={() => updateMutation.mutate({ id: editUser!.id, data: editForm })}
              disabled={updateMutation.isPending}
            >
              {updateMutation.isPending ? "Saving..." : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!deleteUser} onOpenChange={(o) => !o && setDeleteUser(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Delete User</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">Delete <strong>{deleteUser?.firstName} {deleteUser?.surname}</strong>? This cannot be undone.</p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteUser(null)}>Cancel</Button>
            <Button variant="destructive" onClick={() => deleteMutation.mutate({ id: deleteUser!.id })} disabled={deleteMutation.isPending}>
              {deleteMutation.isPending ? "Deleting..." : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!resetUser} onOpenChange={(o) => !o && setResetUser(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Reset Password</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground mb-3">Set a new password for <strong>{resetUser?.firstName} {resetUser?.surname}</strong>.</p>
          <Input type="password" placeholder="New password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} />
          <DialogFooter>
            <Button variant="outline" onClick={() => setResetUser(null)}>Cancel</Button>
            <Button onClick={() => resetMutation.mutate({ id: resetUser!.id, data: { newPassword } })} disabled={!newPassword || resetMutation.isPending}>
              {resetMutation.isPending ? "Resetting..." : "Reset Password"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
