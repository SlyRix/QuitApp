import { MiddlewareHandler } from "hono";
import type { Env } from "../types";

export const corsMiddleware: MiddlewareHandler<{ Bindings: Env }> = async (c, next) => {
  const origin = c.req.header("Origin") ?? "";
  const allowedOrigins = [
    c.env.CORS_ORIGIN_HOST,
    c.env.CORS_ORIGIN_PLAYER,
    "http://localhost:5173",
    "http://localhost:5174",
  ];

  const isAllowed = allowedOrigins.includes(origin);
  const responseOrigin = isAllowed ? origin : allowedOrigins[0] ?? "";

  if (c.req.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: {
        "Access-Control-Allow-Origin": responseOrigin,
        "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Authorization",
        "Access-Control-Max-Age": "86400",
        "Access-Control-Allow-Credentials": "true",
      },
    });
  }

  await next();

  c.res.headers.set("Access-Control-Allow-Origin", responseOrigin);
  c.res.headers.set("Access-Control-Allow-Credentials", "true");
  c.res.headers.set("Vary", "Origin");
};
