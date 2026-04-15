import { Hono } from "hono";
import { drizzle } from "drizzle-orm/d1";
import { eq } from "drizzle-orm";
import { users } from "../db/schema";
import type { Env, SessionData } from "../types";

const auth = new Hono<{ Bindings: Env }>();

// ─── Crypto helpers ───────────────────────────────────────────────────────────

async function hashPassword(password: string): Promise<string> {
  const encoder = new TextEncoder();
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    encoder.encode(password),
    "PBKDF2",
    false,
    ["deriveBits"]
  );
  const derivedBits = await crypto.subtle.deriveBits(
    {
      name: "PBKDF2",
      salt,
      iterations: 100_000,
      hash: "SHA-256",
    },
    keyMaterial,
    256
  );
  const hashArray = new Uint8Array(derivedBits);
  const saltHex = Array.from(salt).map((b) => b.toString(16).padStart(2, "0")).join("");
  const hashHex = Array.from(hashArray).map((b) => b.toString(16).padStart(2, "0")).join("");
  return `pbkdf2:${saltHex}:${hashHex}`;
}

async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const parts = stored.split(":");
  if (parts.length !== 3 || parts[0] !== "pbkdf2") return false;
  const [, saltHex, hashHex] = parts;
  if (!saltHex || !hashHex) return false;

  const salt = new Uint8Array(saltHex.match(/.{2}/g)!.map((b) => parseInt(b, 16)));
  const encoder = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    encoder.encode(password),
    "PBKDF2",
    false,
    ["deriveBits"]
  );
  const derivedBits = await crypto.subtle.deriveBits(
    {
      name: "PBKDF2",
      salt,
      iterations: 100_000,
      hash: "SHA-256",
    },
    keyMaterial,
    256
  );
  const derived = new Uint8Array(derivedBits);
  const derivedHex = Array.from(derived).map((b) => b.toString(16).padStart(2, "0")).join("");
  return derivedHex === hashHex;
}

function generateToken(): string {
  const array = crypto.getRandomValues(new Uint8Array(32));
  return Array.from(array).map((b) => b.toString(16).padStart(2, "0")).join("");
}

// ─── POST /register ───────────────────────────────────────────────────────────

auth.post("/register", async (c) => {
  const body = await c.req.json<{ email: string; password: string; name: string }>();

  if (!body.email || !body.password || !body.name) {
    return c.json({ success: false, error: "email, password, and name are required" }, 400);
  }

  if (body.password.length < 8) {
    return c.json({ success: false, error: "Password must be at least 8 characters" }, 400);
  }

  const db = drizzle(c.env.DB);

  const existing = await db.select({ id: users.id }).from(users).where(eq(users.email, body.email)).get();
  if (existing) {
    return c.json({ success: false, error: "Email already registered" }, 409);
  }

  const id = crypto.randomUUID();
  const passwordHash = await hashPassword(body.password);
  const now = Date.now();

  await db.insert(users).values({
    id,
    email: body.email.toLowerCase().trim(),
    name: body.name.trim(),
    passwordHash,
    avatarUrl: null,
    createdAt: now,
  });

  const token = generateToken();
  const session: SessionData = {
    userId: id,
    email: body.email.toLowerCase().trim(),
    name: body.name.trim(),
    avatarUrl: null,
  };
  await c.env.SESSIONS.put(`session:${token}`, JSON.stringify(session), {
    expirationTtl: 60 * 60 * 24 * 7,
  });

  return c.json({
    success: true,
    data: {
      token,
      user: { id, email: session.email, name: session.name, avatarUrl: null },
    },
  }, 201);
});

// ─── POST /login ──────────────────────────────────────────────────────────────

auth.post("/login", async (c) => {
  const body = await c.req.json<{ email: string; password: string }>();

  if (!body.email || !body.password) {
    return c.json({ success: false, error: "email and password are required" }, 400);
  }

  const db = drizzle(c.env.DB);
  const user = await db
    .select()
    .from(users)
    .where(eq(users.email, body.email.toLowerCase().trim()))
    .get();

  if (!user) {
    return c.json({ success: false, error: "Invalid credentials" }, 401);
  }

  const valid = await verifyPassword(body.password, user.passwordHash);
  if (!valid) {
    return c.json({ success: false, error: "Invalid credentials" }, 401);
  }

  const token = generateToken();
  const session: SessionData = {
    userId: user.id,
    email: user.email,
    name: user.name,
    avatarUrl: user.avatarUrl,
  };
  await c.env.SESSIONS.put(`session:${token}`, JSON.stringify(session), {
    expirationTtl: 60 * 60 * 24 * 7,
  });

  return c.json({
    success: true,
    data: {
      token,
      user: { id: user.id, email: user.email, name: user.name, avatarUrl: user.avatarUrl },
    },
  });
});

// ─── GET /me ──────────────────────────────────────────────────────────────────

auth.get("/me", async (c) => {
  const authHeader = c.req.header("Authorization");
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return c.json({ success: false, error: "Unauthorized" }, 401);
  }

  const token = authHeader.slice(7);
  const sessionJson = await c.env.SESSIONS.get(`session:${token}`);
  if (!sessionJson) {
    return c.json({ success: false, error: "Session expired or invalid" }, 401);
  }

  const session = JSON.parse(sessionJson) as SessionData;
  const db = drizzle(c.env.DB);
  const user = await db.select().from(users).where(eq(users.id, session.userId)).get();

  if (!user) {
    return c.json({ success: false, error: "User not found" }, 404);
  }

  return c.json({
    success: true,
    data: { id: user.id, email: user.email, name: user.name, avatarUrl: user.avatarUrl },
  });
});

// ─── POST /logout ─────────────────────────────────────────────────────────────

auth.post("/logout", async (c) => {
  const authHeader = c.req.header("Authorization");
  if (authHeader && authHeader.startsWith("Bearer ")) {
    const token = authHeader.slice(7);
    await c.env.SESSIONS.delete(`session:${token}`);
  }
  return c.json({ success: true, data: { message: "Logged out" } });
});

export default auth;
