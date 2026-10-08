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
  X,
  Plus,
  Trash2,
  Check,
  CheckCircle2,
  ExternalLink,
  BookOpen,
  Layers,
  Flame,
  Zap,
  Sword,
  Sliders,
  HelpCircle,
  Loader2,
  BookmarkPlus,
  Compass,
} from "lucide-react";
import { sound } from "../utils/audio";
import { safeFetchJson } from "../utils/safeApi";

interface UniverseSettingModalProps {
  isOpen: boolean;
  onClose: () => void;
  gameState: ActiveGameState;
  onUpdateUniverseSetting: (newSetting: UniverseSetting) => void;
  onAddLorebookEntry?: (entry: LorebookEntry) => void;
  customApiKey?: string;
  readerTheme: ReaderTheme;
}

export const UNIVERSE_PRESETS: {
  id: string;
  name: string;
  description: string;
  worldRules: string[];
  factions: string[];
  genre: string;
  icon: string;
}[] = [
  {
    id: "witcher",
    name: "Ведьмак (The Witcher)",
    description: "Суровый Континент: эпоха войн между Нильфгаардом и Северными королевствами. Сопряжение сфер оставило реликты и чудовищ, магия требует платы, а нейтралитет стоит дороже золота.",
    worldRules: [
      "Серебряный клинок против чудовищ, стальной против людей",
      "Мутанты-ведьмаки принимают эликсиры, смертельные для обычных людей",
      "Магия питается силой стихий и оставляет след в хаосе",
      "Нейтралитет редко спасает от выбора меньшего зла",
    ],
    factions: ["Школа Волка", "Нильфгаардская Империя", "Ложа Чародеек", "Скоя'таэли (Белки)", "Реданская разведка"],
    genre: "Фэнтези",
    icon: "🐺",
  },
  {
    id: "cyberpunk",
    name: "Киберпанк 2077 (Cyberpunk)",
    description: "Найт-Сити: хромированный неоновый мегаполис на побережье Калифорнии. Корпорации правят бал, уличные наёмники борются за выживание, а грань между человеком и кодом размыта.",
    worldRules: [
      "Каждый имплант нагружает нервную систему и ведёт к риску киберпсихоза",
      "Информация и данные ценнее человеческой жизни",
      "Старый Искин за Чёрным Заслоном смертельно опасен для нетраннеров",
      "Корпорации обладают экстерриториальностью и собственной армией",
    ],
    factions: ["Корпорация Арасака", "Милитех", "Банда «Мальстрём»", "Фиксеры Афтерлайфа", "Сетевой Дозор (NetWatch)"],
    genre: "Киберпанк",
    icon: "🦾",
  },
  {
    id: "starwars",
    name: "Звёздные Войны (Star Wars)",
    description: "Далёкая-далёкая галактика: противостояние Светлой и Тёмной сторон Силы, гиперпространственные прыжки, древние ордены и космические баталии.",
    worldRules: [
      "Сила пронизывает всё сущее, соединяя живые организмы",
      "Гнев, страх и агрессия ведут к Тёмной стороне",
      "Световой меч требует настройки кайбер-кристалла",
      "Гиперпространственные маршруты требуют точных навигационных расчётов",
    ],
    factions: ["Орден Джедаев", "Орден Ситхов", "Галактическая Империя / Первый Орден", "Альянс Повстанцев", "Гильдия Охотников за головами"],
    genre: "Космоопера",
    icon: "🌌",
  },
  {
    id: "harrypotter",
    name: "Гарри Поттер (Wizarding World)",
    description: "Тайное магическое сообщество рядом с миром маглов: древние школы волшебства, министерство магии, скрытые артефакты и опасные проклятия.",
    worldRules: [
      "Статут о секретности строго запрещает демонстрацию магии маглам",
      "Палочка выбирает волшебника сама",
      "Непростительные заклятия караются Азкабаном",
      "Древняя магия крови и любви превосходит стандартные чары",
    ],
    factions: ["Министерство Магии", "Орден Феникса", "Пожиратели Смерти", "Школа Хогвартс", "Отдел Тайн"],
    genre: "Фэнтези",
    icon: "⚡",
  },
  {
    id: "warhammer40k",
    name: "Warhammer 40,000",
    description: "Мрачная тьма 41-го тысячелетия: Империум Человечества ведёт бесконечную войну на выживание против ксеносов, еретиков и порождений Варпа.",
    worldRules: [
      "Варп нестабилен и полон демонических сущностей Губительных Сил",
      "Технологии прошлого почитаются как священные реликвии Адептус Механикус",
      "Псайкеры обязаны быть санкционированы или уничтожены",
      "Только в смерти заканчивается долг перед Императором",
    ],
    factions: ["Адептус Астартес (Космодесант)", "Священная Инквизиция", "Боги Хаоса", "Адептус Механикус", "Астра Милитарум"],
    genre: "Космоопера",
    icon: "⚔️",
  },
  {
    id: "anime_isekai",
    name: "Аниме & Ранобэ (Исекай)",
    description: "Мир меча и магии с развитой системой рангов гильдии, подземельями, древними богами и героями с уникальными талантами.",
    worldRules: [
      "Ранги авантюристов от F до S определяют доступ к заданиям и зонам",
      "Магические круги и песнопения усиливают боевые техники",
      "Монстры в подземельях оставляют магические кристаллы",
      "Уникальные навыки требуют времени на перезарядку или запаса маны",
    ],
    factions: ["Гильдия Авантюристов", "Королевская Рыцарская Гвардия", "Культ Тёмного Владыки", "Торговый Консорциум"],
    genre: "Аниме и исекай",
    icon: "⛩️",
  },
  {
    id: "darksouls",
    name: "Dark Souls & Elden Ring",
    description: "Разрушенный мир угасающего огня или расколотого Кольца: древние владыки, потерявшие рассудок, пепел, руны и цена бессмертия.",
    worldRules: [
      "Утрата душ или рун грозит потерей человечности и разума",
      "Благодать направляет путь избранного к престолу",
      "Время и пространство между эпохами искривлены",
      "Боги смертны, но их падение искажает саму ткань реальности",
    ],
    factions: ["Хранители Огня", "Пепельные паломники", "Золотой Порядок", "Рыцари Горнила"],
    genre: "Фэнтези",
    icon: "🔥",
  },
];

export const UniverseSettingModal: React.FC<UniverseSettingModalProps> = ({
  isOpen,
  onClose,
  gameState,
  onUpdateUniverseSetting,
  onAddLorebookEntry,
  customApiKey,
  readerTheme,
}) => {
  const currentUniverse = gameState.universeSetting || {
    universeName: gameState.story.fandomSource || gameState.story.genre || "Фэнтези",
    settingDescription: gameState.story.synopsis || "Аутентичный мир со своими законами и атмосферой",
    worldRules: [
      "Законы вселенной неукоснительно соблюдаются во всех сценах",
      "Действия героя влияют на репутацию среди местных фракций",
    ],
    factions: ["Местные гильдии", "Орден хранителей"],
    canonStrictness: "adaptive",
    searchGroundingEnabled: true,
  };

  const [activeTab, setActiveTab] = useState<"settings" | "rules" | "search">("settings");
  const [universeName, setUniverseName] = useState(currentUniverse.universeName);
  const [settingDescription, setSettingDescription] = useState(currentUniverse.settingDescription || "");
  const [canonStrictness, setCanonStrictness] = useState<"strict" | "adaptive" | "alternate">(
    currentUniverse.canonStrictness || "adaptive"
  );
  const [searchGroundingEnabled, setSearchGroundingEnabled] = useState<boolean>(
    currentUniverse.searchGroundingEnabled !== false
  );

  const [worldRules, setWorldRules] = useState<string[]>(
    currentUniverse.worldRules || []
  );
  const [newRuleInput, setNewRuleInput] = useState("");

  const [factions, setFactions] = useState<string[]>(
    currentUniverse.factions || []
  );
  const [newFactionInput, setNewFactionInput] = useState("");

  // Live Google Search Grounding tool state
  const [searchQuery, setSearchQuery] = useState("");
  const [isSearchingLore, setIsSearchingLore] = useState(false);
  const [searchResult, setSearchResult] = useState<any | null>(null);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [saveNotice, setSaveNotice] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleApplyPreset = (preset: typeof UNIVERSE_PRESETS[0]) => {
    sound.playAction("magic");
    setUniverseName(preset.name);
    setSettingDescription(preset.description);
    setWorldRules(preset.worldRules);
    setFactions(preset.factions);
    setSaveNotice(`Применён сеттинг: «${preset.name}»!`);
    setTimeout(() => setSaveNotice(null), 3000);
  };

  const handleAddRule = () => {
    const text = newRuleInput.trim();
    if (!text) return;
    sound.playClick();
    if (!worldRules.includes(text)) {
      setWorldRules((prev) => [...prev, text]);
    }
    setNewRuleInput("");
  };

  const handleRemoveRule = (index: number) => {
    sound.playClick();
    setWorldRules((prev) => prev.filter((_, i) => i !== index));
  };

  const handleAddFaction = () => {
    const text = newFactionInput.trim();
    if (!text) return;
    sound.playClick();
    if (!factions.includes(text)) {
      setFactions((prev) => [...prev, text]);
    }
    setNewFactionInput("");
  };

  const handleRemoveFaction = (index: number) => {
    sound.playClick();
    setFactions((prev) => prev.filter((_, i) => i !== index));
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
    onUpdateUniverseSetting(updated);
    setSaveNotice("✓ Параметры вселенной и сеттинга успешно сохранены!");
    setTimeout(() => {
      setSaveNotice(null);
      onClose();
    }, 1200);
  };

  // Google Search Grounding for canon lore facts
  const handlePerformLoreSearch = async () => {
    const q = searchQuery.trim();
    if (!q || isSearchingLore) return;

    sound.playClick();
    setIsSearchingLore(true);
    setSearchError(null);
    setSearchResult(null);

    try {
      const res = await safeFetchJson<any>("/api/universe/search-lore", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(customApiKey ? { "x-custom-api-key": customApiKey } : {}),
        },
        body: JSON.stringify({
          universeName: universeName || gameState.story.genre,
          query: q,
          customKey: customApiKey,
        }),
      });

      if (res.ok && res.data) {
        sound.playAction("magic");
        setSearchResult(res.data);
      } else {
        throw new Error("Не удалось выполнить поиск по канону");
      }
    } catch (err: any) {
      console.warn("Lore search error:", err);
      sound.playAction("click");
      setSearchError("Поиск временно недоступен или лимит исчерпан. Попробуйте другой запрос.");
    } finally {
      setIsSearchingLore(false);
    }
  };

  const handleAddSearchResultToLorebook = () => {
    if (!searchResult || !onAddLorebookEntry) return;
    sound.playAction("magic");

    const entry: LorebookEntry = {
      id: `lore_${Date.now()}`,
      title: searchResult.title || searchQuery,
      description: searchResult.description || searchResult.summary || "Каноничный факт вселенной",
      category: searchResult.category || "правило_мира",
      discoveredAtStep: gameState.stepCount,
    };

    onAddLorebookEntry(entry);
    setSaveNotice(`✓ «${entry.title}» добавлено в летопись лорбука!`);
    setTimeout(() => setSaveNotice(null), 3000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/85 backdrop-blur-md animate-fade-in">
      <div className="bg-neutral-900 border border-neutral-700/80 w-full max-w-3xl rounded-2xl shadow-2xl flex flex-col max-h-[92vh] overflow-hidden text-neutral-100">
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-neutral-800 flex items-center justify-between bg-gradient-to-r from-purple-950/40 via-neutral-900 to-cyan-950/30">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-purple-600/20 border border-purple-500/40 flex items-center justify-center text-purple-400 shrink-0 shadow-inner">
              <Globe className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-neutral-100 flex items-center gap-2">
                <span>Сеттинг & Вселенная</span>
                <span className="text-xs font-normal px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-300 border border-purple-500/30">
                  Google Search Grounding
                </span>
              </h2>
              <p className="text-xs text-neutral-400">
                Каноничные законы мира, фракции и проверка фактов для глав и ИИ-Соавтора
              </p>
            </div>
          </div>

          <button
            onClick={() => {
              sound.playClick();
              onClose();
            }}
            className="p-2 rounded-xl text-neutral-400 hover:text-neutral-100 hover:bg-neutral-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tabs Bar */}
        <div className="flex border-b border-neutral-800 px-4 pt-2 bg-neutral-950/40 gap-2 overflow-x-auto">
          <button
            onClick={() => {
              sound.playClick();
              setActiveTab("settings");
            }}
            className={`pb-2.5 px-3 text-xs font-semibold flex items-center gap-2 border-b-2 transition-all ${
              activeTab === "settings"
                ? "border-purple-500 text-purple-300"
                : "border-transparent text-neutral-400 hover:text-neutral-200"
            }`}
          >
            <Sliders className="w-4 h-4" />
            <span>Параметры сеттинга</span>
          </button>

          <button
            onClick={() => {
              sound.playClick();
              setActiveTab("rules");
            }}
            className={`pb-2.5 px-3 text-xs font-semibold flex items-center gap-2 border-b-2 transition-all ${
              activeTab === "rules"
                ? "border-purple-500 text-purple-300"
                : "border-transparent text-neutral-400 hover:text-neutral-200"
            }`}
          >
            <Shield className="w-4 h-4" />
            <span>Законы мира & Фракции ({worldRules.length + factions.length})</span>
          </button>

          <button
            onClick={() => {
              sound.playClick();
              setActiveTab("search");
            }}
            className={`pb-2.5 px-3 text-xs font-semibold flex items-center gap-2 border-b-2 transition-all ${
              activeTab === "search"
                ? "border-purple-500 text-purple-300"
                : "border-transparent text-neutral-400 hover:text-neutral-200"
            }`}
          >
            <Search className="w-4 h-4" />
            <span className="flex items-center gap-1.5">
              <span>Поиск канона в Google</span>
              <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
            </span>
          </button>
        </div>

        {/* Notification banner */}
        {saveNotice && (
          <div className="mx-4 mt-3 p-2.5 rounded-xl bg-purple-950/90 border border-purple-700 text-purple-200 text-xs flex items-center gap-2 animate-fade-in shadow-md">
            <CheckCheckIcon className="w-4 h-4 text-purple-400 shrink-0" />
            <span>{saveNotice}</span>
          </div>
        )}

        {/* Tab Contents */}
        <div className="p-4 sm:p-5 overflow-y-auto space-y-5 flex-1">
          {activeTab === "settings" && (
            <>
              {/* Google Search Grounding Master Toggle */}
              <div className="p-4 rounded-xl bg-neutral-950 border border-neutral-800 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="p-2 rounded-lg bg-cyan-950/80 border border-cyan-700/50 text-cyan-400">
                      <Search className="w-4 h-4" />
                    </div>
                    <div>
                      <span className="text-xs font-bold text-neutral-100 block">
                        Google Search Grounding (Поиск канона по Google)
                      </span>
                      <span className="text-[11px] text-neutral-400">
                        Использовать актуальные данные веб-поиска для точного канона
                      </span>
                    </div>
                  </div>

                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={searchGroundingEnabled}
                      onChange={(e) => setSearchGroundingEnabled(e.target.checked)}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-neutral-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-neutral-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-purple-600"></div>
                  </label>
                </div>
                <p className="text-[11px] text-neutral-400 leading-relaxed pt-1">
                  При генерации новых глав и в диалогах с ИИ-Соавтором нейросеть будет обращаться к Google Search, сверяясь с именами, географией, фракциями и каноном выбранной вселенной.
                </p>
              </div>

              {/* Quick Preset Selector */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-neutral-200 uppercase tracking-wider flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-purple-400" />
                    Готовые вселенные & Сеттинги (1 клик для применения)
                  </span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {UNIVERSE_PRESETS.map((preset) => (
                    <button
                      key={preset.id}
                      type="button"
                      onClick={() => handleApplyPreset(preset)}
                      className={`p-2.5 rounded-xl border text-left transition-all flex flex-col justify-between group ${
                        universeName.toLowerCase().includes(preset.name.toLowerCase().slice(0, 7))
                          ? "bg-purple-950/70 border-purple-500 shadow-md"
                          : "bg-neutral-950 hover:bg-neutral-800/80 border-neutral-800 hover:border-neutral-700"
                      }`}
                    >
                      <div className="flex items-center justify-between w-full mb-1">
                        <span className="text-xl">{preset.icon}</span>
                        {universeName.toLowerCase().includes(preset.name.toLowerCase().slice(0, 7)) && (
                          <Check className="w-3.5 h-3.5 text-purple-400" />
                        )}
                      </div>
                      <span className="text-xs font-bold text-neutral-200 group-hover:text-purple-300 truncate block">
                        {preset.name}
                      </span>
                      <span className="text-[10px] text-neutral-400 truncate">
                        {preset.genre}
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Main Universe Name & Description */}
              <div className="space-y-3.5 p-4 rounded-xl bg-neutral-950 border border-neutral-800">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-neutral-200 block">
                    Название вселенной или авторского мира:
                  </label>
                  <input
                    type="text"
                    value={universeName}
                    onChange={(e) => setUniverseName(e.target.value)}
                    placeholder="Например: Ведьмак, Киберпанк, Звёздные Войны или Авторский мир..."
                    className="w-full bg-neutral-900 border border-neutral-700 focus:border-purple-500 rounded-xl px-3 py-2 text-xs text-neutral-100 placeholder-neutral-500 focus:outline-none focus:ring-1 focus:ring-purple-500"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-neutral-200 block">
                    Описание сеттинга, эпохи, географии и атмосферы:
                  </label>
                  <textarea
                    rows={3}
                    value={settingDescription}
                    onChange={(e) => setSettingDescription(e.target.value)}
                    placeholder="Опишите эпоху, географию, уровень технологий или магии, царящие настроения и опасности этого мира..."
                    className="w-full bg-neutral-900 border border-neutral-700 focus:border-purple-500 rounded-xl p-3 text-xs text-neutral-100 placeholder-neutral-500 focus:outline-none focus:ring-1 focus:ring-purple-500 leading-relaxed resize-y"
                  />
                </div>

                {/* Canon Strictness Selector */}
                <div className="space-y-1.5 pt-1">
                  <label className="text-xs font-bold text-neutral-200 block">
                    Режим соблюдения канона:
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        sound.playClick();
                        setCanonStrictness("strict");
                      }}
                      className={`p-2.5 rounded-xl border text-left text-xs transition-all ${
                        canonStrictness === "strict"
                          ? "bg-purple-950 border-purple-500 text-purple-200 shadow-sm"
                          : "bg-neutral-900 border-neutral-700 text-neutral-400 hover:text-neutral-200"
                      }`}
                    >
                      <span className="font-bold block text-neutral-100 mb-0.5">🛡️ Строгий канон</span>
                      <span className="text-[10px] leading-tight block">
                        Неукоснительное следование оригинальному лору, именам и законам
                      </span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        sound.playClick();
                        setCanonStrictness("adaptive");
                      }}
                      className={`p-2.5 rounded-xl border text-left text-xs transition-all ${
                        canonStrictness === "adaptive"
                          ? "bg-purple-950 border-purple-500 text-purple-200 shadow-sm"
                          : "bg-neutral-900 border-neutral-700 text-neutral-400 hover:text-neutral-200"
                      }`}
                    >
                      <span className="font-bold block text-neutral-100 mb-0.5">⚖️ Адаптивный канон</span>
                      <span className="text-[10px] leading-tight block">
                        Аутентичный дух вселенной со свободой авторского сюжета
                      </span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        sound.playClick();
                        setCanonStrictness("alternate");
                      }}
                      className={`p-2.5 rounded-xl border text-left text-xs transition-all ${
                        canonStrictness === "alternate"
                          ? "bg-purple-950 border-purple-500 text-purple-200 shadow-sm"
                          : "bg-neutral-900 border-neutral-700 text-neutral-400 hover:text-neutral-200"
                      }`}
                    >
                      <span className="font-bold block text-neutral-100 mb-0.5">🔀 Альтернативный мир</span>
                      <span className="text-[10px] leading-tight block">
                        Каноничная основа с возможностью смелых What If развилок
                      </span>
                    </button>
                  </div>
                </div>
              </div>
            </>
          )}

          {activeTab === "rules" && (
            <div className="space-y-5">
              {/* World Rules Section */}
              <div className="p-4 rounded-xl bg-neutral-950 border border-neutral-800 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Shield className="w-4 h-4 text-purple-400" />
                    <div>
                      <span className="text-xs font-bold text-neutral-100 block">
                        Непреложные законы и правила вселенной
                      </span>
                      <span className="text-[10px] text-neutral-400">
                        Правила магии, технологий, цены ошибок и физики мира
                      </span>
                    </div>
                  </div>
                  <span className="text-xs text-purple-400 font-mono">
                    {worldRules.length} правил
                  </span>
                </div>

                {/* Add new rule */}
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={newRuleInput}
                    onChange={(e) => setNewRuleInput(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleAddRule()}
                    placeholder="Добавить закон мира (например: 'Серебро губительно для монстров')..."
                    className="flex-1 bg-neutral-900 border border-neutral-700 focus:border-purple-500 rounded-xl px-3 py-1.5 text-xs text-neutral-100 placeholder-neutral-500 focus:outline-none focus:ring-1 focus:ring-purple-500"
                  />
                  <button
                    type="button"
                    onClick={handleAddRule}
                    className="px-3 py-1.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-semibold flex items-center gap-1 transition-colors shrink-0"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Добавить</span>
                  </button>
                </div>

                {/* Rules List */}
                <div className="space-y-1.5 max-h-48 overflow-y-auto pt-1">
                  {worldRules.map((rule, idx) => (
                    <div
                      key={idx}
                      className="p-2 rounded-lg bg-neutral-900 border border-neutral-800 text-xs flex items-center justify-between gap-2 group hover:border-neutral-700"
                    >
                      <span className="text-neutral-200 leading-relaxed">• {rule}</span>
                      <button
                        type="button"
                        onClick={() => handleRemoveRule(idx)}
                        className="text-neutral-500 hover:text-rose-400 p-1 opacity-60 group-hover:opacity-100 transition-opacity"
                        title="Удалить правило"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                  {worldRules.length === 0 && (
                    <div className="text-center py-4 text-xs text-neutral-500 italic">
                      Правила мира не заданы. Добавьте свои или выберите пресет!
                    </div>
                  )}
                </div>
              </div>

              {/* Factions Section */}
              <div className="p-4 rounded-xl bg-neutral-950 border border-neutral-800 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Sword className="w-4 h-4 text-cyan-400" />
                    <div>
                      <span className="text-xs font-bold text-neutral-100 block">
                        Ключевые фракции, ордены и дома мира
                      </span>
                      <span className="text-[10px] text-neutral-400">
                        Силы, определяющие баланс власти и конфликты в повести
                      </span>
                    </div>
                  </div>
                  <span className="text-xs text-cyan-400 font-mono">
                    {factions.length} фракций
                  </span>
                </div>

                {/* Add new faction */}
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={newFactionInput}
                    onChange={(e) => setNewFactionInput(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleAddFaction()}
                    placeholder="Название фракции (например: 'Орден Пылающей Розы', 'Арасака')..."
                    className="flex-1 bg-neutral-900 border border-neutral-700 focus:border-cyan-500 rounded-xl px-3 py-1.5 text-xs text-neutral-100 placeholder-neutral-500 focus:outline-none focus:ring-1 focus:ring-cyan-500"
                  />
                  <button
                    type="button"
                    onClick={handleAddFaction}
                    className="px-3 py-1.5 rounded-xl bg-cyan-700 hover:bg-cyan-600 text-white text-xs font-semibold flex items-center gap-1 transition-colors shrink-0"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Добавить</span>
                  </button>
                </div>

                {/* Faction Tags */}
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {factions.map((f, idx) => (
                    <span
                      key={idx}
                      className="px-2.5 py-1 rounded-lg bg-neutral-900 border border-neutral-700 text-xs text-neutral-200 flex items-center gap-1.5 shadow-sm"
                    >
                      <span>{f}</span>
                      <button
                        type="button"
                        onClick={() => handleRemoveFaction(idx)}
                        className="text-neutral-500 hover:text-rose-400 p-0.5"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  ))}
                  {factions.length === 0 && (
                    <div className="text-center w-full py-4 text-xs text-neutral-500 italic">
                      Фракции не указаны. Добавьте ключевые противоборствующие силы.
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {activeTab === "search" && (
            <div className="space-y-4">
              <div className="p-4 rounded-xl bg-gradient-to-r from-cyan-950/40 via-neutral-950 to-purple-950/40 border border-cyan-800/40 space-y-3">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-cyan-500/20 border border-cyan-500/30 flex items-center justify-center text-cyan-400 shrink-0">
                    <Search className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="text-xs font-bold text-neutral-100 block">
                      Исследование канона «{universeName}» через Google Search
                    </span>
                    <span className="text-[10px] text-cyan-300">
                      Поиск официальных фактов, хронологии, артефактов и персонажей с подтверждением
                    </span>
                  </div>
                </div>

                <div className="flex gap-2">
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handlePerformLoreSearch()}
                    placeholder="Например: 'Знаки ведьмаков', 'Оружие киберпсихоза', 'Орден джедаев'..."
                    className="flex-1 bg-neutral-900 border border-neutral-700 focus:border-cyan-500 rounded-xl px-3 py-2 text-xs text-neutral-100 placeholder-neutral-500 focus:outline-none focus:ring-1 focus:ring-cyan-500"
                  />
                  <button
                    type="button"
                    onClick={handlePerformLoreSearch}
                    disabled={isSearchingLore || !searchQuery.trim()}
                    className="px-4 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 text-white text-xs font-semibold flex items-center gap-1.5 transition-colors shrink-0 shadow-md"
                  >
                    {isSearchingLore ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        <span>Поиск...</span>
                      </>
                    ) : (
                      <>
                        <Search className="w-3.5 h-3.5" />
                        <span>Искать</span>
                      </>
                    )}
                  </button>
                </div>

                {searchError && (
                  <p className="text-xs text-rose-400 bg-rose-950/40 border border-rose-800/40 p-2 rounded-lg">
                    {searchError}
                  </p>
                )}
              </div>

              {/* Search Result Card */}
              {searchResult && (
                <div className="p-4 rounded-xl bg-neutral-950 border border-neutral-800 space-y-3 animate-fade-in shadow-lg">
                  <div className="flex items-center justify-between border-b border-neutral-800 pb-2">
                    <div>
                      <span className="text-xs font-bold text-purple-300 flex items-center gap-1.5">
                        <BookmarkPlus className="w-3.5 h-3.5" />
                        {searchResult.title}
                      </span>
                      <span className="text-[10px] text-neutral-400">
                        Категория: {searchResult.category || "правило_мира"}
                      </span>
                    </div>

                    {onAddLorebookEntry && (
                      <button
                        type="button"
                        onClick={handleAddSearchResultToLorebook}
                        className="px-3 py-1 rounded-lg bg-purple-600 hover:bg-purple-500 text-white text-xs font-semibold flex items-center gap-1 transition-colors shadow-sm"
                      >
                        <Plus className="w-3 h-3" />
                        <span>В лорбук</span>
                      </button>
                    )}
                  </div>

                  <p className="text-xs text-neutral-200 leading-relaxed">
                    {searchResult.description || searchResult.summary}
                  </p>

                  {/* Key Facts */}
                  {Array.isArray(searchResult.keyFacts) && searchResult.keyFacts.length > 0 && (
                    <div className="space-y-1 pt-1">
                      <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider block">
                        Подтверждённые факты:
                      </span>
                      <div className="space-y-0.5">
                        {searchResult.keyFacts.map((fact: string, idx: number) => (
                          <div key={idx} className="text-xs text-neutral-300 flex items-start gap-1.5">
                            <span className="text-cyan-400">•</span>
                            <span>{fact}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Grounding Sources */}
                  {Array.isArray(searchResult.sources) && searchResult.sources.length > 0 && (
                    <div className="pt-2 border-t border-neutral-800/80">
                      <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider block mb-1">
                        Источники Google Search Grounding:
                      </span>
                      <div className="flex flex-wrap gap-1.5">
                        {searchResult.sources.map((src: any, idx: number) => (
                          <a
                            key={idx}
                            href={src.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-neutral-900 hover:bg-neutral-800 border border-neutral-700 text-[11px] text-cyan-300 hover:text-cyan-200 transition-colors"
                          >
                            <ExternalLink className="w-3 h-3" />
                            <span className="max-w-[200px] truncate">{src.title}</span>
                          </a>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-neutral-800 bg-neutral-950 flex items-center justify-between gap-3">
          <div className="text-[11px] text-neutral-400 flex items-center gap-1.5">
            <CheckCircle2 className="w-3.5 h-3.5 text-purple-400 shrink-0" />
            <span>Сеттинг «{universeName}» влияет на главы и соавтора</span>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                sound.playClick();
                onClose();
              }}
              className="px-3.5 py-1.5 rounded-xl border border-neutral-700 hover:bg-neutral-800 text-neutral-300 text-xs font-semibold transition-colors"
            >
              Отмена
            </button>
            <button
              type="button"
              onClick={handleSaveAndApply}
              className="px-4 py-1.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold transition-all shadow-md flex items-center gap-1.5"
            >
              <Check className="w-4 h-4" />
              <span>Применить сеттинг</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

function CheckCheckIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      {...props}
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      viewBox="0 0 24 24"
    >
      <path d="M18 6 7 17l-5-5" />
      <path d="m22 10-7.5 7.5L13 16" />
    </svg>
  );
}
