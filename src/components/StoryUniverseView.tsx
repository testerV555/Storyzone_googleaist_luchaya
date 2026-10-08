import React, { useState } from "react";
import {
  ActiveGameState,
  UniverseSetting,
  ReaderTheme,
  LorebookEntry,
} from "../types";
import {
  Globe,
  Search,
  Sparkles,
  Shield,
  Plus,
  Trash2,
  Check,
  ExternalLink,
  BookOpen,
  Layers,
  Zap,
  Sword,
  Sliders,
  Loader2,
  BookmarkPlus,
  ArrowLeft,
  Compass,
  CheckCircle2,
} from "lucide-react";
import { sound } from "../utils/audio";
import { safeFetchJson } from "../utils/safeApi";
import { UNIVERSE_PRESETS } from "./UniverseSettingModal";

interface StoryUniverseViewProps {
  gameState: ActiveGameState;
  readerTheme: ReaderTheme;
  customApiKey?: string;
  onBackToStory: () => void;
  onUpdateUniverseSetting?: (newSetting: UniverseSetting) => void;
  onAddLorebookEntry?: (entry: LorebookEntry) => void;
}

export const StoryUniverseView: React.FC<StoryUniverseViewProps> = ({
  gameState,
  readerTheme,
  customApiKey,
  onBackToStory,
  onUpdateUniverseSetting,
  onAddLorebookEntry,
}) => {
  const currentUniverse: UniverseSetting =
    gameState.universeSetting ||
    gameState.story.universeSetting || {
      universeName: gameState.story.fandomSource || gameState.story.genre,
      settingDescription:
        gameState.story.synopsis ||
        "Уникальный авторский мир со своими законами, тайнами и атмосферой.",
      worldRules: [
        "Законы вселенной неукоснительно соблюдаются во всех сценах",
        "Действия героя влияют на репутацию среди местных фракций",
      ],
      factions: ["Местные гильдии", "Орден хранителей"],
      canonStrictness: "adaptive",
      searchGroundingEnabled: true,
    };

  const [universeName, setUniverseName] = useState(currentUniverse.universeName);
  const [settingDescription, setSettingDescription] = useState(
    currentUniverse.settingDescription || ""
  );
  const [canonStrictness, setCanonStrictness] = useState<"strict" | "adaptive" | "alternate">(
    currentUniverse.canonStrictness || "adaptive"
  );
  const [searchGroundingEnabled, setSearchGroundingEnabled] = useState<boolean>(
    currentUniverse.searchGroundingEnabled !== false
  );

  const [worldRules, setWorldRules] = useState<string[]>(
    currentUniverse.worldRules && currentUniverse.worldRules.length > 0
      ? [...currentUniverse.worldRules]
      : [
          "Действуют законы магии, технологий и социума выбранного сеттинга",
          "Решения героя влияют на баланс сил и отношение фракций",
        ]
  );
  const [newRuleInput, setNewRuleInput] = useState("");

  const [factions, setFactions] = useState<string[]>(
    currentUniverse.factions && currentUniverse.factions.length > 0
      ? [...currentUniverse.factions]
      : ["Правящий орден", "Вольные искатели"]
  );
  const [newFactionInput, setNewFactionInput] = useState("");

  // Live Google Search Grounding for Lore
  const [searchQuery, setSearchQuery] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [searchResult, setSearchResult] = useState<{
    title: string;
    category: string;
    summary: string;
    description: string;
    keyFacts: string[];
    sources?: { title: string; url: string }[];
  } | null>(null);

  const [saveNotice, setSaveNotice] = useState<string | null>(null);

  const handleAddRule = () => {
    if (!newRuleInput.trim()) return;
    sound.playClick();
    setWorldRules((prev) => [...prev, newRuleInput.trim()]);
    setNewRuleInput("");
  };

  const handleRemoveRule = (index: number) => {
    sound.playClick();
    setWorldRules((prev) => prev.filter((_, i) => i !== index));
  };

  const handleAddFaction = () => {
    if (!newFactionInput.trim()) return;
    sound.playClick();
    setFactions((prev) => [...prev, newFactionInput.trim()]);
    setNewFactionInput("");
  };

  const handleRemoveFaction = (index: number) => {
    sound.playClick();
    setFactions((prev) => prev.filter((_, i) => i !== index));
  };

  const handleApplyPreset = (preset: (typeof UNIVERSE_PRESETS)[0]) => {
    sound.playAction("magic");
    setUniverseName(preset.name);
    setSettingDescription(preset.description);
    setWorldRules([...preset.worldRules]);
    setFactions([...preset.factions]);
    setSaveNotice(`Применён пресет: «${preset.name}». Не забудьте нажать «Сохранить»!`);
    setTimeout(() => setSaveNotice(null), 3500);
  };

  const handleSearchLore = async () => {
    if (!searchQuery.trim() || isSearching) return;
    sound.playClick();
    setIsSearching(true);
    setSearchResult(null);

    try {
      const res = await safeFetchJson<any>("/api/universe/search-lore", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(customApiKey ? { "x-custom-api-key": customApiKey } : {}),
        },
        body: JSON.stringify({
          universeName,
          query: searchQuery,
          customKey: customApiKey,
        }),
      });

      if (res.ok && res.data) {
        sound.playAction("magic");
        setSearchResult(res.data);
      }
    } catch (e) {
      console.error("Lore search error:", e);
    } finally {
      setIsSearching(false);
    }
  };

  const handleAddSearchResultToRules = () => {
    if (!searchResult) return;
    sound.playAction("magic");
    const newRule = `${searchResult.title}: ${searchResult.summary}`;
    setWorldRules((prev) => [...prev, newRule]);
    setSaveNotice(`Правило «${searchResult.title}» добавлено в список!`);
    setTimeout(() => setSaveNotice(null), 3000);
  };

  const handleAddSearchResultToLorebook = () => {
    if (!searchResult || !onAddLorebookEntry) return;
    sound.playAction("magic");
    onAddLorebookEntry({
      id: `lore_${Date.now()}`,
      title: searchResult.title,
      description: searchResult.description || searchResult.summary,
      category: (searchResult.category as any) || "правило_мира",
      discoveredAtStep: gameState.stepCount,
    });
    setSaveNotice(`Запись «${searchResult.title}» добавлена в лорбук повести!`);
    setTimeout(() => setSaveNotice(null), 3000);
  };

  const handleSaveAndApply = () => {
    sound.playAction("magic");
    const updated: UniverseSetting = {
      universeName: universeName.trim() || gameState.story.genre,
      settingDescription: settingDescription.trim(),
      worldRules,
      factions,
      canonStrictness,
      searchGroundingEnabled,
      lastGroundingSources: searchResult?.sources || currentUniverse.lastGroundingSources,
    };

    if (onUpdateUniverseSetting) {
      onUpdateUniverseSetting(updated);
    }

    setSaveNotice("✓ Параметры вселенной успешно сохранены и переданы ИИ-Соавтору!");
    setTimeout(() => setSaveNotice(null), 4000);
  };

  return (
    <div className="flex-1 overflow-y-auto p-3 sm:p-6 space-y-6 max-w-5xl mx-auto w-full animate-fade-in pb-24">
      {/* Top Header & Breadcrumbs */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-neutral-800">
        <div className="flex items-center gap-3">
          <button
            onClick={() => {
              sound.playClick();
              onBackToStory();
            }}
            className="p-2 rounded-xl bg-neutral-900 hover:bg-neutral-800 border border-neutral-800 text-neutral-300 hover:text-white transition-colors"
            title="Вернуться к чтению повести"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div className="p-2.5 rounded-2xl bg-cyan-950/80 border border-cyan-800/80 text-cyan-300 shadow-md">
            <Globe className="w-5 h-5" />
          </div>
          <div>
            <h2 className="font-cinzel text-lg sm:text-xl font-bold text-neutral-100 flex items-center gap-2">
              Настройки Вселенной & Сеттинга
              <span className="text-xs px-2 py-0.5 rounded-full bg-cyan-950 border border-cyan-800 text-cyan-300 font-sans font-medium">
                {canonStrictness === "strict" ? "Строгий канон" : canonStrictness === "alternate" ? "Альтернативный мир" : "Адаптивный"}
              </span>
            </h2>
            <p className="text-xs text-neutral-400">
              ИИ-Соавтор и генератор глав неукоснительно опираются на эти правила при создании каждого следующего шага
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleSaveAndApply}
            className="px-4 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white font-bold text-xs sm:text-sm flex items-center gap-2 shadow-lg shadow-cyan-950 transition-all hover:scale-105 active:scale-95"
          >
            <Check className="w-4 h-4" />
            <span>Сохранить и применить</span>
          </button>
        </div>
      </div>

      {saveNotice && (
        <div className="p-3 rounded-xl bg-emerald-950/80 border border-emerald-700/60 text-emerald-200 text-xs flex items-center gap-2 animate-fade-in shadow-md">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{saveNotice}</span>
        </div>
      )}

      {/* Preset Fast Selector */}
      <div className="space-y-2">
        <div className="flex items-center justify-between text-xs text-neutral-400">
          <span className="font-semibold text-neutral-300 flex items-center gap-1.5">
            <Compass className="w-4 h-4 text-purple-400" />
            Быстрый выбор популярного канона:
          </span>
          <span className="text-[11px] text-neutral-500">Нажмите для загрузки правил</span>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 gap-2">
          {UNIVERSE_PRESETS.map((p) => (
            <button
              key={p.id}
              onClick={() => handleApplyPreset(p)}
              className="p-2 rounded-xl bg-neutral-900/90 hover:bg-purple-950/60 border border-neutral-800 hover:border-purple-700/60 text-left transition-all group flex flex-col justify-between"
            >
              <div className="text-base mb-1">{p.icon}</div>
              <div className="text-xs font-semibold text-neutral-200 group-hover:text-purple-300 line-clamp-1">
                {p.name.split("(")[0].trim()}
              </div>
              <div className="text-[10px] text-neutral-500">{p.genre}</div>
            </button>
          ))}
        </div>
      </div>

      {/* Main Grid: Settings & Canon Rules */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left Column: General Universe Info & Canon Strictness */}
        <div className="space-y-4">
          <div className="p-4 sm:p-5 rounded-2xl bg-neutral-900/70 border border-neutral-800 space-y-4 shadow-md">
            <h3 className="text-sm font-bold text-neutral-200 flex items-center gap-2">
              <Layers className="w-4 h-4 text-cyan-400" />
              Базовые параметры сеттинга
            </h3>

            <div>
              <label className="block text-xs font-semibold text-neutral-300 mb-1.5">
                Название вселенной или первоисточника
              </label>
              <input
                type="text"
                value={universeName}
                onChange={(e) => setUniverseName(e.target.value)}
                placeholder="Например: Ведьмак, Cyberpunk 2077, Звёздные Войны, Авторский мир..."
                className="w-full px-3.5 py-2 rounded-xl bg-neutral-950 border border-neutral-800 text-xs sm:text-sm text-neutral-100 placeholder-neutral-500 focus:outline-none focus:border-cyan-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-neutral-300 mb-1.5">
                Художественное описание сеттинга и эпохи
              </label>
              <textarea
                rows={4}
                value={settingDescription}
                onChange={(e) => setSettingDescription(e.target.value)}
                placeholder="Опишите атмосферу, законы магии, уровень технологий, географию и общий тон повествования..."
                className="w-full px-3.5 py-2 rounded-xl bg-neutral-950 border border-neutral-800 text-xs sm:text-sm text-neutral-100 placeholder-neutral-500 focus:outline-none focus:border-cyan-500 resize-none leading-relaxed"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-neutral-300 mb-2">
                Степень строгости канона
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => {
                    sound.playClick();
                    setCanonStrictness("strict");
                  }}
                  className={`p-3 rounded-xl border text-left text-xs transition-all ${
                    canonStrictness === "strict"
                      ? "bg-purple-950/80 border-purple-500 text-purple-200 shadow-md"
                      : "bg-neutral-950 border-neutral-800 text-neutral-400 hover:text-neutral-200"
                  }`}
                >
                  <span className="font-bold block text-neutral-100 mb-0.5">🛡️ Строгий канон</span>
                  <span className="text-[10px] leading-tight block text-neutral-400">
                    ИИ следует фактам первоисточника без вольностей
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    sound.playClick();
                    setCanonStrictness("adaptive");
                  }}
                  className={`p-3 rounded-xl border text-left text-xs transition-all ${
                    canonStrictness === "adaptive"
                      ? "bg-purple-950/80 border-purple-500 text-purple-200 shadow-md"
                      : "bg-neutral-950 border-neutral-800 text-neutral-400 hover:text-neutral-200"
                  }`}
                >
                  <span className="font-bold block text-neutral-100 mb-0.5">⚖️ Адаптивный</span>
                  <span className="text-[10px] leading-tight block text-neutral-400">
                    Органичное развитие сюжета в атмосфере мира
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    sound.playClick();
                    setCanonStrictness("alternate");
                  }}
                  className={`p-3 rounded-xl border text-left text-xs transition-all ${
                    canonStrictness === "alternate"
                      ? "bg-purple-950/80 border-purple-500 text-purple-200 shadow-md"
                      : "bg-neutral-950 border-neutral-800 text-neutral-400 hover:text-neutral-200"
                  }`}
                >
                  <span className="font-bold block text-neutral-100 mb-0.5">🔀 Альтернативный</span>
                  <span className="text-[10px] leading-tight block text-neutral-400">
                    Смелые развилки и неканонические линии
                  </span>
                </button>
              </div>
            </div>

            {/* Search Grounding Toggle */}
            <div className="pt-2 border-t border-neutral-800 flex items-center justify-between">
              <div className="space-y-0.5">
                <span className="text-xs font-bold text-neutral-200 flex items-center gap-1.5">
                  <Search className="w-3.5 h-3.5 text-cyan-400" />
                  Google Search Grounding
                </span>
                <p className="text-[11px] text-neutral-400">
                  Позволяет ИИ сверять канонические факты, термины и даты через Google Поиск
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  sound.playClick();
                  setSearchGroundingEnabled(!searchGroundingEnabled);
                }}
                className={`w-12 h-6 rounded-full transition-colors relative flex items-center px-1 ${
                  searchGroundingEnabled ? "bg-cyan-600" : "bg-neutral-800"
                }`}
              >
                <div
                  className={`w-4 h-4 rounded-full bg-white transition-transform ${
                    searchGroundingEnabled ? "translate-x-6" : "translate-x-0"
                  }`}
                />
              </button>
            </div>
          </div>

          {/* Factions & Power Structures */}
          <div className="p-4 sm:p-5 rounded-2xl bg-neutral-900/70 border border-neutral-800 space-y-3 shadow-md">
            <h3 className="text-sm font-bold text-neutral-200 flex items-center gap-2">
              <Shield className="w-4 h-4 text-purple-400" />
              Действующие фракции и силы мира
            </h3>

            <div className="flex gap-2">
              <input
                type="text"
                value={newFactionInput}
                onChange={(e) => setNewFactionInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleAddFaction()}
                placeholder="Добавить фракцию (например: Ложа Чародеек, Корпорация Арасака)..."
                className="flex-1 px-3 py-1.5 rounded-xl bg-neutral-950 border border-neutral-800 text-xs text-neutral-100 placeholder-neutral-500 focus:outline-none focus:border-purple-500"
              />
              <button
                onClick={handleAddFaction}
                className="px-3 py-1.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold flex items-center gap-1 shrink-0"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Добавить</span>
              </button>
            </div>

            <div className="flex flex-wrap gap-2 pt-1">
              {factions.map((fac, idx) => (
                <div
                  key={idx}
                  className="flex items-center gap-1.5 px-3 py-1 rounded-xl bg-neutral-950 border border-neutral-800 text-xs text-neutral-200"
                >
                  <span>{fac}</span>
                  <button
                    onClick={() => handleRemoveFaction(idx)}
                    className="text-neutral-500 hover:text-rose-400 p-0.5 rounded transition-colors"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right Column: World Rules & Live Lore Search */}
        <div className="space-y-4">
          {/* World Rules List */}
          <div className="p-4 sm:p-5 rounded-2xl bg-neutral-900/70 border border-neutral-800 space-y-3 shadow-md">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-neutral-200 flex items-center gap-2">
                <Sword className="w-4 h-4 text-amber-400" />
                Непреложные законы и правила мира ({worldRules.length})
              </h3>
              <span className="text-[10px] text-neutral-500">ИИ учитывает их в каждой сцене</span>
            </div>

            <div className="flex gap-2">
              <input
                type="text"
                value={newRuleInput}
                onChange={(e) => setNewRuleInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleAddRule()}
                placeholder="Новый закон мира (например: магия требует платы здоровьем)..."
                className="flex-1 px-3 py-1.5 rounded-xl bg-neutral-950 border border-neutral-800 text-xs text-neutral-100 placeholder-neutral-500 focus:outline-none focus:border-amber-500"
              />
              <button
                onClick={handleAddRule}
                className="px-3 py-1.5 rounded-xl bg-amber-600 hover:bg-amber-500 text-white text-xs font-bold flex items-center gap-1 shrink-0"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Добавить</span>
              </button>
            </div>

            <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
              {worldRules.map((rule, idx) => (
                <div
                  key={idx}
                  className="p-2.5 rounded-xl bg-neutral-950 border border-neutral-800 text-xs text-neutral-200 flex items-start justify-between gap-3 group"
                >
                  <div className="flex items-start gap-2">
                    <span className="text-amber-400 font-bold text-[11px] shrink-0 mt-0.5">
                      #{idx + 1}
                    </span>
                    <span className="leading-relaxed">{rule}</span>
                  </div>
                  <button
                    onClick={() => handleRemoveRule(idx)}
                    className="text-neutral-500 hover:text-rose-400 p-1 rounded transition-colors opacity-70 group-hover:opacity-100 shrink-0"
                    title="Удалить правило"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Online Lore Researcher via Google Search */}
          <div className="p-4 sm:p-5 rounded-2xl bg-cyan-950/20 border border-cyan-800/40 space-y-3 shadow-md">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-cyan-200 flex items-center gap-2">
                <Search className="w-4 h-4 text-cyan-400" />
                Онлайн-исследователь канона (Google Search)
              </h3>
              <span className="text-[10px] text-cyan-400/80">Поиск аутентичных фактов</span>
            </div>

            <p className="text-[11px] text-neutral-400 leading-relaxed">
              Введите имя персонажа, артефакт, орден или термин вселенной «{universeName}», чтобы получить проверенную справку из Сети:
            </p>

            <div className="flex gap-2">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSearchLore()}
                placeholder="Что исследовать (например: Школа Кота, Релик, Батлерианский джихад)..."
                className="flex-1 px-3 py-2 rounded-xl bg-neutral-950 border border-neutral-800 text-xs text-neutral-100 placeholder-neutral-500 focus:outline-none focus:border-cyan-500"
              />
              <button
                onClick={handleSearchLore}
                disabled={isSearching || !searchQuery.trim()}
                className="px-4 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-bold flex items-center gap-1.5 shrink-0 disabled:opacity-40"
              >
                {isSearching ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Search className="w-3.5 h-3.5" />
                )}
                <span>Искать</span>
              </button>
            </div>

            {searchResult && (
              <div className="p-3.5 rounded-xl bg-neutral-950 border border-cyan-800/60 space-y-3 text-xs animate-fade-in">
                <div className="flex items-center justify-between">
                  <h4 className="font-bold text-cyan-300 text-sm">{searchResult.title}</h4>
                  <span className="text-[10px] px-2 py-0.5 rounded bg-cyan-950 text-cyan-400 border border-cyan-800">
                    {searchResult.category}
                  </span>
                </div>

                <p className="text-neutral-300 leading-relaxed">{searchResult.summary}</p>

                {searchResult.keyFacts && searchResult.keyFacts.length > 0 && (
                  <div className="space-y-1 pt-1">
                    <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider block">
                      Ключевые факты канона:
                    </span>
                    {searchResult.keyFacts.map((fact, idx) => (
                      <div key={idx} className="flex items-start gap-1.5 text-neutral-300 text-[11px]">
                        <span className="text-cyan-400">•</span>
                        <span>{fact}</span>
                      </div>
                    ))}
                  </div>
                )}

                {searchResult.sources && searchResult.sources.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 pt-2 border-t border-neutral-800">
                    {searchResult.sources.map((src, idx) => (
                      <a
                        key={idx}
                        href={src.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-neutral-900 hover:bg-neutral-800 text-[10px] text-cyan-300 border border-neutral-750 transition-colors"
                      >
                        <span className="truncate max-w-[180px]">{src.title}</span>
                        <ExternalLink className="w-2.5 h-2.5" />
                      </a>
                    ))}
                  </div>
                )}

                <div className="flex flex-wrap gap-2 pt-2">
                  <button
                    onClick={handleAddSearchResultToRules}
                    className="px-3 py-1.5 rounded-lg bg-amber-600/90 hover:bg-amber-500 text-white text-xs font-semibold flex items-center gap-1.5 shadow"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Добавить в правила мира</span>
                  </button>

                  {onAddLorebookEntry && (
                    <button
                      onClick={handleAddSearchResultToLorebook}
                      className="px-3 py-1.5 rounded-lg bg-purple-600/90 hover:bg-purple-500 text-white text-xs font-semibold flex items-center gap-1.5 shadow"
                    >
                      <BookmarkPlus className="w-3.5 h-3.5" />
                      <span>Сохранить в лорбук</span>
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Floating Bottom Quick Action Bar */}
      <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-30 flex items-center gap-3 p-2 rounded-2xl bg-neutral-900/95 border border-cyan-800/80 shadow-2xl backdrop-blur-xl">
        <button
          onClick={handleSaveAndApply}
          className="px-5 py-2.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white font-bold text-xs sm:text-sm flex items-center gap-2 shadow-lg shadow-cyan-950 transition-all hover:scale-105 active:scale-95"
        >
          <Check className="w-4 h-4" />
          <span>Сохранить параметры вселенной</span>
        </button>
        <button
          onClick={() => {
            sound.playClick();
            onBackToStory();
          }}
          className="px-4 py-2.5 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-300 text-xs sm:text-sm font-semibold transition-colors"
        >
          К повести
        </button>
      </div>
    </div>
  );
};
