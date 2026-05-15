import { pgTable, serial, text, timestamp, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const prioritiesTable = pgTable("priorities", {
  id: serial("id").primaryKey(),
  name: text("name").notNull().unique(),
  order: integer("order").notNull().default(0),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertPrioritySchema = createInsertSchema(prioritiesTable).omit({
  id: true,
  createdAt: true,
});

export type InsertPriority = z.infer<typeof insertPrioritySchema>;
export type Priority = typeof prioritiesTable.$inferSelect;
