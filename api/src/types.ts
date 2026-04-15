import type { D1Database, KVNamespace, R2Bucket, DurableObjectNamespace } from "@cloudflare/workers-types";

export interface Env {
  // D1 database
  DB: D1Database;
  // KV namespace for session storage
  SESSIONS: KVNamespace;
  // R2 bucket for media uploads
  MEDIA: R2Bucket;
  // Durable Object namespace for game rooms
  GAME_ROOM: DurableObjectNamespace;
  // Environment variables
  CORS_ORIGIN_HOST: string;
  CORS_ORIGIN_PLAYER: string;
}

export interface SessionData {
  userId: string;
  email: string;
  name: string;
  avatarUrl: string | null;
}

export interface JwtPayload {
  sub: string;
  email: string;
  name: string;
  iat: number;
  exp: number;
}
