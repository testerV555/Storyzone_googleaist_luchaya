import React, { useState, useEffect, useMemo } from "react";
import {
  Edit3,
  X,
  Sparkles,
  Save,
  Check,
  AlertCircle,
  RefreshCw,
  Loader2,
  Compass,
  ArrowRight,
  Zap,
} from "lucide-react";
import { sound } from "../utils/audio";
import { safeFetchJson } from "../utils/safeApi";
import { StoryChoice } from "../types";
import { extractAuthorStyleHeuristic } from "../utils/styleAnalyzer";

interface ChapterEditModalProps {
  isOpen: boolean;
  onClose: () => void;
  originalText: string;
  stepNumber: number;
  storyTitle: string;
  customApiKey?: string;
  currentChoices?: StoryChoice[];
  onSaveChapter: (
    editedText: string,
    updatedSummary?: string,
    newLoreFact?: string,
    updatedChoices?: StoryChoice[],
    targetStepNumber?: number,
    options?: {
      autoAdvanceNextStep?: boolean;
      nextLogicalStep?: {
        sceneText: string;
        actionLabel: string;
        choices: StoryChoice[];
      };
      extractedStyleDirective?: string;
    }
  ) => void;
}

export const ChapterEditModal: React.FC<ChapterEditModalProps> = ({
  isOpen,
  onClose,
  originalText,
  stepNumber,
  storyTitle,
  customApiKey,
  currentChoices,
  onSaveChapter,
}) => {
  const [editedText, setEditedText] = useState(originalText);
  const [syncWithMemory, setSyncWithMemory] = useState(true);
  const [adaptChoices, setAdaptChoices] = useState(true);
  const [mirrorAuthorStyle, setMirrorAuthorStyle] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [savingMode, setSavingMode] = useState<"choices" | "cascade">("choices");
  const [detectedChanges, setDetectedChanges] = useState<string[] | null>(null);

  // Compute live author style from current text
  const analyzedStyle = useMemo(() => {
    return extractAuthorStyleHeuristic(editedText);
  }, [editedText]);

  // Sync state with original text when modal opens or originalText updates
  useEffect(() => {
    if (isOpen) {
      setEditedText(originalText || "");
      setDetectedChanges(null);
    }
  }, [isOpen, originalText]);

  if (!isOpen) return null;

  const handleSave = async (autoAdvanceNextStep: boolean = false) => {
    if (!editedText.trim()) return;

    setSavingMode(autoAdvanceNextStep ? "cascade" : "choices");

    const fallbackChoices: StoryChoice[] = adaptChoices
      ? [
          {
            id: "1",
            label: "Продолжить действие на основе изменившейся обстановки",
            description: "Следовать новому направлению отредактированной главы",
          },
          {
            id: "2",
            label: "Оценить последствия произошедших событий",
            description: "Внимательно осмотреться и скорректировать план",
          },
          {
            id: "3",
            label: "Обсудить дальнейший шаг со спутниками",
            description: "Узнать их отношение к происходящему",
          },
        ]
      : (currentChoices || []);

    const fallbackSummary =
      editedText.length > 200
        ? editedText.slice(0, 200).trim() + "..."
        : editedText.trim();

    const fallbackNextStep = {
      actionLabel: "Сюжетное продолжение авторских правок",
      sceneText:
        "Мир вокруг незамедлительно отозвался на совершённые перемены. Напряжение в воздухе сменилось новой цепью событий, требующей дальнейших решений.",
      choices: fallbackChoices,
    };

    if (!syncWithMemory) {
      sound.playAction("item");
      onSaveChapter(
        editedText.trim(),
        fallbackSummary,
        undefined,
        adaptChoices ? fallbackChoices : undefined,
        stepNumber,
        {
          autoAdvanceNextStep,
          nextLogicalStep: autoAdvanceNextStep ? fallbackNextStep : undefined,
          extractedStyleDirective: mirrorAuthorStyle ? analyzedStyle.promptDirective : undefined,
        }
      );
      onClose();
      return;
    }

    setIsSaving(true);
    sound.playAction("magic");

    try {
      const res = await safeFetchJson<any>("/api/story/edit-chapter", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(customApiKey ? { "x-custom-api-key": customApiKey } : {}),
        },
        body: JSON.stringify({
          originalText,
          editedText: editedText.trim(),
          storyTitle,
          currentChoices: adaptChoices ? currentChoices : undefined,
          generateNextStep: autoAdvanceNextStep,
          customKey: customApiKey,
        }),
      });

      if (res.ok && res.data) {
        const data = res.data;
        if (data.detectedChanges) {
          setDetectedChanges(data.detectedChanges);
        }
        const choicesToApply =
          adaptChoices && Array.isArray(data.updatedChoices) && data.updatedChoices.length > 0
            ? data.updatedChoices
            : adaptChoices
            ? fallbackChoices
            : undefined;

        const styleDirective =
          mirrorAuthorStyle && data.extractedAuthorStyle?.promptDirective
            ? data.extractedAuthorStyle.promptDirective
            : mirrorAuthorStyle
            ? analyzedStyle.promptDirective
            : undefined;

        onSaveChapter(
          editedText.trim(),
          data.updatedSummary || fallbackSummary,
          data.newLoreFact,
          choicesToApply,
          stepNumber,
          {
            autoAdvanceNextStep,
            nextLogicalStep: autoAdvanceNextStep
              ? data.nextLogicalStep || fallbackNextStep
              : undefined,
            extractedStyleDirective: styleDirective,
          }
        );
        setTimeout(() => {
          onClose();
        }, 500);
      } else {
        onSaveChapter(
          editedText.trim(),
          fallbackSummary,
          undefined,
          adaptChoices ? fallbackChoices : undefined,
          stepNumber,
          {
            autoAdvanceNextStep,
            nextLogicalStep: autoAdvanceNextStep ? fallbackNextStep : undefined,
            extractedStyleDirective: mirrorAuthorStyle ? analyzedStyle.promptDirective : undefined,
          }
        );
        onClose();
      }
    } catch (e) {
      onSaveChapter(
        editedText.trim(),
        fallbackSummary,
        undefined,
        adaptChoices ? fallbackChoices : undefined,
        stepNumber,
        {
          autoAdvanceNextStep,
          nextLogicalStep: autoAdvanceNextStep ? fallbackNextStep : undefined,
          extractedStyleDirective: mirrorAuthorStyle ? analyzedStyle.promptDirective : undefined,
        }
      );
      onClose();
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/75 backdrop-blur-md animate-fade-in">
      <div className="relative w-full max-w-2xl max-h-[92vh] flex flex-col rounded-2xl bg-neutral-900 border border-neutral-800 shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-4 sm:p-5 border-b border-neutral-800 bg-neutral-950/60">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-amber-950/60 border border-amber-500/40 text-amber-400">
              <Edit3 className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-cinzel text-base sm:text-lg font-bold text-neutral-100 flex items-center gap-2">
                Редактирование Главы #{stepNumber}
              </h3>
              <p className="text-xs text-neutral-400">
                Сквозное обновление: пересчет последствий, обучение стилю автора и генерация следующего шага.
              </p>
            </div>
          </div>
          <button
            onClick={() => {
              sound.playClick();
              onClose();
            }}
            className="p-1.5 rounded-xl text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-4 sm:p-5 space-y-3.5 overflow-y-auto max-h-[68vh]">
          {/* Text Area */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-neutral-300">
                Художественный текст главы:
              </label>
              <div className="flex items-center gap-2">
                <span className="text-[10px] text-neutral-500 font-mono">
                  {editedText.trim().split(/\s+/).filter(Boolean).length} слов • {editedText.length} симв.
                </span>
                {editedText !== originalText && (
                  <button
                    type="button"
                    onClick={() => {
                      sound.playClick();
                      setEditedText(originalText || "");
                    }}
                    className="text-[10px] text-amber-400 hover:text-amber-300 underline transition-colors"
                  >
                    Вернуть исходный
                  </button>
                )}
              </div>
            </div>
            <textarea
              value={editedText}
              onChange={(e) => setEditedText(e.target.value)}
              rows={10}
              className="w-full p-3.5 rounded-xl bg-neutral-950 border border-neutral-800 text-xs sm:text-sm text-neutral-200 leading-relaxed placeholder-neutral-500 focus:outline-none focus:border-purple-500 transition-colors"
              placeholder="Текст текущей сцены..."
            />
          </div>

          {/* Live Style Recognition Banner */}
          <div className="p-3 rounded-xl bg-purple-950/40 border border-purple-800/50 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5 min-w-0">
              <Sparkles className="w-4 h-4 text-purple-400 shrink-0" />
              <div className="min-w-0">
                <span className="text-[10px] font-bold uppercase tracking-wider text-purple-300 block">
                  Анализ авторского стиля (обучение ИИ):
                </span>
                <span className="text-xs text-neutral-200 truncate block">
                  {analyzedStyle.styleSummary}
                </span>
                <div className="flex items-center gap-1.5 mt-0.5">
                  {analyzedStyle.keyMarkers.map((m, idx) => (
                    <span
                      key={idx}
                      className="text-[9px] px-1.5 py-0.5 rounded bg-purple-900/60 text-purple-300 font-medium"
                    >
                      {m}
                    </span>
                  ))}
                </div>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setMirrorAuthorStyle(!mirrorAuthorStyle)}
              className={`w-10 h-5 flex items-center rounded-full p-0.5 transition-colors shrink-0 ${
                mirrorAuthorStyle ? "bg-purple-600" : "bg-neutral-800"
              }`}
              title="Внедрить этот стиль в директиву ИИ Game Master"
            >
              <div
                className={`bg-white w-4 h-4 rounded-full shadow-md transform transition-transform ${
                  mirrorAuthorStyle ? "translate-x-5" : "translate-x-0"
                }`}
              />
            </button>
          </div>

          {/* Sync memory toggle */}
          <div className="p-2.5 rounded-xl bg-neutral-950 border border-neutral-800/80 flex items-center justify-between">
            <div className="space-y-0.5 pr-3">
              <span className="text-xs font-semibold text-neutral-200 flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-purple-400" />
                Синхронизировать память ИИ
              </span>
              <p className="text-[11px] text-neutral-400">
                ИИ обновит долгосрочную летопись, чтобы факты, предметы и раны из этого текста стали строгим каноном.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setSyncWithMemory(!syncWithMemory)}
              className={`w-10 h-5 flex items-center rounded-full p-0.5 transition-colors shrink-0 ${
                syncWithMemory ? "bg-purple-600" : "bg-neutral-800"
              }`}
            >
              <div
                className={`bg-white w-4 h-4 rounded-full shadow-md transform transition-transform ${
                  syncWithMemory ? "translate-x-5" : "translate-x-0"
                }`}
              />
            </button>
          </div>

          {/* Adapt choices toggle */}
          <div className="p-2.5 rounded-xl bg-neutral-950 border border-neutral-800/80 flex items-center justify-between">
            <div className="space-y-0.5 pr-3">
              <span className="text-xs font-semibold text-neutral-200 flex items-center gap-1.5">
                <Compass className="w-3.5 h-3.5 text-amber-400" />
                Принудительный пересчет последствий и вариантов (Choices)
              </span>
              <p className="text-[11px] text-neutral-400">
                ИИ пересчитает развилки и предложит 3 новых варианта действий, логично вытекающих из правок.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setAdaptChoices(!adaptChoices)}
              className={`w-10 h-5 flex items-center rounded-full p-0.5 transition-colors shrink-0 ${
                adaptChoices ? "bg-amber-600" : "bg-neutral-800"
              }`}
            >
              <div
                className={`bg-white w-4 h-4 rounded-full shadow-md transform transition-transform ${
                  adaptChoices ? "translate-x-5" : "translate-x-0"
                }`}
              />
            </button>
          </div>

          {detectedChanges && (
            <div className="p-3 rounded-xl bg-purple-950/40 border border-purple-800/40 text-xs text-purple-200 space-y-1 animate-fade-in">
              <span className="font-semibold flex items-center gap-1.5">
                <Check className="w-3.5 h-3.5 text-green-400" />
                Обнаруженные изменения учтены в памяти:
              </span>
              <ul className="list-disc list-inside space-y-0.5 text-[11px] text-purple-300">
                {detectedChanges.map((c, i) => (
                  <li key={i}>{c}</li>
                ))}
              </ul>
            </div>
          )}
        </div>

        {/* Footer actions with Dual Buttons: Adapt choices vs Cascade next step */}
        <div className="p-4 border-t border-neutral-800 bg-neutral-950/80 flex flex-wrap items-center justify-between gap-2.5">
          <button
            type="button"
            onClick={() => {
              sound.playClick();
              onClose();
            }}
            className="px-3 py-2 rounded-xl border border-neutral-800 text-xs text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800 transition-colors"
          >
            Отмена
          </button>

          <div className="flex items-center gap-2">
            {/* Standard: Save and adapt consequences */}
            <button
              type="button"
              disabled={isSaving || !editedText.trim()}
              onClick={() => handleSave(false)}
              className="px-3.5 py-2 rounded-xl bg-neutral-800 hover:bg-neutral-700 disabled:opacity-50 text-neutral-200 text-xs font-semibold flex items-center gap-1.5 border border-neutral-700 transition-all shadow-sm"
              title="Сохранить текст главы, пересчитать последствия и обучить стиль ИИ"
            >
              {isSaving && savingMode === "choices" ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Save className="w-3.5 h-3.5 text-amber-400" />
              )}
              <span>Пересчитать выборы</span>
            </button>

            {/* Cascade: Save, adapt and generate next logical step */}
            <button
              type="button"
              disabled={isSaving || !editedText.trim()}
              onClick={() => handleSave(true)}
              className="px-4 py-2 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 disabled:opacity-50 text-white text-xs font-semibold flex items-center gap-1.5 shadow-lg shadow-purple-950/50 transition-all hover:scale-[1.02] active:scale-[0.98]"
              title="Сквозное обновление: сохранить правки, перенять стиль и сразу сгенерировать следующий шаг истории"
            >
              {isSaving && savingMode === "cascade" ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Zap className="w-4 h-4 text-amber-300" />
              )}
              <span>⚡ Сквозное продолжение</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

