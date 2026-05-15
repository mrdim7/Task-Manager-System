import { pgTable, serial, text, timestamp, integer, date, primaryKey } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./users";
import { categoriesTable } from "./categories";
import { prioritiesTable } from "./priorities";
import { securityGroupsTable } from "./security-groups";

export const tasksTable = pgTable("tasks", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description"),
  parentId: integer("parent_id"),
  categoryId: integer("category_id").references(() => categoriesTable.id, { onDelete: "set null" }),
  priorityId: integer("priority_id").references(() => prioritiesTable.id, { onDelete: "set null" }),
  ownerId: integer("owner_id").references(() => usersTable.id, { onDelete: "set null" }),
  assignedToId: integer("assigned_to_id").references(() => usersTable.id, { onDelete: "set null" }),
  progress: integer("progress").notNull().default(0),
  dueDate: date("due_date"),
  startDate: date("start_date"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const taskSecurityGroupsTable = pgTable(
  "task_security_groups",
  {
    taskId: integer("task_id")
      .notNull()
      .references(() => tasksTable.id, { onDelete: "cascade" }),
    groupId: integer("group_id")
      .notNull()
      .references(() => securityGroupsTable.id, { onDelete: "cascade" }),
  },
  (t) => [primaryKey({ columns: [t.taskId, t.groupId] })],
);

export const taskNotesTable = pgTable("task_notes", {
  id: serial("id").primaryKey(),
  taskId: integer("task_id")
    .notNull()
    .references(() => tasksTable.id, { onDelete: "cascade" }),
  content: text("content").notNull(),
  authorId: integer("author_id")
    .notNull()
    .references(() => usersTable.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertTaskSchema = createInsertSchema(tasksTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertTaskNoteSchema = createInsertSchema(taskNotesTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertTask = z.infer<typeof insertTaskSchema>;
export type Task = typeof tasksTable.$inferSelect;
export type InsertTaskNote = z.infer<typeof insertTaskNoteSchema>;
export type TaskNote = typeof taskNotesTable.$inferSelect;
