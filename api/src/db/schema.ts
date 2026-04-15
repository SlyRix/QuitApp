import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";

export const users = sqliteTable("users", {
  id: text("id").primaryKey(),
  email: text("email").notNull().unique(),
  name: text("name").notNull(),
  passwordHash: text("password_hash").notNull(),
  avatarUrl: text("avatar_url"),
  createdAt: integer("created_at").notNull(),
});

export const oauthAccounts = sqliteTable("oauth_accounts", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  provider: text("provider").notNull(),
  providerId: text("provider_id").notNull(),
});

export const quizzes = sqliteTable("quizzes", {
  id: text("id").primaryKey(),
  ownerId: text("owner_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  description: text("description"),
  coverImage: text("cover_image"),
  theme: text("theme"),
  isPublic: integer("is_public", { mode: "boolean" }).notNull().default(false),
  createdAt: integer("created_at").notNull(),
  updatedAt: integer("updated_at").notNull(),
});

export const questions = sqliteTable("questions", {
  id: text("id").primaryKey(),
  quizId: text("quiz_id")
    .notNull()
    .references(() => quizzes.id, { onDelete: "cascade" }),
  type: text("type").notNull(),
  text: text("text").notNull(),
  mediaUrl: text("media_url"),
  timeLimit: integer("time_limit").notNull().default(20),
  points: integer("points").notNull().default(1000),
  orderIndex: integer("order_index").notNull(),
});

export const answerOptions = sqliteTable("answer_options", {
  id: text("id").primaryKey(),
  questionId: text("question_id")
    .notNull()
    .references(() => questions.id, { onDelete: "cascade" }),
  text: text("text").notNull(),
  isCorrect: integer("is_correct", { mode: "boolean" }).notNull().default(false),
  orderIndex: integer("order_index").notNull(),
});

export const gameSessions = sqliteTable("game_sessions", {
  id: text("id").primaryKey(),
  quizId: text("quiz_id")
    .notNull()
    .references(() => quizzes.id, { onDelete: "cascade" }),
  hostId: text("host_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  pin: text("pin").notNull().unique(),
  status: text("status").notNull().default("lobby"),
  createdAt: integer("created_at").notNull(),
  endedAt: integer("ended_at"),
});

export const gamePlayers = sqliteTable("game_players", {
  id: text("id").primaryKey(),
  sessionId: text("session_id")
    .notNull()
    .references(() => gameSessions.id, { onDelete: "cascade" }),
  nickname: text("nickname").notNull(),
  avatarData: text("avatar_data"),
  sessionToken: text("session_token").notNull().unique(),
  status: text("status").notNull().default("connected"),
  score: integer("score").notNull().default(0),
  streak: integer("streak").notNull().default(0),
  joinedAt: integer("joined_at").notNull(),
});

export const gameAnswers = sqliteTable("game_answers", {
  id: text("id").primaryKey(),
  sessionId: text("session_id")
    .notNull()
    .references(() => gameSessions.id, { onDelete: "cascade" }),
  playerId: text("player_id")
    .notNull()
    .references(() => gamePlayers.id, { onDelete: "cascade" }),
  questionId: text("question_id")
    .notNull()
    .references(() => questions.id, { onDelete: "cascade" }),
  answerId: text("answer_id"),
  responseTimeMs: integer("response_time_ms").notNull(),
  pointsEarned: integer("points_earned").notNull().default(0),
  answeredAt: integer("answered_at").notNull(),
});
