import { Router } from "express";
import { db } from "@workspace/db";
import { usersTable, userSecurityGroupsTable, securityGroupsTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { hashPassword, verifyPassword, signToken } from "../lib/auth";
import { authenticate, type AuthRequest } from "../middlewares/authenticate";
import { LoginBody, ChangePasswordBody } from "@workspace/api-zod";

const router = Router();

router.post("/auth/login", async (req, res) => {
  const parsed = LoginBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ message: "Invalid request body" });
    return;
  }

  const { email, password } = parsed.data;
  const user = await db.query.usersTable.findFirst({
    where: and(eq(usersTable.email, email), eq(usersTable.isActive, true)),
  });

  if (!user) {
    res.status(401).json({ message: "Invalid email or password" });
    return;
  }

  const valid = await verifyPassword(password, user.passwordHash);
  if (!valid) {
    res.status(401).json({ message: "Invalid email or password" });
    return;
  }

  const groups = await db
    .select({ id: securityGroupsTable.id, name: securityGroupsTable.name })
    .from(userSecurityGroupsTable)
    .innerJoin(securityGroupsTable, eq(userSecurityGroupsTable.groupId, securityGroupsTable.id))
    .where(eq(userSecurityGroupsTable.userId, user.id));

  const token = signToken({ userId: user.id, email: user.email, isAdmin: user.isAdmin });

  res.json({
    user: {
      id: user.id,
      firstName: user.firstName,
      surname: user.surname,
      email: user.email,
      isAdmin: user.isAdmin,
      isActive: user.isActive,
      securityGroups: groups,
      createdAt: user.createdAt.toISOString(),
    },
    token,
  });
});

router.post("/auth/logout", authenticate, (_req, res) => {
  res.json({ message: "Logged out successfully" });
});

router.get("/auth/me", authenticate, async (req: AuthRequest, res) => {
  const user = await db.query.usersTable.findFirst({
    where: eq(usersTable.id, req.userId!),
  });

  if (!user || !user.isActive) {
    res.status(401).json({ message: "User not found or inactive" });
    return;
  }

  const groups = await db
    .select({ id: securityGroupsTable.id, name: securityGroupsTable.name })
    .from(userSecurityGroupsTable)
    .innerJoin(securityGroupsTable, eq(userSecurityGroupsTable.groupId, securityGroupsTable.id))
    .where(eq(userSecurityGroupsTable.userId, user.id));

  res.json({
    id: user.id,
    firstName: user.firstName,
    surname: user.surname,
    email: user.email,
    isAdmin: user.isAdmin,
    isActive: user.isActive,
    securityGroups: groups,
    createdAt: user.createdAt.toISOString(),
  });
});

router.post("/auth/change-password", authenticate, async (req: AuthRequest, res) => {
  const parsed = ChangePasswordBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ message: "Invalid request body" });
    return;
  }

  const { currentPassword, newPassword } = parsed.data;
  const user = await db.query.usersTable.findFirst({
    where: eq(usersTable.id, req.userId!),
  });

  if (!user) {
    res.status(404).json({ message: "User not found" });
    return;
  }

  const valid = await verifyPassword(currentPassword, user.passwordHash);
  if (!valid) {
    res.status(400).json({ message: "Current password is incorrect" });
    return;
  }

  const newHash = await hashPassword(newPassword);
  await db.update(usersTable).set({ passwordHash: newHash, updatedAt: new Date() }).where(eq(usersTable.id, user.id));

  res.json({ message: "Password changed successfully" });
});

export default router;
