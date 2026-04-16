import { useState, useEffect, useRef } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  Plus, Trash2, Check, ChevronLeft, Save, Clock, Star,
  GripVertical, Image as ImageIcon, X, Upload, ChevronDown,
  AlignLeft, BarChart2, ToggleLeft, List, Sliders,
} from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useApi } from "../hooks/useApi";
import { QuestionType } from "@slyquiz/shared";
import type { Quiz, Question } from "@slyquiz/shared";
import { motion, AnimatePresence } from "framer-motion";
import {
  DndContext, closestCenter, PointerSensor, useSensor, useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext, useSortable, verticalListSortingStrategy, arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

// ─── Types ────────────────────────────────────────────────────────────────────

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
  // Slider-specific
  sliderMin?: number;
  sliderMax?: number;
  sliderCorrect?: number;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const ANSWER_COLORS = [
  { bg: "bg-[#f23f5d]/20", border: "border-[#f23f5d]/40", active: "border-[#f23f5d]", dot: "#f23f5d", shape: "▲" },
  { bg: "bg-[#3d7fff]/20", border: "border-[#3d7fff]/40", active: "border-[#3d7fff]",  dot: "#3d7fff", shape: "◆" },
  { bg: "bg-[#ffd426]/20", border: "border-[#ffd426]/40", active: "border-[#ffd426]", dot: "#ffd426", shape: "●" },
  { bg: "bg-[#00d483]/20", border: "border-[#00d483]/40", active: "border-[#00d483]", dot: "#00d483", shape: "■" },
];

const QUESTION_TYPES: { type: QuestionType; label: string; icon: React.ReactNode; description: string }[] = [
  { type: QuestionType.MULTIPLE_CHOICE, label: "Multiple Choice", icon: <List size={14} />, description: "Up to 4 options" },
  { type: QuestionType.TRUE_FALSE,      label: "True / False",    icon: <ToggleLeft size={14} />, description: "Simple binary" },
  { type: QuestionType.TYPE_ANSWER,     label: "Type Answer",     icon: <AlignLeft size={14} />, description: "Free text input" },
  { type: QuestionType.POLL,            label: "Poll",            icon: <BarChart2 size={14} />, description: "No correct answer" },
  { type: QuestionType.SLIDER,          label: "Slider",          icon: <Sliders size={14} />, description: "Numeric range" },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

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

function defaultAnswersForType(type: QuestionType): DraftAnswer[] {
  switch (type) {
    case QuestionType.TRUE_FALSE:
      return [
        { id: crypto.randomUUID(), text: "True",  isCorrect: true,  orderIndex: 0 },
        { id: crypto.randomUUID(), text: "False", isCorrect: false, orderIndex: 1 },
      ];
    case QuestionType.TYPE_ANSWER:
    case QuestionType.SLIDER:
      return [];
    case QuestionType.POLL:
    case QuestionType.MULTIPLE_CHOICE:
    default:
      return [
        { id: crypto.randomUUID(), text: "", isCorrect: false, orderIndex: 0 },
        { id: crypto.randomUUID(), text: "", isCorrect: false, orderIndex: 1 },
        { id: crypto.randomUUID(), text: "", isCorrect: false, orderIndex: 2 },
        { id: crypto.randomUUID(), text: "", isCorrect: true,  orderIndex: 3 },
      ];
  }
}

// ─── Sortable question item ───────────────────────────────────────────────────

function SortableQuestionItem({
  q, index, isActive, onClick, onDelete, canDelete,
}: {
  q: DraftQuestion;
  index: number;
  isActive: boolean;
  onClick: () => void;
  onDelete: () => void;
  canDelete: boolean;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: q.id });

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.4 : 1 }}
      className={`w-full text-left px-3 py-2.5 rounded-xl text-sm transition-all group flex items-center gap-2 cursor-pointer select-none ${
        isActive
          ? "bg-accent/15 text-accent border border-accent/25"
          : "text-text-secondary hover:bg-surface-2 hover:text-text-primary border border-transparent"
      }`}
      onClick={onClick}
    >
      <button
        {...attributes}
        {...listeners}
        className="text-text-muted hover:text-text-secondary cursor-grab active:cursor-grabbing p-0.5 shrink-0"
        onClick={(e) => e.stopPropagation()}
      >
        <GripVertical size={12} />
      </button>
      <span className="flex-1 truncate font-medium text-xs">
        {q.text || `Q${index + 1}`}
      </span>
      {canDelete && (
        <button
          onClick={(e) => { e.stopPropagation(); onDelete(); }}
          className="opacity-0 group-hover:opacity-100 text-text-muted hover:text-[#f23f5d] transition-all p-0.5 rounded shrink-0"
        >
          <Trash2 size={10} />
        </button>
      )}
    </div>
  );
}

// ─── Kahoot Import Modal ──────────────────────────────────────────────────────

function KahootImportModal({ onClose, onImport }: { onClose: () => void; onImport: (json: string) => void }) {
  const [json, setJson] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => setJson(ev.target?.result as string);
    reader.readAsText(file);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="bg-surface border border-white/10 rounded-2xl p-6 w-full max-w-lg shadow-2xl"
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-display font-bold text-lg text-text-primary">Import from Kahoot</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg text-text-secondary hover:text-text-primary hover:bg-surface-2">
            <X size={16} />
          </button>
        </div>

        <p className="text-sm text-text-secondary mb-4">
          Export your quiz from Kahoot as JSON, then paste it below or upload the file.
        </p>

        <div className="space-y-3">
          <button
            onClick={() => fileRef.current?.click()}
            className="w-full border-2 border-dashed border-white/15 rounded-xl p-4 text-sm text-text-secondary hover:border-accent/40 hover:text-accent transition-colors flex items-center justify-center gap-2"
          >
            <Upload size={16} /> Upload .json file
          </button>
          <input ref={fileRef} type="file" accept=".json,application/json" className="hidden" onChange={handleFile} />

          <div className="relative">
            <div className="absolute inset-x-0 top-1/2 h-px bg-white/10" />
            <div className="relative flex justify-center">
              <span className="bg-surface px-3 text-xs text-text-muted">or paste JSON</span>
            </div>
          </div>

          <textarea
            value={json}
            onChange={(e) => setJson(e.target.value)}
            placeholder='{ "title": "My Quiz", "questions": [...] }'
            rows={6}
            className="input-field resize-none text-xs font-mono"
          />
        </div>

        <div className="flex gap-3 mt-5">
          <button onClick={onClose} className="btn-secondary flex-1">Cancel</button>
          <button
            onClick={() => { if (json.trim()) onImport(json); }}
            disabled={!json.trim()}
            className="btn-primary flex-1"
          >
            Import Quiz
          </button>
        </div>
      </motion.div>
    </div>
  );
}

// ─── Media Upload ─────────────────────────────────────────────────────────────

function MediaUpload({
  mediaUrl, onUpload, onClear,
}: {
  mediaUrl: string | null;
  onUpload: (file: File) => void;
  onClear: () => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);

  if (mediaUrl) {
    return (
      <div className="relative rounded-2xl overflow-hidden border border-white/10 group">
        <img src={mediaUrl} alt="Question media" className="w-full max-h-48 object-cover" />
        <button
          onClick={onClear}
          className="absolute top-2 right-2 bg-black/60 backdrop-blur-sm text-white rounded-full p-1.5 opacity-0 group-hover:opacity-100 transition-opacity"
        >
          <X size={14} />
        </button>
      </div>
    );
  }

  return (
    <button
      onClick={() => inputRef.current?.click()}
      className="w-full border-2 border-dashed border-white/12 rounded-2xl p-5 flex flex-col items-center gap-2 text-text-muted hover:border-accent/40 hover:text-accent transition-colors"
    >
      <ImageIcon size={20} />
      <span className="text-xs font-medium">Add image</span>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => { const f = e.target.files?.[0]; if (f) onUpload(f); }}
      />
    </button>
  );
}

// ─── Type Selector Dropdown ───────────────────────────────────────────────────

function TypeSelector({
  value, onChange,
}: {
  value: QuestionType;
  onChange: (type: QuestionType) => void;
}) {
  const [open, setOpen] = useState(false);
  const current = QUESTION_TYPES.find((t) => t.type === value)!;

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-surface-2 text-text-secondary hover:text-text-primary text-sm font-semibold transition-colors border border-white/8"
      >
        {current.icon}
        {current.label}
        <ChevronDown size={12} className={`transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.15 }}
            className="absolute top-full mt-1 left-0 z-20 bg-surface border border-white/10 rounded-xl shadow-2xl overflow-hidden min-w-[220px]"
          >
            {QUESTION_TYPES.map(({ type, label, icon, description }) => (
              <button
                key={type}
                onClick={() => { onChange(type); setOpen(false); }}
                className={`w-full flex items-center gap-3 px-4 py-2.5 text-left hover:bg-surface-2 transition-colors ${
                  type === value ? "text-accent" : "text-text-secondary hover:text-text-primary"
                }`}
              >
                <span className="shrink-0">{icon}</span>
                <div>
                  <div className="text-sm font-semibold">{label}</div>
                  <div className="text-xs text-text-muted">{description}</div>
                </div>
                {type === value && <Check size={12} className="ml-auto shrink-0" />}
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── Answer Editor by type ────────────────────────────────────────────────────

function AnswerEditor({
  question, onUpdateQuestion,
}: {
  question: DraftQuestion;
  onUpdateQuestion: (u: Partial<DraftQuestion>) => void;
}) {
  function updateAnswer(answerId: string, updates: Partial<DraftAnswer>) {
    onUpdateQuestion({ answers: question.answers.map((a) => a.id === answerId ? { ...a, ...updates } : a) });
  }
  function setCorrect(answerId: string) {
    onUpdateQuestion({ answers: question.answers.map((a) => ({ ...a, isCorrect: a.id === answerId })) });
  }

  // Type Answer
  if (question.type === QuestionType.TYPE_ANSWER) {
    const correctAnswer = question.answers[0];
    return (
      <div>
        <label className="block text-xs font-semibold text-text-secondary mb-2 tracking-widest uppercase">
          Correct Answer
        </label>
        <div className="relative">
          <input
            type="text"
            value={correctAnswer?.text ?? ""}
            onChange={(e) => {
              if (correctAnswer) {
                updateAnswer(correctAnswer.id, { text: e.target.value });
              } else {
                onUpdateQuestion({ answers: [{ id: crypto.randomUUID(), text: e.target.value, isCorrect: true, orderIndex: 0 }] });
              }
            }}
            placeholder="Type the correct answer…"
            className="input-field pr-10"
          />
          <Check size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-[#00d483]" />
        </div>
        <p className="text-xs text-text-muted mt-2">Players must type this exact answer (case-insensitive).</p>
      </div>
    );
  }

  // Slider
  if (question.type === QuestionType.SLIDER) {
    const min = question.sliderMin ?? 0;
    const max = question.sliderMax ?? 100;
    const correct = question.sliderCorrect ?? 50;
    return (
      <div className="space-y-4">
        <label className="block text-xs font-semibold text-text-secondary tracking-widest uppercase">
          Slider Range
        </label>
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: "Min", value: min, key: "sliderMin" as const },
            { label: "Correct", value: correct, key: "sliderCorrect" as const },
            { label: "Max", value: max, key: "sliderMax" as const },
          ].map(({ label, value, key }) => (
            <div key={key}>
              <label className="block text-xs text-text-muted mb-1">{label}</label>
              <input
                type="number"
                value={value}
                onChange={(e) => onUpdateQuestion({ [key]: Number(e.target.value) })}
                className="input-field text-center"
              />
            </div>
          ))}
        </div>
        <div className="bg-surface-2 rounded-xl p-3">
          <input
            type="range"
            min={min} max={max} value={correct}
            onChange={(e) => onUpdateQuestion({ sliderCorrect: Number(e.target.value) })}
            className="w-full accent-accent"
          />
          <div className="flex justify-between text-xs text-text-muted mt-1">
            <span>{min}</span>
            <span className="text-accent font-bold">{correct}</span>
            <span>{max}</span>
          </div>
        </div>
      </div>
    );
  }

  // Poll / MC / True-False — grid of answer cards
  const isPoll = question.type === QuestionType.POLL;
  const isTF = question.type === QuestionType.TRUE_FALSE;

  return (
    <div>
      <label className="block text-xs font-semibold text-text-secondary mb-3 tracking-widest uppercase">
        Answers {isPoll && <span className="text-text-muted normal-case font-normal">(no correct answer)</span>}
      </label>
      <div className="grid grid-cols-2 gap-3">
        {question.answers.map((answer, ai) => {
          const style = ANSWER_COLORS[ai] ?? ANSWER_COLORS[0]!;
          const isCorrect = answer.isCorrect && !isPoll;
          return (
            <div
              key={answer.id}
              className={`relative rounded-2xl border-2 p-3.5 transition-all ${
                isCorrect ? "border-[#00d483]/60 bg-[#00d483]/8" : `${style.border} ${style.bg}`
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
                disabled={isTF}
                className="bg-transparent text-text-primary placeholder-text-muted outline-none w-full text-sm font-medium disabled:cursor-default"
              />
              {!isPoll && (
                <button
                  onClick={() => setCorrect(answer.id)}
                  className={`absolute top-2.5 right-2.5 w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all ${
                    isCorrect ? "bg-[#00d483] border-[#00d483] text-white" : "border-white/20 hover:border-[#00d483]/50"
                  }`}
                >
                  {isCorrect && <Check size={11} />}
                </button>
              )}
            </div>
          );
        })}
      </div>

      {question.type === QuestionType.MULTIPLE_CHOICE && question.answers.length < 4 && (
        <button
          onClick={() => onUpdateQuestion({
            answers: [...question.answers, {
              id: crypto.randomUUID(), text: "", isCorrect: false,
              orderIndex: question.answers.length,
            }],
          })}
          className="mt-3 text-sm text-accent hover:underline flex items-center gap-1.5"
        >
          <Plus size={14} /> Add answer option
        </button>
      )}
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

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
  const [showImport, setShowImport] = useState(false);
  const [uploadingMedia, setUploadingMedia] = useState(false);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  // ── Load existing quiz ──────────────────────────────────────────────────────

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

  // ── Save ────────────────────────────────────────────────────────────────────

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

  // ── Question mutations ──────────────────────────────────────────────────────

  const activeQuestion = questions[activeIndex];

  function updateQuestion(updates: Partial<DraftQuestion>) {
    setQuestions((prev) => prev.map((q, i) => (i === activeIndex ? { ...q, ...updates } : q)));
  }

  function changeQuestionType(type: QuestionType) {
    updateQuestion({ type, answers: defaultAnswersForType(type) });
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

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = questions.findIndex((q) => q.id === active.id);
    const newIndex = questions.findIndex((q) => q.id === over.id);
    const reordered = arrayMove(questions, oldIndex, newIndex);
    setQuestions(reordered);
    // Keep active selection tracking the same question
    setActiveIndex(newIndex === activeIndex ? oldIndex : newIndex === activeIndex ? oldIndex : activeIndex === oldIndex ? newIndex : activeIndex);
  }

  // ── Media upload ────────────────────────────────────────────────────────────

  async function handleMediaUpload(file: File) {
    setUploadingMedia(true);
    try {
      const result = await api.upload<{ url: string; key: string }>("/upload", file);
      updateQuestion({ mediaUrl: result.url });
    } catch (err) {
      console.error("Upload failed", err);
    } finally {
      setUploadingMedia(false);
    }
  }

  // ── Kahoot import ───────────────────────────────────────────────────────────

  async function handleKahootImport(json: string) {
    try {
      const parsed = JSON.parse(json);
      const result = await api.post<Quiz>("/quizzes/import", parsed);
      setShowImport(false);
      navigate(`/quiz/${result.id}`);
    } catch (err) {
      console.error("Import failed", err);
    }
  }

  // ─── Render ─────────────────────────────────────────────────────────────────

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
          className="flex-1 bg-transparent text-text-primary font-display font-bold text-lg placeholder-text-muted outline-none min-w-0"
        />

        <button
          onClick={() => setShowImport(true)}
          className="btn-secondary gap-2 text-xs hidden sm:flex"
        >
          <Upload size={13} /> Import
        </button>

        <label className="flex items-center gap-2 text-sm text-text-secondary cursor-pointer select-none shrink-0">
          <div
            onClick={() => setIsPublic(!isPublic)}
            className={`w-9 h-5 rounded-full relative transition-colors ${isPublic ? "bg-accent" : "bg-surface-3"}`}
          >
            <div className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white transition-transform ${isPublic ? "translate-x-4" : ""}`} />
          </div>
          <span className="hidden sm:block text-xs">Public</span>
        </label>

        <button
          onClick={() => saveMutation.mutate()}
          disabled={saveMutation.isPending || !title.trim()}
          className={`btn-primary gap-2 text-sm shrink-0 transition-all ${saved ? "bg-[#00d483] text-white" : ""}`}
        >
          {saved ? <Check size={14} /> : <Save size={14} />}
          {saved ? "Saved!" : "Save"}
        </button>
      </header>

      <div className="flex flex-1 overflow-hidden">

        {/* Question sidebar */}
        <aside className="w-52 flex-none bg-surface border-r border-white/6 flex flex-col">
          <div className="px-2 pt-2 pb-1">
            <span className="text-xs font-semibold text-text-muted tracking-widest uppercase px-1">
              {questions.length} Question{questions.length !== 1 ? "s" : ""}
            </span>
          </div>

          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <SortableContext items={questions.map((q) => q.id)} strategy={verticalListSortingStrategy}>
              <div className="flex-1 overflow-y-auto px-2 pb-2 space-y-0.5">
                {questions.map((q, i) => (
                  <SortableQuestionItem
                    key={q.id}
                    q={q}
                    index={i}
                    isActive={i === activeIndex}
                    onClick={() => setActiveIndex(i)}
                    onDelete={() => deleteQuestion(i)}
                    canDelete={questions.length > 1}
                  />
                ))}
              </div>
            </SortableContext>
          </DndContext>

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
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ ease: [0.16, 1, 0.3, 1], duration: 0.25 }}
                className="max-w-2xl mx-auto space-y-5"
              >
                {/* Type selector */}
                <div className="flex items-center gap-3">
                  <TypeSelector value={activeQuestion.type} onChange={changeQuestionType} />
                  <span className="text-xs text-text-muted">
                    Q{activeIndex + 1} of {questions.length}
                  </span>
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

                {/* Media */}
                <div>
                  <label className="block text-xs font-semibold text-text-secondary mb-2 tracking-widest uppercase">
                    Media {uploadingMedia && <span className="text-accent normal-case font-normal">Uploading…</span>}
                  </label>
                  <MediaUpload
                    mediaUrl={activeQuestion.mediaUrl}
                    onUpload={handleMediaUpload}
                    onClear={() => updateQuestion({ mediaUrl: null })}
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
                        <option key={s} value={s}>{s}s</option>
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
                        <option key={p} value={p}>{p === 0 ? "No points" : `${p} pts`}</option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Answers */}
                <AnswerEditor question={activeQuestion} onUpdateQuestion={updateQuestion} />
              </motion.div>
            </AnimatePresence>
          </main>
        )}
      </div>

      {/* Kahoot import modal */}
      <AnimatePresence>
        {showImport && (
          <KahootImportModal
            onClose={() => setShowImport(false)}
            onImport={handleKahootImport}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
