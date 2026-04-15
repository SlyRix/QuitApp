import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { motion, AnimatePresence } from "framer-motion";
import { useAuthStore } from "../store/authStore";

const API_BASE = import.meta.env.VITE_API_URL ? `${import.meta.env.VITE_API_URL}/api` : "/api";

const SHAPES = [
  { shape: "▲", x: "8%",  y: "15%", size: 40, delay: 0,   dur: 7 },
  { shape: "◆", x: "88%", y: "8%",  size: 28, delay: 1.5, dur: 9 },
  { shape: "●", x: "5%",  y: "75%", size: 24, delay: 0.8, dur: 6 },
  { shape: "■", x: "92%", y: "70%", size: 32, delay: 2.2, dur: 8 },
  { shape: "▲", x: "75%", y: "40%", size: 18, delay: 3,   dur: 10 },
  { shape: "◆", x: "18%", y: "50%", size: 20, delay: 1,   dur: 7.5 },
];

export default function Login() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const setAuth = useAuthStore((s) => s.setAuth);

  const [mode, setMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const endpoint = mode === "login" ? `${API_BASE}/auth/login` : `${API_BASE}/auth/register`;
      const body = mode === "login" ? { email, password } : { email, password, name };

      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      const data = await res.json() as {
        success: boolean;
        data?: { token: string; user: { id: string; email: string; name: string; avatarUrl: string | null } };
        error?: string;
      };

      if (!data.success || !data.data) {
        setError(data.error ?? t(`auth.${mode}Error`));
        return;
      }

      setAuth(data.data.user, data.data.token);
      navigate("/");
    } catch {
      setError(t("errors.networkError"));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4 relative overflow-hidden">
      {/* Ambient glow */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-96 h-96 rounded-full pointer-events-none"
           style={{ background: "radial-gradient(circle, rgba(184,255,53,0.05) 0%, transparent 70%)" }} />

      {/* Floating shapes */}
      {SHAPES.map((s, i) => (
        <div
          key={i}
          className="absolute pointer-events-none select-none font-mono"
          style={{
            left: s.x, top: s.y,
            fontSize: s.size,
            color: "rgba(184,255,53,0.07)",
            animation: `loginFloat ${s.dur}s ease-in-out ${s.delay}s infinite`,
          }}
        >
          {s.shape}
        </div>
      ))}

      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
        className="w-full max-w-sm relative z-10"
      >
        {/* Logo */}
        <div className="text-center mb-10">
          <h1 className="font-display font-black text-5xl tracking-tight mb-2" style={{ color: "#b8ff35", textShadow: "0 0 32px rgba(184,255,53,0.4)" }}>
            SlyQuiz
          </h1>
          <p className="text-text-secondary text-sm">
            {mode === "login" ? "Welcome back, quiz master" : "Start creating amazing quizzes"}
          </p>
        </div>

        {/* Mode toggle */}
        <div className="flex bg-surface-2 rounded-2xl p-1 mb-6 border border-white/6">
          {(["login", "register"] as const).map((m) => (
            <button
              key={m}
              onClick={() => { setMode(m); setError(""); }}
              className={`flex-1 py-2.5 rounded-xl text-sm font-semibold transition-all duration-200 ${
                mode === m
                  ? "bg-accent text-background"
                  : "text-text-secondary hover:text-text-primary"
              }`}
            >
              {m === "login" ? "Sign in" : "Sign up"}
            </button>
          ))}
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <AnimatePresence>
            {mode === "register" && (
              <motion.div
                key="name-field"
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                className="overflow-hidden"
              >
                <div className="pb-0">
                  <label className="block text-xs font-semibold text-text-secondary mb-1.5 tracking-widest uppercase">
                    Your Name
                  </label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="input-field"
                    placeholder="Alex Smith"
                    required
                    minLength={2}
                  />
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <div>
            <label className="block text-xs font-semibold text-text-secondary mb-1.5 tracking-widest uppercase">
              Email
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="input-field"
              placeholder="you@example.com"
              required
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-text-secondary mb-1.5 tracking-widest uppercase">
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="input-field"
              placeholder={mode === "register" ? "Min. 8 characters" : "••••••••"}
              required
              minLength={mode === "register" ? 8 : 1}
            />
          </div>

          <AnimatePresence>
            {error && (
              <motion.div
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="flex items-center gap-2 bg-coral/10 border border-coral/25 rounded-xl px-3 py-2.5"
              >
                <span className="text-coral text-sm">⚠</span>
                <p className="text-coral text-sm">{error}</p>
              </motion.div>
            )}
          </AnimatePresence>

          <button
            type="submit"
            disabled={loading}
            className="btn-primary w-full mt-2 text-base py-3.5"
          >
            {loading ? (
              <span className="flex items-center gap-2">
                <span className="inline-block w-4 h-4 border-2 border-background/40 border-t-background rounded-full animate-spin" />
                {mode === "login" ? "Signing in…" : "Creating account…"}
              </span>
            ) : (
              mode === "login" ? "Sign in" : "Create account"
            )}
          </button>
        </form>

        <p className="text-center text-text-muted text-xs mt-6">
          {mode === "login" ? "New here? " : "Already have an account? "}
          <button
            onClick={() => { setMode(mode === "login" ? "register" : "login"); setError(""); }}
            className="text-accent hover:underline font-semibold"
          >
            {mode === "login" ? "Create account →" : "Sign in →"}
          </button>
        </p>
      </motion.div>

      <style>{`
        @keyframes loginFloat {
          0%, 100% { transform: translateY(0) rotate(0deg); }
          50% { transform: translateY(-22px) rotate(8deg); }
        }
      `}</style>
    </div>
  );
}
