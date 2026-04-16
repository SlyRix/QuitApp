import { Hono } from "hono";
import type { Env } from "./types";
import { corsMiddleware } from "./middleware/cors";
import authRouter from "./routes/auth";
import quizzesRouter from "./routes/quizzes";
import gamesRouter from "./routes/games";
import uploadRouter from "./routes/upload";

export { GameRoom } from "./game/GameRoom";

const app = new Hono<{ Bindings: Env }>();

// ─── Global middleware ────────────────────────────────────────────────────────
app.use("*", corsMiddleware);

// ─── Health check ─────────────────────────────────────────────────────────────
app.get("/", (c) => c.json({ status: "ok", service: "slyquiz-api", version: "1.0.0" }));
app.get("/health", (c) => c.json({ status: "ok", ts: Date.now() }));

// ─── API routes ───────────────────────────────────────────────────────────────
app.route("/api/auth", authRouter);
app.route("/api/quizzes", quizzesRouter);
app.route("/api/games", gamesRouter);
app.route("/api/upload", uploadRouter);

// ─── Media serving (R2 proxy) ─────────────────────────────────────────────────
app.get("/api/media/:key{.+}", async (c) => {
  const key = c.req.param("key");
  const object = await c.env.MEDIA.get(key);
  if (!object) return c.json({ success: false, error: "Not found" }, 404);
  const headers = new Headers();
  object.writeHttpMetadata(headers);
  headers.set("Cache-Control", "public, max-age=31536000, immutable");
  return new Response(object.body, { headers });
});

// ─── 404 fallback ─────────────────────────────────────────────────────────────
app.notFound((c) => c.json({ success: false, error: "Not found" }, 404));
app.onError((err, c) => {
  console.error("Unhandled error:", err);
  return c.json({ success: false, error: "Internal server error" }, 500);
});

export default app;
