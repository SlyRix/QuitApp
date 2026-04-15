// ─── Enums ───────────────────────────────────────────────────────────────────

export enum QuestionType {
  MULTIPLE_CHOICE = "MULTIPLE_CHOICE",
  TRUE_FALSE = "TRUE_FALSE",
  TYPE_ANSWER = "TYPE_ANSWER",
  POLL = "POLL",
  SLIDER = "SLIDER",
  WORD_CLOUD = "WORD_CLOUD",
  PUZZLE = "PUZZLE",
}

export enum GamePhase {
  LOBBY = "lobby",
  QUESTION = "question",
  RESULTS = "results",
  ENDED = "ended",
}

// ─── Domain Models ───────────────────────────────────────────────────────────

export interface User {
  id: string;
  email: string;
  name: string;
  avatarUrl: string | null;
  createdAt: number;
}

export interface OAuthAccount {
  id: string;
  userId: string;
  provider: string;
  providerId: string;
}

export interface AnswerOption {
  id: string;
  questionId: string;
  text: string;
  isCorrect: boolean;
  orderIndex: number;
}

export interface Question {
  id: string;
  quizId: string;
  type: QuestionType;
  text: string;
  mediaUrl: string | null;
  timeLimit: number;
  points: number;
  orderIndex: number;
  answers: AnswerOption[];
}

export interface Quiz {
  id: string;
  ownerId: string;
  title: string;
  description: string | null;
  coverImage: string | null;
  theme: string | null;
  isPublic: boolean;
  createdAt: number;
  updatedAt: number;
  questions: Question[];
}

export interface GameSession {
  id: string;
  quizId: string;
  hostId: string;
  pin: string;
  status: GamePhase;
  createdAt: number;
  endedAt: number | null;
}

export interface GamePlayer {
  id: string;
  sessionId: string;
  nickname: string;
  avatarData: string | null;
  sessionToken: string;
  status: "connected" | "disconnected";
  score: number;
  streak: number;
  joinedAt: number;
}

export interface GameAnswer {
  id: string;
  sessionId: string;
  playerId: string;
  questionId: string;
  answerId: string | null;
  responseTimeMs: number;
  pointsEarned: number;
  answeredAt: number;
}

// ─── Leaderboard ─────────────────────────────────────────────────────────────

export interface LeaderboardEntry {
  playerId: string;
  nickname: string;
  avatarData: string | null;
  score: number;
  streak: number;
  rank: number;
}

// ─── WebSocket Message Types ──────────────────────────────────────────────────

export type WsMessage =
  | WsMsgJoin
  | WsMsgJoinAck
  | WsMsgPlayerJoined
  | WsMsgPlayerDisconnected
  | WsMsgStartGame
  | WsMsgNextQuestion
  | WsMsgQuestionStart
  | WsMsgAnswer
  | WsMsgAnswerAck
  | WsMsgQuestionEnd
  | WsMsgSync
  | WsMsgLeaderboardUpdate
  | WsMsgChatMessage
  | WsMsgGameEnded
  | WsMsgPing
  | WsMsgPong
  | WsMsgError;

export interface WsMsgJoin {
  type: "JOIN";
  sessionToken: string;
  nickname: string;
  avatarData?: string;
}

export interface WsMsgJoinAck {
  type: "JOIN_ACK";
  playerId: string;
  nickname: string;
  score: number;
  streak: number;
}

export interface WsMsgPlayerJoined {
  type: "PLAYER_JOINED";
  playerId: string;
  nickname: string;
  avatarData: string | null;
  totalPlayers: number;
}

export interface WsMsgPlayerDisconnected {
  type: "PLAYER_DISCONNECTED";
  playerId: string;
  nickname: string;
}

export interface WsMsgStartGame {
  type: "START_GAME";
}

export interface WsMsgNextQuestion {
  type: "NEXT_QUESTION";
}

export interface WsMsgQuestionStart {
  type: "QUESTION_START";
  questionIndex: number;
  totalQuestions: number;
  question: {
    id: string;
    type: QuestionType;
    text: string;
    mediaUrl: string | null;
    timeLimit: number;
    points: number;
    answers: Array<{ id: string; text: string }>;
  };
  startedAt: number;
}

export interface WsMsgAnswer {
  type: "ANSWER";
  answerId: string;
  responseTimeMs: number;
}

export interface WsMsgAnswerAck {
  type: "ANSWER_ACK";
  received: boolean;
  responseTimeMs: number;
}

export interface WsMsgQuestionEnd {
  type: "QUESTION_END";
  questionId: string;
  correctAnswerId: string | null;
  correctAnswerText: string | null;
  pointsEarned: number;
  myScore: number;
  myStreak: number;
  leaderboard: LeaderboardEntry[];
  answerCounts: Record<string, number>;
}

export interface WsMsgSync {
  type: "SYNC";
  phase: GamePhase;
  currentQuestionIndex: number;
  timeRemainingMs: number;
  myScore: number;
  myStreak: number;
  hasAnswered: boolean;
  leaderboard: LeaderboardEntry[];
  currentQuestion?: WsMsgQuestionStart["question"];
}

export interface WsMsgLeaderboardUpdate {
  type: "LEADERBOARD_UPDATE";
  leaderboard: LeaderboardEntry[];
}

export interface WsMsgChatMessage {
  type: "CHAT_MESSAGE";
  playerId: string;
  nickname: string;
  message: string;
  sentAt: number;
}

export interface WsMsgGameEnded {
  type: "GAME_ENDED";
  finalLeaderboard: LeaderboardEntry[];
  totalQuestions: number;
  totalPlayers: number;
}

export interface WsMsgPing {
  type: "PING";
  ts: number;
}

export interface WsMsgPong {
  type: "PONG";
  ts: number;
}

export interface WsMsgError {
  type: "ERROR";
  code: string;
  message: string;
}

// ─── API response helpers ─────────────────────────────────────────────────────

export interface ApiResponse<T> {
  success: true;
  data: T;
}

export interface ApiError {
  success: false;
  error: string;
  code?: string;
}
