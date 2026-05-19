import { Router } from "express";
import { db } from "@workspace/db";
import { usersTable, userSecurityGroupsTable, securityGroupsTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { hashPassword, verifyPassword, signToken } from "../lib/auth";
import { authenticate, type AuthRequest } from "../middlewares/authenticate";
import { LoginBody, ChangePasswordBody } from "@workspace/api-zod";
import { getLdapConfig, authenticateLdapUser } from "../lib/ldap";

const router = Router();

async function getUserGroups(userId: number) {
  return db
    .select({ id: securityGroupsTable.id, name: securityGroupsTable.name })
    .from(userSecurityGroupsTable)
    .innerJoin(securityGroupsTable, eq(userSecurityGroupsTable.groupId, securityGroupsTable.id))
    .where(eq(userSecurityGroupsTable.userId, userId));
}

function buildUserResponse(user: typeof usersTable.$inferSelect, groups: { id: number; name: string }[]) {
  return {
    id: user.id,
    firstName: user.firstName,
    surname: user.surname,
    email: user.email,
    isAdmin: user.isAdmin,
    isActive: user.isActive,
    authProvider: user.authProvider,
    securityGroups: groups,
    createdAt: user.createdAt.toISOString(),
  };
}

router.post("/auth/login", async (req, res) => {
  const parsed = LoginBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ message: "Invalid request body" });
    return;
  }

  const { email, password } = parsed.data;
  const ldapConfig = getLdapConfig();

  const user = await db.query.usersTable.findFirst({
    where: and(eq(usersTable.email, email), eq(usersTable.isActive, true)),
  });

  if (user) {
    if (user.authProvider === "ldap") {
      if (!ldapConfig) {
        res.status(503).json({ message: "LDAP authentication is not configured on this server" });
        return;
      }
      const ldapUser = await authenticateLdapUser(email, password, ldapConfig);
      if (!ldapUser) {
        res.status(401).json({ message: "Invalid email or password" });
        return;
      }

      await db.update(usersTable)
        .set({ firstName: ldapUser.firstName, surname: ldapUser.surname, updatedAt: new Date() })
        .where(eq(usersTable.id, user.id));

      const updatedUser = { ...user, firstName: ldapUser.firstName, surname: ldapUser.surname };
      const groups = await getUserGroups(user.id);
      const token = signToken({ userId: user.id, email: user.email, isAdmin: user.isAdmin });
      res.json({ user: buildUserResponse(updatedUser, groups), token });
      return;
    }

    if (!user.passwordHash) {
      res.status(401).json({ message: "Invalid email or password" });
      return;
    }

    const valid = await verifyPassword(password, user.passwordHash);
    if (!valid) {
      res.status(401).json({ message: "Invalid email or password" });
      return;
    }

    const groups = await getUserGroups(user.id);
    const token = signToken({ userId: user.id, email: user.email, isAdmin: user.isAdmin });
    res.json({ user: buildUserResponse(user, groups), token });
    return;
  }

  if (ldapConfig) {
    const ldapUser = await authenticateLdapUser(email, password, ldapConfig);
    if (!ldapUser) {
      res.status(401).json({ message: "Invalid email or password" });
      return;
    }

    const [newUser] = await db
      .insert(usersTable)
      .values({
        firstName: ldapUser.firstName,
        surname: ldapUser.surname,
        email: ldapUser.email,
        passwordHash: null,
        authProvider: "ldap",
        isAdmin: false,
        isActive: true,
      })
      .returning();

    const groups = await getUserGroups(newUser.id);
    const token = signToken({ userId: newUser.id, email: newUser.email, isAdmin: newUser.isAdmin });
    res.json({ user: buildUserResponse(newUser, groups), token });
    return;
  }

  res.status(401).json({ message: "Invalid email or password" });
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

  const groups = await getUserGroups(user.id);
  res.json(buildUserResponse(user, groups));
});

router.post("/auth/change-password", authenticate, async (req: AuthRequest, res) => {
  const parsed = ChangePasswordBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ message: "Invalid request body" });
    return;
  }

  const user = await db.query.usersTable.findFirst({
    where: eq(usersTable.id, req.userId!),
  });

  if (!user) {
    res.status(404).json({ message: "User not found" });
    return;
  }

  if (user.authProvider === "ldap") {
    res.status(400).json({ message: "Password cannot be changed here for LDAP accounts. Please contact your IT administrator." });
    return;
  }

  const { currentPassword, newPassword } = parsed.data;

  if (!user.passwordHash) {
    res.status(400).json({ message: "No local password is set for this account" });
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
