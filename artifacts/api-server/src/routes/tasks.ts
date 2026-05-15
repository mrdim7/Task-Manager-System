import { Router } from "express";
import { db } from "@workspace/db";
import {
  tasksTable,
  taskSecurityGroupsTable,
  taskNotesTable,
  usersTable,
  categoriesTable,
  prioritiesTable,
  securityGroupsTable,
  userSecurityGroupsTable,
} from "@workspace/db";
import { eq, isNull, and, inArray, sql } from "drizzle-orm";
import { authenticate, type AuthRequest } from "../middlewares/authenticate";
import {
  CreateTaskBody,
  UpdateTaskBody,
  ListTasksQueryParams,
  CreateTaskNoteBody,
  UpdateTaskNoteBody,
} from "@workspace/api-zod";

const router = Router();

async function buildTaskResponse(task: typeof tasksTable.$inferSelect) {
  const [owner, assignedTo, category, priority] = await Promise.all([
    task.ownerId ? db.query.usersTable.findFirst({ where: eq(usersTable.id, task.ownerId) }) : Promise.resolve(null),
    task.assignedToId ? db.query.usersTable.findFirst({ where: eq(usersTable.id, task.assignedToId) }) : Promise.resolve(null),
    task.categoryId ? db.query.categoriesTable.findFirst({ where: eq(categoriesTable.id, task.categoryId) }) : Promise.resolve(null),
    task.priorityId ? db.query.prioritiesTable.findFirst({ where: eq(prioritiesTable.id, task.priorityId) }) : Promise.resolve(null),
  ]);

  const securityGroups = await db
    .select({ id: securityGroupsTable.id, name: securityGroupsTable.name })
    .from(taskSecurityGroupsTable)
    .innerJoin(securityGroupsTable, eq(taskSecurityGroupsTable.groupId, securityGroupsTable.id))
    .where(eq(taskSecurityGroupsTable.taskId, task.id));

  const children = await db.select({ id: tasksTable.id }).from(tasksTable).where(eq(tasksTable.parentId, task.id));
  const noteCount = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(taskNotesTable)
    .where(eq(taskNotesTable.taskId, task.id));

  // Calculate progress from children if task has children
  let progress = task.progress;
  if (children.length > 0) {
    const childProgresses = await db
      .select({ progress: tasksTable.progress })
      .from(tasksTable)
      .where(eq(tasksTable.parentId, task.id));
    progress = Math.round(childProgresses.reduce((sum, c) => sum + c.progress, 0) / childProgresses.length);
  }

  return {
    id: task.id,
    name: task.name,
    description: task.description ?? null,
    parentId: task.parentId ?? null,
    categoryId: task.categoryId ?? null,
    categoryName: category?.name ?? null,
    priorityId: task.priorityId ?? null,
    priorityName: priority?.name ?? null,
    ownerId: task.ownerId ?? null,
    ownerName: owner ? `${owner.firstName} ${owner.surname}` : null,
    assignedToId: task.assignedToId ?? null,
    assignedToName: assignedTo ? `${assignedTo.firstName} ${assignedTo.surname}` : null,
    progress,
    dueDate: task.dueDate ?? null,
    startDate: task.startDate ?? null,
    hasChildren: children.length > 0,
    childCount: children.length,
    noteCount: noteCount[0]?.count ?? 0,
    securityGroupIds: securityGroups.map((g) => g.id),
    securityGroups,
    createdAt: task.createdAt.toISOString(),
    updatedAt: task.updatedAt.toISOString(),
  };
}

async function getUserGroupIds(userId: number): Promise<number[]> {
  const rows = await db
    .select({ groupId: userSecurityGroupsTable.groupId })
    .from(userSecurityGroupsTable)
    .where(eq(userSecurityGroupsTable.userId, userId));
  return rows.map((r) => r.groupId);
}

async function getAccessibleTaskIds(userId: number): Promise<number[] | null> {
  // Admins see all tasks
  const user = await db.query.usersTable.findFirst({ where: eq(usersTable.id, userId) });
  if (user?.isAdmin) return null; // null means all tasks

  const userGroupIds = await getUserGroupIds(userId);
  if (!userGroupIds.length) {
    // User has no groups — only see tasks with no security groups assigned
    const rows = await db
      .select({ taskId: tasksTable.id })
      .from(tasksTable)
      .leftJoin(taskSecurityGroupsTable, eq(tasksTable.id, taskSecurityGroupsTable.taskId))
      .where(isNull(taskSecurityGroupsTable.groupId));
    return rows.map((r) => r.taskId);
  }

  // Tasks visible if: task has no security groups, OR task shares a group with the user
  const tasksWithGroups = await db
    .select({ taskId: taskSecurityGroupsTable.taskId })
    .from(taskSecurityGroupsTable)
    .where(inArray(taskSecurityGroupsTable.groupId, userGroupIds));

  const visibleWithGroups = new Set(tasksWithGroups.map((r) => r.taskId));

  const allTasks = await db.select({ id: tasksTable.id }).from(tasksTable);
  const secGroups = await db.select().from(taskSecurityGroupsTable);
  const tasksHavingGroups = new Set(secGroups.map((r) => r.taskId));

  const visible = allTasks.filter((t) => !tasksHavingGroups.has(t.id) || visibleWithGroups.has(t.id));
  return visible.map((t) => t.id);
}

router.get("/tasks", authenticate, async (req: AuthRequest, res) => {
  const accessibleIds = await getAccessibleTaskIds(req.userId!);
  let tasks = await db.select().from(tasksTable).orderBy(tasksTable.createdAt);

  if (accessibleIds !== null) {
    tasks = tasks.filter((t) => accessibleIds.includes(t.id));
  }

  const query = req.query;
  if (query.rootOnly === "true") {
    tasks = tasks.filter((t) => t.parentId === null);
  }
  if (query.parentId !== undefined) {
    const pid = query.parentId === "null" ? null : parseInt(query.parentId as string);
    tasks = tasks.filter((t) => t.parentId === pid);
  }
  if (query.ownerId) tasks = tasks.filter((t) => t.ownerId === parseInt(query.ownerId as string));
  if (query.assignedToId) tasks = tasks.filter((t) => t.assignedToId === parseInt(query.assignedToId as string));
  if (query.categoryId) tasks = tasks.filter((t) => t.categoryId === parseInt(query.categoryId as string));
  if (query.priorityId) tasks = tasks.filter((t) => t.priorityId === parseInt(query.priorityId as string));
  if (query.search) {
    const s = (query.search as string).toLowerCase();
    tasks = tasks.filter((t) => t.name.toLowerCase().includes(s) || (t.description ?? "").toLowerCase().includes(s));
  }

  const results = await Promise.all(tasks.map(buildTaskResponse));
  res.json(results);
});

router.post("/tasks", authenticate, async (req: AuthRequest, res) => {
  const parsed = CreateTaskBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ message: "Invalid request body", error: parsed.error.message });
    return;
  }

  const { name, description, parentId, categoryId, priorityId, ownerId, assignedToId, progress, dueDate, startDate, securityGroupIds } = parsed.data;

  const [task] = await db
    .insert(tasksTable)
    .values({
      name,
      description: description ?? null,
      parentId: parentId ?? null,
      categoryId: categoryId ?? null,
      priorityId: priorityId ?? null,
      ownerId: ownerId ?? null,
      assignedToId: assignedToId ?? null,
      progress: progress ?? 0,
      dueDate: dueDate ? String(dueDate) : null,
      startDate: startDate ? String(startDate) : null,
    })
    .returning();

  // Only root tasks get security groups
  if (!parentId && securityGroupIds?.length) {
    await db.insert(taskSecurityGroupsTable).values(securityGroupIds.map((gid) => ({ taskId: task.id, groupId: gid })));
  }

  const result = await buildTaskResponse(task);
  res.status(201).json(result);
});

router.get("/tasks/:id", authenticate, async (req: AuthRequest, res) => {
  const id = parseInt(String(req.params.id));
  const task = await db.query.tasksTable.findFirst({ where: eq(tasksTable.id, id) });
  if (!task) {
    res.status(404).json({ message: "Task not found" });
    return;
  }
  const result = await buildTaskResponse(task);
  res.json(result);
});

router.put("/tasks/:id", authenticate, async (req: AuthRequest, res) => {
  const id = parseInt(String(req.params.id));
  const parsed = UpdateTaskBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ message: "Invalid request body" });
    return;
  }

  const existing = await db.query.tasksTable.findFirst({ where: eq(tasksTable.id, id) });
  if (!existing) {
    res.status(404).json({ message: "Task not found" });
    return;
  }

  const { name, description, categoryId, priorityId, ownerId, assignedToId, progress, dueDate, startDate, securityGroupIds } = parsed.data;

  await db
    .update(tasksTable)
    .set({
      ...(name !== undefined && { name }),
      ...(description !== undefined && { description }),
      ...(categoryId !== undefined && { categoryId }),
      ...(priorityId !== undefined && { priorityId }),
      ...(ownerId !== undefined && { ownerId }),
      ...(assignedToId !== undefined && { assignedToId }),
      ...(progress !== undefined && { progress }),
      ...(dueDate !== undefined && { dueDate: dueDate ? String(dueDate) : null }),
      ...(startDate !== undefined && { startDate: startDate ? String(startDate) : null }),
      updatedAt: new Date(),
    })
    .where(eq(tasksTable.id, id));

  // Only update security groups on root tasks
  if (!existing.parentId && securityGroupIds !== undefined) {
    await db.delete(taskSecurityGroupsTable).where(eq(taskSecurityGroupsTable.taskId, id));
    if (securityGroupIds.length) {
      await db.insert(taskSecurityGroupsTable).values(securityGroupIds.map((gid) => ({ taskId: id, groupId: gid })));
    }
  }

  const updated = await db.query.tasksTable.findFirst({ where: eq(tasksTable.id, id) });
  const result = await buildTaskResponse(updated!);
  res.json(result);
});

router.delete("/tasks/:id", authenticate, async (req: AuthRequest, res) => {
  const id = parseInt(String(req.params.id));
  const existing = await db.query.tasksTable.findFirst({ where: eq(tasksTable.id, id) });
  if (!existing) {
    res.status(404).json({ message: "Task not found" });
    return;
  }
  await db.delete(tasksTable).where(eq(tasksTable.id, id));
  res.json({ message: "Task deleted" });
});

// Notes
router.get("/tasks/:taskId/notes", authenticate, async (req, res) => {
  const taskId = parseInt(String(req.params.taskId));
  const notes = await db
    .select({
      id: taskNotesTable.id,
      taskId: taskNotesTable.taskId,
      content: taskNotesTable.content,
      authorId: taskNotesTable.authorId,
      authorFirstName: usersTable.firstName,
      authorSurname: usersTable.surname,
      createdAt: taskNotesTable.createdAt,
      updatedAt: taskNotesTable.updatedAt,
    })
    .from(taskNotesTable)
    .leftJoin(usersTable, eq(taskNotesTable.authorId, usersTable.id))
    .where(eq(taskNotesTable.taskId, taskId))
    .orderBy(taskNotesTable.createdAt);

  res.json(
    notes.map((n) => ({
      id: n.id,
      taskId: n.taskId,
      content: n.content,
      authorId: n.authorId,
      authorName: n.authorFirstName && n.authorSurname ? `${n.authorFirstName} ${n.authorSurname}` : "Unknown",
      createdAt: n.createdAt.toISOString(),
      updatedAt: n.updatedAt.toISOString(),
    })),
  );
});

router.post("/tasks/:taskId/notes", authenticate, async (req: AuthRequest, res) => {
  const taskId = parseInt(String(req.params.taskId));
  const parsed = CreateTaskNoteBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ message: "Invalid request body" });
    return;
  }

  const task = await db.query.tasksTable.findFirst({ where: eq(tasksTable.id, taskId) });
  if (!task) {
    res.status(404).json({ message: "Task not found" });
    return;
  }

  const [note] = await db
    .insert(taskNotesTable)
    .values({ taskId, content: parsed.data.content, authorId: req.userId! })
    .returning();

  const author = await db.query.usersTable.findFirst({ where: eq(usersTable.id, req.userId!) });
  res.status(201).json({
    id: note.id,
    taskId: note.taskId,
    content: note.content,
    authorId: note.authorId,
    authorName: author ? `${author.firstName} ${author.surname}` : "Unknown",
    createdAt: note.createdAt.toISOString(),
    updatedAt: note.updatedAt.toISOString(),
  });
});

router.put("/tasks/:taskId/notes/:noteId", authenticate, async (req: AuthRequest, res) => {
  const taskId = parseInt(String(req.params.taskId));
  const noteId = parseInt(String(req.params.noteId));
  const parsed = UpdateTaskNoteBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ message: "Invalid request body" });
    return;
  }

  const note = await db.query.taskNotesTable.findFirst({
    where: and(eq(taskNotesTable.id, noteId), eq(taskNotesTable.taskId, taskId)),
  });
  if (!note) {
    res.status(404).json({ message: "Note not found" });
    return;
  }

  const [updated] = await db
    .update(taskNotesTable)
    .set({ content: parsed.data.content, updatedAt: new Date() })
    .where(eq(taskNotesTable.id, noteId))
    .returning();

  const author = await db.query.usersTable.findFirst({ where: eq(usersTable.id, updated.authorId) });
  res.json({
    id: updated.id,
    taskId: updated.taskId,
    content: updated.content,
    authorId: updated.authorId,
    authorName: author ? `${author.firstName} ${author.surname}` : "Unknown",
    createdAt: updated.createdAt.toISOString(),
    updatedAt: updated.updatedAt.toISOString(),
  });
});

router.delete("/tasks/:taskId/notes/:noteId", authenticate, async (req, res) => {
  const taskId = parseInt(String(req.params.taskId));
  const noteId = parseInt(String(req.params.noteId));
  const note = await db.query.taskNotesTable.findFirst({
    where: and(eq(taskNotesTable.id, noteId), eq(taskNotesTable.taskId, taskId)),
  });
  if (!note) {
    res.status(404).json({ message: "Note not found" });
    return;
  }
  await db.delete(taskNotesTable).where(eq(taskNotesTable.id, noteId));
  res.json({ message: "Note deleted" });
});

export default router;
