import { useState, useEffect, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { motion, AnimatePresence } from "framer-motion";
import { Users, Play, SkipForward, Trophy, BarChart3, Wifi, WifiOff } from "lucide-react";
import { useAuthStore } from "../store/authStore";
import QRCodeDisplay from "../components/QRCodeDisplay";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts";
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

const ANSWER_COLORS = ["#f23f5d", "#3d7fff", "#ffd426", "#00d483"];
const ANSWER_SHAPES = ["▲", "◆", "●", "■"];

export default function HostGame() {
  const { t: _t } = useTranslation();
  const { pin } = useParams<{ pin: string }>();
  const navigate = useNavigate();
  const token = useAuthStore((s) => s.token);

  const wsRef = useRef<WebSocket | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [connected, setConnected] = useState(false);
  const [phase, setPhase] = useState<GamePhase>(GamePhase.LOBBY);
  const [players, setPlayers] = useState<PlayerInfo[]>([]);
  const [currentQuestion, setCurrentQuestion] = useState<WsMsgQuestionStart | null>(null);
  const [questionResult, setQuestionResult] = useState<WsMsgQuestionEnd | null>(null);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [finalResult, setFinalResult] = useState<WsMsgGameEnded | null>(null);
  const [timeRemaining, setTimeRemaining] = useState(0);
  const [answerCounts, setAnswerCounts] = useState<Record<string, number>>({});


  useEffect(() => {
    if (!pin) return;
    const apiHost = import.meta.env.VITE_API_URL
      ? new URL(import.meta.env.VITE_API_URL).host
      : window.location.host;
    const wsProtocol = window.location.protocol === "https:" ? "wss" : "ws";
    const wsUrl = `${wsProtocol}://${apiHost}/api/games/${pin}/ws?isHost=true&token=${token}`;
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => setConnected(true);
    ws.onclose = () => setConnected(false);
    ws.onmessage = (event) => {
      const msg = JSON.parse(event.data as string) as WsMessage;
      handleMessage(msg);
    };

    const ping = setInterval(() => {
      if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ type: "PING", ts: Date.now() }));
    }, 25_000);

    return () => { clearInterval(ping); ws.close(); };
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
      case "SYNC": {
        const m = msg as WsMsgSync;
        setPhase(m.phase);
        setLeaderboard(m.leaderboard);
        break;
      }
      case "QUESTION_START": {
        const m = msg as WsMsgQuestionStart;
        setCurrentQuestion(m);
        setPhase(GamePhase.QUESTION);
        setQuestionResult(null);
        setAnswerCounts({});
        setTimeRemaining(m.question.timeLimit);
        if (timerRef.current) clearInterval(timerRef.current);
        timerRef.current = setInterval(() => {
          setTimeRemaining((prev) => { if (prev <= 1) { clearInterval(timerRef.current!); return 0; } return prev - 1; });
        }, 1000);
        break;
      }
      case "LEADERBOARD_UPDATE": {
        const m = msg as WsMsgLeaderboardUpdate;
        setLeaderboard(m.leaderboard);
        break;
      }
      case "QUESTION_END": {
        const m = msg as WsMsgQuestionEnd;
        setQuestionResult(m);
        setPhase(GamePhase.RESULTS);
        setLeaderboard(m.leaderboard);
        setAnswerCounts(m.answerCounts);
        if (timerRef.current) clearInterval(timerRef.current);
        break;
      }
      case "GAME_ENDED": {
        const m = msg as WsMsgGameEnded;
        setFinalResult(m);
        setPhase(GamePhase.ENDED);
        break;
      }
    }
  }

  function sendWs(msg: WsMessage) {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(msg));
    }
  }

  // ── GAME ENDED ─────────────────────────────────────────────────────────────
  if (phase === GamePhase.ENDED && finalResult) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center p-6">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="w-full max-w-2xl"
        >
          <div className="text-center mb-10">
            <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: "spring", delay: 0.2 }}
              className="text-7xl mb-4">🏆</motion.div>
            <h1 className="font-display font-black text-4xl text-text-primary mb-2">Game Over!</h1>
            <p className="text-text-secondary">{finalResult.totalPlayers} players • {finalResult.totalQuestions} questions</p>
          </div>

          <div className="space-y-3 mb-8">
            {finalResult.finalLeaderboard.slice(0, 10).map((entry, i) => (
              <motion.div
                key={entry.playerId}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.06 }}
                className="flex items-center gap-4 p-4 rounded-2xl bg-surface-2 border border-white/6"
                style={i === 0 ? { borderColor: "rgba(255,212,38,0.3)", background: "rgba(255,212,38,0.06)" } : {}}
              >
                <span className="font-display font-black text-xl w-8 text-center">
                  {i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : `#${i + 1}`}
                </span>
                <span className="flex-1 font-semibold text-text-primary">{entry.nickname}</span>
                <span className="font-mono font-bold text-lg" style={{ color: "#b8ff35" }}>
                  {entry.score.toLocaleString()}
                </span>
              </motion.div>
            ))}
          </div>

          <button onClick={() => navigate("/")} className="btn-primary w-full py-3.5 text-base">
            Back to Dashboard
          </button>
        </motion.div>
      </div>
    );
  }

  // ── LOBBY ──────────────────────────────────────────────────────────────────
  if (phase === GamePhase.LOBBY) {
    return (
      <div className="min-h-screen bg-background">
        <header className="border-b border-white/6 px-6 py-4 flex items-center justify-between">
          <h1 className="font-display font-black text-xl" style={{ color: "#b8ff35" }}>SlyQuiz</h1>
          <div className="flex items-center gap-2">
            {connected ? <Wifi size={14} className="text-success" /> : <WifiOff size={14} className="text-error animate-pulse" />}
            <span className="text-text-muted text-xs">{connected ? "Connected" : "Connecting…"}</span>
          </div>
        </header>

        <div className="max-w-5xl mx-auto px-6 py-8 grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Left — QR + PIN */}
          <div className="flex flex-col items-center gap-6">
            <div className="text-center">
              <p className="text-text-secondary text-sm mb-2 tracking-widest uppercase font-semibold">Game PIN</p>
              <div className="font-mono font-black text-6xl tracking-[0.15em]" style={{ color: "#b8ff35", textShadow: "0 0 30px rgba(184,255,53,0.4)" }}>
                {pin}
              </div>
            </div>

            <div style={{ boxShadow: "0 0 0 3px rgba(184,255,53,0.3), 0 0 0 6px rgba(184,255,53,0.1), 0 0 40px rgba(184,255,53,0.15)" }} className="rounded-3xl">
              <QRCodeDisplay pin={pin ?? ""} size={200} />
            </div>

            <p className="text-text-muted text-sm text-center">
              Scan or go to <span className="text-accent font-semibold">quiz-player.rushelwedsivani.com</span>
            </p>
          </div>

          {/* Right — Players + Start */}
          <div className="flex flex-col gap-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Users size={18} className="text-text-secondary" />
                <h2 className="font-display font-bold text-xl text-text-primary">
                  Players
                </h2>
                <span className="font-mono font-bold text-2xl ml-1" style={{ color: "#b8ff35" }}>
                  {players.length}
                </span>
              </div>
            </div>

            <div className="flex-1 min-h-[200px] max-h-[340px] overflow-y-auto rounded-2xl bg-surface-2 border border-white/6 p-3">
              {players.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center gap-3 text-center">
                  <div className="flex gap-2">
                    {[0, 1, 2].map((i) => (
                      <div key={i} className="w-2.5 h-2.5 rounded-full bg-accent animate-pulse-dot"
                           style={{ animationDelay: `${i * 0.2}s` }} />
                    ))}
                  </div>
                  <p className="text-text-muted text-sm">Waiting for players to join…</p>
                </div>
              ) : (
                <div className="flex flex-wrap gap-2">
                  <AnimatePresence>
                    {players.map((p, i) => (
                      <motion.div
                        key={p.id}
                        initial={{ opacity: 0, scale: 0.6 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ type: "spring", stiffness: 400, damping: 20 }}
                        className="flex items-center gap-2 px-3 py-1.5 bg-surface-3 rounded-xl border border-white/6 text-sm font-medium text-text-primary"
                      >
                        <span className="font-mono text-xs text-text-muted">#{i + 1}</span>
                        {p.nickname}
                      </motion.div>
                    ))}
                  </AnimatePresence>
                </div>
              )}
            </div>

            <button
              onClick={() => sendWs({ type: "START_GAME" })}
              disabled={players.length === 0 || !connected}
              className="btn-primary py-4 text-base w-full gap-3"
            >
              <Play size={18} fill="currentColor" />
              Start Game ({players.length} player{players.length !== 1 ? "s" : ""})
            </button>
          </div>
        </div>

        <style>{`
          @keyframes pulse-dot {
            0%, 100% { transform: scale(1); opacity: 0.4; }
            50% { transform: scale(1.4); opacity: 1; }
          }
          .animate-pulse-dot { animation: pulse-dot 1.4s ease-in-out infinite; }
        `}</style>
      </div>
    );
  }

  // ── QUESTION ───────────────────────────────────────────────────────────────
  if (phase === GamePhase.QUESTION && currentQuestion) {
    const q = currentQuestion.question;
    const timePct = (timeRemaining / q.timeLimit) * 100;
    const answeredCount = Object.values(answerCounts).reduce((s, v) => s + v, 0);

    return (
      <div className="min-h-screen bg-background flex flex-col">
        {/* Timer bar */}
        <div className="h-1.5 bg-surface-2 relative">
          <motion.div
            className="absolute left-0 top-0 h-full"
            style={{
              background: timePct > 50 ? "#b8ff35" : timePct > 20 ? "#ffd426" : "#ff4d6d",
              width: `${timePct}%`,
            }}
            transition={{ duration: 1, ease: "linear" }}
          />
        </div>

        <div className="flex-1 max-w-5xl mx-auto w-full px-6 py-6 grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main question area */}
          <div className="lg:col-span-2 flex flex-col gap-5">
            {/* Question header */}
            <div className="flex items-center justify-between">
              <span className="text-text-muted text-sm font-semibold">
                Question {currentQuestion.questionIndex + 1} / {currentQuestion.totalQuestions}
              </span>
              <div className="flex items-center gap-2">
                <span className="text-text-muted text-sm">{answeredCount} answered</span>
                <span className={`font-mono font-black text-3xl ${timeRemaining <= 5 ? "text-coral animate-pulse" : "text-accent"}`}>
                  {timeRemaining}s
                </span>
              </div>
            </div>

            {/* Question text */}
            <div className="bg-surface-2 border border-white/6 rounded-2xl p-6 flex-1 flex items-center justify-center">
              <p className="font-display font-bold text-2xl text-text-primary text-center leading-snug">
                {q.text}
              </p>
            </div>

            {/* Answer grid preview */}
            <div className="grid grid-cols-2 gap-3">
              {q.answers.map((a, i) => (
                <div
                  key={a.id}
                  className="flex items-center gap-3 px-4 py-3 rounded-xl font-semibold text-white text-sm"
                  style={{ background: ANSWER_COLORS[i] ?? ANSWER_COLORS[0] }}
                >
                  <span className="text-lg opacity-80">{ANSWER_SHAPES[i]}</span>
                  <span className="flex-1 truncate">{a.text}</span>
                  <span className="font-mono text-white/70 text-xs">
                    {answerCounts[a.id] ?? 0}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Live leaderboard sidebar */}
          <div className="bg-surface-2 border border-white/6 rounded-2xl p-4">
            <div className="flex items-center gap-2 mb-4">
              <Trophy size={14} className="text-gold" />
              <h3 className="font-display font-bold text-text-primary text-sm">Live Leaderboard</h3>
            </div>
            <div className="space-y-2">
              {leaderboard.slice(0, 8).map((entry, i) => (
                <div key={entry.playerId} className="flex items-center gap-2 text-sm">
                  <span className="font-mono text-text-muted w-5 text-right shrink-0">
                    {i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : `#${i + 1}`}
                  </span>
                  <span className="flex-1 text-text-primary truncate">{entry.nickname}</span>
                  <span className="font-mono text-xs text-accent">{entry.score.toLocaleString()}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ── RESULTS ────────────────────────────────────────────────────────────────
  if (phase === GamePhase.RESULTS && questionResult) {
    const correctAnswer = currentQuestion?.question.answers.find(
      (a) => a.id === questionResult.correctAnswerId
    );
    const chartData = currentQuestion?.question.answers.map((a, i) => ({
      name: a.text.slice(0, 20),
      count: answerCounts[a.id] ?? 0,
      color: ANSWER_COLORS[i] ?? ANSWER_COLORS[0]!,
      isCorrect: a.id === questionResult.correctAnswerId,
    })) ?? [];

    return (
      <div className="min-h-screen bg-background flex flex-col">
        <div className="flex-1 max-w-5xl mx-auto w-full px-6 py-6 grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 flex flex-col gap-5">
            {/* Correct answer banner */}
            <motion.div
              initial={{ opacity: 0, y: -12 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex items-center gap-3 px-5 py-4 rounded-2xl"
              style={{ background: "rgba(0,212,131,0.12)", border: "1px solid rgba(0,212,131,0.3)" }}
            >
              <span className="text-2xl">✅</span>
              <div>
                <p className="text-xs text-success/80 font-semibold uppercase tracking-widest mb-0.5">Correct Answer</p>
                <p className="font-display font-bold text-text-primary">{correctAnswer?.text ?? "—"}</p>
              </div>
            </motion.div>

            {/* Bar chart */}
            <div className="bg-surface-2 border border-white/6 rounded-2xl p-5 flex-1">
              <div className="flex items-center gap-2 mb-4">
                <BarChart3 size={14} className="text-text-secondary" />
                <h3 className="font-display font-bold text-text-primary text-sm">Answer Distribution</h3>
              </div>
              <ResponsiveContainer width="100%" height={180}>
                <BarChart data={chartData} margin={{ top: 4, right: 4, bottom: 4, left: -20 }}>
                  <XAxis dataKey="name" tick={{ fill: "#6879a0", fontSize: 11 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: "#6879a0", fontSize: 11 }} axisLine={false} tickLine={false} />
                  <Tooltip
                    contentStyle={{ background: "#131822", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 12, fontSize: 12 }}
                    cursor={{ fill: "rgba(255,255,255,0.04)" }}
                  />
                  <Bar dataKey="count" radius={[6, 6, 0, 0]}>
                    {chartData.map((d, i) => <Cell key={i} fill={d.isCorrect ? "#00d483" : d.color} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>

            <button
              onClick={() => sendWs({ type: "NEXT_QUESTION" })}
              className="btn-primary py-4 text-base w-full gap-3"
            >
              <SkipForward size={18} />
              {currentQuestion && currentQuestion.questionIndex + 1 >= currentQuestion.totalQuestions
                ? "Show Final Results"
                : "Next Question"}
            </button>
          </div>

          {/* Leaderboard */}
          <div className="bg-surface-2 border border-white/6 rounded-2xl p-4">
            <div className="flex items-center gap-2 mb-4">
              <Trophy size={14} className="text-gold" />
              <h3 className="font-display font-bold text-text-primary text-sm">Leaderboard</h3>
            </div>
            <div className="space-y-2">
              {leaderboard.slice(0, 10).map((entry, i) => (
                <motion.div
                  key={entry.playerId}
                  initial={{ opacity: 0, x: 12 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.04 }}
                  className="flex items-center gap-2 text-sm p-2 rounded-xl"
                  style={i === 0 ? { background: "rgba(255,212,38,0.08)", border: "1px solid rgba(255,212,38,0.2)" } : {}}
                >
                  <span className="font-mono text-text-muted w-6 text-center shrink-0">
                    {i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : `#${i + 1}`}
                  </span>
                  <span className="flex-1 text-text-primary truncate">{entry.nickname}</span>
                  <span className="font-mono text-xs text-accent">{entry.score.toLocaleString()}</span>
                </motion.div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <div className="text-text-muted">Loading…</div>
    </div>
  );
}
