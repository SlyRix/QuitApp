import { MiddlewareHandler, Context } from "hono";
import type { Env, SessionData } from "../types";

type AuthVariables = {
  user: SessionData;
};

export const authMiddleware: MiddlewareHandler<{
  Bindings: Env;
  Variables: AuthVariables;
}> = async (c, next) => {
  const authHeader = c.req.header("Authorization");
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return c.json({ success: false, error: "Missing or invalid Authorization header" }, 401);
  }

  const token = authHeader.slice(7);
  if (!token) {
    return c.json({ success: false, error: "Missing token" }, 401);
  }

  const sessionJson = await c.env.SESSIONS.get(`session:${token}`);
  if (!sessionJson) {
    return c.json({ success: false, error: "Session expired or invalid" }, 401);
  }

  let session: SessionData;
  try {
    session = JSON.parse(sessionJson) as SessionData;
  } catch {
    return c.json({ success: false, error: "Malformed session data" }, 401);
  }

  c.set("user", session);
  await next();
};

export function getUser(c: Context<{ Bindings: Env; Variables: AuthVariables }>): SessionData {
  return c.get("user");
}
