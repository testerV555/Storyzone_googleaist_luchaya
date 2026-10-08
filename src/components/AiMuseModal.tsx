import React, { useState } from "react";
import { Sparkles, X, Lightbulb, MessageSquare, Zap, Loader2, ArrowRight } from "lucide-react";
import { sound } from "../utils/audio";
import { safeFetchJson } from "../utils/safeApi";
import { Character } from "../types";

interface AiMuseModalProps {
  isOpen: boolean;
  onClose: () => void;
  storyTitle: string;
  genre: string;
  currentScene: string;
  characters: Character[];
  customApiKey?: string;
  onApplySuggestion: (suggestionText: string) => void;
}

export const AiMuseModal: React.FC<AiMuseModalProps> = ({
  isOpen,
  onClose,
  storyTitle,
  genre,
  currentScene,
  characters,
  customApiKey,
  onApplySuggestion,
}) => {
  const [museType, setMuseType] = useState<"action" | "speech" | "twist">("action");
  const [suggestions, setSuggestions] = useState<
    { title: string; text: string; flair?: string }[]
  >([]);
  const [isLoading, setIsLoading] = useState(false);
  const [hasFetched, setHasFetched] = useState(false);

  if (!isOpen) return null;

  const fetchSuggestions = async (type: "action" | "speech" | "twist") => {
    setIsLoading(true);
    setMuseType(type);
    sound.playAction("magic");

    try {
      const res = await safeFetchJson<any>("/api/story/muse", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(customApiKey ? { "x-custom-api-key": customApiKey } : {}),
        },
        body: JSON.stringify({
          storyTitle,
          genre,
          currentScene,
          characters,
          museType: type,
          customKey: customApiKey,
        }),
      });

      if (res.ok && res.data) {
        setSuggestions(res.data.suggestions || []);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoading(false);
      setHasFetched(true);
    }
  };

  // Initial load if not fetched
  if (!hasFetched && !isLoading) {
    fetchSuggestions("action");
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/75 backdrop-blur-md animate-fade-in">
      <div className="relative w-full max-w-lg flex flex-col rounded-2xl bg-neutral-900 border border-neutral-800 shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-4 sm:p-5 border-b border-neutral-800 bg-neutral-950/60">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-purple-950/60 border border-purple-500/40 text-purple-400">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-cinzel text-base sm:text-lg font-bold text-neutral-100 flex items-center gap-2">
                Литературная Муза ИИ
              </h3>
              <p className="text-xs text-neutral-400">
                Получите авторский совет: тактический ход, меткую фразу или внезапный поворот событий
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

        {/* Category Switcher */}
        <div className="grid grid-cols-3 gap-2 p-3 bg-neutral-950/40 border-b border-neutral-800">
          <button
            type="button"
            onClick={() => fetchSuggestions("action")}
            className={`py-2 px-2.5 rounded-xl border text-xs font-semibold flex items-center justify-center gap-1.5 transition-all ${
              museType === "action"
                ? "bg-purple-950/60 border-purple-500 text-purple-200 shadow-md"
                : "bg-neutral-900/60 border-neutral-800 text-neutral-400 hover:text-neutral-200"
            }`}
          >
            <Lightbulb className="w-3.5 h-3.5" />
            Что сделать?
          </button>
          <button
            type="button"
            onClick={() => fetchSuggestions("speech")}
            className={`py-2 px-2.5 rounded-xl border text-xs font-semibold flex items-center justify-center gap-1.5 transition-all ${
              museType === "speech"
                ? "bg-purple-950/60 border-purple-500 text-purple-200 shadow-md"
                : "bg-neutral-900/60 border-neutral-800 text-neutral-400 hover:text-neutral-200"
            }`}
          >
            <MessageSquare className="w-3.5 h-3.5" />
            Что сказать?
          </button>
          <button
            type="button"
            onClick={() => fetchSuggestions("twist")}
            className={`py-2 px-2.5 rounded-xl border text-xs font-semibold flex items-center justify-center gap-1.5 transition-all ${
              museType === "twist"
                ? "bg-purple-950/60 border-purple-500 text-purple-200 shadow-md"
                : "bg-neutral-900/60 border-neutral-800 text-neutral-400 hover:text-neutral-200"
            }`}
          >
            <Zap className="w-3.5 h-3.5" />
            Сюжетный поворот
          </button>
        </div>

        {/* Suggestions List */}
        <div className="p-4 sm:p-5 space-y-3 max-h-[60vh] overflow-y-auto">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-12 gap-2 text-neutral-400">
              <Loader2 className="w-6 h-6 animate-spin text-purple-400" />
              <span className="text-xs">Муза обдумывает варианты сцены...</span>
            </div>
          ) : suggestions.length === 0 ? (
            <div className="text-center py-10 text-neutral-500 text-xs">
              Выберите категорию выше для генерации подсказок
            </div>
          ) : (
            suggestions.map((item, idx) => (
              <div
                key={idx}
                className="p-3.5 rounded-xl bg-neutral-950/80 border border-neutral-800 hover:border-purple-500/60 transition-all space-y-2 group"
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-neutral-200 group-hover:text-purple-300 transition-colors">
                    {item.title}
                  </span>
                  {item.flair && (
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-purple-950 border border-purple-800/60 text-purple-300">
                      {item.flair}
                    </span>
                  )}
                </div>
                <p className="text-xs text-neutral-300 leading-relaxed">
                  {item.text}
                </p>
                <div className="pt-1 flex justify-end">
                  <button
                    type="button"
                    onClick={() => {
                      sound.playClick();
                      onApplySuggestion(item.text);
                      onClose();
                    }}
                    className="px-3 py-1.5 rounded-lg bg-purple-600 hover:bg-purple-500 text-white text-xs font-semibold flex items-center gap-1 shadow-sm transition-all"
                  >
                    Использовать действие
                    <ArrowRight className="w-3 h-3" />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
