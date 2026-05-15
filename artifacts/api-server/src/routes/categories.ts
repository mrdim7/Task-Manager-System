import { Router } from "express";
import { db } from "@workspace/db";
import { categoriesTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { authenticate, requireAdmin } from "../middlewares/authenticate";
import { CreateCategoryBody, UpdateCategoryBody } from "@workspace/api-zod";

const router = Router();

router.get("/categories", authenticate, async (_req, res) => {
  const categories = await db.select().from(categoriesTable).orderBy(categoriesTable.name);
  res.json(
    categories.map((c) => ({
      id: c.id,
      name: c.name,
      createdAt: c.createdAt.toISOString(),
    })),
  );
});

router.post("/categories", authenticate, requireAdmin, async (req, res) => {
  const parsed = CreateCategoryBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ message: "Invalid request body" });
    return;
  }
  const [cat] = await db.insert(categoriesTable).values({ name: parsed.data.name }).returning();
  res.status(201).json({ id: cat.id, name: cat.name, createdAt: cat.createdAt.toISOString() });
});

router.put("/categories/:id", authenticate, requireAdmin, async (req, res) => {
  const id = parseInt(String(req.params.id));
  const parsed = UpdateCategoryBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ message: "Invalid request body" });
    return;
  }
  const existing = await db.query.categoriesTable.findFirst({ where: eq(categoriesTable.id, id) });
  if (!existing) {
    res.status(404).json({ message: "Category not found" });
    return;
  }
  const [cat] = await db.update(categoriesTable).set({ name: parsed.data.name }).where(eq(categoriesTable.id, id)).returning();
  res.json({ id: cat.id, name: cat.name, createdAt: cat.createdAt.toISOString() });
});

router.delete("/categories/:id", authenticate, requireAdmin, async (req, res) => {
  const id = parseInt(String(req.params.id));
  const existing = await db.query.categoriesTable.findFirst({ where: eq(categoriesTable.id, id) });
  if (!existing) {
    res.status(404).json({ message: "Category not found" });
    return;
  }
  await db.delete(categoriesTable).where(eq(categoriesTable.id, id));
  res.json({ message: "Category deleted" });
});

export default router;
