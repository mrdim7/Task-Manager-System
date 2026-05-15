import { Router } from "express";
import { db } from "@workspace/db";
import { prioritiesTable } from "@workspace/db";
import { eq, asc } from "drizzle-orm";
import { authenticate, requireAdmin } from "../middlewares/authenticate";
import { CreatePriorityBody, UpdatePriorityBody } from "@workspace/api-zod";

const router = Router();

router.get("/priorities", authenticate, async (_req, res) => {
  const priorities = await db.select().from(prioritiesTable).orderBy(asc(prioritiesTable.order));
  res.json(
    priorities.map((p) => ({
      id: p.id,
      name: p.name,
      order: p.order,
      createdAt: p.createdAt.toISOString(),
    })),
  );
});

router.post("/priorities", authenticate, requireAdmin, async (req, res) => {
  const parsed = CreatePriorityBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ message: "Invalid request body" });
    return;
  }
  const [p] = await db.insert(prioritiesTable).values({ name: parsed.data.name, order: parsed.data.order }).returning();
  res.status(201).json({ id: p.id, name: p.name, order: p.order, createdAt: p.createdAt.toISOString() });
});

router.put("/priorities/:id", authenticate, requireAdmin, async (req, res) => {
  const id = parseInt(String(req.params.id));
  const parsed = UpdatePriorityBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ message: "Invalid request body" });
    return;
  }
  const existing = await db.query.prioritiesTable.findFirst({ where: eq(prioritiesTable.id, id) });
  if (!existing) {
    res.status(404).json({ message: "Priority not found" });
    return;
  }
  const [p] = await db
    .update(prioritiesTable)
    .set({ name: parsed.data.name, order: parsed.data.order })
    .where(eq(prioritiesTable.id, id))
    .returning();
  res.json({ id: p.id, name: p.name, order: p.order, createdAt: p.createdAt.toISOString() });
});

router.delete("/priorities/:id", authenticate, requireAdmin, async (req, res) => {
  const id = parseInt(String(req.params.id));
  const existing = await db.query.prioritiesTable.findFirst({ where: eq(prioritiesTable.id, id) });
  if (!existing) {
    res.status(404).json({ message: "Priority not found" });
    return;
  }
  await db.delete(prioritiesTable).where(eq(prioritiesTable.id, id));
  res.json({ message: "Priority deleted" });
});

export default router;
