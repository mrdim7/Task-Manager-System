import { pgTable, serial, text, timestamp, integer, primaryKey } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./users";

export const securityGroupsTable = pgTable("security_groups", {
  id: serial("id").primaryKey(),
  name: text("name").notNull().unique(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const userSecurityGroupsTable = pgTable(
  "user_security_groups",
  {
    userId: integer("user_id")
      .notNull()
      .references(() => usersTable.id, { onDelete: "cascade" }),
    groupId: integer("group_id")
      .notNull()
      .references(() => securityGroupsTable.id, { onDelete: "cascade" }),
  },
  (t) => [primaryKey({ columns: [t.userId, t.groupId] })],
);

export const insertSecurityGroupSchema = createInsertSchema(securityGroupsTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertSecurityGroup = z.infer<typeof insertSecurityGroupSchema>;
export type SecurityGroup = typeof securityGroupsTable.$inferSelect;
