import { useState } from "react";
import { motion } from "framer-motion";
import { useTranslation } from "react-i18next";
import { Shuffle } from "lucide-react";

export interface AvatarConfig {
  body: number;
  skin: number;
  hair: number;
  outfit: number;
  accessory: number;
  color: string;
}

const BODY_COUNT = 3;
const SKIN_COLORS = ["#FDDBB4", "#F1C27D", "#C68642", "#8D5524", "#4A2C17"];
const HAIR_COUNT = 5;
const OUTFIT_COUNT = 4;
const ACCESSORY_COUNT = 4;
const BG_COLORS = [
  "#6EE7F7", "#F87171", "#FBBF24", "#4ADE80",
  "#A78BFA", "#F472B6", "#60A5FA", "#34D399",
];

function randomInt(max: number) {
  return Math.floor(Math.random() * max);
}

function randomConfig(): AvatarConfig {
  return {
    body: randomInt(BODY_COUNT),
    skin: randomInt(SKIN_COLORS.length),
    hair: randomInt(HAIR_COUNT),
    outfit: randomInt(OUTFIT_COUNT),
    accessory: randomInt(ACCESSORY_COUNT),
    color: BG_COLORS[randomInt(BG_COLORS.length)] ?? "#6EE7F7",
  };
}

export function configToString(config: AvatarConfig): string {
  return JSON.stringify(config);
}

export function AvatarSVG({ config, size = 80 }: { config: AvatarConfig; size?: number }) {
  const skinColor = SKIN_COLORS[config.skin] ?? SKIN_COLORS[0]!;
  const hairColors = ["#2C1810", "#8B4513", "#DAA520", "#FF6347", "#708090"];
  const hairColor = hairColors[config.hair] ?? hairColors[0]!;
  const outfitColors = ["#3B82F6", "#EF4444", "#22C55E", "#8B5CF6"];
  const outfitColor = outfitColors[config.outfit] ?? outfitColors[0]!;

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      xmlns="http://www.w3.org/2000/svg"
    >
      {/* Background circle */}
      <circle cx="50" cy="50" r="50" fill={config.color} />
      {/* Body */}
      <rect x="25" y="60" width="50" height="35" rx="10" fill={outfitColor} />
      {/* Neck */}
      <rect x="42" y="52" width="16" height="12" rx="4" fill={skinColor} />
      {/* Head */}
      <ellipse cx="50" cy="42" rx="22" ry="22" fill={skinColor} />
      {/* Hair styles */}
      {config.hair === 0 && (
        <ellipse cx="50" cy="22" rx="22" ry="10" fill={hairColor} />
      )}
      {config.hair === 1 && (
        <>
          <ellipse cx="50" cy="22" rx="22" ry="10" fill={hairColor} />
          <rect x="28" y="18" width="6" height="16" rx="3" fill={hairColor} />
          <rect x="66" y="18" width="6" height="16" rx="3" fill={hairColor} />
        </>
      )}
      {config.hair === 2 && (
        <ellipse cx="50" cy="20" rx="22" ry="12" fill={hairColor} />
      )}
      {config.hair === 3 && (
        <>
          <ellipse cx="50" cy="20" rx="22" ry="12" fill={hairColor} />
          <rect x="37" y="14" width="26" height="8" rx="4" fill={hairColor} />
        </>
      )}
      {config.hair === 4 && (
        <rect x="29" y="14" width="42" height="12" rx="6" fill={hairColor} />
      )}
      {/* Eyes */}
      <circle cx="41" cy="42" r="4" fill="white" />
      <circle cx="59" cy="42" r="4" fill="white" />
      <circle cx="42" cy="43" r="2" fill="#1a1a2e" />
      <circle cx="60" cy="43" r="2" fill="#1a1a2e" />
      {/* Mouth */}
      <path d="M 42 54 Q 50 60 58 54" stroke="#8B4513" strokeWidth="2" fill="none" strokeLinecap="round" />
      {/* Accessories */}
      {config.accessory === 1 && (
        <rect x="29" y="38" width="42" height="8" rx="4" fill="#1a1a2e" fillOpacity="0.7" />
      )}
      {config.accessory === 2 && (
        <ellipse cx="50" cy="20" rx="22" ry="6" fill="#F59E0B" />
      )}
      {config.accessory === 3 && (
        <>
          <circle cx="41" cy="42" r="6" fill="none" stroke="#6EE7F7" strokeWidth="2" />
          <circle cx="59" cy="42" r="6" fill="none" stroke="#6EE7F7" strokeWidth="2" />
          <line x1="47" y1="42" x2="53" y2="42" stroke="#6EE7F7" strokeWidth="2" />
        </>
      )}
    </svg>
  );
}

interface AvatarBuilderProps {
  onConfirm: (config: AvatarConfig) => void;
}

export default function AvatarBuilder({ onConfirm }: AvatarBuilderProps) {
  const { t } = useTranslation();
  const [config, setConfig] = useState<AvatarConfig>(randomConfig);

  function update(key: keyof AvatarConfig, value: number | string) {
    setConfig((prev) => ({ ...prev, [key]: value }));
  }

  return (
    <div className="flex flex-col h-full p-6 gap-6">
      <div className="text-center">
        <h2 className="text-2xl font-bold text-text-primary">{t("avatar.title")}</h2>
        <p className="text-text-secondary text-sm mt-1">{t("avatar.subtitle")}</p>
      </div>

      {/* Avatar preview */}
      <div className="flex justify-center">
        <motion.div
          key={JSON.stringify(config)}
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: "spring", stiffness: 300, damping: 20 }}
        >
          <AvatarSVG config={config} size={140} />
        </motion.div>
      </div>

      {/* Customization options */}
      <div className="space-y-4 flex-1">
        {/* Background color */}
        <div>
          <label className="text-sm text-text-secondary mb-2 block">Background</label>
          <div className="flex gap-2 flex-wrap">
            {BG_COLORS.map((color) => (
              <button
                key={color}
                onClick={() => update("color", color)}
                className={`w-8 h-8 rounded-full border-2 transition-all ${
                  config.color === color ? "border-white scale-110" : "border-transparent"
                }`}
                style={{ backgroundColor: color }}
              />
            ))}
          </div>
        </div>

        {/* Skin */}
        <div>
          <label className="text-sm text-text-secondary mb-2 block">{t("avatar.skin")}</label>
          <div className="flex gap-2">
            {SKIN_COLORS.map((color, i) => (
              <button
                key={i}
                onClick={() => update("skin", i)}
                className={`w-8 h-8 rounded-full border-2 transition-all ${
                  config.skin === i ? "border-white scale-110" : "border-transparent"
                }`}
                style={{ backgroundColor: color }}
              />
            ))}
          </div>
        </div>

        {/* Hair */}
        <div>
          <label className="text-sm text-text-secondary mb-2 block">{t("avatar.hair")}</label>
          <div className="flex gap-2">
            {Array.from({ length: HAIR_COUNT }, (_, i) => (
              <button
                key={i}
                onClick={() => update("hair", i)}
                className={`w-10 h-10 rounded-xl text-xs font-bold transition-all ${
                  config.hair === i
                    ? "bg-accent text-background"
                    : "bg-surface-2 text-text-secondary hover:bg-surface"
                }`}
              >
                {i + 1}
              </button>
            ))}
          </div>
        </div>

        {/* Outfit */}
        <div>
          <label className="text-sm text-text-secondary mb-2 block">{t("avatar.outfit")}</label>
          <div className="flex gap-2">
            {["#3B82F6", "#EF4444", "#22C55E", "#8B5CF6"].map((color, i) => (
              <button
                key={i}
                onClick={() => update("outfit", i)}
                className={`w-8 h-8 rounded-full border-2 transition-all ${
                  config.outfit === i ? "border-white scale-110" : "border-transparent"
                }`}
                style={{ backgroundColor: color }}
              />
            ))}
          </div>
        </div>

        {/* Accessory */}
        <div>
          <label className="text-sm text-text-secondary mb-2 block">{t("avatar.accessory")}</label>
          <div className="flex gap-2">
            {["None", "Shades", "Hat", "Glasses"].map((name, i) => (
              <button
                key={i}
                onClick={() => update("accessory", i)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                  config.accessory === i
                    ? "bg-accent text-background"
                    : "bg-surface-2 text-text-secondary"
                }`}
              >
                {name}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="flex gap-3">
        <button
          onClick={() => setConfig(randomConfig())}
          className="flex items-center gap-2 bg-surface-2 text-text-secondary px-4 py-3 rounded-2xl font-semibold"
        >
          <Shuffle size={18} />
          {t("avatar.randomize")}
        </button>
        <button
          onClick={() => onConfirm(config)}
          className="btn-primary"
        >
          {t("avatar.ready")}
        </button>
      </div>
    </div>
  );
}
