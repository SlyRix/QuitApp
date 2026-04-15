import { Hono } from "hono";
import { drizzle } from "drizzle-orm/d1";
import { eq, and } from "drizzle-orm";
import { quizzes, questions, answerOptions } from "../db/schema";
import { authMiddleware, getUser } from "../middleware/auth";
import type { Env, SessionData } from "../types";
import type { QuestionType } from "@slyquiz/shared";

type Variables = { user: SessionData };

const quizzesRouter = new Hono<{ Bindings: Env; Variables: Variables }>();

// ─── GET /public — no auth ────────────────────────────────────────────────────

quizzesRouter.get("/public", async (c) => {
  const db = drizzle(c.env.DB);
  const publicQuizzes = await db
    .select()
    .from(quizzes)
    .where(eq(quizzes.isPublic, true))
    .all();

  return c.json({ success: true, data: publicQuizzes });
});

// ─── Auth guard for all other routes ─────────────────────────────────────────

quizzesRouter.use("/*", authMiddleware);

// ─── GET / — list user's quizzes ──────────────────────────────────────────────

quizzesRouter.get("/", async (c) => {
  const user = getUser(c);
  const db = drizzle(c.env.DB);

  const userQuizzes = await db
    .select()
    .from(quizzes)
    .where(eq(quizzes.ownerId, user.userId))
    .all();

  return c.json({ success: true, data: userQuizzes });
});

// ─── POST / — create quiz ─────────────────────────────────────────────────────

quizzesRouter.post("/", async (c) => {
  const user = getUser(c);
  const body = await c.req.json<{
    title: string;
    description?: string;
    coverImage?: string;
    theme?: string;
    isPublic?: boolean;
    questions?: Array<{
      type: QuestionType;
      text: string;
      mediaUrl?: string;
      timeLimit?: number;
      points?: number;
      orderIndex: number;
      answers: Array<{ text: string; isCorrect: boolean; orderIndex: number }>;
    }>;
  }>();

  if (!body.title) {
    return c.json({ success: false, error: "title is required" }, 400);
  }

  const db = drizzle(c.env.DB);
  const quizId = crypto.randomUUID();
  const now = Date.now();

  await db.insert(quizzes).values({
    id: quizId,
    ownerId: user.userId,
    title: body.title.trim(),
    description: body.description ?? null,
    coverImage: body.coverImage ?? null,
    theme: body.theme ?? null,
    isPublic: body.isPublic ?? false,
    createdAt: now,
    updatedAt: now,
  });

  if (body.questions && body.questions.length > 0) {
    for (const q of body.questions) {
      const questionId = crypto.randomUUID();
      await db.insert(questions).values({
        id: questionId,
        quizId,
        type: q.type,
        text: q.text,
        mediaUrl: q.mediaUrl ?? null,
        timeLimit: q.timeLimit ?? 20,
        points: q.points ?? 1000,
        orderIndex: q.orderIndex,
      });

      if (q.answers && q.answers.length > 0) {
        for (const a of q.answers) {
          await db.insert(answerOptions).values({
            id: crypto.randomUUID(),
            questionId,
            text: a.text,
            isCorrect: a.isCorrect,
            orderIndex: a.orderIndex,
          });
        }
      }
    }
  }

  const quiz = await db.select().from(quizzes).where(eq(quizzes.id, quizId)).get();
  return c.json({ success: true, data: quiz }, 201);
});

// ─── GET /:id — get quiz with questions ──────────────────────────────────────

quizzesRouter.get("/:id", async (c) => {
  const user = getUser(c);
  const quizId = c.req.param("id");
  const db = drizzle(c.env.DB);

  const quiz = await db.select().from(quizzes).where(eq(quizzes.id, quizId)).get();
  if (!quiz) {
    return c.json({ success: false, error: "Quiz not found" }, 404);
  }

  if (!quiz.isPublic && quiz.ownerId !== user.userId) {
    return c.json({ success: false, error: "Forbidden" }, 403);
  }

  const quizQuestions = await db
    .select()
    .from(questions)
    .where(eq(questions.quizId, quizId))
    .all();

  const questionsWithAnswers = await Promise.all(
    quizQuestions.map(async (q) => {
      const answers = await db
        .select()
        .from(answerOptions)
        .where(eq(answerOptions.questionId, q.id))
        .all();
      return { ...q, answers };
    })
  );

  questionsWithAnswers.sort((a, b) => a.orderIndex - b.orderIndex);

  return c.json({ success: true, data: { ...quiz, questions: questionsWithAnswers } });
});

// ─── PUT /:id — update quiz ───────────────────────────────────────────────────

quizzesRouter.put("/:id", async (c) => {
  const user = getUser(c);
  const quizId = c.req.param("id");
  const db = drizzle(c.env.DB);

  const quiz = await db.select().from(quizzes).where(eq(quizzes.id, quizId)).get();
  if (!quiz) {
    return c.json({ success: false, error: "Quiz not found" }, 404);
  }

  if (quiz.ownerId !== user.userId) {
    return c.json({ success: false, error: "Forbidden" }, 403);
  }

  const body = await c.req.json<{
    title?: string;
    description?: string;
    coverImage?: string;
    theme?: string;
    isPublic?: boolean;
  }>();

  await db
    .update(quizzes)
    .set({
      title: body.title ?? quiz.title,
      description: body.description !== undefined ? body.description : quiz.description,
      coverImage: body.coverImage !== undefined ? body.coverImage : quiz.coverImage,
      theme: body.theme !== undefined ? body.theme : quiz.theme,
      isPublic: body.isPublic !== undefined ? body.isPublic : quiz.isPublic,
      updatedAt: Date.now(),
    })
    .where(eq(quizzes.id, quizId));

  const updated = await db.select().from(quizzes).where(eq(quizzes.id, quizId)).get();
  return c.json({ success: true, data: updated });
});

// ─── DELETE /:id — delete quiz ────────────────────────────────────────────────

quizzesRouter.delete("/:id", async (c) => {
  const user = getUser(c);
  const quizId = c.req.param("id");
  const db = drizzle(c.env.DB);

  const quiz = await db.select().from(quizzes).where(eq(quizzes.id, quizId)).get();
  if (!quiz) {
    return c.json({ success: false, error: "Quiz not found" }, 404);
  }

  if (quiz.ownerId !== user.userId) {
    return c.json({ success: false, error: "Forbidden" }, 403);
  }

  await db.delete(quizzes).where(eq(quizzes.id, quizId));
  return c.json({ success: true, data: { message: "Quiz deleted" } });
});

// ─── POST /import — import Kahoot JSON ───────────────────────────────────────

quizzesRouter.post("/import", async (c) => {
  const user = getUser(c);
  const body = await c.req.json<{
    title: string;
    uuid?: string;
    questions: Array<{
      question: string;
      type: string;
      time: number;
      pointsMultiplier: number;
      choices?: Array<{ answer: string; correct: boolean }>;
    }>;
  }>();

  if (!body.title || !body.questions) {
    return c.json({ success: false, error: "Invalid Kahoot format: missing title or questions" }, 400);
  }

  const db = drizzle(c.env.DB);
  const quizId = crypto.randomUUID();
  const now = Date.now();

  await db.insert(quizzes).values({
    id: quizId,
    ownerId: user.userId,
    title: body.title.trim(),
    description: `Imported from Kahoot`,
    coverImage: null,
    theme: null,
    isPublic: false,
    createdAt: now,
    updatedAt: now,
  });

  for (let i = 0; i < body.questions.length; i++) {
    const kq = body.questions[i]!;
    const questionId = crypto.randomUUID();

    let type = "MULTIPLE_CHOICE";
    if (kq.type === "true_or_false") type = "TRUE_FALSE";
    else if (kq.type === "open_ended") type = "TYPE_ANSWER";
    else if (kq.type === "survey") type = "POLL";

    await db.insert(questions).values({
      id: questionId,
      quizId,
      type,
      text: kq.question,
      mediaUrl: null,
      timeLimit: Math.round(kq.time / 1000) || 20,
      points: kq.pointsMultiplier === 2 ? 2000 : 1000,
      orderIndex: i,
    });

    if (kq.choices && kq.choices.length > 0) {
      for (let j = 0; j < kq.choices.length; j++) {
        const choice = kq.choices[j]!;
        await db.insert(answerOptions).values({
          id: crypto.randomUUID(),
          questionId,
          text: choice.answer,
          isCorrect: choice.correct,
          orderIndex: j,
        });
      }
    }
  }

  const quiz = await db.select().from(quizzes).where(eq(quizzes.id, quizId)).get();
  return c.json({ success: true, data: quiz }, 201);
});

export default quizzesRouter;
