import React, { useState } from "react";
import {
  X,
  Sparkles,
  Download,
  Image as ImageIcon,
  Check,
  Copy,
  Maximize2,
  RefreshCw,
  Palette,
  Eye,
  Sliders,
} from "lucide-react";
import { Character, StoryGenre } from "../types";
import { sound } from "../utils/audio";
import { safeFetchJson } from "../utils/safeApi";

interface SceneArtModalProps {
  isOpen: boolean;
  onClose: () => void;
  sceneText: string;
  storyTitle: string;
  genre: StoryGenre;
  atmosphere?: string;
  characters: Character[];
  currentArtUrl?: string;
  onApplySceneArt: (url: string) => void;
  customApiKey?: string;
}

const ART_STYLES = [
  { id: "cinematic digital painting", label: "Кинематографичная живопись", icon: "🎬" },
  { id: "dark fantasy oil illustration", label: "Тёмное фэнтези / Масло", icon: "⚔️" },
  { id: "anime light novel key visual", label: "Аниме / Ранобэ арт", icon: "🌸" },
  { id: "neon cyberpunk concept art", label: "Неоновый киберпанк", icon: "🌆" },
  { id: "gothic watercolor book sketch", label: "Готическая акварель", icon: "📜" },
  { id: "epic hyperrealistic matte painting", label: "Гиперреализм", icon: "🌌" },
];

export const SceneArtModal: React.FC<SceneArtModalProps> = ({
  isOpen,
  onClose,
  sceneText,
  storyTitle,
  genre,
  atmosphere = "mysterious",
  characters,
  currentArtUrl,
  onApplySceneArt,
  customApiKey,
}) => {
  const [selectedStyle, setSelectedStyle] = useState(ART_STYLES[0].id);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedArt, setGeneratedArt] = useState<{
    imageUrl: string;
    prompt: string;
    isAiGenerated: boolean;
    artNotes: string;
  } | null>(
    currentArtUrl
      ? {
          imageUrl: currentArtUrl,
          prompt: "Иллюстрация текущей главы",
          isAiGenerated: true,
          artNotes: "Визуальное сопровождение сцены.",
        }
      : null
  );
  const [copiedPrompt, setCopiedPrompt] = useState(false);
  const [applied, setApplied] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);

  if (!isOpen) return null;

  const handleGenerate = async () => {
    setIsGenerating(true);
    setApplied(false);
    sound.playClick();

    try {
      const res = await safeFetchJson<any>("/api/ai/generate-scene-art", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sceneText,
          storyTitle,
          genre,
          atmosphere,
          characters,
          artStyle: selectedStyle,
          customKey: customApiKey,
        }),
      });

      const data = res.data;
      if (data && data.imageUrl) {
        setGeneratedArt({
          imageUrl: data.imageUrl,
          prompt: data.prompt || "Визуальный арт",
          isAiGenerated: data.isAiGenerated ?? false,
          artNotes: data.artNotes || "Арт успешно сформирован.",
        });
        sound.playFanfare();
      }
    } catch (e) {
      console.error("Art generation error:", e);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleCopyPrompt = () => {
    if (!generatedArt?.prompt) return;
    navigator.clipboard.writeText(generatedArt.prompt);
    setCopiedPrompt(true);
    setTimeout(() => setCopiedPrompt(false), 2000);
  };

  const handleApply = () => {
    if (!generatedArt?.imageUrl) return;
    onApplySceneArt(generatedArt.imageUrl);
    setApplied(true);
    sound.playClick();
    setTimeout(() => setApplied(false), 3000);
  };

  const handleDownload = () => {
    if (!generatedArt?.imageUrl) return;
    const link = document.createElement("a");
    link.href = generatedArt.imageUrl;
    link.download = `StoryZone_${storyTitle.replace(/\s+/g, "_")}_SceneArt.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/85 backdrop-blur-md animate-fade-in">
      <div className="relative w-full max-w-4xl bg-neutral-950 border border-neutral-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-neutral-800 bg-neutral-900/80">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-purple-950/80 border border-purple-800/60 flex items-center justify-center text-purple-400">
              <Palette className="w-5 h-5" />
            </div>
            <div>
              <h2 className="font-cinzel text-lg font-bold text-neutral-100 flex items-center gap-2">
                Генератор Арта Сцены (ИИ)
                <span className="text-xs px-2 py-0.5 rounded-full bg-purple-950 border border-purple-800/60 text-purple-300 font-sans font-normal">
                  Визуализация
                </span>
              </h2>
              <p className="text-xs text-neutral-400">
                Превратите текст главы и эмоции персонажей в захватывающий арт
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg bg-neutral-900 hover:bg-neutral-800 text-neutral-400 hover:text-neutral-200 border border-neutral-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6">
          {/* Style Selector */}
          <div>
            <label className="text-xs font-semibold text-neutral-300 mb-2 flex items-center gap-1.5">
              <Sliders className="w-3.5 h-3.5 text-purple-400" />
              Выберите художественный стиль иллюстрации:
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {ART_STYLES.map((style) => (
                <button
                  key={style.id}
                  onClick={() => setSelectedStyle(style.id)}
                  className={`p-2.5 rounded-xl border text-xs text-left flex items-center gap-2 transition-all ${
                    selectedStyle === style.id
                      ? "bg-purple-950/70 border-purple-600 text-purple-200 font-semibold shadow-md"
                      : "bg-neutral-900/60 border-neutral-800 text-neutral-400 hover:text-neutral-200 hover:border-neutral-700"
                  }`}
                >
                  <span className="text-base">{style.icon}</span>
                  <span className="truncate">{style.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Action Button */}
          <button
            onClick={handleGenerate}
            disabled={isGenerating}
            className="w-full py-3.5 px-4 rounded-xl bg-gradient-to-r from-purple-700 via-indigo-600 to-purple-800 hover:from-purple-600 hover:to-indigo-500 text-white font-semibold text-sm shadow-xl flex items-center justify-center gap-2 transition-all disabled:opacity-50"
          >
            {isGenerating ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin text-purple-200" />
                <span>ИИ рисует сцену (анализ света, персонажей и композиции)...</span>
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4 text-amber-300" />
                <span>
                  {generatedArt ? "Сгенерировать другой вариант арта" : "Сгенерировать арт текущей сцены"}
                </span>
              </>
            )}
          </button>

          {/* Art Display Area */}
          {isGenerating ? (
            <div className="w-full h-72 sm:h-96 rounded-2xl border border-purple-900/50 bg-neutral-900/60 flex flex-col items-center justify-center p-6 text-center space-y-3 animate-pulse">
              <div className="w-14 h-14 rounded-2xl bg-purple-900/40 border border-purple-700/60 flex items-center justify-center text-purple-300">
                <Palette className="w-7 h-7 animate-bounce" />
              </div>
              <h4 className="text-sm font-semibold text-purple-200 font-cinzel">
                ИИ-Художник создаёт иллюстрацию...
              </h4>
              <p className="text-xs text-neutral-400 max-w-sm">
                Извлекаем ключевые образы персонажей ({(characters || []).map((c) => c.name).join(", ") || "протагонист"}), выстраиваем композицию и атмосферу «{atmosphere}».
              </p>
            </div>
          ) : generatedArt ? (
            <div className="space-y-4">
              {/* Image Frame */}
              <div className="relative rounded-2xl overflow-hidden border border-neutral-800 shadow-2xl group bg-black aspect-video max-h-[420px] flex items-center justify-center">
                <img
                  src={generatedArt.imageUrl}
                  alt="Scene Art"
                  className="w-full h-full object-cover"
                />

                {/* Overlay actions on hover */}
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-black/40 opacity-0 group-hover:opacity-100 transition-opacity p-4 flex flex-col justify-between">
                  <div className="flex items-center justify-between">
                    <span className="px-2.5 py-1 rounded-full bg-neutral-950/80 backdrop-blur-md text-xs text-purple-300 border border-purple-800/60">
                      {generatedArt.isAiGenerated ? "✨ Сгенерировано ИИ" : "🎨 Атмосферная иллюстрация"}
                    </span>
                    <button
                      onClick={() => setIsFullscreen(true)}
                      className="p-2 rounded-xl bg-neutral-900/80 hover:bg-neutral-800 text-neutral-200 backdrop-blur-md border border-neutral-700"
                      title="Во весь экран"
                    >
                      <Maximize2 className="w-4 h-4" />
                    </button>
                  </div>

                  <div className="flex items-center gap-2 justify-end">
                    <button
                      onClick={handleDownload}
                      className="px-3 py-1.5 rounded-xl bg-neutral-900/80 hover:bg-neutral-800 text-neutral-200 text-xs font-medium border border-neutral-700 flex items-center gap-1.5"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>Скачать</span>
                    </button>
                    <button
                      onClick={handleApply}
                      className={`px-3 py-1.5 rounded-xl text-xs font-medium border flex items-center gap-1.5 transition-all ${
                        applied
                          ? "bg-emerald-950 border-emerald-600 text-emerald-300"
                          : "bg-purple-600 hover:bg-purple-500 border-purple-500 text-white"
                      }`}
                    >
                      {applied ? <Check className="w-3.5 h-3.5" /> : <ImageIcon className="w-3.5 h-3.5" />}
                      <span>{applied ? "Установлено обложкой!" : "Установить обложкой главы"}</span>
                    </button>
                  </div>
                </div>
              </div>

              {/* Bottom Details & Prompt */}
              <div className="p-4 rounded-xl bg-neutral-900/70 border border-neutral-800/80 space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-neutral-300 flex items-center gap-1.5">
                    <Eye className="w-3.5 h-3.5 text-purple-400" />
                    Концепт-промпт ИИ для визуализации:
                  </span>
                  <button
                    onClick={handleCopyPrompt}
                    className="text-xs text-purple-400 hover:text-purple-300 flex items-center gap-1 transition-colors"
                  >
                    {copiedPrompt ? (
                      <>
                        <Check className="w-3 h-3 text-emerald-400" />
                        <span className="text-emerald-400">Скопировано</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3 h-3" />
                        <span>Копировать промпт</span>
                      </>
                    )}
                  </button>
                </div>
                <p className="text-xs text-neutral-400 font-mono bg-neutral-950 p-2.5 rounded-lg border border-neutral-800 leading-relaxed">
                  {generatedArt.prompt}
                </p>
                {generatedArt.artNotes && (
                  <p className="text-xs text-neutral-300 italic">
                    {generatedArt.artNotes}
                  </p>
                )}
              </div>
            </div>
          ) : (
            <div className="p-8 text-center text-xs text-neutral-500 border border-dashed border-neutral-800 rounded-2xl">
              Нажмите кнопку выше, чтобы ИИ сгенерировал кинематографичную иллюстрацию для текущей сцены.
            </div>
          )}
        </div>
      </div>

      {/* Fullscreen Lightbox */}
      {isFullscreen && generatedArt?.imageUrl && (
        <div
          className="fixed inset-0 z-60 bg-black/95 flex items-center justify-center p-4 cursor-pointer"
          onClick={() => setIsFullscreen(false)}
        >
          <img
            src={generatedArt.imageUrl}
            alt="Fullscreen Scene Art"
            className="max-w-full max-h-full object-contain rounded-xl shadow-2xl"
          />
          <button
            onClick={() => setIsFullscreen(false)}
            className="absolute top-6 right-6 p-2 rounded-full bg-neutral-900/80 text-white hover:bg-neutral-800"
          >
            <X className="w-6 h-6" />
          </button>
        </div>
      )}
    </div>
  );
};
