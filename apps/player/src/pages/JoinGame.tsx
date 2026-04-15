import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { motion, AnimatePresence } from "framer-motion";
import AvatarBuilder, { configToString } from "./AvatarBuilder";
import type { AvatarConfig } from "./AvatarBuilder";

const SESSION_KEY = "kahootplus_player_session";

interface StoredSession {
  playerId: string;
  sessionToken: string;
  sessionId: string;
  nickname: string;
  pin: string;
}

export default function JoinGame() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { pin: urlPin } = useParams<{ pin?: string }>();

  const [step, setStep] = useState<"pin" | "nickname" | "avatar">("pin");
  const [pin, setPin] = useState(urlPin ?? "");
  const [nickname, setNickname] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [existingSession, setExistingSession] = useState<StoredSession | null>(null);

  // Check for existing session in localStorage
  useEffect(() => {
    const stored = localStorage.getItem(SESSION_KEY);
    if (stored) {
      try {
        const session = JSON.parse(stored) as StoredSession;
        if (session.pin === (urlPin ?? session.pin)) {
          setExistingSession(session);
        }
      } catch {
        localStorage.removeItem(SESSION_KEY);
      }
    }
    if (urlPin) {
      setPin(urlPin);
      setStep("nickname");
    }
  }, [urlPin]);

  async function validatePin() {
    setError("");
    if (pin.length !== 6) {
      setError("Please enter a 6-digit PIN");
      return;
    }
    setStep("nickname");
  }

  async function handleAvatarConfirm(avatarConfig: AvatarConfig) {
    setLoading(true);
    setError("");

    try {
      const res = await fetch(`/api/games/${pin}/join`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nickname: nickname.trim(),
          avatarData: configToString(avatarConfig),
        }),
      });

      const data = await res.json() as {
        success: boolean;
        data?: { playerId: string; sessionToken: string; sessionId: string };
        error?: string;
      };

      if (!data.success || !data.data) {
        const errMsg = data.error ?? "Failed to join";
        if (errMsg.includes("Nickname")) {
          setError(t("join.nicknameTaken"));
          setStep("nickname");
        } else if (errMsg.includes("started")) {
          setError(t("join.gameStarted"));
        } else if (errMsg.includes("not found")) {
          setError(t("join.invalidPin"));
          setStep("pin");
        } else {
          setError(errMsg);
        }
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
      localStorage.setItem("kahootplus_avatar", configToString(avatarConfig));

      navigate("/game", { state: session });
    } catch {
      setError(t("errors.networkError"));
    } finally {
      setLoading(false);
    }
  }

  function continueExisting() {
    if (existingSession) {
      navigate("/game", { state: existingSession });
    }
  }

  function clearSession() {
    localStorage.removeItem(SESSION_KEY);
    setExistingSession(null);
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <div className="flex-1 flex flex-col max-w-sm mx-auto w-full p-6">
        {/* Logo */}
        <div className="text-center pt-8 pb-6">
          <h1 className="text-3xl font-bold text-accent">KahootPlus</h1>
        </div>

        {/* Existing session banner */}
        {existingSession && step !== "avatar" && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-accent/10 border border-accent/20 rounded-2xl p-4 mb-4"
          >
            <p className="text-text-secondary text-sm mb-3">
              {t("join.continueAs", { nickname: existingSession.nickname })}
            </p>
            <div className="flex gap-2">
              <button onClick={continueExisting} className="btn-primary py-2 text-base">
                {t("join.continueAs", { nickname: existingSession.nickname })}
              </button>
              <button
                onClick={clearSession}
                className="bg-surface-2 text-text-secondary px-4 py-2 rounded-2xl text-sm font-semibold"
              >
                {t("join.newSession")}
              </button>
            </div>
          </motion.div>
        )}

        <AnimatePresence mode="wait">
          {step === "pin" && (
            <motion.div
              key="pin"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              className="space-y-4"
            >
              <div>
                <label className="block text-text-secondary text-sm font-medium mb-2">
                  {t("join.pinLabel")}
                </label>
                <input
                  type="tel"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  value={pin}
                  onChange={(e) => {
                    const val = e.target.value.replace(/\D/g, "").slice(0, 6);
                    setPin(val);
                    setError("");
                  }}
                  placeholder={t("join.pinPlaceholder")}
                  className="input-field text-center text-3xl font-bold tracking-widest"
                  maxLength={6}
                  autoFocus
                />
              </div>

              {error && (
                <p className="text-error text-sm text-center">{error}</p>
              )}

              <button
                onClick={validatePin}
                disabled={pin.length !== 6}
                className="btn-primary"
              >
                {t("join.joinButton")}
              </button>
            </motion.div>
          )}

          {step === "nickname" && (
            <motion.div
              key="nickname"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-4"
            >
              <div className="text-center mb-2">
                <span className="text-accent font-mono font-bold text-2xl tracking-widest">{pin}</span>
              </div>

              <div>
                <label className="block text-text-secondary text-sm font-medium mb-2">
                  {t("join.nicknameLabel")}
                </label>
                <input
                  type="text"
                  value={nickname}
                  onChange={(e) => { setNickname(e.target.value.slice(0, 20)); setError(""); }}
                  placeholder={t("join.nicknamePlaceholder")}
                  className="input-field"
                  maxLength={20}
                  autoFocus
                  onKeyDown={(e) => { if (e.key === "Enter" && nickname.trim().length >= 2) setStep("avatar"); }}
                />
                <p className="text-text-muted text-xs mt-1 text-right">{nickname.length}/20</p>
              </div>

              {error && (
                <p className="text-error text-sm text-center">{error}</p>
              )}

              <div className="flex gap-3">
                <button
                  onClick={() => setStep("pin")}
                  className="bg-surface-2 text-text-secondary px-4 py-4 rounded-2xl font-semibold"
                >
                  ←
                </button>
                <button
                  onClick={() => setStep("avatar")}
                  disabled={nickname.trim().length < 2}
                  className="btn-primary"
                >
                  {t("join.joinButton")}
                </button>
              </div>
            </motion.div>
          )}

          {step === "avatar" && (
            <motion.div
              key="avatar"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="flex-1 flex flex-col -mx-6 -mb-6"
            >
              <AvatarBuilder onConfirm={handleAvatarConfirm} />
              {error && (
                <p className="text-error text-sm text-center px-6 pb-4">{error}</p>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
