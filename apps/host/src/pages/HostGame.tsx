import { useState, useEffect, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { motion, AnimatePresence } from "framer-motion";
import { Users, Play, SkipForward, Trophy, BarChart3 } from "lucide-react";
import { useAuthStore } from "../store/authStore";
import QRCodeDisplay from "../components/QRCodeDisplay";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { GamePhase } from "@slyquiz/shared";
import type {
  WsMessage,
  WsMsgPlayerJoined,
  WsMsgQuestionStart,
  WsMsgQuestionEnd,
  WsMsgLeaderboardUpdate,
  WsMsgGameEnded,
  WsMsgSync,
  LeaderboardEntry,
} from "@slyquiz/shared";

interface PlayerInfo {
  id: string;
  nickname: string;
  avatarData: string | null;
}

const ANSWER_COLORS = ["#EF4444", "#3B82F6", "#EAB308", "#22C55E"];

export default function HostGame() {
  const { t } = useTranslation();
  const { pin } = useParams<{ pin: string }>();
  const navigate = useNavigate();
  const token = useAuthStore((s) => s.token);

  const wsRef = useRef<WebSocket | null>(null);
  const [phase, setPhase] = useState<GamePhase>(GamePhase.LOBBY);
  const [players, setPlayers] = useState<PlayerInfo[]>([]);
  const [currentQuestion, setCurrentQuestion] = useState<WsMsgQuestionStart | null>(null);
  const [questionResult, setQuestionResult] = useState<WsMsgQuestionEnd | null>(null);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [finalResult, setFinalResult] = useState<WsMsgGameEnded | null>(null);
  const [timeRemaining, setTimeRemaining] = useState(0);
  const [answerCounts, setAnswerCounts] = useState<Record<string, number>>({});
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Connect WebSocket as host
  useEffect(() => {
    if (!pin) return;
    const wsUrl = `${window.location.protocol === "https:" ? "wss" : "ws"}://${window.location.host}/api/games/${pin}/ws?isHost=true&token=${token}`;
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onmessage = (event) => {
      const msg = JSON.parse(event.data as string) as WsMessage;
      handleMessage(msg);
    };

    ws.onclose = () => {
      // Reconnect logic handled by the server
    };

    const pingInterval = setInterval(() => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: "PING", ts: Date.now() }));
      }
    }, 25_000);

    return () => {
      clearInterval(pingInterval);
      ws.close();
    };
  }, [pin, token]);

  function handleMessage(msg: WsMessage) {
    switch (msg.type) {
      case "PLAYER_JOINED": {
        const m = msg as WsMsgPlayerJoined;
        setPlayers((prev) => {
          if (prev.find((p) => p.id === m.playerId)) return prev;
          return [...prev, { id: m.playerId, nickname: m.nickname, avatarData: m.avatarData }];
        });
        break;
      }
      case "PLAYER_DISCONNECTED": {
        setPlayers((prev) => prev.filter((p) => p.id !== msg.playerId));
        break;
      }
      case "QUESTION_START": {
        const m = msg as WsMsgQuestionStart;
        setCurrentQuestion(m);
        setQuestionResult(null);
        setAnswerCounts({});
        setPhase(GamePhase.QUESTION);
        setTimeRemaining(m.question.timeLimit);

        if (timerRef.current) clearInterval(timerRef.current);
        timerRef.current = setInterval(() => {
          setTimeRemaining((t) => {
            if (t <= 1) {
              if (timerRef.current) clearInterval(timerRef.current);
              return 0;
            }
            return t - 1;
          });
        }, 1000);
        break;
      }
      case "LEADERBOARD_UPDATE": {
        const m = msg as WsMsgLeaderboardUpdate;
        setLeaderboard(m.leaderboard);
        // Track answer counts from leaderboard (derive from answered players)
        break;
      }
      case "ANSWER_ACK": {
        // Host gets ANSWER_ACK forwarded — update count display if needed
        break;
      }
      case "QUESTION_END": {
        const m = msg as WsMsgQuestionEnd;
        setQuestionResult(m);
        setLeaderboard(m.leaderboard);
        setAnswerCounts(m.answerCounts);
        setPhase(GamePhase.RESULTS);
        if (timerRef.current) clearInterval(timerRef.current);
        break;
      }
      case "GAME_ENDED": {
        const m = msg as WsMsgGameEnded;
        setFinalResult(m);
        setLeaderboard(m.finalLeaderboard);
        setPhase(GamePhase.ENDED);
        break;
      }
      case "SYNC": {
        const m = msg as WsMsgSync;
        setPhase(m.phase);
        setLeaderboard(m.leaderboard);
        break;
      }
      default:
        break;
    }
  }

  function sendToServer(msg: WsMessage) {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(msg));
    }
  }

  function startGame() {
    sendToServer({ type: "START_GAME" });
  }

  function nextQuestion() {
    sendToServer({ type: "NEXT_QUESTION" });
  }

  // Build bar chart data from answer counts
  const chartData = currentQuestion
    ? currentQuestion.question.answers.map((a, i) => ({
        name: a.text.slice(0, 20),
        count: answerCounts[a.id] ?? 0,
        fill: ANSWER_COLORS[i] ?? "#6EE7F7",
      }))
    : [];

  if (phase === GamePhase.ENDED && finalResult) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center p-6">
        <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="w-full max-w-2xl">
          <div className="text-center mb-8">
            <Trophy size={64} className="text-warning mx-auto mb-4" />
            <h1 className="text-3xl font-bold text-text-primary">{t("hostGame.finalResults")}</h1>
            <p className="text-text-secondary mt-2">{finalResult.totalQuestions} questions · {finalResult.totalPlayers} players</p>
          </div>

          <div className="space-y-3">
            {finalResult.finalLeaderboard.slice(0, 10).map((entry, i) => (
              <motion.div
                key={entry.playerId}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.08 }}
                className={`card flex items-center gap-4 ${i === 0 ? "border-warning/30 bg-warning/5" : ""}`}
              >
                <span className="text-2xl font-bold w-10 text-center text-text-muted">
                  {i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : `#${i + 1}`}
                </span>
                <span className="flex-1 font-semibold text-text-primary">{entry.nickname}</span>
                <span className="text-accent font-bold tabular-nums">{entry.score.toLocaleString()} pts</span>
              </motion.div>
            ))}
          </div>

          <div className="flex gap-3 mt-8 justify-center">
            <button onClick={() => navigate("/")} className="btn-secondary">
              Back to Dashboard
            </button>
          </div>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="bg-surface border-b border-white/5 px-6 py-4 flex items-center justify-between">
        <div>
          <p className="text-text-muted text-xs">{t("hostGame.pin")}</p>
          <p className="text-3xl font-bold tracking-widest text-accent font-mono">{pin}</p>
        </div>
        <div className="flex items-center gap-2 text-text-secondary">
          <Users size={18} />
          <span className="font-semibold text-text-primary">{players.length}</span>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* Main content */}
        <main className="flex-1 p-6 overflow-y-auto">
          <AnimatePresence mode="wait">
            {phase === GamePhase.LOBBY && (
              <motion.div
                key="lobby"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="flex flex-col items-center justify-center h-full gap-8"
              >
                <div className="text-center">
                  <p className="text-text-secondary mb-2">{t("hostGame.scanQr")}</p>
                  <p className="text-text-muted text-sm">{t("hostGame.joinUrl")}</p>
                </div>

                {pin && <QRCodeDisplay pin={pin} size={220} />}

                <div className="text-center">
                  <p className="text-text-primary font-semibold text-xl">
                    {t("hostGame.playersJoined", { count: players.length })}
                  </p>
                  <div className="flex flex-wrap gap-2 justify-center mt-4 max-w-lg">
                    {players.map((p) => (
                      <motion.span
                        key={p.id}
                        initial={{ opacity: 0, scale: 0.8 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="px-3 py-1 bg-surface-2 rounded-full text-sm text-text-primary"
                      >
                        {p.nickname}
                      </motion.span>
                    ))}
                  </div>
                </div>

                <button
                  onClick={startGame}
                  disabled={players.length === 0}
                  className="btn-primary flex items-center gap-3 text-lg px-8 py-3 disabled:opacity-40"
                >
                  <Play size={22} />
                  {t("hostGame.startGame")}
                </button>
              </motion.div>
            )}

            {phase === GamePhase.QUESTION && currentQuestion && (
              <motion.div
                key={`question-${currentQuestion.questionIndex}`}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="space-y-6"
              >
                <div className="flex items-center justify-between">
                  <p className="text-text-secondary">
                    {t("hostGame.question", {
                      current: currentQuestion.questionIndex + 1,
                      total: currentQuestion.totalQuestions,
                    })}
                  </p>
                  <div className="flex items-center gap-2">
                    <span className={`text-2xl font-bold tabular-nums ${timeRemaining <= 5 ? "text-error animate-pulse" : "text-accent"}`}>
                      {timeRemaining}s
                    </span>
                  </div>
                </div>

                <div className="card text-center">
                  <p className="text-2xl font-bold text-text-primary">{currentQuestion.question.text}</p>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  {currentQuestion.question.answers.map((a, i) => (
                    <div
                      key={a.id}
                      className="card flex items-center gap-3"
                      style={{ borderColor: `${ANSWER_COLORS[i]}40` }}
                    >
                      <div
                        className="w-4 h-4 rounded-sm flex-shrink-0"
                        style={{ backgroundColor: ANSWER_COLORS[i] }}
                      />
                      <span className="text-text-primary font-medium">{a.text}</span>
                      <span className="ml-auto text-text-muted font-bold tabular-nums">
                        {answerCounts[a.id] ?? 0}
                      </span>
                    </div>
                  ))}
                </div>

                {chartData.some((d) => d.count > 0) && (
                  <div className="card h-40">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={chartData}>
                        <XAxis dataKey="name" tick={{ fill: "#94A3B8", fontSize: 11 }} />
                        <YAxis tick={{ fill: "#94A3B8", fontSize: 11 }} />
                        <Tooltip
                          contentStyle={{ background: "#161B27", border: "1px solid #ffffff10", borderRadius: 8 }}
                          labelStyle={{ color: "#F1F5F9" }}
                        />
                        <Bar dataKey="count" fill="#6EE7F7" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </motion.div>
            )}

            {phase === GamePhase.RESULTS && questionResult && (
              <motion.div
                key="results"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="space-y-6"
              >
                <div className="card text-center border-success/20 bg-success/5">
                  <p className="text-text-secondary text-sm mb-1">{t("hostGame.correctAnswer")}</p>
                  <p className="text-xl font-bold text-success">{questionResult.correctAnswerText}</p>
                </div>

                <div className="card h-48">
                  <p className="text-sm text-text-secondary mb-2 flex items-center gap-2">
                    <BarChart3 size={14} /> Answer distribution
                  </p>
                  <ResponsiveContainer width="100%" height="85%">
                    <BarChart
                      data={currentQuestion?.question.answers.map((a, i) => ({
                        name: a.text.slice(0, 16),
                        count: questionResult.answerCounts[a.id] ?? 0,
                        fill: ANSWER_COLORS[i] ?? "#6EE7F7",
                        correct: a.id === questionResult.correctAnswerId,
                      }))}
                    >
                      <XAxis dataKey="name" tick={{ fill: "#94A3B8", fontSize: 11 }} />
                      <YAxis tick={{ fill: "#94A3B8", fontSize: 11 }} />
                      <Tooltip
                        contentStyle={{ background: "#161B27", border: "1px solid #ffffff10", borderRadius: 8 }}
                      />
                      <Bar dataKey="count" fill="#6EE7F7" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>

                <button
                  onClick={nextQuestion}
                  className="btn-primary w-full flex items-center justify-center gap-3 text-lg py-3"
                >
                  <SkipForward size={20} />
                  {t("hostGame.nextQuestion")}
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </main>

        {/* Leaderboard sidebar */}
        <aside className="w-64 bg-surface border-l border-white/5 flex flex-col">
          <div className="p-4 border-b border-white/5">
            <h3 className="font-semibold text-text-primary flex items-center gap-2">
              <Trophy size={16} className="text-warning" />
              {t("hostGame.leaderboard")}
            </h3>
          </div>
          <div className="flex-1 overflow-y-auto p-3 space-y-2">
            {leaderboard.slice(0, 15).map((entry, i) => (
              <div key={entry.playerId} className="flex items-center gap-2 text-sm">
                <span className="text-text-muted w-6 text-right">{i + 1}</span>
                <span className="flex-1 text-text-primary truncate">{entry.nickname}</span>
                <span className="text-accent font-bold tabular-nums text-xs">{entry.score.toLocaleString()}</span>
              </div>
            ))}
            {leaderboard.length === 0 && (
              <p className="text-text-muted text-xs text-center py-4">Waiting for answers...</p>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}
