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
import { eq, isNull, lte, and, inArray, sql, or } from "drizzle-orm";
import { authenticate, type AuthRequest } from "../middlewares/authenticate";

const router = Router();

async function getAccessibleTaskIds(userId: number): Promise<number[] | null> {
  const user = await db.query.usersTable.findFirst({ where: eq(usersTable.id, userId) });
  if (user?.isAdmin) return null;

  const userGroupRows = await db
    .select({ groupId: userSecurityGroupsTable.groupId })
    .from(userSecurityGroupsTable)
    .where(eq(userSecurityGroupsTable.userId, userId));
  const userGroupIds = userGroupRows.map((r) => r.groupId);

  const allTasks = await db.select({ id: tasksTable.id }).from(tasksTable);
  const allSecGroups = await db.select().from(taskSecurityGroupsTable);
  const tasksHavingGroups = new Set(allSecGroups.map((r) => r.taskId));

  let visibleWithGroupIds = new Set<number>();
  if (userGroupIds.length) {
    const rows = await db
      .select({ taskId: taskSecurityGroupsTable.taskId })
      .from(taskSecurityGroupsTable)
      .where(inArray(taskSecurityGroupsTable.groupId, userGroupIds));
    visibleWithGroupIds = new Set(rows.map((r) => r.taskId));
  }

  return allTasks.filter((t) => !tasksHavingGroups.has(t.id) || visibleWithGroupIds.has(t.id)).map((t) => t.id);
}

async function buildTaskResponse(task: typeof tasksTable.$inferSelect) {
  const [owner, assignedTo, category, priority] = await Promise.all([
    task.ownerId ? db.query.usersTable.findFirst({ where: eq(usersTable.id, task.ownerId) }) : null,
    task.assignedToId ? db.query.usersTable.findFirst({ where: eq(usersTable.id, task.assignedToId) }) : null,
    task.categoryId ? db.query.categoriesTable.findFirst({ where: eq(categoriesTable.id, task.categoryId) }) : null,
    task.priorityId ? db.query.prioritiesTable.findFirst({ where: eq(prioritiesTable.id, task.priorityId) }) : null,
  ]);

  const sgs = await db
    .select({ id: securityGroupsTable.id, name: securityGroupsTable.name })
    .from(taskSecurityGroupsTable)
    .innerJoin(securityGroupsTable, eq(taskSecurityGroupsTable.groupId, securityGroupsTable.id))
    .where(eq(taskSecurityGroupsTable.taskId, task.id));

  const children = await db.select({ id: tasksTable.id, progress: tasksTable.progress }).from(tasksTable).where(eq(tasksTable.parentId, task.id));
  const noteCount = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(taskNotesTable)
    .where(eq(taskNotesTable.taskId, task.id));

  let progress = task.progress;
  if (children.length > 0) {
    progress = Math.round(children.reduce((s, c) => s + c.progress, 0) / children.length);
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
    securityGroupIds: sgs.map((g) => g.id),
    securityGroups: sgs,
    createdAt: task.createdAt.toISOString(),
    updatedAt: task.updatedAt.toISOString(),
  };
}

router.get("/dashboard/summary", authenticate, async (req: AuthRequest, res) => {
  const accessibleIds = await getAccessibleTaskIds(req.userId!);
  let allTasks = await db.select().from(tasksTable);
  if (accessibleIds !== null) {
    allTasks = allTasks.filter((t) => accessibleIds.includes(t.id));
  }

  const today = new Date().toISOString().split("T")[0];
  const sevenDays = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];

  const totalTasks = allTasks.length;
  const completedTasks = allTasks.filter((t) => t.progress === 100).length;
  const overdueTasks = allTasks.filter((t) => t.dueDate && t.dueDate < today && t.progress < 100).length;
  const myOpenTasks = allTasks.filter(
    (t) => (t.ownerId === req.userId || t.assignedToId === req.userId) && t.progress < 100,
  ).length;
  const tasksInProgress = allTasks.filter((t) => t.progress > 0 && t.progress < 100).length;
  const upcomingDueSoon = allTasks.filter((t) => t.dueDate && t.dueDate >= today && t.dueDate <= sevenDays && t.progress < 100).length;

  res.json({ totalTasks, completedTasks, overdueTasks, myOpenTasks, tasksInProgress, upcomingDueSoon });
});

router.get("/dashboard/my-tasks", authenticate, async (req: AuthRequest, res) => {
  const limit = parseInt(req.query.limit as string) || 10;
  const accessibleIds = await getAccessibleTaskIds(req.userId!);
  let allTasks = await db.select().from(tasksTable);
  if (accessibleIds !== null) {
    allTasks = allTasks.filter((t) => accessibleIds.includes(t.id));
  }

  const myTasks = allTasks
    .filter((t) => t.ownerId === req.userId || t.assignedToId === req.userId)
    .sort((a, b) => (a.dueDate ?? "9999") < (b.dueDate ?? "9999") ? -1 : 1)
    .slice(0, limit);

  const results = await Promise.all(myTasks.map(buildTaskResponse));
  res.json(results);
});

router.get("/dashboard/overdue-tasks", authenticate, async (req: AuthRequest, res) => {
  const accessibleIds = await getAccessibleTaskIds(req.userId!);
  const today = new Date().toISOString().split("T")[0];
  let allTasks = await db.select().from(tasksTable);
  if (accessibleIds !== null) {
    allTasks = allTasks.filter((t) => accessibleIds.includes(t.id));
  }
  const overdue = allTasks.filter((t) => t.dueDate && t.dueDate < today && t.progress < 100);
  const results = await Promise.all(overdue.map(buildTaskResponse));
  res.json(results);
});

router.get("/dashboard/tasks-by-priority", authenticate, async (req: AuthRequest, res) => {
  const accessibleIds = await getAccessibleTaskIds(req.userId!);
  let allTasks = await db.select().from(tasksTable);
  if (accessibleIds !== null) {
    allTasks = allTasks.filter((t) => accessibleIds.includes(t.id));
  }

  const priorities = await db.select().from(prioritiesTable).orderBy(prioritiesTable.order);
  const counts = priorities.map((p) => ({
    id: p.id,
    name: p.name,
    count: allTasks.filter((t) => t.priorityId === p.id).length,
  }));
  const noPriority = allTasks.filter((t) => !t.priorityId).length;
  if (noPriority > 0) counts.push({ id: null as unknown as number, name: "No Priority", count: noPriority });

  res.json(counts);
});

router.get("/dashboard/tasks-by-category", authenticate, async (req: AuthRequest, res) => {
  const accessibleIds = await getAccessibleTaskIds(req.userId!);
  let allTasks = await db.select().from(tasksTable);
  if (accessibleIds !== null) {
    allTasks = allTasks.filter((t) => accessibleIds.includes(t.id));
  }

  const categories = await db.select().from(categoriesTable).orderBy(categoriesTable.name);
  const counts = categories.map((c) => ({
    id: c.id,
    name: c.name,
    count: allTasks.filter((t) => t.categoryId === c.id).length,
  }));
  const noCategory = allTasks.filter((t) => !t.categoryId).length;
  if (noCategory > 0) counts.push({ id: null as unknown as number, name: "Uncategorized", count: noCategory });

  res.json(counts);
});

export default router;
