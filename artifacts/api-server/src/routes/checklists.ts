import { Router, type IRouter } from "express";
import { db, checklistTemplatesTable, checklistResponsesTable, tradesTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { requireAuth } from "../middlewares/auth";

const router: IRouter = Router();

router.get("/checklists/templates", requireAuth, async (req, res): Promise<void> => {
  const userId = req.user!.id;
  const templates = await db.select().from(checklistTemplatesTable)
    .where(eq(checklistTemplatesTable.userId, userId))
    .orderBy(checklistTemplatesTable.createdAt);
  res.json(templates);
});

router.post("/checklists/templates", requireAuth, async (req, res): Promise<void> => {
  const userId = req.user!.id;
  const { name, questions } = req.body as { name?: string; questions?: unknown[] };

  if (!name || typeof name !== "string" || name.trim().length === 0) {
    res.status(400).json({ error: "Template name is required" });
    return;
  }

  const [template] = await db.insert(checklistTemplatesTable).values({
    userId,
    name: name.trim(),
    questions: Array.isArray(questions) ? questions : [],
  }).returning();

  res.status(201).json(template);
});

router.patch("/checklists/templates/:id", requireAuth, async (req, res): Promise<void> => {
  const userId = req.user!.id;
  const id = parseInt(String(req.params.id), 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }

  const [existing] = await db.select().from(checklistTemplatesTable)
    .where(and(eq(checklistTemplatesTable.id, id), eq(checklistTemplatesTable.userId, userId)));
  if (!existing) { res.status(404).json({ error: "Template not found" }); return; }

  const { name, questions } = req.body as { name?: string; questions?: unknown[] };
  const updates: Record<string, unknown> = {};
  if (name !== undefined) updates.name = String(name).trim();
  if (questions !== undefined) updates.questions = Array.isArray(questions) ? questions : [];

  const [updated] = await db.update(checklistTemplatesTable)
    .set(updates)
    .where(eq(checklistTemplatesTable.id, id))
    .returning();

  res.json(updated);
});

router.delete("/checklists/templates/:id", requireAuth, async (req, res): Promise<void> => {
  const userId = req.user!.id;
  const id = parseInt(String(req.params.id), 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }

  const [deleted] = await db.delete(checklistTemplatesTable)
    .where(and(eq(checklistTemplatesTable.id, id), eq(checklistTemplatesTable.userId, userId)))
    .returning();

  if (!deleted) { res.status(404).json({ error: "Template not found" }); return; }
  res.sendStatus(204);
});

router.get("/checklists/responses/:tradeId", requireAuth, async (req, res): Promise<void> => {
  const userId = req.user!.id;
  const tradeId = parseInt(String(req.params.tradeId), 10);
  if (isNaN(tradeId)) { res.status(400).json({ error: "Invalid tradeId" }); return; }

  const [trade] = await db.select({ id: tradesTable.id }).from(tradesTable)
    .where(and(eq(tradesTable.id, tradeId), eq(tradesTable.userId, userId)));
  if (!trade) { res.status(404).json({ error: "Trade not found" }); return; }

  const responses = await db.select().from(checklistResponsesTable)
    .where(and(eq(checklistResponsesTable.tradeId, tradeId), eq(checklistResponsesTable.userId, userId)));
  res.json(responses);
});

router.put("/checklists/responses/:tradeId", requireAuth, async (req, res): Promise<void> => {
  const userId = req.user!.id;
  const tradeId = parseInt(String(req.params.tradeId), 10);
  if (isNaN(tradeId)) { res.status(400).json({ error: "Invalid tradeId" }); return; }

  const { templateId, answers } = req.body as { templateId?: number; answers?: unknown[] };
  if (!templateId || typeof templateId !== "number") {
    res.status(400).json({ error: "templateId is required" });
    return;
  }

  const [trade] = await db.select({ id: tradesTable.id }).from(tradesTable)
    .where(and(eq(tradesTable.id, tradeId), eq(tradesTable.userId, userId)));
  if (!trade) { res.status(404).json({ error: "Trade not found" }); return; }

  const [template] = await db.select({ id: checklistTemplatesTable.id }).from(checklistTemplatesTable)
    .where(and(eq(checklistTemplatesTable.id, templateId), eq(checklistTemplatesTable.userId, userId)));
  if (!template) { res.status(404).json({ error: "Template not found" }); return; }

  const [existing] = await db.select().from(checklistResponsesTable)
    .where(and(
      eq(checklistResponsesTable.tradeId, tradeId),
      eq(checklistResponsesTable.templateId, templateId),
      eq(checklistResponsesTable.userId, userId),
    ));

  let result;
  if (existing) {
    [result] = await db.update(checklistResponsesTable)
      .set({ answers: Array.isArray(answers) ? answers : [] })
      .where(eq(checklistResponsesTable.id, existing.id))
      .returning();
  } else {
    [result] = await db.insert(checklistResponsesTable).values({
      userId,
      tradeId,
      templateId,
      answers: Array.isArray(answers) ? answers : [],
    }).returning();
  }

  res.json(result);
});

export default router;
