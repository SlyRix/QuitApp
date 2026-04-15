import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { motion } from "framer-motion";
import { Plus, Play, Pencil, Trash2, Globe, Lock, LogOut } from "lucide-react";
import { useAuthStore } from "../store/authStore";
import { useApi } from "../hooks/useApi";
import type { Quiz } from "@slyquiz/shared";

export default function Dashboard() {
  const { t } = useTranslation();
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
      <header className="bg-surface border-b border-white/5 px-6 py-4">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <h1 className="text-xl font-bold text-accent">SlyQuiz</h1>
          <div className="flex items-center gap-4">
            <span className="text-text-secondary text-sm">{user?.name}</span>
            <button onClick={handleLogout} className="btn-secondary flex items-center gap-2 text-sm py-1.5">
              <LogOut size={14} />
              {t("common.logout")}
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-8">
        {/* Page title + create button */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h2 className="text-2xl font-bold text-text-primary">{t("dashboard.title")}</h2>
            <p className="text-text-secondary mt-1">{quizzes.length} quiz{quizzes.length !== 1 ? "zes" : ""}</p>
          </div>
          <button
            onClick={() => navigate("/quizzes/new")}
            className="btn-primary flex items-center gap-2"
          >
            <Plus size={18} />
            {t("dashboard.createNew")}
          </button>
        </div>

        {/* Loading state */}
        {isLoading && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="card animate-pulse">
                <div className="h-6 bg-surface-2 rounded mb-3 w-3/4" />
                <div className="h-4 bg-surface-2 rounded w-1/2" />
              </div>
            ))}
          </div>
        )}

        {/* Empty state */}
        {!isLoading && quizzes.length === 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center py-20"
          >
            <div className="text-6xl mb-4">🎯</div>
            <h3 className="text-xl font-semibold text-text-primary mb-2">
              {t("dashboard.noQuizzes")}
            </h3>
            <p className="text-text-secondary mb-6">{t("dashboard.noQuizzesHint")}</p>
            <button
              onClick={() => navigate("/quizzes/new")}
              className="btn-primary flex items-center gap-2 mx-auto"
            >
              <Plus size={18} />
              {t("dashboard.createNew")}
            </button>
          </motion.div>
        )}

        {/* Quiz grid */}
        {!isLoading && quizzes.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {quizzes.map((quiz, i) => (
              <motion.div
                key={quiz.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
                className="card group hover:border-accent/20 transition-all"
              >
                {/* Cover image or placeholder */}
                <div className="h-32 rounded-lg bg-surface-2 mb-4 overflow-hidden flex items-center justify-center">
                  {quiz.coverImage ? (
                    <img src={quiz.coverImage} alt={quiz.title} className="w-full h-full object-cover" />
                  ) : (
                    <span className="text-4xl">🧠</span>
                  )}
                </div>

                {/* Quiz info */}
                <div className="flex items-start justify-between mb-2">
                  <h3 className="font-semibold text-text-primary truncate flex-1 mr-2">
                    {quiz.title}
                  </h3>
                  <span className={`flex items-center gap-1 text-xs px-2 py-0.5 rounded-full ${quiz.isPublic ? "bg-success/20 text-success" : "bg-surface-2 text-text-muted"}`}>
                    {quiz.isPublic ? <Globe size={10} /> : <Lock size={10} />}
                    {quiz.isPublic ? t("dashboard.publicBadge") : t("dashboard.privateBadge")}
                  </span>
                </div>

                <p className="text-text-muted text-xs mb-4">
                  {t("dashboard.lastEdited", {
                    date: new Date(quiz.updatedAt).toLocaleDateString(),
                  })}
                </p>

                {/* Actions */}
                <div className="flex gap-2">
                  <button
                    onClick={() => createGameMutation.mutate(quiz.id)}
                    disabled={createGameMutation.isPending}
                    className="btn-primary flex items-center gap-1.5 text-sm py-1.5 flex-1"
                  >
                    <Play size={14} />
                    Host
                  </button>
                  <button
                    onClick={() => navigate(`/quizzes/${quiz.id}/edit`)}
                    className="btn-secondary flex items-center gap-1.5 text-sm py-1.5 px-3"
                  >
                    <Pencil size={14} />
                  </button>
                  <button
                    onClick={() => {
                      if (confirm(`Delete "${quiz.title}"?`)) deleteMutation.mutate(quiz.id);
                    }}
                    className="btn-danger flex items-center gap-1.5 text-sm py-1.5 px-3"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
