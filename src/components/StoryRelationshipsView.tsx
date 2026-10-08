import React, { useState, useMemo } from "react";
import {
  ActiveGameState,
  Character,
  ReaderTheme,
  CharacterTemperament,
} from "../types";
import {
  Heart,
  Users2,
  Table,
  Sparkles,
  ArrowLeft,
  Search,
  SlidersHorizontal,
  Flame,
  Shield,
  Swords,
  Smile,
  AlertCircle,
  HelpCircle,
  Award,
  Zap,
  Compass,
  Globe,
  Scroll,
  MessageSquare,
  ChevronRight,
  TrendingUp,
  TrendingDown,
  Minus,
} from "lucide-react";
import { sound } from "../utils/audio";
import { safeFetchJson } from "../utils/safeApi";

interface StoryRelationshipsViewProps {
  gameState: ActiveGameState;
  readerTheme: ReaderTheme;
  onBackToStory: () => void;
  onUpdateCharacter?: (updatedChar: Character) => void;
  customApiKey?: string;
}

interface RelationshipCellData {
  charA: string;
  charB: string;
  affinity: number;
  label: string;
  colorClass: string;
  badgeBg: string;
  notes: string;
  chemistry: string;
  isProtagonistPair: boolean;
}

export const StoryRelationshipsView: React.FC<StoryRelationshipsViewProps> = ({
  gameState,
  readerTheme,
  onBackToStory,
  onUpdateCharacter,
  customApiKey,
}) => {
  const [viewMode, setViewMode] = useState<"matrix" | "table" | "chemistry">("matrix");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCell, setSelectedCell] = useState<RelationshipCellData | null>(null);
  const [tierFilter, setTierFilter] = useState<"all" | "allies" | "neutral" | "hostile">("all");
  const [characterThought, setCharacterThought] = useState<string | null>(null);
  const [isLoadingThought, setIsLoadingThought] = useState(false);

  const characters = gameState.characters || [];
  const protagonistName = "Протагонист (Вы)";

  // Compute affinity tier details
  const getAffinityTier = (val: number): { label: string; colorClass: string; badgeBg: string } => {
    if (val >= 90) return { label: "Абсолютная преданность", colorClass: "text-amber-300", badgeBg: "bg-amber-500/20 border-amber-500/40 text-amber-300" };
    if (val >= 75) return { label: "Верный соратник", colorClass: "text-emerald-400", badgeBg: "bg-emerald-500/20 border-emerald-500/40 text-emerald-300" };
    if (val >= 55) return { label: "Дружба & Доверие", colorClass: "text-cyan-400", badgeBg: "bg-cyan-500/20 border-cyan-500/40 text-cyan-300" };
    if (val >= 40) return { label: "Нейтралитет", colorClass: "text-neutral-300", badgeBg: "bg-neutral-800 border-neutral-700 text-neutral-300" };
    if (val >= 25) return { label: "Настороженность", colorClass: "text-yellow-400", badgeBg: "bg-yellow-500/20 border-yellow-500/40 text-yellow-300" };
    if (val >= 10) return { label: "Соперничество", colorClass: "text-orange-400", badgeBg: "bg-orange-500/20 border-orange-500/40 text-orange-300" };
    return { label: "Враждебность", colorClass: "text-rose-400", badgeBg: "bg-rose-500/20 border-rose-500/40 text-rose-300" };
  };

  // Interpersonal affinity calculator between companions based on temperament and merits
  const calculateInterpersonalAffinity = (c1: Character, c2: Character): number => {
    let base = 50;

    // Temperament synergy
    const t1 = c1.temperament || "сангвиник";
    const t2 = c2.temperament || "сангвиник";

    if (t1 === t2) base += 10;
    else if ((t1 === "холерик" && t2 === "меланхолик") || (t1 === "меланхолик" && t2 === "холерик")) base -= 15;
    else if ((t1 === "сангвиник" && t2 === "флегматик") || (t1 === "флегматик" && t2 === "сангвиник")) base += 12;
    else if ((t1 === "холерик" && t2 === "флегматик") || (t1 === "флегматик" && t2 === "холерик")) base += 5;

    // Common allegiance
    if (c1.allegiance && c2.allegiance && c1.allegiance.toLowerCase() === c2.allegiance.toLowerCase()) {
      base += 15;
    }

    // Origin harmony
    if (c1.origin && c2.origin && c1.origin.toLowerCase() === c2.origin.toLowerCase()) {
      base += 8;
    }

    // Affinity with protagonist dampener / resonance
    const avgProtagonistAff = (c1.affinity + c2.affinity) / 2;
    base = Math.round(base * 0.6 + avgProtagonistAff * 0.4);

    return Math.max(5, Math.min(98, base));
  };

  // Matrix participants: [Protagonist, ...characters]
  const allParticipants = useMemo(() => {
    return [
      { id: "protagonist", name: protagonistName, role: "Главный герой", avatar: "👤", isProtagonist: true },
      ...characters.map((c) => ({ id: c.id, name: c.name, role: c.role, avatar: c.avatar, isProtagonist: false, character: c })),
    ];
  }, [characters]);

  // Compute relationship data for matrix
  const getCellData = (pA: typeof allParticipants[0], pB: typeof allParticipants[0]): RelationshipCellData => {
    if (pA.id === pB.id) {
      return {
        charA: pA.name,
        charB: pB.name,
        affinity: 100,
        label: "Сам с собой",
        colorClass: "text-purple-300",
        badgeBg: "bg-purple-900/30 border-purple-700/50 text-purple-300",
        notes: "Внутренний баланс и самосознание.",
        chemistry: "Собственная линия судьбы.",
        isProtagonistPair: false,
      };
    }

    if (pA.isProtagonist || pB.isProtagonist) {
      const char = pA.isProtagonist ? pB.character! : pA.character!;
      const aff = char.affinity;
      const tier = getAffinityTier(aff);
      return {
        charA: protagonistName,
        charB: char.name,
        affinity: aff,
        label: tier.label,
        colorClass: tier.colorClass,
        badgeBg: tier.badgeBg,
        notes: char.affinityTitle || tier.label,
        chemistry: `Отношение к протагонисту: ${aff}%. ${char.temperament ? `Темперамент: ${char.temperament}.` : ""} ${char.secret ? "Хранит личную тайну." : ""}`,
        isProtagonistPair: true,
      };
    }

    // Companion to companion
    const c1 = pA.character!;
    const c2 = pB.character!;
    const aff = calculateInterpersonalAffinity(c1, c2);
    const tier = getAffinityTier(aff);

    let chemistryText = "Нейтральное сосуществование.";
    if (aff >= 75) chemistryText = "Крепкое боевое братство и слаженность.";
    else if (aff >= 55) chemistryText = "Взаимный интерес и готовность прикрыть спину.";
    else if (aff <= 30) chemistryText = "Трение взглядов, различия в ценностях.";

    return {
      charA: c1.name,
      charB: c2.name,
      affinity: aff,
      label: tier.label,
      colorClass: tier.colorClass,
      badgeBg: tier.badgeBg,
      notes: `${tier.label} в отряде`,
      chemistry: chemistryText,
      isProtagonistPair: false,
    };
  };

  // Filtered characters for table
  const filteredCharacters = useMemo(() => {
    return characters.filter((c) => {
      const matchesSearch =
        c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        c.role.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (c.origin && c.origin.toLowerCase().includes(searchQuery.toLowerCase()));

      if (!matchesSearch) return false;

      if (tierFilter === "allies") return c.affinity >= 70;
      if (tierFilter === "neutral") return c.affinity >= 40 && c.affinity < 70;
      if (tierFilter === "hostile") return c.affinity < 40;
      return true;
    });
  }, [characters, searchQuery, tierFilter]);

  // Request thoughts on cell click
  const handleInspectCell = async (cell: RelationshipCellData) => {
    setSelectedCell(cell);
    setCharacterThought(null);
    sound.playClick();

    if (cell.isProtagonistPair) {
      const charObj = characters.find((c) => c.name.toLowerCase() === cell.charB.toLowerCase());
      if (charObj) {
        setIsLoadingThought(true);
        try {
          const res = await safeFetchJson<any>("/api/story/muse", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              storyTitle: gameState.story.title,
              genre: gameState.story.genre,
              currentScene: `Протагонист оценивает связь с ${charObj.name}. Уровень привязанности: ${charObj.affinity}%. Черты: ${(charObj.traits || []).join(", ")}.`,
              characters: [charObj],
              museType: "speech",
              customKey: customApiKey,
            }),
          });
          if (res.data?.suggestions?.[0]?.text) {
            setCharacterThought(`«${res.data.suggestions[0].text}»`);
          } else {
            setCharacterThought(`«Я внимательно оцениваю каждый наш шаг. Пока ты ведёшь нас вперёд — я рядом».`);
          }
        } catch {
          setCharacterThought(`«Наши судьбы сплелись в этом походе. Время покажет, куда ведёт эта дорога».`);
        } finally {
          setIsLoadingThought(false);
        }
      }
    }
  };

  return (
    <div className="max-w-5xl mx-auto px-3 sm:px-6 py-4 space-y-6 animate-fade-in pb-16">
      {/* Top Navigation & View Switcher */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 p-3 sm:p-4 rounded-2xl bg-neutral-900/90 border border-neutral-800 shadow-xl backdrop-blur-md">
        <div className="flex items-center gap-3">
          <button
            onClick={() => {
              sound.playClick();
              onBackToStory();
            }}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-300 hover:text-neutral-100 text-xs font-medium transition-all cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>К повести</span>
          </button>
          <div>
            <h2 className="font-cinzel text-base sm:text-lg font-bold text-neutral-100 flex items-center gap-2">
              <Heart className="w-5 h-5 text-rose-400 fill-rose-500/20" />
              <span>Матрица отношений & Связи персонажей</span>
            </h2>
            <p className="text-[11px] text-neutral-400">
              Интерактивная карта взаимного доверия, психологической химии и союзов
            </p>
          </div>
        </div>

        {/* View Mode Toggle */}
        <div className="flex items-center bg-neutral-950 p-1 rounded-xl border border-neutral-800 self-stretch sm:self-auto">
          <button
            onClick={() => {
              sound.playClick();
              setViewMode("matrix");
            }}
            className={`flex-1 sm:flex-initial flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer ${
              viewMode === "matrix"
                ? "bg-rose-500/20 text-rose-300 border border-rose-500/30"
                : "text-neutral-400 hover:text-neutral-200"
            }`}
          >
            <Table className="w-3.5 h-3.5" />
            <span>Матрица N×N</span>
          </button>
          <button
            onClick={() => {
              sound.playClick();
              setViewMode("table");
            }}
            className={`flex-1 sm:flex-initial flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer ${
              viewMode === "table"
                ? "bg-rose-500/20 text-rose-300 border border-rose-500/30"
                : "text-neutral-400 hover:text-neutral-200"
            }`}
          >
            <Users2 className="w-3.5 h-3.5" />
            <span>Реестр спутников</span>
          </button>
          <button
            onClick={() => {
              sound.playClick();
              setViewMode("chemistry");
            }}
            className={`flex-1 sm:flex-initial flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer ${
              viewMode === "chemistry"
                ? "bg-rose-500/20 text-rose-300 border border-rose-500/30"
                : "text-neutral-400 hover:text-neutral-200"
            }`}
          >
            <Flame className="w-3.5 h-3.5 text-amber-400" />
            <span>Синергия</span>
          </button>
        </div>
      </div>

      {/* VIEW 1: INTERACTIVE N×N MATRIX */}
      {viewMode === "matrix" && (
        <div className="space-y-4">
          <div className="p-3 rounded-xl bg-neutral-900/60 border border-neutral-800/80 text-xs text-neutral-300 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-rose-400" />
              <span>
                Кликните на любую ячейку матрицы, чтобы исследовать психологическую связь, мысли спутника и совместимость.
              </span>
            </div>
            <span className="text-[11px] text-neutral-500 hidden sm:inline">
              Участников: {allParticipants.length}
            </span>
          </div>

          <div className="overflow-x-auto rounded-2xl border border-neutral-800 bg-neutral-900/90 shadow-2xl">
            <table className="w-full border-collapse text-left text-xs min-w-[650px]">
              <thead>
                <tr className="border-b border-neutral-800 bg-neutral-950/80">
                  <th className="p-3 text-[11px] font-bold uppercase tracking-wider text-neutral-400 sticky left-0 bg-neutral-950 z-10 w-44">
                    Персонаж
                  </th>
                  {allParticipants.map((p) => (
                    <th key={p.id} className="p-3 text-center font-semibold text-neutral-200 min-w-[130px]">
                      <div className="flex flex-col items-center gap-1">
                        {p.isProtagonist ? (
                          <div className="w-7 h-7 rounded-full bg-purple-900/60 border border-purple-500/50 flex items-center justify-center text-xs">
                            👤
                          </div>
                        ) : (
                          <img
                            src={p.avatar}
                            alt={p.name}
                            className="w-7 h-7 rounded-full object-cover border border-neutral-700"
                          />
                        )}
                        <span className="text-[11px] truncate max-w-[110px]">{p.name}</span>
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {allParticipants.map((rowP, rowIdx) => (
                  <tr
                    key={rowP.id}
                    className={`border-b border-neutral-800/50 hover:bg-neutral-800/30 transition-colors ${
                      rowIdx % 2 === 0 ? "bg-neutral-900/30" : "bg-neutral-900/10"
                    }`}
                  >
                    {/* Row Header */}
                    <td className="p-3 font-semibold text-neutral-200 sticky left-0 bg-neutral-950/95 z-10 border-r border-neutral-800/60">
                      <div className="flex items-center gap-2">
                        {rowP.isProtagonist ? (
                          <div className="w-6 h-6 rounded-full bg-purple-900/60 border border-purple-500/50 flex items-center justify-center text-[10px]">
                            👤
                          </div>
                        ) : (
                          <img
                            src={rowP.avatar}
                            alt={rowP.name}
                            className="w-6 h-6 rounded-full object-cover border border-neutral-700"
                          />
                        )}
                        <div className="truncate max-w-[120px]">
                          <div className="truncate text-xs">{rowP.name}</div>
                          <div className="text-[10px] text-neutral-500 truncate">{rowP.role}</div>
                        </div>
                      </div>
                    </td>

                    {/* Cells */}
                    {allParticipants.map((colP) => {
                      const cell = getCellData(rowP, colP);
                      const isSelf = rowP.id === colP.id;

                      return (
                        <td
                          key={colP.id}
                          onClick={() => !isSelf && handleInspectCell(cell)}
                          className={`p-2 text-center transition-all ${
                            isSelf
                              ? "bg-neutral-950/40 opacity-40 cursor-default"
                              : "cursor-pointer hover:bg-neutral-800/70 hover:scale-[1.02]"
                          }`}
                        >
                          {isSelf ? (
                            <span className="text-neutral-600">—</span>
                          ) : (
                            <div className="flex flex-col items-center gap-1">
                              <div className="flex items-center gap-1 font-bold text-xs">
                                <Heart className={`w-3 h-3 fill-current ${cell.colorClass}`} />
                                <span className={cell.colorClass}>{cell.affinity}%</span>
                              </div>
                              <div className="w-16 h-1 rounded-full bg-neutral-800 overflow-hidden">
                                <div
                                  className="h-full rounded-full transition-all"
                                  style={{
                                    width: `${cell.affinity}%`,
                                    backgroundColor:
                                      cell.affinity >= 75
                                        ? "#34d399"
                                        : cell.affinity >= 50
                                        ? "#38bdf8"
                                        : cell.affinity >= 30
                                        ? "#fbbf24"
                                        : "#f43f5e",
                                  }}
                                />
                              </div>
                              <span
                                className={`text-[9px] px-1.5 py-0.5 rounded-full border truncate max-w-[110px] ${cell.badgeBg}`}
                              >
                                {cell.label}
                              </span>
                            </div>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* VIEW 2: DETAILED COMPANION TABLE */}
      {viewMode === "table" && (
        <div className="space-y-4">
          {/* Controls bar */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 p-3 rounded-2xl bg-neutral-900 border border-neutral-800">
            {/* Search */}
            <div className="relative flex-1">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-neutral-500" />
              <input
                type="text"
                placeholder="Поиск по имени, роли или родине спутника..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-1.5 rounded-xl bg-neutral-950 border border-neutral-800 text-xs text-neutral-200 placeholder-neutral-500 focus:outline-none focus:border-rose-500/50"
              />
            </div>

            {/* Tier Filters */}
            <div className="flex items-center gap-1.5 bg-neutral-950 p-1 rounded-xl border border-neutral-800 text-xs">
              <button
                onClick={() => setTierFilter("all")}
                className={`px-2.5 py-1 rounded-lg transition-all cursor-pointer ${
                  tierFilter === "all" ? "bg-neutral-800 text-neutral-100" : "text-neutral-400 hover:text-neutral-200"
                }`}
              >
                Все ({characters.length})
              </button>
              <button
                onClick={() => setTierFilter("allies")}
                className={`px-2.5 py-1 rounded-lg transition-all cursor-pointer ${
                  tierFilter === "allies" ? "bg-emerald-500/20 text-emerald-300" : "text-neutral-400 hover:text-neutral-200"
                }`}
              >
                Союзники (70%+)
              </button>
              <button
                onClick={() => setTierFilter("neutral")}
                className={`px-2.5 py-1 rounded-lg transition-all cursor-pointer ${
                  tierFilter === "neutral" ? "bg-cyan-500/20 text-cyan-300" : "text-neutral-400 hover:text-neutral-200"
                }`}
              >
                Нейтралы
              </button>
              <button
                onClick={() => setTierFilter("hostile")}
                className={`px-2.5 py-1 rounded-lg transition-all cursor-pointer ${
                  tierFilter === "hostile" ? "bg-rose-500/20 text-rose-300" : "text-neutral-400 hover:text-neutral-200"
                }`}
              >
                Опасность
              </button>
            </div>
          </div>

          {/* Table */}
          <div className="overflow-x-auto rounded-2xl border border-neutral-800 bg-neutral-900/90 shadow-xl">
            <table className="w-full border-collapse text-left text-xs min-w-[700px]">
              <thead>
                <tr className="border-b border-neutral-800 bg-neutral-950/80 text-[11px] font-bold uppercase tracking-wider text-neutral-400">
                  <th className="p-3.5">Персонаж & Роль</th>
                  <th className="p-3.5">Привязанность (Affinity)</th>
                  <th className="p-3.5">Темперамент & Характер</th>
                  <th className="p-3.5">Родина & Статус</th>
                  <th className="p-3.5">Заслуги & Подвиги</th>
                  <th className="p-3.5 text-right">Действие</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-800/60">
                {filteredCharacters.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="p-8 text-center text-neutral-500 text-xs">
                      Персонажи по данному фильтру не найдены.
                    </td>
                  </tr>
                ) : (
                  filteredCharacters.map((char) => {
                    const tier = getAffinityTier(char.affinity);
                    return (
                      <tr key={char.id} className="hover:bg-neutral-800/40 transition-colors">
                        <td className="p-3.5">
                          <div className="flex items-center gap-3">
                            <img
                              src={char.avatar}
                              alt={char.name}
                              className="w-10 h-10 rounded-full object-cover border border-neutral-700 shadow-md"
                            />
                            <div>
                              <div className="font-semibold text-neutral-100 text-sm flex items-center gap-1.5">
                                <span>{char.name}</span>
                                {char.isLockedTraits && (
                                  <span title="Черты зафиксированы">🔒</span>
                                )}
                              </div>
                              <div className="text-[11px] text-neutral-400">{char.role}</div>
                            </div>
                          </div>
                        </td>
                        <td className="p-3.5">
                          <div className="space-y-1.5 w-36">
                            <div className="flex items-center justify-between text-xs font-bold">
                              <span className={tier.colorClass}>{char.affinity}%</span>
                              <span className={`text-[10px] px-2 py-0.5 rounded-full border ${tier.badgeBg}`}>
                                {tier.label}
                              </span>
                            </div>
                            <div className="w-full h-1.5 rounded-full bg-neutral-800 overflow-hidden">
                              <div
                                className="h-full rounded-full transition-all"
                                style={{
                                  width: `${char.affinity}%`,
                                  backgroundColor:
                                    char.affinity >= 75
                                      ? "#34d399"
                                      : char.affinity >= 50
                                      ? "#38bdf8"
                                      : char.affinity >= 30
                                      ? "#fbbf24"
                                      : "#f43f5e",
                                }}
                              />
                            </div>
                          </div>
                        </td>
                        <td className="p-3.5">
                          <div className="space-y-1">
                            <span className="inline-block text-[10px] px-2 py-0.5 rounded-md bg-purple-950/60 border border-purple-700/40 text-purple-300 font-medium">
                              {char.temperament || "сангвиник"}
                            </span>
                            <div className="text-[11px] text-neutral-400 line-clamp-1">
                              {(char.traits || []).join(", ") || "Черты раскрываются"}
                            </div>
                          </div>
                        </td>
                        <td className="p-3.5">
                          <div className="space-y-1">
                            <div className="text-xs text-neutral-200 flex items-center gap-1">
                              <Globe className="w-3 h-3 text-cyan-400" />
                              <span className="truncate max-w-[130px]">{char.origin || "Неизвестно"}</span>
                            </div>
                            <div className="text-[10px] text-neutral-400 truncate max-w-[130px]">
                              {char.currentStatus || "В отряде"}
                            </div>
                          </div>
                        </td>
                        <td className="p-3.5">
                          <div className="space-y-1 max-w-[180px]">
                            {char.merits && char.merits.length > 0 ? (
                              <div className="flex items-start gap-1 text-[11px] text-amber-300/90">
                                <Award className="w-3 h-3 text-amber-400 shrink-0 mt-0.5" />
                                <span className="line-clamp-2">{char.merits[char.merits.length - 1]}</span>
                              </div>
                            ) : (
                              <span className="text-[10px] text-neutral-500 italic">Подвиги впереди</span>
                            )}
                          </div>
                        </td>
                        <td className="p-3.5 text-right">
                          <button
                            onClick={() =>
                              handleInspectCell({
                                charA: protagonistName,
                                charB: char.name,
                                affinity: char.affinity,
                                label: tier.label,
                                colorClass: tier.colorClass,
                                badgeBg: tier.badgeBg,
                                notes: char.affinityTitle || tier.label,
                                chemistry: `Отношение: ${char.affinity}%. Черты: ${(char.traits || []).join(", ")}.`,
                                isProtagonistPair: true,
                              })
                            }
                            className="px-2.5 py-1.5 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-300 text-xs font-medium transition-all cursor-pointer inline-flex items-center gap-1"
                          >
                            <span>Досье</span>
                            <ChevronRight className="w-3 h-3" />
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* VIEW 3: TEMPERAMENT & CHEMISTRY SYNERGY */}
      {viewMode === "chemistry" && (
        <div className="space-y-4">
          <div className="p-4 rounded-2xl bg-neutral-900 border border-neutral-800 space-y-2">
            <h3 className="font-cinzel text-sm sm:text-base font-bold text-neutral-100 flex items-center gap-2">
              <Flame className="w-4 h-4 text-amber-400" />
              <span>Психологическая синергия отряда</span>
            </h3>
            <p className="text-xs text-neutral-400">
              Темпераменты спутников влияют на их споры в пути, инициативу в бою и реакцию на нестандартные действия автора.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {[
              {
                title: "Холерики",
                icon: "🔥",
                color: "text-rose-400 border-rose-500/30 bg-rose-950/20",
                desc: "Вспыльчивые, решительные, первыми рвутся в атаку. Не терпят промедлений.",
                count: characters.filter((c) => c.temperament === "холерик").length,
              },
              {
                title: "Сангвиники",
                icon: "⚡",
                color: "text-amber-400 border-amber-500/30 bg-amber-950/20",
                desc: "Оптимистичные, находчивые, легко вдохновляют спутников и заводят дружбу.",
                count: characters.filter((c) => c.temperament === "сангвиник").length,
              },
              {
                title: "Флегматики",
                icon: "🛡️",
                color: "text-cyan-400 border-cyan-500/30 bg-cyan-950/20",
                desc: "Невозмутимые, хладнокровные, опора отряда в моменты хаоса и паники.",
                count: characters.filter((c) => c.temperament === "флегматик").length,
              },
              {
                title: "Меланхолики",
                icon: "🌙",
                color: "text-purple-400 border-purple-500/30 bg-purple-950/20",
                desc: "Чуткие, глубокие, видят скрытые детали и скрытые опасности раньше других.",
                count: characters.filter((c) => c.temperament === "меланхолик").length,
              },
            ].map((box) => (
              <div key={box.title} className={`p-4 rounded-2xl border ${box.color} space-y-2`}>
                <div className="flex items-center justify-between">
                  <span className="text-xl">{box.icon}</span>
                  <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-neutral-900 border border-neutral-700">
                    {box.count} в группе
                  </span>
                </div>
                <div className="font-bold text-sm text-neutral-100">{box.title}</div>
                <p className="text-[11px] text-neutral-400 leading-relaxed">{box.desc}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* SELECTED CELL DETAILS MODAL / CARD */}
      {selectedCell && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-md animate-fade-in">
          <div className="relative w-full max-w-lg p-5 sm:p-6 rounded-2xl bg-neutral-900 border border-neutral-700 shadow-2xl space-y-4">
            <div className="flex items-start justify-between">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <Heart className="w-5 h-5 text-rose-400 fill-rose-500/20" />
                  <h3 className="font-cinzel text-base font-bold text-neutral-100">
                    {selectedCell.charA} ↔ {selectedCell.charB}
                  </h3>
                </div>
                <div className="text-xs text-neutral-400">
                  Психологический статус и взаимное восприятие
                </div>
              </div>
              <button
                onClick={() => setSelectedCell(null)}
                className="p-1 rounded-lg text-neutral-400 hover:text-neutral-100 hover:bg-neutral-800 transition-colors"
              >
                ✕
              </button>
            </div>

            {/* Gauge */}
            <div className="p-4 rounded-xl bg-neutral-950 border border-neutral-800 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs text-neutral-400">Уровень доверия & связи:</span>
                <span className={`text-base font-bold ${selectedCell.colorClass}`}>
                  {selectedCell.affinity}% ({selectedCell.label})
                </span>
              </div>
              <div className="w-full h-2 rounded-full bg-neutral-800 overflow-hidden">
                <div
                  className="h-full rounded-full transition-all"
                  style={{
                    width: `${selectedCell.affinity}%`,
                    backgroundColor:
                      selectedCell.affinity >= 75
                        ? "#34d399"
                        : selectedCell.affinity >= 50
                        ? "#38bdf8"
                        : selectedCell.affinity >= 30
                        ? "#fbbf24"
                        : "#f43f5e",
                  }}
                />
              </div>
              <p className="text-xs text-neutral-300 leading-relaxed">
                {selectedCell.chemistry}
              </p>
            </div>

            {/* AI Thought inspection if protagonist pair */}
            {selectedCell.isProtagonistPair && (
              <div className="p-3.5 rounded-xl bg-purple-950/20 border border-purple-700/30 space-y-2">
                <div className="flex items-center justify-between text-xs font-semibold text-purple-300">
                  <span className="flex items-center gap-1.5">
                    <MessageSquare className="w-3.5 h-3.5" />
                    <span>Мысли спутника о вас прямо сейчас:</span>
                  </span>
                  {isLoadingThought && <span className="text-[10px] text-purple-400">Считывание...</span>}
                </div>
                <div className="text-xs text-neutral-200 italic pl-2 border-l-2 border-purple-500/50">
                  {characterThought || (isLoadingThought ? "Анализ эмоционального фона..." : "«Я готов продолжить наш поход».")}
                </div>
              </div>
            )}

            <div className="flex justify-end pt-2">
              <button
                onClick={() => setSelectedCell(null)}
                className="px-4 py-2 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-200 text-xs font-medium transition-all cursor-pointer"
              >
                Закрыть
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
