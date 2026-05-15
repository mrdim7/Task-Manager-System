import { Router } from "express";
import { db } from "@workspace/db";
import { securityGroupsTable, userSecurityGroupsTable, usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { authenticate, requireAdmin, type AuthRequest } from "../middlewares/authenticate";
import { CreateSecurityGroupBody, UpdateSecurityGroupBody } from "@workspace/api-zod";

const router = Router();

async function getGroupWithMembers(groupId: number) {
  const group = await db.query.securityGroupsTable.findFirst({
    where: eq(securityGroupsTable.id, groupId),
  });
  if (!group) return null;
  const members = await db
    .select({
      id: usersTable.id,
      firstName: usersTable.firstName,
      surname: usersTable.surname,
      email: usersTable.email,
    })
    .from(userSecurityGroupsTable)
    .innerJoin(usersTable, eq(userSecurityGroupsTable.userId, usersTable.id))
    .where(eq(userSecurityGroupsTable.groupId, groupId));
  return {
    id: group.id,
    name: group.name,
    members,
    createdAt: group.createdAt.toISOString(),
  };
}

router.get("/security-groups", authenticate, async (_req, res) => {
  const groups = await db.select().from(securityGroupsTable);
  const results = await Promise.all(groups.map((g) => getGroupWithMembers(g.id)));
  res.json(results.filter(Boolean));
});

router.post("/security-groups", authenticate, requireAdmin, async (req: AuthRequest, res) => {
  const parsed = CreateSecurityGroupBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ message: "Invalid request body" });
    return;
  }
  const { name, memberIds } = parsed.data;
  const [group] = await db.insert(securityGroupsTable).values({ name }).returning();
  if (memberIds?.length) {
    await db.insert(userSecurityGroupsTable).values(memberIds.map((uid) => ({ userId: uid, groupId: group.id })));
  }
  const result = await getGroupWithMembers(group.id);
  res.status(201).json(result);
});

router.get("/security-groups/:id", authenticate, async (req, res) => {
  const id = parseInt(String(req.params.id));
  const result = await getGroupWithMembers(id);
  if (!result) {
    res.status(404).json({ message: "Security group not found" });
    return;
  }
  res.json(result);
});

router.put("/security-groups/:id", authenticate, requireAdmin, async (req: AuthRequest, res) => {
  const id = parseInt(String(req.params.id));
  const parsed = UpdateSecurityGroupBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ message: "Invalid request body" });
    return;
  }
  const existing = await db.query.securityGroupsTable.findFirst({ where: eq(securityGroupsTable.id, id) });
  if (!existing) {
    res.status(404).json({ message: "Security group not found" });
    return;
  }
  const { name, memberIds } = parsed.data;
  if (name !== undefined) {
    await db.update(securityGroupsTable).set({ name, updatedAt: new Date() }).where(eq(securityGroupsTable.id, id));
  }
  if (memberIds !== undefined) {
    await db.delete(userSecurityGroupsTable).where(eq(userSecurityGroupsTable.groupId, id));
    if (memberIds.length) {
      await db.insert(userSecurityGroupsTable).values(memberIds.map((uid) => ({ userId: uid, groupId: id })));
    }
  }
  const result = await getGroupWithMembers(id);
  res.json(result);
});

router.delete("/security-groups/:id", authenticate, requireAdmin, async (_req, res) => {
  const id = parseInt(String(_req.params.id));
  const existing = await db.query.securityGroupsTable.findFirst({ where: eq(securityGroupsTable.id, id) });
  if (!existing) {
    res.status(404).json({ message: "Security group not found" });
    return;
  }
  await db.delete(securityGroupsTable).where(eq(securityGroupsTable.id, id));
  res.json({ message: "Security group deleted" });
});

export default router;
