import { useState, useCallback, useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { motion, AnimatePresence } from "framer-motion";
import { Wifi, WifiOff, Trophy, Zap } from "lucide-react";
import { useGameSocket } from "../hooks/useGameSocket";
import { AvatarSVG } from "./AvatarBuilder";
import { GamePhase } from "@kahootplus/shared";
import type {
  WsMessage,
  WsMsgSync,
  WsMsgQuestionStart,
  WsMsgQuestionEnd,
  WsMsgGameEnded,
  WsMsgAnswerAck,
} from "@kahootplus/shared";
import type { AvatarConfig } from "./AvatarBuilder";

interface SessionState {
  playerId: string;
  sessionToken: string;
  sessionId: string;
  nickname: string;
  pin: string;
}

const ANSWER_COLORS = [
  { bg: "bg-red-500 active:bg-red-600", border: "border-red-400", shape: "▲" },
  { bg: "bg-blue-500 active:bg-blue-600", border: "border-blue-400", shape: "◆" },
  { bg: "bg-yellow-500 active:bg-yellow-600", border: "border-yellow-400", shape: "●" },
  { bg: "bg-green-500 active:bg-green-600", border: "border-green-400", shape: "■" },
];

export default function GamePlay() {
  const { t } = useTranslation();
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
  const [selectedAnswerId, setSelectedAnswerId] = useState<string | null>(null);
  const [timeRemaining, setTimeRemaining] = useState(0);
  const [showLeaderboard, setShowLeaderboard] = useState(false);

  const avatarRaw = localStorage.getItem("kahootplus_avatar");
  let avatarConfig: AvatarConfig | null = null;
  try {
    if (avatarRaw) avatarConfig = JSON.parse(avatarRaw) as AvatarConfig;
  } catch { /* ignore */ }

  // Redirect if no session
  useEffect(() => {
    if (!session) {
      navigate("/join", { replace: true });
    }
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
            totalQuestions: m.leaderboard.length,
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
        setSelectedAnswerId(null);
        setQuestionResult(null);
        setShowLeaderboard(false);
        setTimeRemaining(m.question.timeLimit);

        const interval = setInterval(() => {
          setTimeRemaining((t) => {
            if (t <= 1) { clearInterval(interval); return 0; }
            return t - 1;
          });
        }, 1000);
        break;
      }
      case "ANSWER_ACK": {
        const m = msg as WsMsgAnswerAck;
        if (m.received) {
          setHasAnswered(true);
        }
        break;
      }
      case "QUESTION_END": {
        const m = msg as WsMsgQuestionEnd;
        setQuestionResult(m);
        setPhase(GamePhase.RESULTS);
        setMyScore(m.myScore);
        setMyStreak(m.myStreak);
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
      default:
        break;
    }
  }, [session?.playerId]);

  const { connected, reconnecting, send } = useGameSocket({
    pin: session?.pin ?? "",
    sessionToken: session?.sessionToken ?? "",
    onMessage: handleMessage,
  });

  function submitAnswer(answerId: string) {
    if (hasAnswered || !currentQuestion) return;
    setSelectedAnswerId(answerId);
    const responseTimeMs = Date.now() - currentQuestion.startedAt;
    send({ type: "ANSWER", answerId, responseTimeMs });
  }

  if (!session) return null;

  // Game ended screen
  if (phase === GamePhase.ENDED && gameEnded) {
    const myFinalEntry = gameEnded.finalLeaderboard.find((e) => e.playerId === session.playerId);
    const rank = myFinalEntry?.rank ?? 0;
    const podiumEmoji = rank === 1 ? "🥇" : rank === 2 ? "🥈" : rank === 3 ? "🥉" : `#${rank}`;

    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center p-6 text-center">
        <motion.div
          initial={{ scale: 0.5, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: "spring", stiffness: 200 }}
          className="space-y-6 w-full max-w-sm"
        >
          <div className="text-7xl">{podiumEmoji}</div>
          <h1 className="text-3xl font-bold text-text-primary">{t("game.gameOver")}</h1>

          {avatarConfig && <AvatarSVG config={avatarConfig} size={100} />}

          <div className="card">
            <p className="text-text-secondary text-sm">{t("game.finalScore")}</p>
            <p className="text-4xl font-bold text-accent tabular-nums">{myFinalEntry?.score.toLocaleString() ?? 0}</p>
          </div>

          <div className="space-y-2">
            {gameEnded.finalLeaderboard.slice(0, 5).map((entry, i) => (
              <div
                key={entry.playerId}
                className={`flex items-center gap-3 p-3 rounded-xl ${
                  entry.playerId === session.playerId ? "bg-accent/20 border border-accent/30" : "bg-surface"
                }`}
              >
                <span className="text-lg w-8 text-center">
                  {i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : `#${i + 1}`}
                </span>
                <span className="flex-1 text-text-primary font-medium">{entry.nickname}</span>
                <span className="text-accent font-bold tabular-nums">{entry.score.toLocaleString()}</span>
              </div>
            ))}
          </div>

          <button
            onClick={() => { localStorage.removeItem("kahootplus_player_session"); navigate("/join"); }}
            className="btn-primary"
          >
            Play again
          </button>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Status bar */}
      <div className="flex items-center justify-between px-4 py-3 bg-surface border-b border-white/5">
        <div className="flex items-center gap-2">
          {connected ? (
            <Wifi size={14} className="text-success" />
          ) : (
            <WifiOff size={14} className="text-error animate-pulse" />
          )}
          <span className="text-xs text-text-secondary">
            {reconnecting ? t("errors.connectionLost") : session.nickname}
          </span>
        </div>
        <div className="flex items-center gap-3">
          {myStreak >= 2 && (
            <div className="flex items-center gap-1 text-warning">
              <Zap size={14} />
              <span className="text-xs font-bold">{myStreak}x</span>
            </div>
          )}
          <div className="text-right">
            <p className="text-xs text-text-muted">{t("game.yourScore")}</p>
            <p className="text-sm font-bold text-accent tabular-nums">{myScore.toLocaleString()}</p>
          </div>
        </div>
      </div>

      <div className="flex-1 flex flex-col p-4">
        <AnimatePresence mode="wait">
          {/* Lobby / waiting */}
          {phase === GamePhase.LOBBY && (
            <motion.div
              key="waiting"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex-1 flex flex-col items-center justify-center gap-6 text-center"
            >
              {avatarConfig && <AvatarSVG config={avatarConfig} size={120} />}
              <div>
                <h2 className="text-2xl font-bold text-text-primary">{session.nickname}</h2>
                <p className="text-text-secondary mt-2">{t("game.waiting")}</p>
              </div>
              <div className="flex gap-1 mt-4">
                {[0, 1, 2].map((i) => (
                  <motion.div
                    key={i}
                    className="w-3 h-3 rounded-full bg-accent"
                    animate={{ opacity: [0.3, 1, 0.3] }}
                    transition={{ duration: 1.5, repeat: Infinity, delay: i * 0.3 }}
                  />
                ))}
              </div>
            </motion.div>
          )}

          {/* Active question */}
          {phase === GamePhase.QUESTION && currentQuestion && (
            <motion.div
              key={`q-${currentQuestion.questionIndex}`}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="flex-1 flex flex-col gap-4"
            >
              {/* Timer and question info */}
              <div className="flex items-center justify-between">
                <span className="text-text-muted text-sm">
                  {t("game.question", { n: currentQuestion.questionIndex + 1 })}
                </span>
                <span className={`text-2xl font-bold tabular-nums font-mono ${timeRemaining <= 5 ? "text-error animate-pulse" : "text-accent"}`}>
                  {timeRemaining}s
                </span>
              </div>

              {/* Question text */}
              <div className="card flex-shrink-0">
                <p className="text-lg font-bold text-text-primary text-center leading-snug">
                  {currentQuestion.question.text}
                </p>
              </div>

              {/* Answered state */}
              {hasAnswered ? (
                <motion.div
                  initial={{ scale: 0.8, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  className="flex-1 flex flex-col items-center justify-center gap-4"
                >
                  <motion.div
                    animate={{ rotate: [0, -10, 10, -10, 0] }}
                    transition={{ duration: 0.5 }}
                    className="text-5xl"
                  >
                    ✅
                  </motion.div>
                  <p className="text-text-primary font-bold text-xl">{t("game.answered")}</p>
                  <p className="text-text-muted text-sm">{t("game.waitingForHost")}</p>
                </motion.div>
              ) : (
                /* Answer buttons */
                <div className="grid grid-cols-2 gap-3 flex-1">
                  {currentQuestion.question.answers.map((answer, i) => {
                    const style = ANSWER_COLORS[i] ?? ANSWER_COLORS[0]!;
                    const isSelected = selectedAnswerId === answer.id;
                    return (
                      <motion.button
                        key={answer.id}
                        whileTap={{ scale: 0.95 }}
                        onClick={() => submitAnswer(answer.id)}
                        disabled={hasAnswered}
                        className={`answer-btn ${style.bg} ${isSelected ? "ring-4 ring-white/50" : ""} min-h-[80px] flex-col justify-center text-center`}
                      >
                        <span className="text-2xl mb-1">{style.shape}</span>
                        <span className="text-sm font-bold leading-tight">{answer.text}</span>
                      </motion.button>
                    );
                  })}
                </div>
              )}
            </motion.div>
          )}

          {/* Question results */}
          {phase === GamePhase.RESULTS && questionResult && (
            <motion.div
              key="results"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex-1 flex flex-col items-center justify-center gap-6 text-center"
            >
              {(() => {
                const isCorrect = selectedAnswerId === questionResult.correctAnswerId;
                const pointsEarned = questionResult.pointsEarned;
                return (
                  <>
                    <motion.div
                      initial={{ scale: 0.3, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      transition={{ type: "spring", stiffness: 300, damping: 15 }}
                      className="text-7xl"
                    >
                      {isCorrect ? "✅" : "❌"}
                    </motion.div>

                    <div>
                      <h2 className={`text-3xl font-bold ${isCorrect ? "text-success" : "text-error"}`}>
                        {isCorrect ? t("game.correct") : t("game.incorrect")}
                      </h2>
                      {isCorrect && pointsEarned > 0 && (
                        <motion.p
                          initial={{ opacity: 0, y: -10 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: 0.3 }}
                          className="text-2xl font-bold text-warning mt-2"
                        >
                          {t("game.points", { n: pointsEarned.toLocaleString() })}
                        </motion.p>
                      )}
                      {!isCorrect && questionResult.correctAnswerText && (
                        <p className="text-text-secondary mt-2 text-sm">
                          Correct: <span className="text-success font-semibold">{questionResult.correctAnswerText}</span>
                        </p>
                      )}
                    </div>

                    <div className="card w-full">
                      <div className="flex justify-between items-center">
                        <div>
                          <p className="text-text-muted text-xs">{t("game.yourScore")}</p>
                          <p className="text-2xl font-bold text-accent tabular-nums">{myScore.toLocaleString()}</p>
                        </div>
                        {myStreak >= 2 && (
                          <div className="text-center">
                            <p className="text-text-muted text-xs">Streak</p>
                            <p className="text-xl font-bold text-warning flex items-center gap-1">
                              <Zap size={16} />
                              {myStreak}x
                            </p>
                          </div>
                        )}
                        {myRank && (
                          <div className="text-right">
                            <p className="text-text-muted text-xs">Rank</p>
                            <p className="text-2xl font-bold text-text-primary">#{myRank}</p>
                          </div>
                        )}
                      </div>
                    </div>

                    <p className="text-text-muted text-sm">{t("game.waitingForHost")}</p>

                    {/* Mini leaderboard toggle */}
                    <button
                      onClick={() => setShowLeaderboard(!showLeaderboard)}
                      className="flex items-center gap-2 text-accent text-sm"
                    >
                      <Trophy size={14} />
                      {t("game.leaderboard")}
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
                              className={`flex items-center gap-2 text-sm p-2 rounded-xl ${
                                entry.playerId === session.playerId ? "bg-accent/20" : "bg-surface"
                              }`}
                            >
                              <span className="text-text-muted w-6 text-right">{i + 1}</span>
                              <span className="flex-1 text-text-primary">{entry.nickname}</span>
                              <span className="text-accent font-bold tabular-nums">{entry.score.toLocaleString()}</span>
                            </div>
                          ))}
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </>
                );
              })()}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
