import type { DurableObjectState } from "@cloudflare/workers-types";
import type { Env } from "../types";
import type {
  WsMessage,
  GamePhase,
  LeaderboardEntry,
  QuestionType,
} from "@kahootplus/shared";

interface PlayerState {
  id: string;
  nickname: string;
  avatarData: string | null;
  sessionToken: string;
  score: number;
  streak: number;
  status: "connected" | "disconnected";
  ws: WebSocket | null;
  hasAnswered: boolean;
  lastAnswerQuestionId: string | null;
}

interface QuestionData {
  id: string;
  type: QuestionType;
  text: string;
  mediaUrl: string | null;
  timeLimit: number;
  points: number;
  orderIndex: number;
  answers: Array<{ id: string; text: string; isCorrect: boolean; orderIndex: number }>;
}

interface ChatMessage {
  playerId: string;
  nickname: string;
  message: string;
  sentAt: number;
}

interface GameState {
  phase: GamePhase;
  sessionId: string;
  quizId: string;
  questions: QuestionData[];
  currentQuestionIndex: number;
  questionStartedAt: number;
  scores: Record<string, number>;
  answerCounts: Record<string, Record<string, number>>;
  chatMessages: ChatMessage[];
  hostConnected: boolean;
}

export class GameRoom {
  private state: DurableObjectState;
  private env: Env;
  private players: Map<string, PlayerState> = new Map();
  private gameState: GameState = {
    phase: "lobby" as GamePhase,
    sessionId: "",
    quizId: "",
    questions: [],
    currentQuestionIndex: -1,
    questionStartedAt: 0,
    scores: {},
    answerCounts: {},
    chatMessages: [],
    hostConnected: false,
  };
  private hostWs: WebSocket | null = null;
  private initialized = false;

  constructor(state: DurableObjectState, env: Env) {
    this.state = state;
    this.env = env;
  }

  private async initialize(): Promise<void> {
    if (this.initialized) return;
    const stored = await this.state.storage.get<GameState>("gameState");
    if (stored) {
      this.gameState = stored;
    }
    const storedPlayers = await this.state.storage.get<Array<Omit<PlayerState, "ws">>>("players");
    if (storedPlayers) {
      for (const p of storedPlayers) {
        this.players.set(p.id, { ...p, ws: null });
      }
    }
    this.initialized = true;
  }

  private async persistState(): Promise<void> {
    await this.state.storage.put("gameState", this.gameState);
    const persistablePlayers = Array.from(this.players.values()).map(({ ws: _ws, ...rest }) => rest);
    await this.state.storage.put("players", persistablePlayers);
  }

  private broadcast(message: WsMessage, excludePlayerId?: string): void {
    const payload = JSON.stringify(message);
    if (this.hostWs && this.hostWs.readyState === WebSocket.OPEN) {
      try { this.hostWs.send(payload); } catch { /* ignore */ }
    }
    for (const [id, player] of this.players) {
      if (id === excludePlayerId) continue;
      if (player.ws && player.ws.readyState === WebSocket.OPEN) {
        try { player.ws.send(payload); } catch { /* ignore */ }
      }
    }
  }

  private sendToPlayer(playerId: string, message: WsMessage): void {
    const player = this.players.get(playerId);
    if (player?.ws && player.ws.readyState === WebSocket.OPEN) {
      try { player.ws.send(JSON.stringify(message)); } catch { /* ignore */ }
    }
  }

  private sendToHost(message: WsMessage): void {
    if (this.hostWs && this.hostWs.readyState === WebSocket.OPEN) {
      try { this.hostWs.send(JSON.stringify(message)); } catch { /* ignore */ }
    }
  }

  private buildLeaderboard(): LeaderboardEntry[] {
    const entries = Array.from(this.players.values())
      .map((p) => ({
        playerId: p.id,
        nickname: p.nickname,
        avatarData: p.avatarData,
        score: p.score,
        streak: p.streak,
        rank: 0,
      }))
      .sort((a, b) => b.score - a.score);

    let rank = 1;
    for (let i = 0; i < entries.length; i++) {
      if (i > 0 && entries[i]!.score < entries[i - 1]!.score) rank = i + 1;
      entries[i]!.rank = rank;
    }
    return entries;
  }

  private async loadQuestions(): Promise<void> {
    if (this.gameState.questions.length > 0) return;

    const result = await this.env.DB.prepare(
      `SELECT q.id, q.type, q.text, q.media_url, q.time_limit, q.points, q.order_index,
              a.id as answer_id, a.text as answer_text, a.is_correct, a.order_index as answer_order
       FROM questions q
       LEFT JOIN answer_options a ON a.question_id = q.id
       WHERE q.quiz_id = ?
       ORDER BY q.order_index, a.order_index`
    )
      .bind(this.gameState.quizId)
      .all<{
        id: string;
        type: string;
        text: string;
        media_url: string | null;
        time_limit: number;
        points: number;
        order_index: number;
        answer_id: string;
        answer_text: string;
        is_correct: number;
        answer_order: number;
      }>();

    const questionsMap = new Map<string, QuestionData>();
    for (const row of result.results) {
      if (!questionsMap.has(row.id)) {
        questionsMap.set(row.id, {
          id: row.id,
          type: row.type as QuestionType,
          text: row.text,
          mediaUrl: row.media_url,
          timeLimit: row.time_limit,
          points: row.points,
          orderIndex: row.order_index,
          answers: [],
        });
      }
      if (row.answer_id) {
        questionsMap.get(row.id)!.answers.push({
          id: row.answer_id,
          text: row.answer_text,
          isCorrect: row.is_correct === 1,
          orderIndex: row.answer_order,
        });
      }
    }

    this.gameState.questions = Array.from(questionsMap.values()).sort(
      (a, b) => a.orderIndex - b.orderIndex
    );
    await this.persistState();
  }

  private async startQuestion(index: number): Promise<void> {
    const question = this.gameState.questions[index];
    if (!question) return;

    this.gameState.phase = "question" as GamePhase;
    this.gameState.currentQuestionIndex = index;
    this.gameState.questionStartedAt = Date.now();
    this.gameState.answerCounts[question.id] = {};

    for (const player of this.players.values()) {
      player.hasAnswered = false;
      player.lastAnswerQuestionId = null;
    }

    await this.persistState();

    const msg: WsMessage = {
      type: "QUESTION_START",
      questionIndex: index,
      totalQuestions: this.gameState.questions.length,
      question: {
        id: question.id,
        type: question.type,
        text: question.text,
        mediaUrl: question.mediaUrl,
        timeLimit: question.timeLimit,
        points: question.points,
        answers: question.answers.map((a) => ({ id: a.id, text: a.text })),
      },
      startedAt: this.gameState.questionStartedAt,
    };

    this.broadcast(msg);

    // Auto-end question after timeLimit
    await this.state.storage.setAlarm(
      Date.now() + question.timeLimit * 1000 + 500
    );
  }

  private async endQuestion(): Promise<void> {
    const index = this.gameState.currentQuestionIndex;
    const question = this.gameState.questions[index];
    if (!question) return;

    this.gameState.phase = "results" as GamePhase;
    const correctAnswer = question.answers.find((a) => a.isCorrect);
    const leaderboard = this.buildLeaderboard();

    const msg: WsMessage = {
      type: "QUESTION_END",
      questionId: question.id,
      correctAnswerId: correctAnswer?.id ?? null,
      correctAnswerText: correctAnswer?.text ?? null,
      pointsEarned: 0,
      myScore: 0,
      myStreak: 0,
      leaderboard,
      answerCounts: this.gameState.answerCounts[question.id] ?? {},
    };

    // Send personalized QUESTION_END to each player
    for (const player of this.players.values()) {
      const personalMsg: WsMessage = {
        ...msg,
        pointsEarned: player.score - (this.gameState.scores[player.id] ?? 0),
        myScore: player.score,
        myStreak: player.streak,
      };
      this.sendToPlayer(player.id, personalMsg);
    }
    this.sendToHost(msg);

    // Save current scores as baseline for next question
    for (const player of this.players.values()) {
      this.gameState.scores[player.id] = player.score;
    }

    await this.persistState();
  }

  async fetch(request: Request): Promise<Response> {
    await this.initialize();

    const url = new URL(request.url);
    const sessionId = url.searchParams.get("sessionId") ?? "";
    const quizId = url.searchParams.get("quizId") ?? "";

    if (sessionId && !this.gameState.sessionId) {
      this.gameState.sessionId = sessionId;
      this.gameState.quizId = quizId;
      await this.persistState();
    }

    const upgradeHeader = request.headers.get("Upgrade");
    if (!upgradeHeader || upgradeHeader.toLowerCase() !== "websocket") {
      return new Response("Expected WebSocket", { status: 426 });
    }

    const pair = new WebSocketPair();
    const [client, server] = Object.values(pair) as [WebSocket, WebSocket];
    this.state.acceptWebSocket(server);

    const sessionToken = url.searchParams.get("sessionToken");
    const isHost = url.searchParams.get("isHost") === "true";

    if (isHost) {
      this.hostWs = server;
      this.gameState.hostConnected = true;
      await this.persistState();

      server.addEventListener("message", async (event) => {
        await this.handleHostMessage(server, event.data as string);
      });
      server.addEventListener("close", async () => {
        this.hostWs = null;
        this.gameState.hostConnected = false;
        await this.persistState();
      });
    } else if (sessionToken) {
      await this.handlePlayerConnect(server, sessionToken);
    } else {
      server.close(4001, "Missing sessionToken or isHost");
      return new Response(null, { status: 101, webSocket: client });
    }

    return new Response(null, { status: 101, webSocket: client });
  }

  private async handlePlayerConnect(ws: WebSocket, sessionToken: string): Promise<void> {
    // Look up player by session token from DB
    const row = await this.env.DB.prepare(
      "SELECT id, nickname, avatar_data, score, streak FROM game_players WHERE session_token = ? AND session_id = ?"
    )
      .bind(sessionToken, this.gameState.sessionId)
      .first<{ id: string; nickname: string; avatar_data: string | null; score: number; streak: number }>();

    if (!row) {
      ws.close(4002, "Invalid session token");
      return;
    }

    const existing = this.players.get(row.id);
    if (existing) {
      // Rejoin — restore state
      existing.ws = ws;
      existing.status = "connected";
      existing.score = row.score;
      existing.streak = row.streak;

      // Send SYNC
      const currentQuestion = this.gameState.questions[this.gameState.currentQuestionIndex];
      const timeRemainingMs =
        this.gameState.phase === "question" && currentQuestion
          ? Math.max(0, currentQuestion.timeLimit * 1000 - (Date.now() - this.gameState.questionStartedAt))
          : 0;

      const syncMsg: WsMessage = {
        type: "SYNC",
        phase: this.gameState.phase,
        currentQuestionIndex: this.gameState.currentQuestionIndex,
        timeRemainingMs,
        myScore: existing.score,
        myStreak: existing.streak,
        hasAnswered: existing.hasAnswered,
        leaderboard: this.buildLeaderboard(),
        currentQuestion:
          this.gameState.phase === "question" && currentQuestion
            ? {
                id: currentQuestion.id,
                type: currentQuestion.type,
                text: currentQuestion.text,
                mediaUrl: currentQuestion.mediaUrl,
                timeLimit: currentQuestion.timeLimit,
                points: currentQuestion.points,
                answers: currentQuestion.answers.map((a) => ({ id: a.id, text: a.text })),
              }
            : undefined,
      };
      ws.send(JSON.stringify(syncMsg));

      this.broadcast({ type: "PLAYER_JOINED", playerId: row.id, nickname: row.nickname, avatarData: row.avatar_data, totalPlayers: this.players.size }, row.id);
    } else {
      // New join
      const player: PlayerState = {
        id: row.id,
        nickname: row.nickname,
        avatarData: row.avatar_data,
        sessionToken,
        score: row.score,
        streak: row.streak,
        status: "connected",
        ws,
        hasAnswered: false,
        lastAnswerQuestionId: null,
      };
      this.players.set(row.id, player);
      this.gameState.scores[row.id] = row.score;

      const ackMsg: WsMessage = {
        type: "JOIN_ACK",
        playerId: row.id,
        nickname: row.nickname,
        score: row.score,
        streak: row.streak,
      };
      ws.send(JSON.stringify(ackMsg));

      this.broadcast(
        { type: "PLAYER_JOINED", playerId: row.id, nickname: row.nickname, avatarData: row.avatar_data, totalPlayers: this.players.size },
        row.id
      );
    }

    ws.addEventListener("message", async (event) => {
      await this.handlePlayerMessage(ws, row.id, event.data as string);
    });

    ws.addEventListener("close", async () => {
      const p = this.players.get(row.id);
      if (p) {
        p.status = "disconnected";
        p.ws = null;
      }
      this.broadcast({ type: "PLAYER_DISCONNECTED", playerId: row.id, nickname: row.nickname });
      // Set alarm for 60s cleanup
      await this.state.storage.setAlarm(Date.now() + 60_000);
      await this.persistState();
    });
  }

  private async handlePlayerMessage(ws: WebSocket, playerId: string, raw: string): Promise<void> {
    let msg: WsMessage;
    try {
      msg = JSON.parse(raw) as WsMessage;
    } catch {
      ws.send(JSON.stringify({ type: "ERROR", code: "PARSE_ERROR", message: "Invalid JSON" } satisfies WsMessage));
      return;
    }

    const player = this.players.get(playerId);
    if (!player) return;

    switch (msg.type) {
      case "ANSWER": {
        if (this.gameState.phase !== "question") {
          ws.send(JSON.stringify({ type: "ERROR", code: "NOT_IN_QUESTION", message: "No active question" } satisfies WsMessage));
          return;
        }
        if (player.hasAnswered) {
          ws.send(JSON.stringify({ type: "ERROR", code: "ALREADY_ANSWERED", message: "Already answered" } satisfies WsMessage));
          return;
        }

        const question = this.gameState.questions[this.gameState.currentQuestionIndex];
        if (!question) return;

        player.hasAnswered = true;
        player.lastAnswerQuestionId = question.id;

        const responseTimeMs = Date.now() - this.gameState.questionStartedAt;
        const correctAnswer = question.answers.find((a) => a.isCorrect);
        const isCorrect = correctAnswer?.id === msg.answerId;

        let pointsEarned = 0;
        if (isCorrect) {
          const timeRatio = Math.max(0, 1 - responseTimeMs / (question.timeLimit * 1000));
          pointsEarned = Math.round(question.points * (0.5 + 0.5 * timeRatio));
          player.score += pointsEarned;
          player.streak += 1;
        } else {
          player.streak = 0;
        }

        // Track answer counts
        if (!this.gameState.answerCounts[question.id]) {
          this.gameState.answerCounts[question.id] = {};
        }
        const counts = this.gameState.answerCounts[question.id]!;
        counts[msg.answerId] = (counts[msg.answerId] ?? 0) + 1;

        // Persist to DB
        await this.env.DB.prepare(
          "INSERT INTO game_answers (id, session_id, player_id, question_id, answer_id, response_time_ms, points_earned, answered_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)"
        )
          .bind(crypto.randomUUID(), this.gameState.sessionId, playerId, question.id, msg.answerId, responseTimeMs, pointsEarned, Date.now())
          .run();

        await this.env.DB.prepare(
          "UPDATE game_players SET score = ?, streak = ? WHERE id = ?"
        )
          .bind(player.score, player.streak, playerId)
          .run();

        ws.send(JSON.stringify({ type: "ANSWER_ACK", received: true, responseTimeMs } satisfies WsMessage));

        // Notify host of leaderboard update
        this.sendToHost({ type: "LEADERBOARD_UPDATE", leaderboard: this.buildLeaderboard() });

        // Check if all players answered
        const allAnswered = Array.from(this.players.values()).every(
          (p) => p.hasAnswered || p.status === "disconnected"
        );
        if (allAnswered) {
          await this.endQuestion();
        }

        await this.persistState();
        break;
      }

      case "CHAT_MESSAGE": {
        const chatMsg: WsMessage = {
          type: "CHAT_MESSAGE",
          playerId,
          nickname: player.nickname,
          message: msg.message.slice(0, 200),
          sentAt: Date.now(),
        };
        this.gameState.chatMessages.push({
          playerId,
          nickname: player.nickname,
          message: msg.message.slice(0, 200),
          sentAt: chatMsg.sentAt,
        });
        this.broadcast(chatMsg);
        break;
      }

      case "PING": {
        ws.send(JSON.stringify({ type: "PONG", ts: msg.ts } satisfies WsMessage));
        break;
      }

      default:
        break;
    }
  }

  private async handleHostMessage(ws: WebSocket, raw: string): Promise<void> {
    let msg: WsMessage;
    try {
      msg = JSON.parse(raw) as WsMessage;
    } catch {
      ws.send(JSON.stringify({ type: "ERROR", code: "PARSE_ERROR", message: "Invalid JSON" } satisfies WsMessage));
      return;
    }

    switch (msg.type) {
      case "START_GAME": {
        if (this.gameState.phase !== "lobby") {
          ws.send(JSON.stringify({ type: "ERROR", code: "ALREADY_STARTED", message: "Game already started" } satisfies WsMessage));
          return;
        }

        await this.loadQuestions();

        if (this.gameState.questions.length === 0) {
          ws.send(JSON.stringify({ type: "ERROR", code: "NO_QUESTIONS", message: "Quiz has no questions" } satisfies WsMessage));
          return;
        }

        await this.env.DB.prepare("UPDATE game_sessions SET status = 'question' WHERE id = ?")
          .bind(this.gameState.sessionId)
          .run();

        await this.startQuestion(0);
        break;
      }

      case "NEXT_QUESTION": {
        if (this.gameState.phase !== "results") {
          ws.send(JSON.stringify({ type: "ERROR", code: "NOT_IN_RESULTS", message: "Not in results phase" } satisfies WsMessage));
          return;
        }

        const nextIndex = this.gameState.currentQuestionIndex + 1;
        if (nextIndex >= this.gameState.questions.length) {
          // End game
          this.gameState.phase = "ended" as GamePhase;
          await this.persistState();

          await this.env.DB.prepare("UPDATE game_sessions SET status = 'ended', ended_at = ? WHERE id = ?")
            .bind(Date.now(), this.gameState.sessionId)
            .run();

          const finalLeaderboard = this.buildLeaderboard();
          this.broadcast({
            type: "GAME_ENDED",
            finalLeaderboard,
            totalQuestions: this.gameState.questions.length,
            totalPlayers: this.players.size,
          });
        } else {
          await this.startQuestion(nextIndex);
        }
        break;
      }

      case "PING": {
        ws.send(JSON.stringify({ type: "PONG", ts: msg.ts } satisfies WsMessage));
        break;
      }

      default:
        break;
    }
  }

  async alarm(): Promise<void> {
    // Triggered after question timeLimit or after 60s disconnect grace period
    if (this.gameState.phase === "question") {
      await this.endQuestion();
    }

    // Clean up long-disconnected players from in-memory map
    for (const [id, player] of this.players) {
      if (player.status === "disconnected") {
        this.players.delete(id);
      }
    }

    await this.persistState();
  }
}
