import { Hono } from "hono";
import { drizzle } from "drizzle-orm/d1";
import { eq } from "drizzle-orm";
import { gameSessions, gamePlayers, quizzes } from "../db/schema";
import { authMiddleware, getUser } from "../middleware/auth";
import type { Env, SessionData } from "../types";

type Variables = { user: SessionData };

const gamesRouter = new Hono<{ Bindings: Env; Variables: Variables }>();

function generatePin(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

// ─── POST / — create game session ────────────────────────────────────────────

gamesRouter.post("/", authMiddleware, async (c) => {
  const user = getUser(c);
  const body = await c.req.json<{ quizId: string }>();

  if (!body.quizId) {
    return c.json({ success: false, error: "quizId is required" }, 400);
  }

  const db = drizzle(c.env.DB);

  const quiz = await db.select().from(quizzes).where(eq(quizzes.id, body.quizId)).get();
  if (!quiz) {
    return c.json({ success: false, error: "Quiz not found" }, 404);
  }

  if (quiz.ownerId !== user.userId) {
    return c.json({ success: false, error: "Forbidden" }, 403);
  }

  // Generate unique PIN
  let pin = generatePin();
  let attempts = 0;
  while (attempts < 10) {
    const existing = await db.select({ id: gameSessions.id }).from(gameSessions).where(eq(gameSessions.pin, pin)).get();
    if (!existing) break;
    pin = generatePin();
    attempts++;
  }

  const sessionId = crypto.randomUUID();
  const now = Date.now();

  await db.insert(gameSessions).values({
    id: sessionId,
    quizId: body.quizId,
    hostId: user.userId,
    pin,
    status: "lobby",
    createdAt: now,
    endedAt: null,
  });

  const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=256x256&data=${encodeURIComponent(`https://quiz-player.rushelwedsivani.com/join/${pin}`)}`;

  return c.json({
    success: true,
    data: {
      sessionId,
      pin,
      qrCodeUrl,
      joinUrl: `https://quiz-player.rushelwedsivani.com/join/${pin}`,
    },
  }, 201);
});

// ─── GET /:pin — get game state ───────────────────────────────────────────────

gamesRouter.get("/:pin", async (c) => {
  const pin = c.req.param("pin");
  const db = drizzle(c.env.DB);

  const session = await db.select().from(gameSessions).where(eq(gameSessions.pin, pin)).get();
  if (!session) {
    return c.json({ success: false, error: "Game not found" }, 404);
  }

  const players = await db
    .select()
    .from(gamePlayers)
    .where(eq(gamePlayers.sessionId, session.id))
    .all();

  return c.json({
    success: true,
    data: {
      ...session,
      playerCount: players.length,
      players: players.map((p) => ({
        id: p.id,
        nickname: p.nickname,
        avatarData: p.avatarData,
        score: p.score,
        streak: p.streak,
        status: p.status,
      })),
    },
  });
});

// ─── POST /:pin/join — player joins game ──────────────────────────────────────

gamesRouter.post("/:pin/join", async (c) => {
  const pin = c.req.param("pin");
  const body = await c.req.json<{ nickname: string; avatarData?: string }>();

  if (!body.nickname || body.nickname.trim().length === 0) {
    return c.json({ success: false, error: "nickname is required" }, 400);
  }

  const db = drizzle(c.env.DB);

  const session = await db.select().from(gameSessions).where(eq(gameSessions.pin, pin)).get();
  if (!session) {
    return c.json({ success: false, error: "Game not found" }, 404);
  }

  if (session.status !== "lobby") {
    return c.json({ success: false, error: "Game has already started" }, 409);
  }

  const existingPlayers = await db
    .select()
    .from(gamePlayers)
    .where(eq(gamePlayers.sessionId, session.id))
    .all();

  const nicknameTaken = existingPlayers.some(
    (p) => p.nickname.toLowerCase() === body.nickname.trim().toLowerCase() && p.status === "connected"
  );
  if (nicknameTaken) {
    return c.json({ success: false, error: "Nickname already taken" }, 409);
  }

  const playerId = crypto.randomUUID();
  const sessionToken = Array.from(crypto.getRandomValues(new Uint8Array(32)))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  const now = Date.now();

  await db.insert(gamePlayers).values({
    id: playerId,
    sessionId: session.id,
    nickname: body.nickname.trim(),
    avatarData: body.avatarData ?? null,
    sessionToken,
    status: "connected",
    score: 0,
    streak: 0,
    joinedAt: now,
  });

  return c.json({
    success: true,
    data: {
      playerId,
      sessionToken,
      sessionId: session.id,
      quizId: session.quizId,
    },
  }, 201);
});

// ─── GET /:pin/ws — WebSocket upgrade ────────────────────────────────────────

gamesRouter.get("/:pin/ws", async (c) => {
  const pin = c.req.param("pin");

  const upgradeHeader = c.req.header("Upgrade");
  if (!upgradeHeader || upgradeHeader.toLowerCase() !== "websocket") {
    return c.json({ success: false, error: "Expected WebSocket upgrade" }, 426);
  }

  const db = drizzle(c.env.DB);
  const session = await db.select().from(gameSessions).where(eq(gameSessions.pin, pin)).get();
  if (!session) {
    return c.json({ success: false, error: "Game not found" }, 404);
  }

  // Route to the Durable Object
  const id = c.env.GAME_ROOM.idFromName(session.id);
  const stub = c.env.GAME_ROOM.get(id);

  const url = new URL(c.req.url);
  url.searchParams.set("sessionId", session.id);
  url.searchParams.set("quizId", session.quizId);

  return stub.fetch(new Request(url.toString(), c.req.raw));
});

export default gamesRouter;
