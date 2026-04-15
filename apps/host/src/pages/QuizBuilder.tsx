import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Plus, Trash2, Check, ChevronLeft, Save, Clock, Star, GripVertical } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useApi } from "../hooks/useApi";
import { QuestionType } from "@slyquiz/shared";
import type { Quiz, Question } from "@slyquiz/shared";
import { motion, AnimatePresence } from "framer-motion";

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
      { id: crypto.randomUUID(), text: "", isCorrect: true,  orderIndex: 3 },
    ],
  };
}

const ANSWER_COLORS = [
  { bg: "bg-[#f23f5d]/20", border: "border-[#f23f5d]/40", dot: "#f23f5d", shape: "▲" },
  { bg: "bg-[#3d7fff]/20", border: "border-[#3d7fff]/40", dot: "#3d7fff", shape: "◆" },
  { bg: "bg-[#ffd426]/20", border: "border-[#ffd426]/40", dot: "#ffd426", shape: "●" },
  { bg: "bg-[#00d483]/20", border: "border-[#00d483]/40", dot: "#00d483", shape: "■" },
];

export default function QuizBuilder() {
  const { t: _t } = useTranslation();
  const navigate = useNavigate();
  const { id } = useParams<{ id?: string }>();
  const api = useApi();
  const queryClient = useQueryClient();

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [isPublic, setIsPublic] = useState(false);
  const [questions, setQuestions] = useState<DraftQuestion[]>([createBlankQuestion(0)]);
  const [activeIndex, setActiveIndex] = useState(0);
  const [saved, setSaved] = useState(false);

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
              id: a.id, text: a.text, isCorrect: a.isCorrect, orderIndex: a.orderIndex,
            })),
          }))
        );
      }
    }
  }, [existingQuiz]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        title, description: description || undefined, isPublic,
        questions: questions.map((q, qi) => ({
          type: q.type, text: q.text,
          mediaUrl: q.mediaUrl ?? undefined,
          timeLimit: q.timeLimit, points: q.points, orderIndex: qi,
          answers: q.answers.map((a, ai) => ({
            text: a.text, isCorrect: a.isCorrect, orderIndex: ai,
          })),
        })),
      };
      return id ? api.put(`/quizzes/${id}`, payload) : api.post<Quiz>("/quizzes", payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["quizzes"] });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    },
  });

  const activeQuestion = questions[activeIndex];

  function updateQuestion(updates: Partial<DraftQuestion>) {
    setQuestions((prev) => prev.map((q, i) => (i === activeIndex ? { ...q, ...updates } : q)));
  }

  function updateAnswer(answerId: string, updates: Partial<DraftAnswer>) {
    if (!activeQuestion) return;
    updateQuestion({ answers: activeQuestion.answers.map((a) => a.id === answerId ? { ...a, ...updates } : a) });
  }

  function setCorrectAnswer(answerId: string) {
    if (!activeQuestion) return;
    updateQuestion({ answers: activeQuestion.answers.map((a) => ({ ...a, isCorrect: a.id === answerId })) });
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
    <div className="h-screen bg-background flex flex-col overflow-hidden">
      {/* Top bar */}
      <header className="flex-none border-b border-white/6 px-4 py-3 flex items-center gap-3 bg-surface/50 backdrop-blur-xl">
        <button
          onClick={() => navigate("/")}
          className="p-2 rounded-xl text-text-secondary hover:text-text-primary hover:bg-surface-2 transition-colors"
        >
          <ChevronLeft size={18} />
        </button>

        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Quiz title…"
          className="flex-1 bg-transparent text-text-primary font-display font-bold text-lg placeholder-text-muted outline-none"
        />

        <label className="flex items-center gap-2 text-sm text-text-secondary cursor-pointer select-none">
          <div
            onClick={() => setIsPublic(!isPublic)}
            className={`w-9 h-5 rounded-full relative transition-colors ${isPublic ? "bg-accent" : "bg-surface-3"}`}
          >
            <div className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white transition-transform ${isPublic ? "translate-x-4" : ""}`} />
          </div>
          <span className="hidden sm:block">Public</span>
        </label>

        <button
          onClick={() => saveMutation.mutate()}
          disabled={saveMutation.isPending || !title.trim()}
          className={`btn-primary gap-2 text-sm transition-all ${saved ? "bg-success text-white" : ""}`}
        >
          {saved ? <Check size={14} /> : <Save size={14} />}
          {saved ? "Saved!" : "Save"}
        </button>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* Question sidebar */}
        <aside className="w-56 flex-none bg-surface border-r border-white/6 flex flex-col">
          <div className="flex-1 overflow-y-auto p-2 space-y-1">
            {questions.map((q, i) => (
              <button
                key={q.id}
                onClick={() => setActiveIndex(i)}
                className={`w-full text-left px-3 py-2.5 rounded-xl text-sm transition-all group flex items-center gap-2 ${
                  i === activeIndex
                    ? "bg-accent/15 text-accent border border-accent/25"
                    : "text-text-secondary hover:bg-surface-2 hover:text-text-primary"
                }`}
              >
                <GripVertical size={12} className="text-text-muted shrink-0" />
                <span className="flex-1 truncate font-medium">
                  {q.text || `Question ${i + 1}`}
                </span>
                {questions.length > 1 && (
                  <button
                    onClick={(e) => { e.stopPropagation(); deleteQuestion(i); }}
                    className="opacity-0 group-hover:opacity-100 text-text-muted hover:text-coral transition-all p-0.5 rounded"
                  >
                    <Trash2 size={10} />
                  </button>
                )}
              </button>
            ))}
          </div>
          <div className="p-2 border-t border-white/6">
            <button onClick={addQuestion} className="btn-secondary w-full text-xs py-2 gap-1.5">
              <Plus size={12} /> Add question
            </button>
          </div>
        </aside>

        {/* Question editor */}
        {activeQuestion && (
          <main className="flex-1 overflow-y-auto p-6">
            <AnimatePresence mode="wait">
              <motion.div
                key={activeQuestion.id}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ ease: [0.16, 1, 0.3, 1], duration: 0.3 }}
                className="max-w-2xl mx-auto space-y-5"
              >
                {/* Type selector */}
                <div className="flex gap-2">
                  {[
                    { type: QuestionType.MULTIPLE_CHOICE, label: "Multiple Choice" },
                    { type: QuestionType.TRUE_FALSE,      label: "True / False" },
                    { type: QuestionType.POLL,            label: "Poll" },
                  ].map(({ type, label }) => (
                    <button
                      key={type}
                      onClick={() => {
                        if (type === QuestionType.TRUE_FALSE) {
                          updateQuestion({
                            type,
                            answers: [
                              { id: crypto.randomUUID(), text: "True",  isCorrect: true,  orderIndex: 0 },
                              { id: crypto.randomUUID(), text: "False", isCorrect: false, orderIndex: 1 },
                            ],
                          });
                        } else { updateQuestion({ type }); }
                      }}
                      className={`px-3 py-1.5 rounded-xl text-sm font-semibold transition-all ${
                        activeQuestion.type === type
                          ? "bg-accent text-background"
                          : "bg-surface-2 text-text-secondary hover:text-text-primary hover:bg-surface-3"
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>

                {/* Question text */}
                <div>
                  <label className="block text-xs font-semibold text-text-secondary mb-2 tracking-widest uppercase">
                    Question
                  </label>
                  <textarea
                    value={activeQuestion.text}
                    onChange={(e) => updateQuestion({ text: e.target.value })}
                    placeholder="Type your question here…"
                    rows={3}
                    className="input-field resize-none text-base font-medium leading-relaxed"
                  />
                </div>

                {/* Time & Points */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="flex items-center gap-1.5 text-xs font-semibold text-text-secondary mb-2 tracking-widest uppercase">
                      <Clock size={12} /> Time Limit
                    </label>
                    <select
                      value={activeQuestion.timeLimit}
                      onChange={(e) => updateQuestion({ timeLimit: Number(e.target.value) })}
                      className="input-field"
                    >
                      {[5, 10, 15, 20, 30, 45, 60, 90, 120].map((s) => (
                        <option key={s} value={s}>{s} seconds</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="flex items-center gap-1.5 text-xs font-semibold text-text-secondary mb-2 tracking-widest uppercase">
                      <Star size={12} /> Points
                    </label>
                    <select
                      value={activeQuestion.points}
                      onChange={(e) => updateQuestion({ points: Number(e.target.value) })}
                      className="input-field"
                    >
                      {[0, 500, 1000, 2000].map((p) => (
                        <option key={p} value={p}>{p === 0 ? "No points (Poll)" : `${p} points`}</option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Answers */}
                <div>
                  <label className="block text-xs font-semibold text-text-secondary mb-3 tracking-widest uppercase">
                    Answers
                  </label>
                  <div className="grid grid-cols-2 gap-3">
                    {activeQuestion.answers.map((answer, ai) => {
                      const style = ANSWER_COLORS[ai] ?? ANSWER_COLORS[0]!;
                      return (
                        <div
                          key={answer.id}
                          className={`relative rounded-2xl border-2 p-3.5 transition-all ${
                            answer.isCorrect && activeQuestion.type !== QuestionType.POLL
                              ? "border-success/60 bg-success/8"
                              : `${style.border} ${style.bg}`
                          }`}
                        >
                          <div className="flex items-center gap-2 mb-2">
                            <span className="text-base" style={{ color: style.dot }}>{style.shape}</span>
                            <span className="text-xs font-mono text-text-muted">{["A", "B", "C", "D"][ai]}</span>
                          </div>
                          <input
                            type="text"
                            value={answer.text}
                            onChange={(e) => updateAnswer(answer.id, { text: e.target.value })}
                            placeholder={`Answer ${ai + 1}`}
                            className="bg-transparent text-text-primary placeholder-text-muted outline-none w-full text-sm font-medium"
                            disabled={activeQuestion.type === QuestionType.TRUE_FALSE}
                          />
                          {activeQuestion.type !== QuestionType.POLL && (
                            <button
                              onClick={() => setCorrectAnswer(answer.id)}
                              className={`absolute top-2.5 right-2.5 w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all ${
                                answer.isCorrect
                                  ? "bg-success border-success text-white"
                                  : "border-white/20 hover:border-success/50"
                              }`}
                            >
                              {answer.isCorrect && <Check size={11} />}
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </div>

                  {activeQuestion.type === QuestionType.MULTIPLE_CHOICE && activeQuestion.answers.length < 4 && (
                    <button
                      onClick={() => updateQuestion({
                        answers: [...activeQuestion.answers, {
                          id: crypto.randomUUID(), text: "", isCorrect: false,
                          orderIndex: activeQuestion.answers.length,
                        }],
                      })}
                      className="mt-3 text-sm text-accent hover:underline flex items-center gap-1.5"
                    >
                      <Plus size={14} /> Add answer option
                    </button>
                  )}
                </div>
              </motion.div>
            </AnimatePresence>
          </main>
        )}
      </div>
    </div>
  );
}
