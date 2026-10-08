import React, { useState, useMemo } from "react";
import {
  ActiveGameState,
  StoryMemoryChapter,
  LorebookEntry,
  Character,
  ReaderTheme,
} from "../types";
import {
  BookOpen,
  Scroll,
  Search,
  Sparkles,
  Bookmark,
  Compass,
  Award,
  Shield,
  MapPin,
  Flame,
  ArrowRight,
  Copy,
  Check,
  Users,
  Feather,
  RotateCcw,
  Edit3,
  Tag,
  Clock,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { sound } from "../utils/audio";

interface StoryJournalViewProps {
  gameState: ActiveGameState;
  readerTheme: ReaderTheme;
  onBackToStory: () => void;
  onEnrichCharacter?: (character: Character) => Promise<void>;
  customApiKey?: string;
  onEditChapter?: (chapterNumber: number, currentText: string) => void;
  onRollbackToChapter?: (chapterNumber: number) => void;
}

export const StoryJournalView: React.FC<StoryJournalViewProps> = ({
  gameState,
  readerTheme,
  onBackToStory,
  onEnrichCharacter,
  customApiKey,
  onEditChapter,
  onRollbackToChapter,
}) => {
  const [filter, setFilter] = useState<"all" | "chapters" | "lore" | "companions">("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [copied, setCopied] = useState(false);
  const [expandedChapterId, setExpandedChapterId] = useState<string | null>(null);
  const [selectedCharacter, setSelectedCharacter] = useState<Character | null>(null);
  const [isEnrichingChar, setIsEnrichingChar] = useState<string | null>(null);

  const { story, memoryChapters, lorebook, characters, stepCount } = gameState;

  // Build a chronological combined timeline
  const chronologicalItems = useMemo(() => {
    type TimelineItem =
      | { type: "chapter"; data: StoryMemoryChapter; order: number }
      | { type: "lore"; data: LorebookEntry; order: number };

    const items: TimelineItem[] = [];

    (memoryChapters || []).forEach((ch) => {
      items.push({
        type: "chapter",
        data: ch,
        order: ch.chapterNumber * 10,
      });
    });

    (lorebook || []).forEach((l, idx) => {
      items.push({
        type: "lore",
        data: l,
        order: (l.discoveredAtStep || idx + 1) * 3 + 1,
      });
    });

    return items.sort((a, b) => a.order - b.order);
  }, [memoryChapters, lorebook]);

  // Filtered chapters
  const filteredChapters = useMemo(() => {
    return (memoryChapters || []).filter((ch) => {
      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase();
      return (
        ch.title.toLowerCase().includes(q) ||
        ch.summary.toLowerCase().includes(q) ||
        (ch.keyFacts || []).some((f) => f.toLowerCase().includes(q))
      );
    });
  }, [memoryChapters, searchQuery]);

  // Filtered lorebook
  const filteredLore = useMemo(() => {
    return (lorebook || []).filter((l) => {
      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase();
      return (
        l.title.toLowerCase().includes(q) ||
        l.description.toLowerCase().includes(q) ||
        (l.category && l.category.toLowerCase().includes(q))
      );
    });
  }, [lorebook, searchQuery]);

  // Filtered companions
  const filteredCharacters = useMemo(() => {
    return (characters || []).filter((c) => {
      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase();
      return (
        c.name.toLowerCase().includes(q) ||
        c.role.toLowerCase().includes(q) ||
        (c.origin && c.origin.toLowerCase().includes(q)) ||
        (c.abilities && c.abilities.some((a) => a.toLowerCase().includes(q))) ||
        (c.merits && c.merits.some((m) => m.toLowerCase().includes(q))) ||
        (c.traits && c.traits.some((t) => t.toLowerCase().includes(q)))
      );
    });
  }, [characters, searchQuery]);

  const handleCopyJournal = () => {
    let text = `📜 ЖУРНАЛ СТРАНСТВИЙ: ${story.title}\n`;
    text += `Вселенная/Жанр: ${story.genre} | Всего шагов: ${stepCount}\n\n`;

    text += `=== ХРОНИКА ГЛАВ ===\n`;
    (memoryChapters || []).forEach((c) => {
      text += `Глава ${c.chapterNumber}: ${c.title}\n${c.summary}\nФакты: ${(c.keyFacts || []).join("; ")}\n\n`;
    });

    text += `=== ТАЙНЫ И ЛОРБУК ===\n`;
    (lorebook || []).forEach((l) => {
      text += `[${l.category || "Факт"}] ${l.title}: ${l.description}\n`;
    });

    text += `\n=== СПУТНИКИ И ЗАСЛУГИ ===\n`;
    (characters || []).forEach((c) => {
      text += `${c.name} (${c.role})\n`;
      if (c.origin) text += `• Родина: ${c.origin}\n`;
      if (c.currentStatus) text += `• Текущее дело: ${c.currentStatus}\n`;
      if (c.abilities && c.abilities.length) text += `• Умения: ${c.abilities.join(", ")}\n`;
      if (c.merits && c.merits.length) text += `• Заслуги: ${c.merits.join("; ")}\n`;
      text += `\n`;
    });

    navigator.clipboard.writeText(text);
    setCopied(true);
    sound.playClick();
    setTimeout(() => setCopied(false), 2500);
  };

  const handleTriggerEnrich = async (char: Character) => {
    if (!onEnrichCharacter) return;
    setIsEnrichingChar(char.id);
    sound.playAction("magic");
    try {
      await onEnrichCharacter(char);
    } finally {
      setIsEnrichingChar(null);
    }
  };

  return (
    <div className="max-w-5xl mx-auto px-3 sm:px-6 py-6 space-y-6 animate-fade-in">
      {/* Journal Header Banner */}
      <div className="p-5 sm:p-7 rounded-3xl bg-neutral-900/90 border border-purple-900/40 shadow-2xl relative overflow-hidden backdrop-blur-md">
        <div className="absolute top-0 right-0 w-80 h-80 bg-purple-600/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-80 h-80 bg-amber-600/5 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2">
              <span className="p-2 rounded-2xl bg-purple-950/80 border border-purple-700/50 text-purple-300">
                <Scroll className="w-5 h-5" />
              </span>
              <span className="text-[11px] font-bold tracking-widest uppercase text-purple-400 font-cinzel">
                Летопись и Память странствий
              </span>
            </div>
            <h1 className="font-cinzel text-xl sm:text-2xl font-bold text-neutral-100">
              {story.title}
            </h1>
            <p className="text-xs sm:text-sm text-neutral-400 leading-relaxed max-w-2xl">
              Чистый литературный хронологический свиток вашего пути: события глав, открытые тайны
              мира, подвиги спутников и их живая эволюция без лишней игровой механики.
            </p>
          </div>

          <div className="flex items-center gap-2 w-full md:w-auto">
            <button
              onClick={handleCopyJournal}
              className="flex-1 md:flex-none px-3.5 py-2 rounded-xl bg-neutral-800 hover:bg-neutral-700 border border-neutral-700 text-neutral-200 text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors shadow-sm"
              title="Скопировать весь текст летописи в буфер"
            >
              {copied ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                  <span className="text-emerald-300">Скопировано</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5 text-neutral-400" />
                  <span>Скопировать летопись</span>
                </>
              )}
            </button>

            <button
              onClick={() => {
                sound.playClick();
                onBackToStory();
              }}
              className="flex-1 md:flex-none px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-semibold flex items-center justify-center gap-1.5 shadow-lg shadow-purple-900/40 transition-all hover:scale-[1.02]"
            >
              <span>К чтению повести</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Stats Strip */}
        <div className="mt-5 pt-4 border-t border-neutral-800/80 grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
          <div className="p-2.5 rounded-xl bg-neutral-950/60 border border-neutral-800/80">
            <span className="text-[10px] text-neutral-400 block font-semibold uppercase tracking-wider">
              Пройдено глав
            </span>
            <span className="font-cinzel text-lg font-bold text-purple-300">
              {memoryChapters.length || 1}
            </span>
          </div>
          <div className="p-2.5 rounded-xl bg-neutral-950/60 border border-neutral-800/80">
            <span className="text-[10px] text-neutral-400 block font-semibold uppercase tracking-wider">
              Тайны лорбука
            </span>
            <span className="font-cinzel text-lg font-bold text-amber-300">
              {lorebook.length}
            </span>
          </div>
          <div className="p-2.5 rounded-xl bg-neutral-950/60 border border-neutral-800/80">
            <span className="text-[10px] text-neutral-400 block font-semibold uppercase tracking-wider">
              Спутников в отряде
            </span>
            <span className="font-cinzel text-lg font-bold text-emerald-300">
              {characters.length}
            </span>
          </div>
          <div className="p-2.5 rounded-xl bg-neutral-950/60 border border-neutral-800/80">
            <span className="text-[10px] text-neutral-400 block font-semibold uppercase tracking-wider">
              Шагов истории
            </span>
            <span className="font-cinzel text-lg font-bold text-neutral-200">
              #{stepCount}
            </span>
          </div>
        </div>
      </div>

      {/* Filter and Search Navigation Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 p-2 rounded-2xl bg-neutral-900/70 border border-neutral-800 backdrop-blur-sm">
        {/* Filter Pills */}
        <div className="flex items-center gap-1 overflow-x-auto pb-1 sm:pb-0">
          <button
            onClick={() => {
              sound.playClick();
              setFilter("all");
            }}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-colors flex items-center gap-1.5 shrink-0 ${
              filter === "all"
                ? "bg-purple-600 text-white shadow-md shadow-purple-900/30"
                : "text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800"
            }`}
          >
            <Scroll className="w-3.5 h-3.5" />
            <span>Вся летопись</span>
          </button>

          <button
            onClick={() => {
              sound.playClick();
              setFilter("chapters");
            }}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-colors flex items-center gap-1.5 shrink-0 ${
              filter === "chapters"
                ? "bg-purple-600 text-white shadow-md shadow-purple-900/30"
                : "text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800"
            }`}
          >
            <BookOpen className="w-3.5 h-3.5" />
            <span>Главы ({memoryChapters.length})</span>
          </button>

          <button
            onClick={() => {
              sound.playClick();
              setFilter("lore");
            }}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-colors flex items-center gap-1.5 shrink-0 ${
              filter === "lore"
                ? "bg-purple-600 text-white shadow-md shadow-purple-900/30"
                : "text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800"
            }`}
          >
            <Compass className="w-3.5 h-3.5" />
            <span>Тайны и лор ({lorebook.length})</span>
          </button>

          <button
            onClick={() => {
              sound.playClick();
              setFilter("companions");
            }}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-colors flex items-center gap-1.5 shrink-0 ${
              filter === "companions"
                ? "bg-purple-600 text-white shadow-md shadow-purple-900/30"
                : "text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800"
            }`}
          >
            <Users className="w-3.5 h-3.5" />
            <span>Спутники и заслуги ({characters.length})</span>
          </button>
        </div>

        {/* Search input */}
        <div className="relative min-w-[220px]">
          <Search className="w-3.5 h-3.5 text-neutral-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Поиск по летописи, именам, местам..."
            className="w-full bg-neutral-950/80 border border-neutral-800 hover:border-neutral-700 focus:border-purple-500 rounded-xl pl-8 pr-3 py-1.5 text-xs text-neutral-200 placeholder-neutral-500 focus:outline-none focus:ring-1 focus:ring-purple-500 transition-colors"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery("")}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-200 text-xs"
            >
              ×
            </button>
          )}
        </div>
      </div>

      {/* Main Content Area */}
      <div className="space-y-6">
        {/* COMPANIONS VIEW */}
        {(filter === "all" || filter === "companions") && (
          <section className="space-y-3">
            <div className="flex items-center justify-between pb-1 border-b border-neutral-800">
              <h2 className="font-cinzel text-base font-bold text-neutral-100 flex items-center gap-2">
                <Users className="w-4 h-4 text-purple-400" />
                <span>Спутники, подвиги и происхождение</span>
              </h2>
              <span className="text-[11px] text-neutral-400">
                Живые досье (адаптируются по ходу ваших решений)
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {filteredCharacters.map((char) => (
                <div
                  key={char.id}
                  className="p-4 sm:p-5 rounded-2xl bg-neutral-900/80 border border-neutral-800 hover:border-purple-800/60 shadow-lg space-y-4 transition-all"
                >
                  <div className="flex items-start gap-3.5">
                    <img
                      src={char.avatar}
                      alt={char.name}
                      className="w-14 h-14 rounded-2xl object-cover border border-purple-500/50 shadow-md shrink-0"
                      referrerPolicy="no-referrer"
                    />
                    <div className="min-w-0 flex-1 space-y-0.5">
                      <div className="flex items-center justify-between gap-2">
                        <h3 className="font-cinzel text-base font-bold text-neutral-100 truncate">
                          {char.name}
                        </h3>
                        {char.temperament && (
                          <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-purple-950/80 border border-purple-800/80 text-purple-300 shrink-0">
                            {char.temperament}
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-purple-400 font-medium truncate">
                        {char.role}
                      </div>
                      <div className="text-[11px] text-neutral-400">
                        Отношение: {char.affinity}% ({char.affinityTitle || "Союзник"})
                      </div>
                    </div>
                  </div>

                  {/* Origin & Current Status */}
                  <div className="space-y-1.5 text-xs">
                    {char.origin && (
                      <div className="flex items-start gap-1.5 text-neutral-300">
                        <MapPin className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5" />
                        <div>
                          <span className="text-neutral-400 text-[11px]">Происхождение: </span>
                          <span className="font-medium text-neutral-200">{char.origin}</span>
                        </div>
                      </div>
                    )}

                    {char.currentStatus && (
                      <div className="flex items-start gap-1.5 text-neutral-300">
                        <Compass className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
                        <div>
                          <span className="text-neutral-400 text-[11px]">Текущее занятие: </span>
                          <span className="italic text-neutral-200">{char.currentStatus}</span>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Merits / Заслуги и подвиги */}
                  {char.merits && char.merits.length > 0 && (
                    <div className="p-2.5 rounded-xl bg-neutral-950/70 border border-amber-900/30 space-y-1">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-amber-400 flex items-center gap-1">
                        <Award className="w-3.5 h-3.5" />
                        Заслуги и боевая слава:
                      </span>
                      <ul className="text-xs text-neutral-300 space-y-0.5 list-disc list-inside">
                        {char.merits.map((m, i) => (
                          <li key={i} className="leading-snug">
                            {m}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Abilities / Умения и техники */}
                  {char.abilities && char.abilities.length > 0 && (
                    <div className="space-y-1">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-purple-400 flex items-center gap-1">
                        <Flame className="w-3.5 h-3.5" />
                        Особые умения и техники:
                      </span>
                      <div className="flex flex-wrap gap-1">
                        {char.abilities.map((ab, i) => (
                          <span
                            key={i}
                            className="px-2 py-0.5 rounded-lg bg-neutral-950 border border-neutral-800 text-[11px] text-neutral-200"
                          >
                            {ab}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Traits & Habits */}
                  <div className="space-y-1">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-neutral-400 block">
                      Черты характера:
                    </span>
                    <div className="flex flex-wrap gap-1">
                      {(char.traits || ["Верный"]).map((t, i) => (
                        <span
                          key={i}
                          className="px-2 py-0.5 rounded-md bg-purple-950/40 border border-purple-900/40 text-[11px] text-purple-300"
                        >
                          {t}
                        </span>
                      ))}
                    </div>
                  </div>

                  {/* AI Fandom Enrichment Action Button */}
                  {onEnrichCharacter && (
                    <div className="pt-2 border-t border-neutral-800/80 flex items-center justify-between">
                      <span className="text-[10px] text-neutral-500">
                        {char.isLockedTraits
                          ? "Черты зафиксированы игроком"
                          : "Черты и заслуги развиваются по ходу истории"}
                      </span>
                      <button
                        onClick={() => handleTriggerEnrich(char)}
                        disabled={isEnrichingChar === char.id}
                        className="px-2.5 py-1 rounded-lg bg-purple-950/60 hover:bg-purple-900/80 border border-purple-800/60 text-purple-300 text-[11px] font-medium flex items-center gap-1 transition-colors disabled:opacity-50"
                        title="Синтезировать глубокое досье на основе канона, фанфиков и обзоров"
                      >
                        <Sparkles className="w-3 h-3 text-purple-400" />
                        <span>
                          {isEnrichingChar === char.id ? "Синтезирую..." : "Обогатить из канона ИИ"}
                        </span>
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </section>
        )}

        {/* CHRONOLOGICAL CHAPTERS VIEW */}
        {(filter === "all" || filter === "chapters") && (
          <section className="space-y-3">
            <div className="flex items-center justify-between pb-1 border-b border-neutral-800">
              <h2 className="font-cinzel text-base font-bold text-neutral-100 flex items-center gap-2">
                <BookOpen className="w-4 h-4 text-purple-400" />
                <span>Летопись глав & Ключевые события</span>
              </h2>
              <span className="text-[11px] text-neutral-400">
                Сводка сюжетных поворотов в хронологическом порядке
              </span>
            </div>

            {filteredChapters.length === 0 ? (
              <div className="p-8 text-center rounded-2xl bg-neutral-900/40 border border-neutral-800 text-neutral-400 text-xs">
                Пока нет записанных глав. По мере продвижения по сюжету здесь будут появляться
                развёрнутые летописные записи.
              </div>
            ) : (
              <div className="space-y-4">
                {filteredChapters.map((chapter) => {
                  const isExpanded = expandedChapterId === chapter.id;
                  return (
                    <div
                      key={chapter.id}
                      className="p-5 rounded-2xl bg-neutral-900/80 border border-neutral-800 hover:border-purple-800/50 shadow-md space-y-3 transition-colors"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="px-2 py-0.5 rounded-full bg-purple-950 text-purple-300 border border-purple-800/60 font-cinzel text-xs font-bold">
                              Глава {chapter.chapterNumber}
                            </span>
                            <h3 className="font-cinzel text-sm sm:text-base font-bold text-neutral-100">
                              {chapter.title}
                            </h3>
                          </div>
                          {chapter.timestamp && (
                            <div className="text-[10px] text-neutral-500 flex items-center gap-1">
                              <Clock className="w-3 h-3" />
                              <span>{new Date(chapter.timestamp).toLocaleDateString()}</span>
                            </div>
                          )}
                        </div>

                        <button
                          onClick={() =>
                            setExpandedChapterId(isExpanded ? null : chapter.id)
                          }
                          className="p-1.5 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-300 transition-colors"
                          title={isExpanded ? "Свернуть" : "Развернуть детали"}
                        >
                          {isExpanded ? (
                            <ChevronUp className="w-4 h-4" />
                          ) : (
                            <ChevronDown className="w-4 h-4" />
                          )}
                        </button>
                      </div>

                      {/* Literary Summary */}
                      <p className="text-xs sm:text-sm text-neutral-200 leading-relaxed font-serif">
                        {chapter.summary}
                      </p>

                      {/* Key Facts */}
                      {chapter.keyFacts && chapter.keyFacts.length > 0 && (
                        <div className="p-3 rounded-xl bg-neutral-950/60 border border-neutral-800/80 space-y-1.5">
                          <span className="text-[10px] font-bold uppercase tracking-wider text-purple-400 block">
                            Зафиксированные факты и последствия:
                          </span>
                          <div className="flex flex-wrap gap-1.5">
                            {chapter.keyFacts.map((fact, idx) => (
                              <span
                                key={idx}
                                className="px-2.5 py-1 rounded-lg bg-neutral-900 border border-neutral-700 text-neutral-300 text-xs flex items-center gap-1.5"
                              >
                                <Bookmark className="w-3 h-3 text-purple-400 shrink-0" />
                                <span>{fact}</span>
                              </span>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Chapter Actions: Edit & Rollback */}
                      {(() => {
                        const matchingHistory =
                          gameState.history.find(
                            (h) => h.stepNumber === chapter.chapterNumber
                          ) ||
                          (chapter.chapterNumber === gameState.stepCount
                            ? { sceneText: gameState.currentScene, wasEdited: false }
                            : null);
                        const sceneText =
                          matchingHistory?.sceneText || chapter.summary;
                        const wasEdited =
                          matchingHistory && "wasEdited" in matchingHistory
                            ? matchingHistory.wasEdited
                            : false;

                        return (
                          <div className="pt-2 border-t border-neutral-800/60 flex items-center justify-between flex-wrap gap-2">
                            <div className="flex items-center gap-2">
                              {wasEdited && (
                                <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-950/80 border border-amber-700/60 text-amber-300 font-mono">
                                  ✏️ Отредактировано автором
                                </span>
                              )}
                            </div>

                            <div className="flex items-center gap-2">
                              {onEditChapter && (
                                <button
                                  onClick={() => {
                                    sound.playClick();
                                    onEditChapter(chapter.chapterNumber, sceneText);
                                  }}
                                  className="px-2.5 py-1 rounded-lg bg-amber-950/60 hover:bg-amber-900/70 border border-amber-600/50 text-amber-200 text-xs font-semibold flex items-center gap-1.5 transition-colors"
                                  title="Отредактировать текст этой главы"
                                >
                                  <Edit3 className="w-3 h-3 text-amber-400" />
                                  <span>Редактировать</span>
                                </button>
                              )}

                              {onRollbackToChapter &&
                                chapter.chapterNumber < gameState.stepCount && (
                                  <button
                                    onClick={() => {
                                      sound.playClick();
                                      onRollbackToChapter(chapter.chapterNumber);
                                    }}
                                    className="px-2.5 py-1 rounded-lg bg-neutral-800 hover:bg-neutral-700 border border-neutral-700 text-neutral-300 text-xs font-semibold flex items-center gap-1.5 transition-colors"
                                    title="Откатить сюжет назад к этой главе"
                                  >
                                    <RotateCcw className="w-3 h-3 text-purple-400" />
                                    <span>Откатить сюда</span>
                                  </button>
                                )}
                            </div>
                          </div>
                        );
                      })()}
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        )}

        {/* LOREBOOK SECRETS & WORLD RULES */}
        {(filter === "all" || filter === "lore") && (
          <section className="space-y-3">
            <div className="flex items-center justify-between pb-1 border-b border-neutral-800">
              <h2 className="font-cinzel text-base font-bold text-neutral-100 flex items-center gap-2">
                <Compass className="w-4 h-4 text-amber-400" />
                <span>Тайны, артефакты и законы мира</span>
              </h2>
              <span className="text-[11px] text-neutral-400">
                Энциклопедия знаний, открытых во время путешествия
              </span>
            </div>

            {filteredLore.length === 0 ? (
              <div className="p-8 text-center rounded-2xl bg-neutral-900/40 border border-neutral-800 text-neutral-400 text-xs">
                Лорбук пока пуст. Исследуйте мир, совершайте нестандартные поступки, и новые законы
                мира зафиксируются здесь.
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                {filteredLore.map((item) => (
                  <div
                    key={item.id}
                    className="p-4 rounded-2xl bg-neutral-900/70 border border-neutral-800 hover:border-amber-700/50 shadow-sm space-y-2 transition-colors"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="px-2 py-0.5 rounded-md bg-amber-950/60 border border-amber-800/60 text-amber-300 text-[10px] font-bold uppercase tracking-wider">
                        {item.category || "правило_мира"}
                      </span>
                      {item.discoveredAtStep && (
                        <span className="text-[10px] text-neutral-500">
                          Открыто на шаге #{item.discoveredAtStep}
                        </span>
                      )}
                    </div>

                    <h4 className="font-cinzel text-sm font-bold text-neutral-100">
                      {item.title}
                    </h4>

                    <p className="text-xs text-neutral-300 leading-relaxed font-serif">
                      {item.description}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </section>
        )}
      </div>

      {/* Bottom Action Footer */}
      <div className="p-4 rounded-2xl bg-neutral-900/60 border border-neutral-800 flex items-center justify-between">
        <div className="text-xs text-neutral-400 flex items-center gap-2">
          <Feather className="w-4 h-4 text-purple-400 shrink-0" />
          <span>Летопись обновляется автоматически после каждого хода и действия автора.</span>
        </div>
        <button
          onClick={() => {
            sound.playClick();
            onBackToStory();
          }}
          className="px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-semibold flex items-center gap-1.5 transition-colors shadow-md"
        >
          <span>Продолжить повесть</span>
          <ArrowRight className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
};
