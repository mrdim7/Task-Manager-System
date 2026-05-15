import { Router } from "express";
import { db } from "@workspace/db";
import { usersTable, userSecurityGroupsTable, securityGroupsTable } from "@workspace/db";
import { eq, ilike, and } from "drizzle-orm";
import { hashPassword } from "../lib/auth";
import { authenticate, requireAdmin, type AuthRequest } from "../middlewares/authenticate";
import { CreateUserBody, UpdateUserBody, ResetUserPasswordBody } from "@workspace/api-zod";

const router = Router();

async function getUserWithGroups(userId: number) {
  const user = await db.query.usersTable.findFirst({ where: eq(usersTable.id, userId) });
  if (!user) return null;
  const groups = await db
    .select({ id: securityGroupsTable.id, name: securityGroupsTable.name })
    .from(userSecurityGroupsTable)
    .innerJoin(securityGroupsTable, eq(userSecurityGroupsTable.groupId, securityGroupsTable.id))
    .where(eq(userSecurityGroupsTable.userId, userId));
  return {
    id: user.id,
    firstName: user.firstName,
    surname: user.surname,
    email: user.email,
    isAdmin: user.isAdmin,
    isActive: user.isActive,
    securityGroups: groups,
    createdAt: user.createdAt.toISOString(),
  };
}

router.get("/users", authenticate, async (req: AuthRequest, res) => {
  const search = req.query.search as string | undefined;
  const activeParam = req.query.active as string | undefined;

  let users = await db.select().from(usersTable);

  if (search) {
    users = users.filter(
      (u) =>
        u.firstName.toLowerCase().includes(search.toLowerCase()) ||
        u.surname.toLowerCase().includes(search.toLowerCase()) ||
        u.email.toLowerCase().includes(search.toLowerCase()),
    );
  }

  if (activeParam !== undefined) {
    const isActive = activeParam === "true";
    users = users.filter((u) => u.isActive === isActive);
  }

  const results = await Promise.all(users.map((u) => getUserWithGroups(u.id)));
  res.json(results.filter(Boolean));
});

router.post("/users", authenticate, requireAdmin, async (req: AuthRequest, res) => {
  const parsed = CreateUserBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ message: "Invalid request body", error: parsed.error.message });
    return;
  }

  const { firstName, surname, email, password, isAdmin, isActive, securityGroupIds } = parsed.data;

  const existing = await db.query.usersTable.findFirst({ where: eq(usersTable.email, email) });
  if (existing) {
    res.status(400).json({ message: "Email already in use" });
    return;
  }

  const passwordHash = await hashPassword(password);
  const [newUser] = await db
    .insert(usersTable)
    .values({ firstName, surname, email, passwordHash, isAdmin: isAdmin ?? false, isActive: isActive ?? true })
    .returning();

  if (securityGroupIds?.length) {
    await db.insert(userSecurityGroupsTable).values(securityGroupIds.map((gid) => ({ userId: newUser.id, groupId: gid })));
  }

  const result = await getUserWithGroups(newUser.id);
  res.status(201).json(result);
});

router.get("/users/:id", authenticate, async (req, res) => {
  const id = parseInt(String(req.params.id));
  const result = await getUserWithGroups(id);
  if (!result) {
    res.status(404).json({ message: "User not found" });
    return;
  }
  res.json(result);
});

router.put("/users/:id", authenticate, requireAdmin, async (req: AuthRequest, res) => {
  const id = parseInt(String(req.params.id));
  const parsed = UpdateUserBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ message: "Invalid request body" });
    return;
  }

  const existing = await db.query.usersTable.findFirst({ where: eq(usersTable.id, id) });
  if (!existing) {
    res.status(404).json({ message: "User not found" });
    return;
  }

  const { firstName, surname, email, isAdmin, isActive, securityGroupIds } = parsed.data;
  await db
    .update(usersTable)
    .set({
      ...(firstName !== undefined && { firstName }),
      ...(surname !== undefined && { surname }),
      ...(email !== undefined && { email }),
      ...(isAdmin !== undefined && { isAdmin }),
      ...(isActive !== undefined && { isActive }),
      updatedAt: new Date(),
    })
    .where(eq(usersTable.id, id));

  if (securityGroupIds !== undefined) {
    await db.delete(userSecurityGroupsTable).where(eq(userSecurityGroupsTable.userId, id));
    if (securityGroupIds.length) {
      await db.insert(userSecurityGroupsTable).values(securityGroupIds.map((gid) => ({ userId: id, groupId: gid })));
    }
  }

  const result = await getUserWithGroups(id);
  res.json(result);
});

router.delete("/users/:id", authenticate, requireAdmin, async (req: AuthRequest, res) => {
  const id = parseInt(String(req.params.id));
  const existing = await db.query.usersTable.findFirst({ where: eq(usersTable.id, id) });
  if (!existing) {
    res.status(404).json({ message: "User not found" });
    return;
  }
  await db.delete(usersTable).where(eq(usersTable.id, id));
  res.json({ message: "User deleted" });
});

router.post("/users/:id/reset-password", authenticate, requireAdmin, async (req: AuthRequest, res) => {
  const id = parseInt(String(req.params.id));
  const parsed = ResetUserPasswordBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ message: "Invalid request body" });
    return;
  }

  const existing = await db.query.usersTable.findFirst({ where: eq(usersTable.id, id) });
  if (!existing) {
    res.status(404).json({ message: "User not found" });
    return;
  }

  const newHash = await hashPassword(parsed.data.newPassword);
  await db.update(usersTable).set({ passwordHash: newHash, updatedAt: new Date() }).where(eq(usersTable.id, id));
  res.json({ message: "Password reset successfully" });
});

export default router;
