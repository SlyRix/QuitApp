import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { motion, AnimatePresence } from "framer-motion";
import { Plus, Play, Pencil, Trash2, Globe, Lock, LogOut, Zap } from "lucide-react";
import { useAuthStore } from "../store/authStore";
import { useApi } from "../hooks/useApi";
import type { Quiz } from "@slyquiz/shared";

const CARD_ACCENTS = ["#b8ff35", "#38d9f5", "#ff4d6d", "#ffd426", "#00d483", "#a78bfa"];

export default function Dashboard() {
  const { t: _t } = useTranslation();
  const navigate = useNavigate();
  const api = useApi();
  const queryClient = useQueryClient();
  const { user, clearAuth } = useAuthStore();

  const { data: quizzes = [], isLoading } = useQuery({
    queryKey: ["quizzes"],
    queryFn: () => api.get<Quiz[]>("/quizzes"),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/quizzes/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["quizzes"] }),
  });

  const createGameMutation = useMutation({
    mutationFn: (quizId: string) =>
      api.post<{ pin: string; sessionId: string; qrCodeUrl: string }>("/games", { quizId }),
    onSuccess: (data) => navigate(`/games/${data.pin}/host`),
  });

  function handleLogout() {
    clearAuth();
    navigate("/login");
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-30 border-b border-white/6 bg-background/85 backdrop-blur-xl px-6 py-4">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h1 className="font-display font-black text-xl" style={{ color: "#b8ff35" }}>SlyQuiz</h1>
            <span className="hidden sm:block text-text-muted text-sm">/</span>
            <span className="hidden sm:block text-text-secondary text-sm">Dashboard</span>
          </div>
          <div className="flex items-center gap-3">
            <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 bg-surface-2 rounded-xl border border-white/6">
              <div className="w-5 h-5 rounded-full bg-accent flex items-center justify-center text-background text-xs font-black">
                {user?.name?.charAt(0).toUpperCase()}
              </div>
              <span className="text-text-secondary text-sm">{user?.name}</span>
            </div>
            <button
              onClick={handleLogout}
              className="flex items-center gap-1.5 text-text-muted hover:text-text-primary text-sm transition-colors px-3 py-1.5 rounded-xl hover:bg-surface-2"
            >
              <LogOut size={14} />
              <span className="hidden sm:block">Logout</span>
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-8">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h2 className="font-display font-bold text-2xl text-text-primary">My Quizzes</h2>
            <p className="text-text-muted text-sm mt-0.5">
              {!isLoading && (quizzes.length > 0
                ? `${quizzes.length} quiz${quizzes.length !== 1 ? "zes" : ""}`
                : "No quizzes yet")}
            </p>
          </div>
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.97 }}
            onClick={() => navigate("/quizzes/new")}
            className="btn-primary"
          >
            <Plus size={16} />
            New Quiz
          </motion.button>
        </div>

        {/* Skeletons */}
        {isLoading && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-44 rounded-2xl bg-surface-2 animate-pulse" />
            ))}
          </div>
        )}

        {/* Empty */}
        {!isLoading && quizzes.length === 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex flex-col items-center justify-center py-24 text-center"
          >
            <div className="text-6xl mb-6" style={{ filter: "drop-shadow(0 0 20px rgba(184,255,53,0.3))" }}>⚡</div>
            <h3 className="font-display font-bold text-xl text-text-primary mb-2">Ready to quiz?</h3>
            <p className="text-text-muted text-sm mb-8 max-w-xs">
              Create your first quiz and start hosting live sessions in seconds.
            </p>
            <button onClick={() => navigate("/quizzes/new")} className="btn-primary">
              <Plus size={16} /> Create first quiz
            </button>
          </motion.div>
        )}

        {/* Grid */}
        {!isLoading && quizzes.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <AnimatePresence>
              {quizzes.map((quiz, idx) => {
                const accent = CARD_ACCENTS[idx % CARD_ACCENTS.length]!;
                return (
                  <motion.div
                    key={quiz.id}
                    initial={{ opacity: 0, y: 16 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    transition={{ delay: idx * 0.04, ease: [0.16, 1, 0.3, 1] }}
                    className="group relative bg-surface-2 border border-white/6 rounded-2xl overflow-hidden
                               hover:border-white/12 transition-all duration-200"
                    style={{ boxShadow: "0 2px 12px rgba(0,0,0,0.4)" }}
                  >
                    {/* Colored top bar */}
                    <div className="h-0.5 w-full" style={{ background: accent }} />

                    <div className="p-5">
                      <div className="flex items-start justify-between gap-2 mb-3">
                        <h3 className="font-display font-bold text-text-primary leading-snug line-clamp-2 flex-1">
                          {quiz.title}
                        </h3>
                        {quiz.isPublic ? (
                          <span className="badge-sky shrink-0">
                            <Globe size={9} /> Public
                          </span>
                        ) : (
                          <span className="badge-coral shrink-0">
                            <Lock size={9} /> Private
                          </span>
                        )}
                      </div>

                      <p className="text-xs text-text-muted mb-5 flex items-center gap-1.5">
                        <Zap size={10} style={{ color: accent }} />
                        {quiz.questions?.length ?? 0} question{(quiz.questions?.length ?? 0) !== 1 ? "s" : ""}
                      </p>

                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => createGameMutation.mutate(quiz.id)}
                          disabled={createGameMutation.isPending}
                          className="flex-1 flex items-center justify-center gap-2 py-2 rounded-xl
                                     font-semibold text-sm text-background transition-all active:scale-95 hover:brightness-110"
                          style={{ background: accent }}
                        >
                          <Play size={13} fill="currentColor" /> Host
                        </button>
                        <button
                          onClick={() => navigate(`/quizzes/${quiz.id}/edit`)}
                          className="p-2 rounded-xl text-text-secondary hover:text-text-primary hover:bg-surface-3 transition-colors"
                        >
                          <Pencil size={14} />
                        </button>
                        <button
                          onClick={() => { if (confirm("Delete this quiz?")) deleteMutation.mutate(quiz.id); }}
                          className="p-2 rounded-xl text-text-muted hover:text-coral hover:bg-coral/10 transition-colors"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </AnimatePresence>

            {/* Add new card */}
            <motion.button
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: quizzes.length * 0.04 }}
              whileHover={{ scale: 1.01 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => navigate("/quizzes/new")}
              className="h-44 flex flex-col items-center justify-center gap-3
                         border-2 border-dashed border-white/10 rounded-2xl
                         text-text-muted hover:border-accent/35 hover:text-accent
                         transition-all duration-200 group"
            >
              <div className="w-10 h-10 rounded-2xl border-2 border-dashed border-current flex items-center justify-center
                              group-hover:rotate-90 transition-transform duration-300">
                <Plus size={18} />
              </div>
              <span className="text-sm font-semibold">New Quiz</span>
            </motion.button>
          </div>
        )}
      </main>
    </div>
  );
}
