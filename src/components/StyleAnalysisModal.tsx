import React, { useState, useEffect } from "react";
import {
  X,
  Sparkles,
  CheckCircle2,
  AlertTriangle,
  Lightbulb,
  ArrowRight,
  RefreshCw,
  Sliders,
  Award,
  Check,
  Zap,
} from "lucide-react";
import { NarrativePOV, NarrativeStyle, StoryGenre, StyleAnalysisResult } from "../types";
import { sound } from "../utils/audio";
import { safeFetchJson } from "../utils/safeApi";

interface StyleAnalysisModalProps {
  isOpen: boolean;
  onClose: () => void;
  sceneText: string;
  targetStyle: NarrativeStyle;
  targetPOV: NarrativePOV;
  genre: StoryGenre;
  onApplyImprovedText: (text: string) => void;
  customApiKey?: string;
}

const STYLE_NAMES: Record<NarrativeStyle, string> = {
  [NarrativeStyle.LITERARY]: "Художественный & Метафоричный",
  [NarrativeStyle.CONVERSATIONAL]: "Живой & Разговорный",
  [NarrativeStyle.NOIR]: "Тёмный Нуар & Детектив",
  [NarrativeStyle.CINEMATIC]: "Кинематографичный Блокбастер",
  [NarrativeStyle.ANIME]: "Аниме & Ранобэ экспрессия",
  [NarrativeStyle.FANFICTION]: "Чувственный Фанфикшн",
  [NarrativeStyle.BRUTAL]: "Жёсткий Реализм & Экшен",
  [NarrativeStyle.CYBERPUNK]: "Киберпанк & Неон",
  [NarrativeStyle.SATIRE]: "Ирония & Сарказм",
  [NarrativeStyle.CUSTOM]: "Авторский стиль",
};

export const StyleAnalysisModal: React.FC<StyleAnalysisModalProps> = ({
  isOpen,
  onClose,
  sceneText,
  targetStyle,
  targetPOV,
  genre,
  onApplyImprovedText,
  customApiKey,
}) => {
  const [selectedStyle, setSelectedStyle] = useState<NarrativeStyle>(targetStyle);
  const [analysis, setAnalysis] = useState<StyleAnalysisResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [applied, setApplied] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setSelectedStyle(targetStyle);
      runAnalysis(targetStyle);
    }
  }, [isOpen, targetStyle]);

  const runAnalysis = async (styleToTest: NarrativeStyle) => {
    setIsLoading(true);
    setApplied(false);

    try {
      const res = await safeFetchJson<any>("/api/story/analyze-style", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sceneText,
          targetStyle: styleToTest,
          targetPOV,
          genre,
          customKey: customApiKey,
        }),
      });

      if (res.ok && res.data) {
        setAnalysis(res.data);
      }
    } catch (err) {
      console.error("Style analysis failed:", err);
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) return null;

  const getScoreColor = (score: number) => {
    if (score >= 85) return "text-emerald-400 border-emerald-500 bg-emerald-950/40";
    if (score >= 70) return "text-cyan-400 border-cyan-500 bg-cyan-950/40";
    if (score >= 50) return "text-amber-400 border-amber-500 bg-amber-950/40";
    return "text-rose-400 border-rose-500 bg-rose-950/40";
  };

  const handleApply = () => {
    if (!analysis?.improvedVersion) return;
    onApplyImprovedText(analysis.improvedVersion);
    setApplied(true);
    sound.playFanfare();
    setTimeout(() => {
      onClose();
    }, 1200);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/85 backdrop-blur-md animate-fade-in">
      <div className="relative w-full max-w-4xl bg-neutral-950 border border-neutral-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-neutral-800 bg-neutral-900/80">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-purple-950/80 border border-purple-800/60 flex items-center justify-center text-purple-400">
              <Award className="w-5 h-5" />
            </div>
            <div>
              <h2 className="font-cinzel text-lg font-bold text-neutral-100 flex items-center gap-2">
                Анализ Стиля ИИ & Качество Текста
                <span className="text-xs px-2 py-0.5 rounded-full bg-purple-950 border border-purple-800/60 text-purple-300 font-sans font-normal">
                  Литературный Критик
                </span>
              </h2>
              <p className="text-xs text-neutral-400">
                Оценка соответствия выбранному стилю повествования и советы по улучшению
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

        {/* Style selection toolbar */}
        <div className="px-6 py-3 border-b border-neutral-800/80 bg-neutral-950/60 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="text-xs text-neutral-400 flex items-center gap-1 font-semibold">
              <Sliders className="w-3.5 h-3.5 text-purple-400" />
              Целевой стиль:
            </span>
            <select
              value={selectedStyle}
              onChange={(e) => {
                const newStyle = e.target.value as NarrativeStyle;
                setSelectedStyle(newStyle);
                runAnalysis(newStyle);
              }}
              className="px-2.5 py-1 rounded-lg bg-neutral-900 border border-neutral-800 text-xs text-purple-300 font-medium focus:outline-none focus:border-purple-500"
            >
              {Object.entries(STYLE_NAMES).map(([key, name]) => (
                <option key={key} value={key}>
                  {name}
                </option>
              ))}
            </select>
          </div>

          <button
            onClick={() => runAnalysis(selectedStyle)}
            disabled={isLoading}
            className="px-3 py-1 rounded-lg bg-neutral-900 hover:bg-neutral-800 border border-neutral-800 text-xs text-neutral-300 flex items-center gap-1.5 transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? "animate-spin text-purple-400" : ""}`} />
            <span>Пересчитать анализ</span>
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6">
          {isLoading ? (
            <div className="py-16 flex flex-col items-center justify-center text-center space-y-3">
              <div className="w-12 h-12 rounded-2xl bg-purple-950 border border-purple-800 flex items-center justify-center text-purple-400 animate-spin">
                <Sparkles className="w-6 h-6" />
              </div>
              <h3 className="font-cinzel text-base font-bold text-neutral-200">
                ИИ-редактор анализирует текст главы...
              </h3>
              <p className="text-xs text-neutral-400 max-w-sm">
                Оцениваем ритм предложений, метафоры, динамику диалогов и соответствие стилю «{STYLE_NAMES[selectedStyle]}».
              </p>
            </div>
          ) : analysis ? (
            <div className="space-y-6">
              {/* Overall Score Banner */}
              <div className="p-5 rounded-2xl bg-gradient-to-r from-purple-950/40 via-neutral-900/60 to-purple-950/30 border border-purple-900/40 flex flex-wrap items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                  <div
                    className={`w-16 h-16 rounded-2xl border-2 flex flex-col items-center justify-center font-mono-code font-bold ${getScoreColor(
                      analysis.overallScore
                    )}`}
                  >
                    <span className="text-2xl leading-none">{analysis.overallScore}</span>
                    <span className="text-[10px] opacity-75">/ 100</span>
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-cinzel text-base font-bold text-neutral-100">
                        Соответствие стилю: {analysis.styleMatchRating || "Хорошо"}
                      </h3>
                      <span className="text-xs px-2 py-0.5 rounded-full bg-neutral-900 border border-neutral-800 text-purple-300 font-medium">
                        {STYLE_NAMES[selectedStyle]}
                      </span>
                    </div>
                    <p className="text-xs text-neutral-400 mt-0.5">
                      Текст выдержан в установленных границах жанра {genre}. Ниже представлены детальные метрики и советы.
                    </p>
                  </div>
                </div>
              </div>

              {/* 4 Metric Gauges */}
              {analysis.breakdown && (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div className="p-3.5 rounded-xl bg-neutral-900/70 border border-neutral-800/80">
                    <span className="text-[11px] text-neutral-400 font-medium block mb-1">
                      Словарный запас & Слог
                    </span>
                    <div className="flex items-center justify-between">
                      <span className="text-base font-bold font-mono text-purple-300">
                        {analysis.breakdown.vocabularyScore}%
                      </span>
                      <Zap className="w-4 h-4 text-purple-400" />
                    </div>
                    <div className="w-full h-1.5 rounded-full bg-neutral-950 mt-2 overflow-hidden">
                      <div
                        className="h-full bg-purple-500 rounded-full"
                        style={{ width: `${analysis.breakdown.vocabularyScore}%` }}
                      />
                    </div>
                  </div>

                  <div className="p-3.5 rounded-xl bg-neutral-900/70 border border-neutral-800/80">
                    <span className="text-[11px] text-neutral-400 font-medium block mb-1">
                      Темпоритм & Динамика
                    </span>
                    <div className="flex items-center justify-between">
                      <span className="text-base font-bold font-mono text-cyan-300">
                        {analysis.breakdown.pacingScore}%
                      </span>
                      <Zap className="w-4 h-4 text-cyan-400" />
                    </div>
                    <div className="w-full h-1.5 rounded-full bg-neutral-950 mt-2 overflow-hidden">
                      <div
                        className="h-full bg-cyan-500 rounded-full"
                        style={{ width: `${analysis.breakdown.pacingScore}%` }}
                      />
                    </div>
                  </div>

                  <div className="p-3.5 rounded-xl bg-neutral-900/70 border border-neutral-800/80">
                    <span className="text-[11px] text-neutral-400 font-medium block mb-1">
                      Баланс диалогов & Речи
                    </span>
                    <div className="flex items-center justify-between">
                      <span className="text-base font-bold font-mono text-amber-300">
                        {analysis.breakdown.dialogueBalanceScore}%
                      </span>
                      <Zap className="w-4 h-4 text-amber-400" />
                    </div>
                    <div className="w-full h-1.5 rounded-full bg-neutral-950 mt-2 overflow-hidden">
                      <div
                        className="h-full bg-amber-500 rounded-full"
                        style={{ width: `${analysis.breakdown.dialogueBalanceScore}%` }}
                      />
                    </div>
                  </div>

                  <div className="p-3.5 rounded-xl bg-neutral-900/70 border border-neutral-800/80">
                    <span className="text-[11px] text-neutral-400 font-medium block mb-1">
                      Атмосферность
                    </span>
                    <div className="flex items-center justify-between">
                      <span className="text-base font-bold font-mono text-emerald-300">
                        {analysis.breakdown.atmosphereScore}%
                      </span>
                      <Zap className="w-4 h-4 text-emerald-400" />
                    </div>
                    <div className="w-full h-1.5 rounded-full bg-neutral-950 mt-2 overflow-hidden">
                      <div
                        className="h-full bg-emerald-500 rounded-full"
                        style={{ width: `${analysis.breakdown.atmosphereScore}%` }}
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Strengths & Divergences */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Strengths */}
                <div className="p-4 rounded-xl bg-emerald-950/20 border border-emerald-800/40 space-y-2">
                  <h4 className="text-xs font-semibold text-emerald-300 flex items-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                    Сильные стороны текста:
                  </h4>
                  <ul className="text-xs text-neutral-300 space-y-1.5">
                    {(analysis.strengths || ["Удачный баланс решений"]).map((s, i) => (
                      <li key={i} className="flex items-start gap-1.5">
                        <span className="text-emerald-400 font-bold">•</span>
                        <span>{s}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                {/* Divergences */}
                <div className="p-4 rounded-xl bg-amber-950/20 border border-amber-800/40 space-y-2">
                  <h4 className="text-xs font-semibold text-amber-300 flex items-center gap-1.5">
                    <AlertTriangle className="w-4 h-4 text-amber-400" />
                    Замеченные отклонения от стиля:
                  </h4>
                  <ul className="text-xs text-neutral-300 space-y-1.5">
                    {(analysis.divergences || ["Стиль можно сделать выразительнее"]).map((d, i) => (
                      <li key={i} className="flex items-start gap-1.5">
                        <span className="text-amber-400 font-bold">•</span>
                        <span>{d}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>

              {/* Actionable Tips */}
              {analysis.actionableTips && analysis.actionableTips.length > 0 && (
                <div className="p-4 rounded-xl bg-neutral-900/80 border border-neutral-800 space-y-2">
                  <h4 className="text-xs font-semibold text-purple-300 flex items-center gap-1.5">
                    <Lightbulb className="w-4 h-4 text-purple-400" />
                    Рекомендации по улучшению текста:
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-neutral-300">
                    {analysis.actionableTips.map((tip, idx) => (
                      <div
                        key={idx}
                        className="p-2.5 rounded-lg bg-neutral-950 border border-neutral-800/80 flex items-start gap-2"
                      >
                        <ArrowRight className="w-3.5 h-3.5 text-purple-400 shrink-0 mt-0.5" />
                        <span>{tip}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* AI Improved Version with 1-click apply */}
              {analysis.improvedVersion && (
                <div className="p-5 rounded-2xl bg-neutral-900/90 border border-purple-800/50 shadow-xl space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="font-cinzel text-sm font-bold text-purple-200 flex items-center gap-2">
                      <Sparkles className="w-4 h-4 text-amber-400" />
                      Идеальная редакция сцены от ИИ ({STYLE_NAMES[selectedStyle]})
                    </h4>

                    <button
                      onClick={handleApply}
                      className={`px-3 py-1.5 rounded-xl text-xs font-semibold border flex items-center gap-1.5 transition-all ${
                        applied
                          ? "bg-emerald-950 border-emerald-600 text-emerald-300"
                          : "bg-purple-600 hover:bg-purple-500 border-purple-500 text-white shadow-md"
                      }`}
                    >
                      {applied ? (
                        <>
                          <Check className="w-3.5 h-3.5" />
                          <span>Применено в главу!</span>
                        </>
                      ) : (
                        <>
                          <Sparkles className="w-3.5 h-3.5" />
                          <span>Применить улучшение в главу</span>
                        </>
                      )}
                    </button>
                  </div>

                  <div className="font-story text-xs sm:text-sm text-neutral-200 whitespace-pre-line bg-neutral-950 p-4 rounded-xl border border-neutral-800 leading-relaxed max-h-60 overflow-y-auto">
                    {analysis.improvedVersion}
                  </div>
                </div>
              )}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
};
