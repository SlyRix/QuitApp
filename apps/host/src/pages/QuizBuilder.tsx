import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Plus, Trash2, Check, ChevronLeft, Save, GripVertical, Clock, Star } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useApi } from "../hooks/useApi";
import { QuestionType } from "@kahootplus/shared";
import type { Quiz, Question } from "@kahootplus/shared";

interface DraftAnswer {
  id: string;
  text: string;
  isCorrect: boolean;
  orderIndex: number;
}

interface DraftQuestion {
  id: string;
  type: QuestionType;
  text: string;
  mediaUrl: string | null;
  timeLimit: number;
  points: number;
  orderIndex: number;
  answers: DraftAnswer[];
}

function createBlankQuestion(index: number): DraftQuestion {
  return {
    id: crypto.randomUUID(),
    type: QuestionType.MULTIPLE_CHOICE,
    text: "",
    mediaUrl: null,
    timeLimit: 20,
    points: 1000,
    orderIndex: index,
    answers: [
      { id: crypto.randomUUID(), text: "", isCorrect: false, orderIndex: 0 },
      { id: crypto.randomUUID(), text: "", isCorrect: false, orderIndex: 1 },
      { id: crypto.randomUUID(), text: "", isCorrect: false, orderIndex: 2 },
      { id: crypto.randomUUID(), text: "", isCorrect: true, orderIndex: 3 },
    ],
  };
}

const ANSWER_COLORS = ["bg-red-500", "bg-blue-500", "bg-yellow-500", "bg-green-500"];

export default function QuizBuilder() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { id } = useParams<{ id?: string }>();
  const api = useApi();
  const queryClient = useQueryClient();

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [isPublic, setIsPublic] = useState(false);
  const [questions, setQuestions] = useState<DraftQuestion[]>([createBlankQuestion(0)]);
  const [activeIndex, setActiveIndex] = useState(0);

  // Load existing quiz if editing
  const { data: existingQuiz } = useQuery({
    queryKey: ["quiz", id],
    queryFn: () => api.get<Quiz>(`/quizzes/${id}`),
    enabled: !!id,
  });

  useEffect(() => {
    if (existingQuiz) {
      setTitle(existingQuiz.title);
      setDescription(existingQuiz.description ?? "");
      setIsPublic(existingQuiz.isPublic);
      if (existingQuiz.questions.length > 0) {
        setQuestions(
          existingQuiz.questions.map((q: Question) => ({
            id: q.id,
            type: q.type as QuestionType,
            text: q.text,
            mediaUrl: q.mediaUrl,
            timeLimit: q.timeLimit,
            points: q.points,
            orderIndex: q.orderIndex,
            answers: q.answers.map((a) => ({
              id: a.id,
              text: a.text,
              isCorrect: a.isCorrect,
              orderIndex: a.orderIndex,
            })),
          }))
        );
      }
    }
  }, [existingQuiz]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        title,
        description: description || undefined,
        isPublic,
        questions: questions.map((q, qi) => ({
          type: q.type,
          text: q.text,
          mediaUrl: q.mediaUrl ?? undefined,
          timeLimit: q.timeLimit,
          points: q.points,
          orderIndex: qi,
          answers: q.answers.map((a, ai) => ({
            text: a.text,
            isCorrect: a.isCorrect,
            orderIndex: ai,
          })),
        })),
      };

      if (id) {
        return api.put(`/quizzes/${id}`, payload);
      } else {
        return api.post<Quiz>("/quizzes", payload);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["quizzes"] });
      navigate("/");
    },
  });

  const activeQuestion = questions[activeIndex];

  function updateQuestion(updates: Partial<DraftQuestion>) {
    setQuestions((prev) =>
      prev.map((q, i) => (i === activeIndex ? { ...q, ...updates } : q))
    );
  }

  function updateAnswer(answerId: string, updates: Partial<DraftAnswer>) {
    if (!activeQuestion) return;
    const newAnswers = activeQuestion.answers.map((a) =>
      a.id === answerId ? { ...a, ...updates } : a
    );
    updateQuestion({ answers: newAnswers });
  }

  function setCorrectAnswer(answerId: string) {
    if (!activeQuestion) return;
    const newAnswers = activeQuestion.answers.map((a) => ({
      ...a,
      isCorrect: a.id === answerId,
    }));
    updateQuestion({ answers: newAnswers });
  }

  function addQuestion() {
    const newQ = createBlankQuestion(questions.length);
    setQuestions((prev) => [...prev, newQ]);
    setActiveIndex(questions.length);
  }

  function deleteQuestion(index: number) {
    if (questions.length <= 1) return;
    setQuestions((prev) => prev.filter((_, i) => i !== index));
    setActiveIndex(Math.min(activeIndex, questions.length - 2));
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Top bar */}
      <header className="bg-surface border-b border-white/5 px-4 py-3 flex items-center gap-4">
        <button onClick={() => navigate("/")} className="text-text-secondary hover:text-text-primary transition-colors">
          <ChevronLeft size={20} />
        </button>
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder={t("quizBuilder.quizTitle")}
          className="flex-1 bg-transparent text-lg font-semibold text-text-primary placeholder-text-muted outline-none"
        />
        <label className="flex items-center gap-2 text-sm text-text-secondary cursor-pointer">
          <input
            type="checkbox"
            checked={isPublic}
            onChange={(e) => setIsPublic(e.target.checked)}
            className="rounded"
          />
          Public
        </label>
        <button
          onClick={() => saveMutation.mutate()}
          disabled={saveMutation.isPending || !title.trim()}
          className="btn-primary flex items-center gap-2 text-sm"
        >
          <Save size={14} />
          {t("quizBuilder.saveQuiz")}
        </button>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* Question sidebar */}
        <aside className="w-64 bg-surface border-r border-white/5 flex flex-col">
          <div className="flex-1 overflow-y-auto p-2 space-y-1">
            {questions.map((q, i) => (
              <button
                key={q.id}
                onClick={() => setActiveIndex(i)}
                className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors group flex items-center gap-2 ${
                  i === activeIndex
                    ? "bg-accent/20 text-accent border border-accent/30"
                    : "text-text-secondary hover:bg-surface-2 hover:text-text-primary"
                }`}
              >
                <GripVertical size={14} className="text-text-muted flex-shrink-0" />
                <span className="flex-1 truncate">
                  {q.text || `Question ${i + 1}`}
                </span>
                {questions.length > 1 && (
                  <button
                    onClick={(e) => { e.stopPropagation(); deleteQuestion(i); }}
                    className="opacity-0 group-hover:opacity-100 text-error hover:text-red-400 transition-opacity"
                  >
                    <Trash2 size={12} />
                  </button>
                )}
              </button>
            ))}
          </div>
          <div className="p-2 border-t border-white/5">
            <button onClick={addQuestion} className="btn-secondary w-full text-sm flex items-center justify-center gap-2">
              <Plus size={14} />
              {t("quizBuilder.addQuestion")}
            </button>
          </div>
        </aside>

        {/* Question editor */}
        {activeQuestion && (
          <main className="flex-1 overflow-y-auto p-6">
            <div className="max-w-2xl mx-auto space-y-6">
              {/* Question type selector */}
              <div className="flex gap-2 flex-wrap">
                {[
                  { type: QuestionType.MULTIPLE_CHOICE, label: t("quizBuilder.multipleChoice") },
                  { type: QuestionType.TRUE_FALSE, label: t("quizBuilder.trueFalse") },
                  { type: QuestionType.POLL, label: t("quizBuilder.poll") },
                ].map(({ type, label }) => (
                  <button
                    key={type}
                    onClick={() => {
                      if (type === QuestionType.TRUE_FALSE) {
                        updateQuestion({
                          type,
                          answers: [
                            { id: crypto.randomUUID(), text: "True", isCorrect: true, orderIndex: 0 },
                            { id: crypto.randomUUID(), text: "False", isCorrect: false, orderIndex: 1 },
                          ],
                        });
                      } else {
                        updateQuestion({ type });
                      }
                    }}
                    className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                      activeQuestion.type === type
                        ? "bg-accent text-background"
                        : "bg-surface-2 text-text-secondary hover:text-text-primary"
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>

              {/* Question text */}
              <div>
                <label className="block text-sm font-medium text-text-secondary mb-2">
                  {t("quizBuilder.questionText")}
                </label>
                <textarea
                  value={activeQuestion.text}
                  onChange={(e) => updateQuestion({ text: e.target.value })}
                  placeholder="Enter your question..."
                  rows={3}
                  className="input-field resize-none"
                />
              </div>

              {/* Time & Points */}
              <div className="flex gap-4">
                <div className="flex-1">
                  <label className="flex items-center gap-1 text-sm font-medium text-text-secondary mb-2">
                    <Clock size={14} />
                    {t("quizBuilder.timeLimit")}
                  </label>
                  <select
                    value={activeQuestion.timeLimit}
                    onChange={(e) => updateQuestion({ timeLimit: Number(e.target.value) })}
                    className="input-field"
                  >
                    {[5, 10, 15, 20, 30, 45, 60, 90, 120].map((s) => (
                      <option key={s} value={s}>{s}s</option>
                    ))}
                  </select>
                </div>
                <div className="flex-1">
                  <label className="flex items-center gap-1 text-sm font-medium text-text-secondary mb-2">
                    <Star size={14} />
                    {t("quizBuilder.points")}
                  </label>
                  <select
                    value={activeQuestion.points}
                    onChange={(e) => updateQuestion({ points: Number(e.target.value) })}
                    className="input-field"
                  >
                    {[0, 500, 1000, 2000].map((p) => (
                      <option key={p} value={p}>{p}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Answers */}
              <div>
                <label className="block text-sm font-medium text-text-secondary mb-3">
                  Answers
                </label>
                <div className="grid grid-cols-2 gap-3">
                  {activeQuestion.answers.map((answer, ai) => (
                    <div
                      key={answer.id}
                      className={`relative rounded-xl border-2 p-3 transition-all ${
                        answer.isCorrect
                          ? "border-success bg-success/10"
                          : "border-white/10 bg-surface-2"
                      }`}
                    >
                      <div className={`w-6 h-6 rounded-full ${ANSWER_COLORS[ai] ?? "bg-gray-500"} mb-2`} />
                      <input
                        type="text"
                        value={answer.text}
                        onChange={(e) => updateAnswer(answer.id, { text: e.target.value })}
                        placeholder={t("quizBuilder.answerText", { index: ai + 1 })}
                        className="bg-transparent text-text-primary placeholder-text-muted outline-none w-full text-sm"
                        disabled={activeQuestion.type === QuestionType.TRUE_FALSE}
                      />
                      {activeQuestion.type !== QuestionType.POLL && (
                        <button
                          onClick={() => setCorrectAnswer(answer.id)}
                          className={`absolute top-2 right-2 w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all ${
                            answer.isCorrect
                              ? "bg-success border-success text-white"
                              : "border-white/20 hover:border-success/50"
                          }`}
                        >
                          {answer.isCorrect && <Check size={12} />}
                        </button>
                      )}
                    </div>
                  ))}
                </div>
                {activeQuestion.type === QuestionType.MULTIPLE_CHOICE && activeQuestion.answers.length < 4 && (
                  <button
                    onClick={() => updateQuestion({
                      answers: [
                        ...activeQuestion.answers,
                        { id: crypto.randomUUID(), text: "", isCorrect: false, orderIndex: activeQuestion.answers.length },
                      ],
                    })}
                    className="mt-3 text-sm text-accent hover:text-accent-hover transition-colors flex items-center gap-1"
                  >
                    <Plus size={14} /> Add answer
                  </button>
                )}
              </div>
            </div>
          </main>
        )}
      </div>
    </div>
  );
}
