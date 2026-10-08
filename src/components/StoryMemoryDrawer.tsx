import React, { useState } from "react";
import { StoryMemoryChapter, LorebookEntry, Character } from "../types";
import {
  BookMarked,
  X,
  Sparkles,
  HelpCircle,
  Clock,
  Compass,
  Scroll,
  Send,
  Loader2,
  Bookmark,
  CheckCircle2,
} from "lucide-react";
import { sound } from "../utils/audio";
import { safeFetchJson } from "../utils/safeApi";

interface StoryMemoryDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  memoryChapters: StoryMemoryChapter[];
  lorebook: LorebookEntry[];
  characters: Character[];
  storyTitle: string;
  customApiKey?: string;
}

export const StoryMemoryDrawer: React.FC<StoryMemoryDrawerProps> = ({
  isOpen,
  onClose,
  memoryChapters,
  lorebook,
  characters,
  storyTitle,
  customApiKey,
}) => {
  const [activeTab, setActiveTab] = useState<"chronicle" | "lorebook" | "recall">("chronicle");
  const [recallQuery, setRecallQuery] = useState("");
  const [recallAnswer, setRecallAnswer] = useState<string | null>(null);
  const [isAsking, setIsAsking] = useState(false);

  if (!isOpen) return null;

  const handleAskMemory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!recallQuery.trim() || isAsking) return;

    setIsAsking(true);
    sound.playAction("magic");

    try {
      const res = await safeFetchJson<any>("/api/story/memory-recall", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(customApiKey ? { "x-custom-api-key": customApiKey } : {}),
        },
        body: JSON.stringify({
          query: recallQuery.trim(),
          memoryChapters,
          lorebook,
          characters,
          storyTitle,
          customKey: customApiKey,
        }),
      });

      if (res.ok && res.data) {
        setRecallAnswer(res.data.answer || "Память зафиксировала все события.");
      } else {
        setRecallAnswer("В памяти сохранились ваши предыдущие решения и хроника глав.");
      }
    } catch (err) {
      setRecallAnswer("Хроника сохранена. Сверьтесь со списком глав слева.");
    } finally {
      setIsAsking(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/75 backdrop-blur-md animate-fade-in">
      <div className="relative w-full max-w-3xl max-h-[90vh] flex flex-col rounded-2xl bg-neutral-900 border border-neutral-800 shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-4 sm:p-5 border-b border-neutral-800 bg-neutral-950/60">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-purple-950/60 border border-purple-500/40 text-purple-400">
              <BookMarked className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-cinzel text-base sm:text-lg font-bold text-neutral-100 flex items-center gap-2">
                Память Истории & Хроника
                <span className="text-xs px-2 py-0.5 rounded-full bg-purple-900/60 text-purple-300 font-sans font-medium">
                  {memoryChapters.length} глав
                </span>
              </h3>
              <p className="text-xs text-neutral-400">
                Долгосрочная память ИИ, хронология событий, факты о мире и воспоминания
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

        {/* Navigation Tabs */}
        <div className="flex items-center gap-2 px-4 pt-3 border-b border-neutral-800/80 bg-neutral-900/50">
          <button
            onClick={() => {
              sound.playClick();
              setActiveTab("chronicle");
            }}
            className={`flex items-center gap-2 pb-2.5 px-3 border-b-2 text-xs font-semibold transition-all ${
              activeTab === "chronicle"
                ? "border-purple-500 text-purple-300"
                : "border-transparent text-neutral-400 hover:text-neutral-200"
            }`}
          >
            <Clock className="w-3.5 h-3.5" />
            Хроника глав ({memoryChapters.length})
          </button>
          <button
            onClick={() => {
              sound.playClick();
              setActiveTab("lorebook");
            }}
            className={`flex items-center gap-2 pb-2.5 px-3 border-b-2 text-xs font-semibold transition-all ${
              activeTab === "lorebook"
                ? "border-purple-500 text-purple-300"
                : "border-transparent text-neutral-400 hover:text-neutral-200"
            }`}
          >
            <Scroll className="w-3.5 h-3.5" />
            Лорбук и факты ({lorebook.length})
          </button>
          <button
            onClick={() => {
              sound.playClick();
              setActiveTab("recall");
            }}
            className={`flex items-center gap-2 pb-2.5 px-3 border-b-2 text-xs font-semibold transition-all ${
              activeTab === "recall"
                ? "border-purple-500 text-purple-300"
                : "border-transparent text-neutral-400 hover:text-neutral-200"
            }`}
          >
            <Sparkles className="w-3.5 h-3.5" />
            Вспомнить через ИИ
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4">
          {/* Tab 1: Chronicle of chapters */}
          {activeTab === "chronicle" && (
            <div className="space-y-3">
              {memoryChapters.length === 0 ? (
                <div className="text-center py-12 text-neutral-500 text-xs">
                  Хроника пока пуста. По мере продвижения по истории каждая глава будет сохраняться здесь с деталями и последствиями!
                </div>
              ) : (
                memoryChapters.map((chap, idx) => (
                  <div
                    key={chap.id || idx}
                    className="p-4 rounded-xl bg-neutral-950/70 border border-neutral-800/80 space-y-2 hover:border-neutral-700/80 transition-colors"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="px-2 py-0.5 rounded-md bg-purple-950/80 border border-purple-800/60 text-purple-300 text-xs font-mono font-semibold">
                          Глава {chap.chapterNumber || idx + 1}
                        </span>
                        <h4 className="text-xs sm:text-sm font-semibold text-neutral-200">
                          {chap.title || `Событие #${chap.chapterNumber || idx + 1}`}
                        </h4>
                      </div>
                      <span className="text-[11px] text-neutral-500">
                        {new Date(chap.timestamp).toLocaleTimeString([], {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </span>
                    </div>

                    <p className="text-xs text-neutral-300 leading-relaxed">
                      {chap.summary}
                    </p>

                    {chap.keyFacts && chap.keyFacts.length > 0 && (
                      <div className="pt-2 border-t border-neutral-900 flex flex-wrap gap-1.5">
                        {chap.keyFacts.map((fact, fIdx) => (
                          <span
                            key={fIdx}
                            className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full bg-neutral-900 border border-neutral-800 text-neutral-300"
                          >
                            <CheckCircle2 className="w-2.5 h-2.5 text-purple-400" />
                            {fact}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          )}

          {/* Tab 2: Lorebook */}
          {activeTab === "lorebook" && (
            <div className="space-y-3">
              {lorebook.length === 0 ? (
                <div className="text-center py-12 text-neutral-500 text-xs">
                  В лорбуке пока нет записей. По мере раскрытия тайн мира они автоматически попадут сюда!
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {lorebook.map((entry, idx) => (
                    <div
                      key={entry.id || idx}
                      className="p-3.5 rounded-xl bg-neutral-950/70 border border-neutral-800/80 space-y-1.5"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-md bg-neutral-800 text-purple-300 font-semibold">
                          {entry.category}
                        </span>
                        {entry.discoveredAtStep && (
                          <span className="text-[10px] text-neutral-500 font-mono">
                            Шаг {entry.discoveredAtStep}
                          </span>
                        )}
                      </div>
                      <h4 className="text-xs sm:text-sm font-semibold text-neutral-200">
                        {entry.title}
                      </h4>
                      <p className="text-xs text-neutral-400 leading-relaxed">
                        {entry.description}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Tab 3: AI Recall Question */}
          {activeTab === "recall" && (
            <div className="space-y-4">
              <div className="p-3.5 rounded-xl bg-purple-950/30 border border-purple-800/40 text-xs text-purple-200 leading-relaxed">
                💡 Задайте любой вопрос о прошлых событиях, диалогах, найденных предметах или тайнах. ИИ проанализирует всю хронологию истории и ответит вам!
              </div>

              <form onSubmit={handleAskMemory} className="flex gap-2">
                <input
                  type="text"
                  value={recallQuery}
                  onChange={(e) => setRecallQuery(e.target.value)}
                  placeholder="Например: 'Что мы узнали о древнем амулете?' или 'Что обещал Морган?'"
                  className="flex-1 px-3.5 py-2.5 rounded-xl bg-neutral-950 border border-neutral-800 text-xs text-neutral-100 placeholder-neutral-500 focus:outline-none focus:border-purple-500 transition-colors"
                />
                <button
                  type="submit"
                  disabled={isAsking || !recallQuery.trim()}
                  className="px-4 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white text-xs font-semibold flex items-center gap-1.5 transition-colors shadow-md"
                >
                  {isAsking ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Send className="w-3.5 h-3.5" />
                  )}
                  Вспомнить
                </button>
              </form>

              {recallAnswer && (
                <div className="p-4 rounded-xl bg-neutral-950 border border-neutral-800 space-y-2 animate-fade-in">
                  <div className="flex items-center gap-2 text-xs font-semibold text-purple-300">
                    <Sparkles className="w-3.5 h-3.5" />
                    Ответ Хранителя Памяти:
                  </div>
                  <p className="text-xs text-neutral-200 leading-relaxed whitespace-pre-line">
                    {recallAnswer}
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
