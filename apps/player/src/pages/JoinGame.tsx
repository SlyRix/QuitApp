import { useState, useEffect, useRef } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { motion, AnimatePresence } from "framer-motion";
import AvatarBuilder, { configToString } from "./AvatarBuilder";
import type { AvatarConfig } from "./AvatarBuilder";
import { getApiBase } from "../hooks/useApi";

const SESSION_KEY = "slyquiz_player_session";

interface StoredSession {
  playerId: string;
  sessionToken: string;
  sessionId: string;
  nickname: string;
  pin: string;
}

type Step = "pin" | "nickname" | "avatar";

export default function JoinGame() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { pin: urlPin } = useParams<{ pin?: string }>();

  const [step, setStep] = useState<Step>("pin");
  const [pin, setPin] = useState(urlPin ?? "");
  const [nickname, setNickname] = useState("");
  const [error, setError] = useState("");
  const [existingSession, setExistingSession] = useState<StoredSession | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const stored = localStorage.getItem(SESSION_KEY);
    if (stored) {
      try {
        const session = JSON.parse(stored) as StoredSession;
        if (session.pin === (urlPin ?? session.pin)) setExistingSession(session);
      } catch {
        localStorage.removeItem(SESSION_KEY);
      }
    }
    if (urlPin) {
      setPin(urlPin);
      setStep("nickname");
    }
  }, [urlPin]);

  useEffect(() => {
    if (step === "pin" || step === "nickname") {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [step]);

  async function handleAvatarConfirm(avatarConfig: AvatarConfig) {
    setError("");
    try {
      const res = await fetch(`${getApiBase()}/games/${pin}/join`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nickname: nickname.trim(), avatarData: configToString(avatarConfig) }),
      });

      const data = await res.json() as {
        success: boolean;
        data?: { playerId: string; sessionToken: string; sessionId: string };
        error?: string;
      };

      if (!data.success || !data.data) {
        const msg = data.error ?? "Failed to join";
        if (msg.includes("Nickname")) { setError(t("join.nicknameTaken")); setStep("nickname"); }
        else if (msg.includes("started")) { setError(t("join.gameStarted")); }
        else if (msg.includes("not found")) { setError(t("join.invalidPin")); setStep("pin"); }
        else { setError(msg); }
        return;
      }

      const session: StoredSession = {
        playerId: data.data.playerId,
        sessionToken: data.data.sessionToken,
        sessionId: data.data.sessionId,
        nickname: nickname.trim(),
        pin,
      };
      localStorage.setItem(SESSION_KEY, JSON.stringify(session));
      localStorage.setItem("slyquiz_avatar", configToString(avatarConfig));
      navigate("/game", { state: session });
    } catch {
      setError(t("errors.networkError"));
    }
  }

  return (
    <div className="h-full bg-background flex flex-col relative overflow-hidden">
      {/* Top glow */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-80 h-40 pointer-events-none"
           style={{ background: "radial-gradient(ellipse, rgba(184,255,53,0.08) 0%, transparent 70%)" }} />

      {/* Header */}
      <div className="flex-none pt-safe px-6 pt-8 pb-4 text-center relative z-10">
        <h1 className="font-display font-black text-4xl" style={{ color: "#b8ff35", textShadow: "0 0 24px rgba(184,255,53,0.35)" }}>
          SlyQuiz
        </h1>
      </div>

      {/* Steps indicator */}
      {step !== "avatar" && (
        <div className="flex-none px-6 mb-6 relative z-10">
          <div className="flex items-center justify-center gap-2">
            {(["pin", "nickname", "avatar"] as Step[]).map((s) => (
              <div key={s} className="flex items-center gap-2">
                <div className={`w-2 h-2 rounded-full transition-all duration-300 ${step === s ? "w-6 bg-accent" : "bg-white/20"}`} />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Existing session banner */}
      {existingSession && step !== "avatar" && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex-none mx-6 mb-4 px-4 py-3 rounded-2xl border relative z-10"
          style={{ background: "rgba(184,255,53,0.06)", borderColor: "rgba(184,255,53,0.2)" }}
        >
          <p className="text-text-secondary text-sm mb-3 font-medium">
            Continue as <span className="text-accent font-bold">{existingSession.nickname}</span>?
          </p>
          <div className="flex gap-2">
            <button
              onClick={() => navigate("/game", { state: existingSession })}
              className="flex-1 py-2 rounded-xl text-sm font-bold text-background"
              style={{ background: "#b8ff35" }}
            >
              Continue
            </button>
            <button
              onClick={() => { localStorage.removeItem(SESSION_KEY); setExistingSession(null); }}
              className="px-4 py-2 rounded-xl text-sm font-semibold text-text-secondary bg-surface-2"
            >
              New
            </button>
          </div>
        </motion.div>
      )}

      {/* Main content */}
      <div className="flex-1 px-6 relative z-10 min-h-0">
        <AnimatePresence mode="wait">
          {/* PIN step */}
          {step === "pin" && (
            <motion.div
              key="pin"
              initial={{ opacity: 0, x: -24 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 24 }}
              transition={{ ease: [0.16, 1, 0.3, 1], duration: 0.35 }}
              className="space-y-5"
            >
              <div className="text-center">
                <h2 className="font-display font-bold text-2xl text-text-primary mb-1">Enter PIN</h2>
                <p className="text-text-muted text-sm">Get the PIN from your quiz host</p>
              </div>

              <input
                ref={inputRef}
                type="tel"
                inputMode="numeric"
                pattern="[0-9]*"
                value={pin}
                onChange={(e) => { setPin(e.target.value.replace(/\D/g, "").slice(0, 6)); setError(""); }}
                onKeyDown={(e) => { if (e.key === "Enter" && pin.length === 6) setStep("nickname"); }}
                className="text-center font-mono font-black tracking-[0.3em] text-4xl bg-surface-2 border-2 border-white/8 rounded-2xl px-4 py-5 w-full text-accent focus:border-accent/50 focus:outline-none transition-colors"
                maxLength={6}
                placeholder="000000"
              />

              {error && <p className="text-coral text-sm text-center">{error}</p>}

              <button
                onClick={() => setStep("nickname")}
                disabled={pin.length !== 6}
                className="btn-primary"
              >
                Continue
              </button>
            </motion.div>
          )}

          {/* Nickname step */}
          {step === "nickname" && (
            <motion.div
              key="nickname"
              initial={{ opacity: 0, x: 24 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -24 }}
              transition={{ ease: [0.16, 1, 0.3, 1], duration: 0.35 }}
              className="space-y-5"
            >
              <div className="text-center">
                <div className="font-mono font-black text-2xl tracking-[0.2em] mb-1" style={{ color: "#b8ff35" }}>
                  {pin}
                </div>
                <h2 className="font-display font-bold text-2xl text-text-primary mb-1">Your nickname</h2>
                <p className="text-text-muted text-sm">How should we call you?</p>
              </div>

              <div className="relative">
                <input
                  ref={inputRef}
                  type="text"
                  value={nickname}
                  onChange={(e) => { setNickname(e.target.value.slice(0, 20)); setError(""); }}
                  onKeyDown={(e) => { if (e.key === "Enter" && nickname.trim().length >= 2) setStep("avatar"); }}
                  placeholder="QuizWizard42"
                  className="input-field pr-16"
                  maxLength={20}
                />
                <span className="absolute right-4 top-1/2 -translate-y-1/2 text-text-muted text-xs font-mono">
                  {nickname.length}/20
                </span>
              </div>

              {error && <p className="text-coral text-sm text-center">{error}</p>}

              <div className="flex gap-3">
                <button
                  onClick={() => setStep("pin")}
                  className="py-4 px-5 rounded-2xl bg-surface-2 text-text-secondary font-bold text-lg hover:bg-surface-3 transition-colors"
                >
                  ←
                </button>
                <button
                  onClick={() => setStep("avatar")}
                  disabled={nickname.trim().length < 2}
                  className="btn-primary flex-1"
                >
                  Pick avatar →
                </button>
              </div>
            </motion.div>
          )}

          {/* Avatar step */}
          {step === "avatar" && (
            <motion.div
              key="avatar"
              initial={{ opacity: 0, x: 24 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -24 }}
              transition={{ ease: [0.16, 1, 0.3, 1], duration: 0.35 }}
              className="h-full -mx-6"
            >
              <AvatarBuilder onConfirm={handleAvatarConfirm} nickname={nickname} />
              {error && <p className="text-coral text-sm text-center px-6 pb-4">{error}</p>}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
