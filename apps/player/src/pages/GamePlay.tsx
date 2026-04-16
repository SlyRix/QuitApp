import { useState, useCallback, useEffect, useRef } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { motion, AnimatePresence } from "framer-motion";
import { Wifi, WifiOff, Zap } from "lucide-react";
import { useGameSocket } from "../hooks/useGameSocket";
import { AvatarSVG } from "./AvatarBuilder";
import { GamePhase } from "@slyquiz/shared";
import type {
  WsMessage,
  WsMsgSync,
  WsMsgQuestionStart,
  WsMsgQuestionEnd,
  WsMsgGameEnded,
  WsMsgAnswerAck,
} from "@slyquiz/shared";
import type { AvatarConfig } from "./AvatarBuilder";

interface SessionState {
  playerId: string;
  sessionToken: string;
  sessionId: string;
  nickname: string;
  pin: string;
}

const ANSWERS = [
  { bg: "#f23f5d", dark: "#c02040", shape: "▲", label: "A" },
  { bg: "#3d7fff", dark: "#2657cc", shape: "◆", label: "B" },
  { bg: "#ffd426", dark: "#c4a010", shape: "●", label: "C" },
  { bg: "#00d483", dark: "#00a060", shape: "■", label: "D" },
];

function useCountUp(target: number, duration = 600) {
  const [value, setValue] = useState(target);
  const prev = useRef(target);
  useEffect(() => {
    if (target === prev.current) return;
    const start = prev.current;
    const diff = target - start;
    const steps = 20;
    const stepTime = duration / steps;
    let step = 0;
    const timer = setInterval(() => {
      step++;
      setValue(Math.round(start + diff * (step / steps)));
      if (step >= steps) { clearInterval(timer); prev.current = target; }
    }, stepTime);
    return () => clearInterval(timer);
  }, [target, duration]);
  return value;
}

export default function GamePlay() {
  const { t: _t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const session = location.state as SessionState | null;

  const [phase, setPhase] = useState<GamePhase>(GamePhase.LOBBY);
  const [currentQuestion, setCurrentQuestion] = useState<WsMsgQuestionStart | null>(null);
  const [questionResult, setQuestionResult] = useState<WsMsgQuestionEnd | null>(null);
  const [gameEnded, setGameEnded] = useState<WsMsgGameEnded | null>(null);
  const [myScore, setMyScore] = useState(0);
  const [myStreak, setMyStreak] = useState(0);
  const [myRank, setMyRank] = useState<number | null>(null);
  const [hasAnswered, setHasAnswered] = useState(false);
  const [selectedAnswerIdx, setSelectedAnswerIdx] = useState<number | null>(null);
  const [timeRemaining, setTimeRemaining] = useState(0);
  const [showLeaderboard, setShowLeaderboard] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const displayScore = useCountUp(myScore);

  const avatarRaw = localStorage.getItem("slyquiz_avatar");
  let avatarConfig: AvatarConfig | null = null;
  try { if (avatarRaw) avatarConfig = JSON.parse(avatarRaw) as AvatarConfig; } catch {}

  useEffect(() => {
    if (!session) navigate("/join", { replace: true });
  }, [session, navigate]);

  const handleMessage = useCallback((msg: WsMessage) => {
    switch (msg.type) {
      case "SYNC": {
        const m = msg as WsMsgSync;
        setPhase(m.phase);
        setMyScore(m.myScore);
        setMyStreak(m.myStreak);
        setHasAnswered(m.hasAnswered);
        const myEntry = m.leaderboard.find((e) => e.playerId === session?.playerId);
        if (myEntry) setMyRank(myEntry.rank);
        if (m.phase === GamePhase.QUESTION && m.currentQuestion) {
          setCurrentQuestion({
            type: "QUESTION_START",
            questionIndex: m.currentQuestionIndex,
            totalQuestions: m.totalQuestions,
            question: m.currentQuestion,
            startedAt: Date.now() - (m.currentQuestion.timeLimit * 1000 - m.timeRemainingMs),
          });
          setTimeRemaining(Math.ceil(m.timeRemainingMs / 1000));
        }
        break;
      }
      case "QUESTION_START": {
        const m = msg as WsMsgQuestionStart;
        setCurrentQuestion(m);
        setPhase(GamePhase.QUESTION);
        setHasAnswered(false);
        setSelectedAnswerIdx(null);
        setQuestionResult(null);
        setShowLeaderboard(false);
        setTimeRemaining(m.question.timeLimit);
        if (timerRef.current) clearInterval(timerRef.current);
        timerRef.current = setInterval(() => {
          setTimeRemaining((prev) => { if (prev <= 1) { clearInterval(timerRef.current!); return 0; } return prev - 1; });
        }, 1000);
        break;
      }
      case "ANSWER_ACK": {
        const m = msg as WsMsgAnswerAck;
        if (m.received) setHasAnswered(true);
        break;
      }
      case "QUESTION_END": {
        const m = msg as WsMsgQuestionEnd;
        setQuestionResult(m);
        setPhase(GamePhase.RESULTS);
        setMyScore(m.myScore);
        setMyStreak(m.myStreak);
        if (timerRef.current) clearInterval(timerRef.current);
        const myEntry = m.leaderboard.find((e) => e.playerId === session?.playerId);
        if (myEntry) setMyRank(myEntry.rank);
        break;
      }
      case "GAME_ENDED": {
        const m = msg as WsMsgGameEnded;
        setGameEnded(m);
        setPhase(GamePhase.ENDED);
        const myEntry = m.finalLeaderboard.find((e) => e.playerId === session?.playerId);
        if (myEntry) setMyRank(myEntry.rank);
        break;
      }
    }
  }, [session?.playerId]);

  const { connected, reconnecting, send } = useGameSocket({
    pin: session?.pin ?? "",
    sessionToken: session?.sessionToken ?? "",
    onMessage: handleMessage,
  });

  function submitAnswer(answerId: string, idx: number) {
    if (hasAnswered || !currentQuestion) return;
    setSelectedAnswerIdx(idx);
    send({ type: "ANSWER", answerId, responseTimeMs: Date.now() - currentQuestion.startedAt });
  }

  if (!session) return null;

  // ── GAME ENDED ──────────────────────────────────────────────────────────────
  if (phase === GamePhase.ENDED && gameEnded) {
    const myEntry = gameEnded.finalLeaderboard.find((e) => e.playerId === session.playerId);
    const rank = myEntry?.rank ?? 0;
    const podium = rank === 1 ? "🥇" : rank === 2 ? "🥈" : rank === 3 ? "🥉" : `#${rank}`;

    return (
      <div className="h-full bg-background flex flex-col items-center justify-center p-6 text-center overflow-y-auto">
        <motion.div
          initial={{ scale: 0.5, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: "spring", stiffness: 220, damping: 18 }}
          className="w-full max-w-sm space-y-6"
        >
          <div className="text-7xl">{podium}</div>
          <div>
            <h1 className="font-display font-black text-3xl text-text-primary">Game Over!</h1>
            <p className="text-text-secondary mt-1">{session.nickname}</p>
          </div>

          {avatarConfig && (
            <div className="flex justify-center">
              <AvatarSVG config={avatarConfig} size={100} />
            </div>
          )}

          <div className="card">
            <p className="text-text-muted text-xs uppercase tracking-widest font-semibold mb-1">Final Score</p>
            <p className="font-display font-black text-4xl" style={{ color: "#b8ff35" }}>
              {myEntry?.score.toLocaleString() ?? 0}
            </p>
            {rank <= 3 && (
              <p className="text-success text-sm mt-1 font-semibold">Top 3! Amazing!</p>
            )}
          </div>

          <div className="space-y-2">
            {gameEnded.finalLeaderboard.slice(0, 5).map((entry, i) => (
              <div
                key={entry.playerId}
                className="flex items-center gap-3 p-3 rounded-2xl"
                style={entry.playerId === session.playerId
                  ? { background: "rgba(184,255,53,0.1)", border: "1px solid rgba(184,255,53,0.25)" }
                  : { background: "rgba(255,255,255,0.04)" }}
              >
                <span className="text-base w-7">{i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : `#${i + 1}`}</span>
                <span className="flex-1 text-text-primary font-semibold text-sm">{entry.nickname}</span>
                <span className="font-mono font-bold text-sm" style={{ color: "#b8ff35" }}>{entry.score.toLocaleString()}</span>
              </div>
            ))}
          </div>

          <button
            onClick={() => { localStorage.removeItem("slyquiz_player_session"); navigate("/join"); }}
            className="btn-primary"
          >
            Play again ↩
          </button>
        </motion.div>
      </div>
    );
  }

  // ── LOBBY ───────────────────────────────────────────────────────────────────
  if (phase === GamePhase.LOBBY) {
    return (
      <div className="h-full bg-background flex flex-col items-center justify-center gap-6 p-6 text-center relative overflow-hidden">
        {/* Ambient orbs */}
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="absolute rounded-full opacity-30"
              style={{
                width: `${80 + i * 40}px`, height: `${80 + i * 40}px`,
                background: `radial-gradient(circle, ${["#b8ff35", "#38d9f5", "#ff4d6d"][i]} 0%, transparent 70%)`,
                left: `${[20, 70, 45][i]}%`, top: `${[20, 60, 80][i]}%`,
                animation: `float ${5 + i}s ease-in-out ${i * 1.5}s infinite`,
              }}
            />
          ))}
        </div>

        {avatarConfig && (
          <motion.div
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: "spring", stiffness: 260, damping: 20 }}
            className="relative"
          >
            <div className="absolute inset-0 rounded-full animate-ping" style={{ background: "rgba(184,255,53,0.15)", animationDuration: "2s" }} />
            <AvatarSVG config={avatarConfig} size={120} />
          </motion.div>
        )}

        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
          <h2 className="font-display font-black text-2xl text-text-primary">{session.nickname}</h2>
          <p className="text-text-secondary mt-2">Waiting for the host to start…</p>
        </motion.div>

        <div className="flex gap-2 mt-2">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="w-3 h-3 rounded-full"
              style={{ background: "#b8ff35", animation: `pulseDot 1.4s ease-in-out ${i * 0.22}s infinite` }}
            />
          ))}
        </div>

        <style>{`
          @keyframes pulseDot { 0%,100%{transform:scale(1);opacity:0.3} 50%{transform:scale(1.5);opacity:1} }
          @keyframes float { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-18px)} }
        `}</style>
      </div>
    );
  }

  // ── QUESTION ─────────────────────────────────────────────────────────────────
  if (phase === GamePhase.QUESTION && currentQuestion) {
    const q = currentQuestion.question;
    const timePct = q.timeLimit > 0 ? timeRemaining / q.timeLimit : 0;
    const isLow = timeRemaining <= 5;

    return (
      <div className="h-full bg-background flex flex-col relative overflow-hidden">
        {/* Timer bar */}
        <div className="absolute top-0 left-0 right-0 h-1 bg-surface-2 z-10">
          <motion.div
            className="h-full"
            style={{ background: isLow ? "#ff4d6d" : "#b8ff35", width: `${timePct * 100}%` }}
            transition={{ duration: 1, ease: "linear" }}
          />
        </div>

        {/* Status bar */}
        <div className="flex-none flex items-center justify-between px-4 pt-5 pb-3">
          <div className="flex items-center gap-1.5">
            {connected
              ? <Wifi size={12} style={{ color: "#00d483" }} />
              : <WifiOff size={12} className="text-coral animate-pulse" />}
            <span className="text-text-muted text-xs">{session.nickname}</span>
          </div>
          <div className="flex items-center gap-3">
            {myStreak >= 2 && (
              <div className="flex items-center gap-1 font-bold" style={{ color: "#ffd426" }}>
                <Zap size={12} fill="currentColor" />
                <span className="text-xs">{myStreak}x</span>
              </div>
            )}
            <div className="font-mono font-black text-lg" style={{ color: "#b8ff35" }}>
              {displayScore.toLocaleString()}
            </div>
          </div>
        </div>

        {/* Question info */}
        <div className="flex-none px-4 flex items-center justify-between mb-3">
          <span className="text-text-muted text-xs font-semibold">
            Q{currentQuestion.questionIndex + 1}/{currentQuestion.totalQuestions}
          </span>
          <span className={`font-mono font-black text-3xl ${isLow ? "text-coral" : "text-accent"}`} style={isLow ? { animation: "pulse 0.5s ease-in-out infinite" } : {}}>
            {timeRemaining}
          </span>
        </div>

        {/* Question text */}
        <div className="flex-none mx-4 mb-4 bg-surface-2 border border-white/6 rounded-2xl px-5 py-4 flex items-center justify-center min-h-[80px]">
          <p className="font-display font-bold text-lg text-text-primary text-center leading-snug">
            {q.text}
          </p>
        </div>

        {/* Answer buttons */}
        {hasAnswered ? (
          <div className="flex-1 flex flex-col items-center justify-center gap-4 px-4">
            <motion.div
              initial={{ scale: 0.3, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ type: "spring", stiffness: 300, damping: 18 }}
              className="text-6xl"
            >
              ✅
            </motion.div>
            <p className="font-display font-bold text-xl text-text-primary">Answer locked in!</p>
            <p className="text-text-muted text-sm">Waiting for results…</p>
          </div>
        ) : (
          <div className="flex-1 grid grid-cols-2 gap-3 px-4 pb-4 content-start">
            <AnimatePresence>
              {q.answers.map((answer, i) => {
                const style = ANSWERS[i] ?? ANSWERS[0]!;
                const isSelected = selectedAnswerIdx === i;
                return (
                  <motion.button
                    key={answer.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.06, ease: [0.16, 1, 0.3, 1] }}
                    onClick={() => submitAnswer(answer.id, i)}
                    disabled={hasAnswered}
                    className="answer-btn flex-col justify-center text-center rounded-2xl p-4"
                    style={{
                      background: style.bg,
                      outline: isSelected ? "3px solid white" : "none",
                      outlineOffset: "2px",
                    }}
                  >
                    <span className="text-2xl opacity-90 mb-1">{style.shape}</span>
                    <span className="text-sm font-bold leading-snug px-1">{answer.text}</span>
                  </motion.button>
                );
              })}
            </AnimatePresence>
          </div>
        )}
      </div>
    );
  }

  // ── RESULTS ──────────────────────────────────────────────────────────────────
  if (phase === GamePhase.RESULTS && questionResult) {
    const isCorrect = selectedAnswerIdx !== null &&
      currentQuestion?.question.answers[selectedAnswerIdx]?.id === questionResult.correctAnswerId;
    const pts = questionResult.pointsEarned;

    return (
      <div className="h-full bg-background flex flex-col items-center justify-center gap-5 p-6 overflow-y-auto">
        {/* Status */}
        <div className="flex items-center justify-between w-full text-xs">
          <div className="flex items-center gap-1.5">
            {connected ? <Wifi size={12} style={{ color: "#00d483" }} /> : <WifiOff size={12} className="text-coral" />}
            <span className="text-text-muted">{session.nickname}</span>
          </div>
          {myStreak >= 2 && (
            <div className="flex items-center gap-1 font-bold" style={{ color: "#ffd426" }}>
              <Zap size={12} fill="currentColor" /> {myStreak}x streak
            </div>
          )}
        </div>

        {/* Result icon */}
        <motion.div
          initial={{ scale: 0.3, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: "spring", stiffness: 280, damping: 16 }}
          className="text-7xl"
        >
          {isCorrect ? "✅" : "❌"}
        </motion.div>

        {/* Verdict */}
        <div className="text-center">
          <h2 className={`font-display font-black text-3xl ${isCorrect ? "text-success" : "text-coral"}`}>
            {isCorrect ? "Correct!" : "Wrong!"}
          </h2>
          {isCorrect && pts > 0 && (
            <motion.p
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.25 }}
              className="font-mono font-black text-2xl mt-1"
              style={{ color: "#ffd426" }}
            >
              +{pts.toLocaleString()} pts
            </motion.p>
          )}
          {!isCorrect && questionResult.correctAnswerText && (
            <p className="text-text-secondary text-sm mt-2">
              Correct: <span className="font-bold text-success">{questionResult.correctAnswerText}</span>
            </p>
          )}
        </div>

        {/* Score card */}
        <div className="card w-full">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-text-muted text-xs uppercase tracking-widest mb-0.5">Score</p>
              <p className="font-display font-black text-3xl" style={{ color: "#b8ff35" }}>
                {displayScore.toLocaleString()}
              </p>
            </div>
            {myRank && (
              <div className="text-right">
                <p className="text-text-muted text-xs uppercase tracking-widest mb-0.5">Rank</p>
                <p className="font-display font-black text-3xl text-text-primary">
                  {myRank === 1 ? "🥇" : myRank === 2 ? "🥈" : myRank === 3 ? "🥉" : `#${myRank}`}
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Leaderboard */}
        <button
          onClick={() => setShowLeaderboard(!showLeaderboard)}
          className="text-accent text-sm font-semibold flex items-center gap-1"
        >
          {showLeaderboard ? "Hide" : "Show"} leaderboard {showLeaderboard ? "↑" : "↓"}
        </button>

        <AnimatePresence>
          {showLeaderboard && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="w-full space-y-2 overflow-hidden"
            >
              {questionResult.leaderboard.slice(0, 5).map((entry, i) => (
                <div
                  key={entry.playerId}
                  className="flex items-center gap-2 text-sm p-2.5 rounded-xl"
                  style={entry.playerId === session.playerId
                    ? { background: "rgba(184,255,53,0.1)", border: "1px solid rgba(184,255,53,0.2)" }
                    : { background: "rgba(255,255,255,0.04)" }}
                >
                  <span className="text-text-muted w-6 text-center">{i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : `#${i + 1}`}</span>
                  <span className="flex-1 text-text-primary">{entry.nickname}</span>
                  <span className="font-mono font-bold text-xs" style={{ color: "#b8ff35" }}>{entry.score.toLocaleString()}</span>
                </div>
              ))}
            </motion.div>
          )}
        </AnimatePresence>

        <p className="text-text-muted text-sm">Waiting for next question…</p>
      </div>
    );
  }

  return (
    <div className="h-full bg-background flex items-center justify-center">
      <div className="text-center text-text-muted">
        <div className="text-4xl mb-3">⚡</div>
        <p>{reconnecting ? "Reconnecting…" : "Connecting…"}</p>
      </div>
    </div>
  );
}
