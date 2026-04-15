-- KahootPlus Initial Schema Migration
-- 0001_initial.sql

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  avatar_url TEXT,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS oauth_accounts (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  provider TEXT NOT NULL,
  provider_id TEXT NOT NULL,
  UNIQUE(provider, provider_id)
);

CREATE INDEX IF NOT EXISTS idx_oauth_accounts_user_id ON oauth_accounts(user_id);

CREATE TABLE IF NOT EXISTS quizzes (
  id TEXT PRIMARY KEY,
  owner_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  cover_image TEXT,
  theme TEXT,
  is_public INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_quizzes_owner_id ON quizzes(owner_id);
CREATE INDEX IF NOT EXISTS idx_quizzes_is_public ON quizzes(is_public);

CREATE TABLE IF NOT EXISTS questions (
  id TEXT PRIMARY KEY,
  quiz_id TEXT NOT NULL REFERENCES quizzes(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  text TEXT NOT NULL,
  media_url TEXT,
  time_limit INTEGER NOT NULL DEFAULT 20,
  points INTEGER NOT NULL DEFAULT 1000,
  order_index INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_questions_quiz_id ON questions(quiz_id);

CREATE TABLE IF NOT EXISTS answer_options (
  id TEXT PRIMARY KEY,
  question_id TEXT NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
  text TEXT NOT NULL,
  is_correct INTEGER NOT NULL DEFAULT 0,
  order_index INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_answer_options_question_id ON answer_options(question_id);

CREATE TABLE IF NOT EXISTS game_sessions (
  id TEXT PRIMARY KEY,
  quiz_id TEXT NOT NULL REFERENCES quizzes(id) ON DELETE CASCADE,
  host_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  pin TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'lobby',
  created_at INTEGER NOT NULL,
  ended_at INTEGER
);

CREATE INDEX IF NOT EXISTS idx_game_sessions_pin ON game_sessions(pin);
CREATE INDEX IF NOT EXISTS idx_game_sessions_host_id ON game_sessions(host_id);
CREATE INDEX IF NOT EXISTS idx_game_sessions_quiz_id ON game_sessions(quiz_id);

CREATE TABLE IF NOT EXISTS game_players (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL REFERENCES game_sessions(id) ON DELETE CASCADE,
  nickname TEXT NOT NULL,
  avatar_data TEXT,
  session_token TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'connected',
  score INTEGER NOT NULL DEFAULT 0,
  streak INTEGER NOT NULL DEFAULT 0,
  joined_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_game_players_session_id ON game_players(session_id);
CREATE INDEX IF NOT EXISTS idx_game_players_session_token ON game_players(session_token);

CREATE TABLE IF NOT EXISTS game_answers (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL REFERENCES game_sessions(id) ON DELETE CASCADE,
  player_id TEXT NOT NULL REFERENCES game_players(id) ON DELETE CASCADE,
  question_id TEXT NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
  answer_id TEXT,
  response_time_ms INTEGER NOT NULL,
  points_earned INTEGER NOT NULL DEFAULT 0,
  answered_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_game_answers_session_id ON game_answers(session_id);
CREATE INDEX IF NOT EXISTS idx_game_answers_player_id ON game_answers(player_id);
CREATE INDEX IF NOT EXISTS idx_game_answers_question_id ON game_answers(question_id);
