import { useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Shuffle, Check, Camera, X } from "lucide-react";

export interface AvatarConfig {
  body: number;
  skin: number;
  hair: number;
  outfit: number;
  accessory: number;
  color: string;
  photo?: string; // base64 data URL if user uploaded a photo
}

const SKIN_COLORS = ["#fddbb4", "#f1c27d", "#c68642", "#8d5524", "#4a2c17"];
const HAIR_COUNT = 5;
const OUTFIT_COUNT = 4;
const ACCESSORY_COUNT = 4;
const BG_COLORS = [
  "#b8ff35", "#38d9f5", "#ff4d6d", "#ffd426",
  "#00d483", "#a78bfa", "#f472b6", "#fb923c",
];

function randomInt(max: number) { return Math.floor(Math.random() * max); }

function randomConfig(): AvatarConfig {
  return {
    body: randomInt(3),
    skin: randomInt(SKIN_COLORS.length),
    hair: randomInt(HAIR_COUNT),
    outfit: randomInt(OUTFIT_COUNT),
    accessory: randomInt(ACCESSORY_COUNT),
    color: BG_COLORS[randomInt(BG_COLORS.length)] ?? "#b8ff35",
  };
}

export function configToString(config: AvatarConfig): string {
  return JSON.stringify(config);
}

export function AvatarSVG({ config, size = 80 }: { config: AvatarConfig; size?: number }) {
  // If user uploaded a photo, render it as a circular image
  if (config.photo) {
    return (
      <svg width={size} height={size} viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <clipPath id="circle-clip">
            <circle cx="50" cy="50" r="50" />
          </clipPath>
        </defs>
        <image href={config.photo} x="0" y="0" width="100" height="100" clipPath="url(#circle-clip)" preserveAspectRatio="xMidYMid slice" />
      </svg>
    );
  }
  const skinColor = SKIN_COLORS[config.skin] ?? SKIN_COLORS[0]!;
  const hairColors = ["#1a0a00", "#6b3a2a", "#d4a017", "#e03030", "#607080"];
  const hairColor = hairColors[config.hair] ?? hairColors[0]!;
  const outfitColors = ["#3d7fff", "#f23f5d", "#00d483", "#9f7aea"];
  const outfitColor = outfitColors[config.outfit] ?? outfitColors[0]!;

  return (
    <svg width={size} height={size} viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
      <circle cx="50" cy="50" r="50" fill={config.color} />
      {/* Body */}
      <rect x="22" y="62" width="56" height="34" rx="12" fill={outfitColor} />
      {/* Neck */}
      <rect x="42" y="54" width="16" height="12" rx="5" fill={skinColor} />
      {/* Head */}
      <ellipse cx="50" cy="43" rx="23" ry="23" fill={skinColor} />
      {/* Hair */}
      {config.hair === 0 && <ellipse cx="50" cy="22" rx="23" ry="11" fill={hairColor} />}
      {config.hair === 1 && <>
        <ellipse cx="50" cy="22" rx="23" ry="11" fill={hairColor} />
        <rect x="27" y="18" width="7" height="18" rx="3.5" fill={hairColor} />
        <rect x="66" y="18" width="7" height="18" rx="3.5" fill={hairColor} />
      </>}
      {config.hair === 2 && <path d="M 27 30 Q 28 14 50 14 Q 72 14 73 30 Q 70 18 50 19 Q 30 18 27 30Z" fill={hairColor} />}
      {config.hair === 3 && <>
        <ellipse cx="50" cy="20" rx="23" ry="12" fill={hairColor} />
        <rect x="36" y="13" width="28" height="9" rx="4.5" fill={hairColor} />
      </>}
      {config.hair === 4 && <rect x="28" y="13" width="44" height="13" rx="6.5" fill={hairColor} />}
      {/* Eyes */}
      <ellipse cx="40" cy="44" rx="5" ry="5" fill="white" />
      <ellipse cx="60" cy="44" rx="5" ry="5" fill="white" />
      <circle cx="41" cy="45" r="2.5" fill="#0a0a1a" />
      <circle cx="61" cy="45" r="2.5" fill="#0a0a1a" />
      <circle cx="42" cy="44" r="1" fill="white" />
      <circle cx="62" cy="44" r="1" fill="white" />
      {/* Smile */}
      <path d="M 40 57 Q 50 64 60 57" stroke={skinColor === "#fddbb4" ? "#c47a50" : "#a0522d"} strokeWidth="2.5" fill="none" strokeLinecap="round" />
      {/* Accessories */}
      {config.accessory === 1 && (
        <rect x="28" y="41" width="44" height="7" rx="3.5" fill="rgba(10,10,30,0.75)" />
      )}
      {config.accessory === 2 && (
        <ellipse cx="50" cy="19" rx="24" ry="7" fill="#ffd426" />
      )}
      {config.accessory === 3 && <>
        <circle cx="40" cy="44" r="7" fill="none" stroke="#38d9f5" strokeWidth="2" />
        <circle cx="60" cy="44" r="7" fill="none" stroke="#38d9f5" strokeWidth="2" />
        <line x1="47" y1="44" x2="53" y2="44" stroke="#38d9f5" strokeWidth="2" />
      </>}
    </svg>
  );
}

interface AvatarBuilderProps {
  onConfirm: (config: AvatarConfig) => void;
  nickname?: string;
}

type Panel = "color" | "skin" | "hair" | "outfit" | "extra" | "photo";

export default function AvatarBuilder({ onConfirm, nickname }: AvatarBuilderProps) {
  const [config, setConfig] = useState<AvatarConfig>(randomConfig);
  const [activePanel, setActivePanel] = useState<Panel>("color");
  const photoInputRef = useRef<HTMLInputElement>(null);

  function update(key: keyof AvatarConfig, value: number | string) {
    setConfig((prev) => ({ ...prev, [key]: value }));
  }

  function handlePhotoUpload(file: File) {
    const reader = new FileReader();
    reader.onload = (e) => {
      const dataUrl = e.target?.result as string;
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        canvas.width = 200;
        canvas.height = 200;
        const ctx = canvas.getContext("2d")!;
        // Circle clip
        ctx.beginPath();
        ctx.arc(100, 100, 100, 0, Math.PI * 2);
        ctx.closePath();
        ctx.clip();
        // Draw image centered/cropped
        const size = Math.min(img.width, img.height);
        const sx = (img.width - size) / 2;
        const sy = (img.height - size) / 2;
        ctx.drawImage(img, sx, sy, size, size, 0, 0, 200, 200);
        const compressed = canvas.toDataURL("image/jpeg", 0.75);
        setConfig((prev) => ({ ...prev, photo: compressed }));
      };
      img.src = dataUrl;
    };
    reader.readAsDataURL(file);
  }

  const panels: { key: Panel; label: string; emoji: string }[] = [
    { key: "photo",  label: "Photo", emoji: "📷" },
    { key: "color", label: "BG", emoji: "🎨" },
    { key: "skin",  label: "Skin", emoji: "✋" },
    { key: "hair",  label: "Hair", emoji: "💇" },
    { key: "outfit", label: "Fit", emoji: "👕" },
    { key: "extra", label: "Extra", emoji: "✨" },
  ];

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-6 pt-4 pb-2 text-center">
        <h2 className="font-display font-bold text-xl text-text-primary">Build your avatar</h2>
        {nickname && <p className="text-text-secondary text-sm mt-0.5">{nickname}</p>}
      </div>

      {/* Avatar preview */}
      <div className="flex justify-center items-center py-4 relative">
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="w-40 h-40 rounded-full" style={{ background: "radial-gradient(circle, rgba(184,255,53,0.12) 0%, transparent 70%)" }} />
        </div>
        <AnimatePresence mode="wait">
          <motion.div
            key={`${config.skin}-${config.hair}-${config.outfit}-${config.color}-${config.accessory}`}
            initial={{ scale: 0.85, opacity: 0, rotate: -5 }}
            animate={{ scale: 1, opacity: 1, rotate: 0 }}
            transition={{ type: "spring", stiffness: 350, damping: 22 }}
          >
            <AvatarSVG config={config} size={130} />
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Panel tabs */}
      <div className="flex gap-1 px-4 pb-3 overflow-x-auto no-scrollbar">
        {panels.map((p) => (
          <button
            key={p.key}
            onClick={() => setActivePanel(p.key)}
            className={`flex-1 min-w-[60px] py-2 rounded-xl text-xs font-semibold transition-all whitespace-nowrap ${
              activePanel === p.key
                ? "bg-accent text-background"
                : "bg-surface-2 text-text-secondary hover:text-text-primary"
            }`}
          >
            {p.emoji} {p.label}
          </button>
        ))}
      </div>

      {/* Panel content */}
      <div className="flex-1 px-4 overflow-y-auto">
        <AnimatePresence mode="wait">
          <motion.div
            key={activePanel}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.18 }}
            className="pb-2"
          >
            {activePanel === "photo" && (
              <div className="flex flex-col items-center gap-4 py-2">
                {config.photo ? (
                  <>
                    <div className="relative">
                      <img src={config.photo} alt="Your photo" className="w-24 h-24 rounded-full object-cover border-2 border-accent" />
                      <button
                        onClick={() => setConfig((prev) => ({ ...prev, photo: undefined }))}
                        className="absolute -top-1 -right-1 w-6 h-6 bg-surface-3 border border-white/20 rounded-full flex items-center justify-center"
                      >
                        <X size={12} className="text-text-secondary" />
                      </button>
                    </div>
                    <p className="text-xs text-text-muted text-center">Looking good!</p>
                    <button
                      onClick={() => photoInputRef.current?.click()}
                      className="text-xs text-accent underline"
                    >
                      Change photo
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      onClick={() => photoInputRef.current?.click()}
                      className="w-24 h-24 rounded-full border-2 border-dashed border-white/20 flex flex-col items-center justify-center gap-1 text-text-muted hover:border-accent/50 hover:text-accent transition-colors active:scale-95"
                    >
                      <Camera size={24} />
                      <span className="text-xs font-medium">Upload</span>
                    </button>
                    <p className="text-xs text-text-muted text-center px-4">
                      Use your own photo as avatar.<br />It will be cropped to a circle.
                    </p>
                  </>
                )}
                <input
                  ref={photoInputRef}
                  type="file"
                  accept="image/*"
                  capture="user"
                  className="hidden"
                  onChange={(e) => { const f = e.target.files?.[0]; if (f) handlePhotoUpload(f); }}
                />
              </div>
            )}

            {activePanel === "color" && (
              <div className="grid grid-cols-4 gap-3">
                {BG_COLORS.map((color) => (
                  <button
                    key={color}
                    onClick={() => update("color", color)}
                    className="aspect-square rounded-2xl relative border-2 transition-all active:scale-90"
                    style={{ background: color, borderColor: config.color === color ? "white" : "transparent" }}
                  >
                    {config.color === color && (
                      <Check size={16} className="absolute inset-0 m-auto text-black" strokeWidth={3} />
                    )}
                  </button>
                ))}
              </div>
            )}

            {activePanel === "skin" && (
              <div className="flex gap-3 justify-center">
                {SKIN_COLORS.map((color, i) => (
                  <button
                    key={i}
                    onClick={() => update("skin", i)}
                    className="w-12 h-12 rounded-2xl border-2 transition-all active:scale-90 relative"
                    style={{ background: color, borderColor: config.skin === i ? "white" : "transparent" }}
                  >
                    {config.skin === i && (
                      <Check size={14} className="absolute inset-0 m-auto" style={{ color: i < 2 ? "#333" : "white" }} strokeWidth={3} />
                    )}
                  </button>
                ))}
              </div>
            )}

            {activePanel === "hair" && (
              <div className="grid grid-cols-5 gap-2">
                {Array.from({ length: HAIR_COUNT }, (_, i) => (
                  <button
                    key={i}
                    onClick={() => update("hair", i)}
                    className={`py-3 rounded-2xl text-sm font-bold transition-all active:scale-90 ${
                      config.hair === i ? "bg-accent text-background" : "bg-surface-2 text-text-secondary"
                    }`}
                  >
                    {["Short", "Curly", "Wavy", "Mohawk", "Flat"][i]}
                  </button>
                ))}
              </div>
            )}

            {activePanel === "outfit" && (
              <div className="grid grid-cols-4 gap-3">
                {["#3d7fff", "#f23f5d", "#00d483", "#9f7aea"].map((color, i) => (
                  <button
                    key={i}
                    onClick={() => update("outfit", i)}
                    className="aspect-square rounded-2xl border-2 relative transition-all active:scale-90"
                    style={{ background: color, borderColor: config.outfit === i ? "white" : "transparent" }}
                  >
                    {config.outfit === i && <Check size={16} className="absolute inset-0 m-auto text-white" strokeWidth={3} />}
                  </button>
                ))}
              </div>
            )}

            {activePanel === "extra" && (
              <div className="grid grid-cols-2 gap-3">
                {[
                  { label: "None", emoji: "😊" },
                  { label: "Shades", emoji: "😎" },
                  { label: "Crown", emoji: "👑" },
                  { label: "Glasses", emoji: "🤓" },
                ].map((item, i) => (
                  <button
                    key={i}
                    onClick={() => update("accessory", i)}
                    className={`flex items-center gap-3 px-4 py-3 rounded-2xl border-2 transition-all text-sm font-semibold active:scale-95 ${
                      config.accessory === i
                        ? "border-accent bg-accent/10 text-accent"
                        : "border-white/8 bg-surface-2 text-text-secondary"
                    }`}
                  >
                    <span className="text-2xl">{item.emoji}</span>
                    {item.label}
                  </button>
                ))}
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Actions */}
      <div className="flex gap-3 px-4 pb-6 pt-3">
        <button
          onClick={() => setConfig(randomConfig())}
          className="flex items-center gap-2 bg-surface-2 text-text-secondary px-4 py-4 rounded-2xl font-semibold text-sm hover:bg-surface-3 transition-colors active:scale-95"
        >
          <Shuffle size={16} />
          Random
        </button>
        <button onClick={() => onConfirm(config)} className="btn-primary flex-1">
          I'm ready! →
        </button>
      </div>
    </div>
  );
}
