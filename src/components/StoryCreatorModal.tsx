import React, { useState } from "react";
import {
  Story,
  StoryGenre,
  Character,
  StoryChoice,
  NarrativeStyle,
  NarrativePOV,
  SceneFocus,
  CharacterTemperament,
} from "../types";
import {
  Sparkles,
  Plus,
  Trash2,
  Wand2,
  BookOpen,
  Package,
  Users,
  Compass,
  Globe,
  Settings2,
  Bookmark,
  Loader2,
  Flame,
  FileText,
} from "lucide-react";
import { sound } from "../utils/audio";
import { safeFetchJson } from "../utils/safeApi";

interface StoryCreatorModalProps {
  onCreateStory: (
    newStory: Story,
    narrativeSettings?: {
      style: NarrativeStyle;
      pov: NarrativePOV;
      focus: SceneFocus;
      ultraMemory: boolean;
    }
  ) => void;
  onCancel: () => void;
  customApiKey?: string;
}

const GENRES: StoryGenre[] = [
  "Фэнтези",
  "Киберпанк",
  "Тёмная романтика",
  "Мистика и детектив",
  "Постапокалипсис",
  "Аниме и исекай",
  "Космоопера",
  "Фанфики",
];

const FANDOM_PRESETS = [
  { name: "Гарри Поттер", tag: "Магия Хогвартса", icon: "⚡" },
  { name: "Ведьмак", tag: "Славянский бестиарий", icon: "🐺" },
  { name: "Атака Титанов", tag: "Разведкорпус & Стены", icon: "⚔️" },
  { name: "Cyberpunk 2077", tag: "Найт-Сити & Импланты", icon: "🤖" },
  { name: "Клинок Демонов", tag: "Дыхание & Демоны", icon: "🗡️" },
  { name: "Наруто", tag: "Шиноби & Чакра", icon: "🌀" },
  { name: "Властелин Колец", tag: "Средиземье & Артефакты", icon: "💍" },
  { name: "Магическая битва", tag: "Проклятая энергия", icon: "👁️" },
  { name: "Дюна", tag: "Арракис & Спайс", icon: "🪐" },
  { name: "Шерлок Холмс", tag: "Лондон & Дедукция", icon: "🕵️" },
];

export const StoryCreatorModal: React.FC<StoryCreatorModalProps> = ({
  onCreateStory,
  onCancel,
  customApiKey,
}) => {
  const [creatorMode, setCreatorMode] = useState<"original" | "fandom" | "import">("original");

  // Story base fields
  const [title, setTitle] = useState("");
  const [genre, setGenre] = useState<StoryGenre>("Фэнтези");
  const [synopsis, setSynopsis] = useState("");
  const [protagonist, setProtagonist] = useState("");
  const [protagonistDetails, setProtagonistDetails] = useState("");
  const [userStoryVision, setUserStoryVision] = useState("");
  const [toneAtmosphere, setToneAtmosphere] = useState("Психологическая глубина, богатая сенсорика и осязаемые эмоции");
  const [firstScene, setFirstScene] = useState("");
  const [coverImage, setCoverImage] = useState(
    "https://images.unsplash.com/photo-1518709268805-4e9042af9f23?q=80&w=1200&auto=format&fit=crop"
  );

  // Fandom specific fields
  const [fandomName, setFandomName] = useState("");
  const [fandomPrompt, setFandomPrompt] = useState("");

  // Import raw text mode
  const [importRawText, setImportRawText] = useState("");
  const [isAnalyzingImport, setIsAnalyzingImport] = useState(false);

  // Narrative control settings
  const [narrativeStyle, setNarrativeStyle] = useState<NarrativeStyle>(NarrativeStyle.LITERARY);
  const [narrativePOV, setNarrativePOV] = useState<NarrativePOV>(NarrativePOV.SECOND);
  const [sceneFocus, setSceneFocus] = useState<SceneFocus>(SceneFocus.GENERAL);
  const [ultraMemory, setUltraMemory] = useState(true);

  // Choices & Characters
  const [choices, setChoices] = useState<StoryChoice[]>([
    { id: "1", label: "Исследовать местность", description: "Осмотреться и изучить окружение" },
    { id: "2", label: "Двигаться прямо к цели", description: "Не терять времени и идти вперёд" },
    { id: "3", label: "Занять защитную позицию", description: "Подготовиться к возможной угрозе" },
  ]);

  const [characters, setCharacters] = useState<Character[]>([
    {
      id: "c1",
      name: "Алиса",
      role: "Спутница и проводник",
      avatar: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=400",
      bio: "Знает тайные тропы и древние предания этого мира.",
      affinity: 50,
      affinityTitle: "Знакомая",
      temperament: "сангвиник",
      traits: ["Внимательная", "Преданная", "Остроумная"],
      habits: ["Оглядывается перед входом", "Говорит тихо"],
      isLockedTraits: false,
    },
  ]);

  const [inventory, setInventory] = useState<string[]>([
    "Медальон странника",
    "Фляга с водой",
    "Походный клинок",
  ]);
  const [newItemText, setNewItemText] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);

  // Deep premise inspiration presets
  const STORY_INSPIRATIONS = [
    {
      label: "🎭 Психологическая драма",
      vision: "История о доверии и предательстве в изолированном убежище. Один из близких спутников скрывает смертельную тайну, связанную с прошлым протагониста.",
      genre: "Мистика и детектив" as StoryGenre,
      tone: "Тягучий саспенс, психологическое напряжение, внимание к взглядам и полутонам",
    },
    {
      label: "🕯️ Мрачная готическая тайна",
      vision: "Древний полуразрушенный особняк на краю забытого города. Протагонист ищет пропавшего родственника, сталкиваясь с оживающими тенями и забытыми клятвами.",
      genre: "Тёмная романтика" as StoryGenre,
      tone: "Готическая атмосфера, запах старой бумаги и дождя, меланхоличный литературный слог",
    },
    {
      label: "⚔️ Судьбоносный выбор и долг",
      vision: "Пограничная крепость накануне решающего штурма. Протагонист обязан сделать выбор между верностью присяге и спасением тех, кого любит.",
      genre: "Фэнтези" as StoryGenre,
      tone: "Высокий драматизм, запах стали и пепла, моральные дилеммы без простого выхода",
    },
    {
      label: "🧬 Киберпанк: Цена памяти",
      vision: "Неоновый мегаполис, где воспоминания стали валютой. Протагонист обнаруживает в своём нейроимпланте чужой зашифрованный секрет высшего уровня.",
      genre: "Киберпанк" as StoryGenre,
      tone: "Сырой реализм улиц, холодный неоновый свет, глубокая личная драма человека в механическом мире",
    },
  ];

  // Generate Original premise with Gemini
  const handleAiGenerateOriginal = async () => {
    setIsGenerating(true);
    sound.playAction("magic");
    try {
      const fullVision = [
        userStoryVision.trim(),
        synopsis.trim(),
        toneAtmosphere ? `Тональность: ${toneAtmosphere}` : "",
      ]
        .filter(Boolean)
        .join(". ");

      const fullProtagonist = [
        protagonist.trim(),
        protagonistDetails.trim() ? `Характер и детали: ${protagonistDetails.trim()}` : "",
      ]
        .filter(Boolean)
        .join(". ");

      const res = await safeFetchJson<any>("/api/story/generate-premise", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(customApiKey ? { "x-custom-api-key": customApiKey } : {}),
        },
        body: JSON.stringify({
          genre,
          theme: fullVision || "Глубокая психологическая драма с неожиданной тайной и высокими ставками",
          protagonist: fullProtagonist || "Многогранный герой со сложным прошлым и внутренней борьбой",
          customKey: customApiKey,
        }),
      });

      if (res.ok && res.data) {
        const data = res.data;
        if (data.title) setTitle(data.title);
        if (data.synopsis) setSynopsis(data.synopsis);
        if (data.firstScene) setFirstScene(data.firstScene);
        if (data.starterChoices?.length) setChoices(data.starterChoices);
        if (data.characters?.length) {
          setCharacters(
            data.characters.map((c: any, i: number) => ({
              id: `c_${i}`,
              name: c.name || "Спутник",
              role: c.role || "Союзник",
              avatar:
                c.avatar ||
                "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=400",
              bio: c.bio || "Таинственный попутчик",
              affinity: c.affinity || 50,
              affinityTitle: c.affinityTitle || "Союзник",
              temperament: c.temperament || "сангвиник",
              traits: c.traits || ["Смелый", "Находчивый"],
              habits: c.habits || ["Наблюдает за обстановкой"],
              speechStyle: c.speechStyle,
              secret: c.secret,
            }))
          );
        }
        if (data.startingInventory?.length) {
          setInventory(data.startingInventory);
        }
      }
    } catch (e) {
      console.error("Premise generation failed:", e);
    } finally {
      setIsGenerating(false);
    }
  };

  // Generate Fandom/Book/Anime premise
  const handleGenerateFandom = async (universeName?: string) => {
    const targetUniverse = universeName || fandomName;
    if (!targetUniverse.trim()) return;

    setIsGenerating(true);
    sound.playAction("magic");

    try {
      const res = await safeFetchJson<any>("/api/story/fandom-premise", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(customApiKey ? { "x-custom-api-key": customApiKey } : {}),
        },
        body: JSON.stringify({
          fandomName: targetUniverse,
          userPrompt: fandomPrompt || "Аутентичный канон с оригинальным протагонистом",
          customKey: customApiKey,
        }),
      });

      if (res.ok && res.data) {
        const data = res.data;
        if (data.title) setTitle(data.title);
        if (data.genre) setGenre(data.genre as StoryGenre);
        if (data.synopsis) setSynopsis(data.synopsis);
        if (data.startingScene) setFirstScene(data.startingScene);
        if (data.starterChoices?.length) setChoices(data.starterChoices);
        if (data.characters?.length) {
          setCharacters(
            data.characters.map((c: any, i: number) => ({
              id: `fandom_char_${i}`,
              name: c.name,
              role: c.role,
              avatar: c.avatar || "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=400",
              bio: c.bio,
              affinity: c.affinity || 50,
              affinityTitle: c.affinityTitle || "Знакомый",
              temperament: c.temperament || "сангвиник",
              traits: c.traits || ["Каноничный", "Внимательный"],
              habits: c.habits || [],
              speechStyle: c.speechStyle,
            }))
          );
        }
        if (data.startingInventory?.length) {
          setInventory(data.startingInventory);
        }
        setFandomName(targetUniverse);
      }
    } catch (e) {
      console.error("Fandom generation failed:", e);
    } finally {
      setIsGenerating(false);
    }
  };

  // Analyze & Import raw text or chapter
  const handleAnalyzeImport = async () => {
    if (!importRawText.trim() || isAnalyzingImport) return;
    setIsAnalyzingImport(true);
    sound.playAction("magic");
    try {
      const res = await safeFetchJson<any>("/api/story/import-analyze", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(customApiKey ? { "x-custom-api-key": customApiKey } : {}),
        },
        body: JSON.stringify({
          rawText: importRawText,
          customKey: customApiKey,
        }),
      });

      if (res.ok && res.data) {
        const data = res.data;
        if (data.title) setTitle(data.title);
        if (data.genre) setGenre(data.genre);
        if (data.synopsis) setSynopsis(data.synopsis);
        if (data.firstScene) setFirstScene(data.firstScene);
        if (data.protagonistName) setProtagonist(data.protagonistName);
        if (data.narrativeStyle) setNarrativeStyle(data.narrativeStyle);
        if (data.starterChoices?.length) setChoices(data.starterChoices);
        if (data.startingInventory?.length) setInventory(data.startingInventory);
        if (data.characters?.length) {
          setCharacters(
            data.characters.map((c: any, i: number) => ({
              id: `c_imp_${i}`,
              name: c.name || "Герой",
              role: c.role || "Участник событий",
              avatar:
                c.avatar ||
                "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=400",
              bio: c.bio || "Персонаж из импортированного текста",
              affinity: c.affinity || 50,
              affinityTitle: c.affinityTitle || "Союзник",
              temperament: c.temperament || "сангвиник",
              traits: c.traits || ["Характерный"],
              habits: c.habits || [],
              isLockedTraits: false,
            }))
          );
        }
        setCreatorMode("original");
      }
    } catch (e) {
      console.error("Import analysis error:", e);
    } finally {
      setIsAnalyzingImport(false);
    }
  };

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !firstScene.trim()) {
      alert("Пожалуйста, укажите название истории и текст первой сцены!");
      return;
    }

    const newStory: Story = {
      id: `custom_${Date.now()}`,
      title: title.trim(),
      genre,
      synopsis: synopsis.trim() || "Уникальное интерактивное приключение в StoryZone.",
      coverImage:
        coverImage ||
        "https://images.unsplash.com/photo-1518709268805-4e9042af9f23?q=80&w=1200&auto=format&fit=crop",
      tags: [genre, creatorMode === "fandom" ? "Фанфикшн" : "Авторская", "Интерактивная"],
      rating: 5.0,
      playsCount: 1,
      estimatedTime: "30-60 мин",
      author: protagonist ? `${protagonist}` : "Вы",
      difficulty: "Средне",
      startingStats: {
        hp: 100,
        maxHp: 100,
        energy: 100,
        maxEnergy: 100,
        gold: 100,
        karma: 0,
      },
      startingInventory: inventory,
      characters,
      startingScene: firstScene.trim(),
      initialChoices: choices.filter((c) => c.label.trim().length > 0),
      isCustom: true,
      atmosphere: "mysterious",
    };

    sound.playChoice();
    onCreateStory(newStory, {
      style: narrativeStyle,
      pov: narrativePOV,
      focus: sceneFocus,
      ultraMemory,
    });
  };

  return (
    <div className="w-full max-w-4xl mx-auto px-4 sm:px-6 py-6 sm:py-8 space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-neutral-800">
        <div>
          <h2 className="font-cinzel text-xl sm:text-2xl font-bold text-neutral-100 flex items-center gap-2">
            <Wand2 className="w-6 h-6 text-purple-400" />
            Конструктор Историй & Фанфикшн
          </h2>
          <p className="text-xs sm:text-sm text-neutral-400">
            Создайте авторскую сагу или погрузитесь в культовые вселенные (книги, аниме, фильмы)
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => {
              sound.playClick();
              setCreatorMode("original");
            }}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all ${
              creatorMode === "original"
                ? "bg-purple-600 text-white shadow-md shadow-purple-900/40"
                : "bg-neutral-900 text-neutral-400 hover:text-neutral-200 border border-neutral-800"
            }`}
          >
            <Sparkles className="w-3.5 h-3.5" />
            Оригинальный сюжет
          </button>
          <button
            type="button"
            onClick={() => {
              sound.playClick();
              setCreatorMode("fandom");
            }}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all ${
              creatorMode === "fandom"
                ? "bg-purple-600 text-white shadow-md shadow-purple-900/40"
                : "bg-neutral-900 text-neutral-400 hover:text-neutral-200 border border-neutral-800"
            }`}
          >
            <Globe className="w-3.5 h-3.5" />
            Вселенные & Фанфики
          </button>
          <button
            type="button"
            onClick={() => {
              sound.playClick();
              setCreatorMode("import");
            }}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all ${
              creatorMode === "import"
                ? "bg-cyan-600 text-white shadow-md shadow-cyan-900/40"
                : "bg-neutral-900 text-neutral-400 hover:text-neutral-200 border border-neutral-800"
            }`}
          >
            <FileText className="w-3.5 h-3.5 text-cyan-400" />
            Импорт текста / Главы
          </button>
        </div>
      </div>

      {/* Mode 3: AI Import & Analysis of Raw Story Text */}
      {creatorMode === "import" && (
        <div className="p-5 sm:p-6 rounded-2xl bg-neutral-900/80 border border-cyan-900/50 space-y-4 animate-fade-in shadow-xl">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <FileText className="w-5 h-5 text-cyan-400" />
              <span className="text-sm font-bold text-neutral-100">
                ИИ-Анализ и Воссоздание Истории из Текста
              </span>
            </div>
            <span className="text-[11px] text-cyan-400 font-medium">
              Gemini 3.8 Flash Deep Reader
            </span>
          </div>

          <p className="text-xs text-neutral-400 leading-relaxed">
            Вставьте любую главу, фанфик или фрагмент текста. ИИ автоматически выделит главного героя, его спутников (с чертами характера и симпатией), ключевые предметы, стилистику и создаст точку старта игры с любого момента!
          </p>

          <textarea
            value={importRawText}
            onChange={(e) => setImportRawText(e.target.value)}
            rows={8}
            placeholder="Вставьте сюда текст главы или фрагмент произведения... Например: 'Ночной дождь хлестал по брусчатке старого квартала, когда капитан Эрик и магесса Лира добрались до ворот цитадели...'"
            className="w-full px-4 py-3 rounded-xl bg-neutral-950/90 border border-neutral-800 text-neutral-200 text-xs sm:text-sm font-serif leading-relaxed focus:outline-none focus:border-cyan-500"
          />

          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-1">
            <span className="text-[11px] text-neutral-500">
              Символов: {importRawText.length}
            </span>

            <button
              type="button"
              disabled={!importRawText.trim() || isAnalyzingImport}
              onClick={handleAnalyzeImport}
              className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-gradient-to-r from-cyan-600 to-indigo-600 hover:from-cyan-500 hover:to-indigo-500 text-white font-semibold text-xs flex items-center justify-center gap-2 shadow-lg shadow-cyan-950/50 disabled:opacity-50 transition-all"
            >
              {isAnalyzingImport ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>ИИ читает и воссоздаёт мир...</span>
                </>
              ) : (
                <>
                  <Wand2 className="w-4 h-4" />
                  <span>Распознать персонажей & Заполнить мир</span>
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {/* Mode 2: Fandom Universe Presets */}
      {creatorMode === "fandom" && (
        <div className="p-4 sm:p-5 rounded-2xl bg-neutral-900/70 border border-purple-900/40 space-y-4 animate-fade-in">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-neutral-200 flex items-center gap-2">
              <Flame className="w-4 h-4 text-amber-400" />
              Популярные вселенные (книги, аниме, кино, игры):
            </span>
            <span className="text-[11px] text-purple-400">
              Нажмите для мгновенной генерации канона
            </span>
          </div>

          {/* Quick preset chips */}
          <div className="flex flex-wrap gap-2">
            {FANDOM_PRESETS.map((p) => (
              <button
                key={p.name}
                type="button"
                onClick={() => handleGenerateFandom(p.name)}
                disabled={isGenerating}
                className="px-3 py-1.5 rounded-xl bg-neutral-950 border border-neutral-800 hover:border-purple-500 text-neutral-200 hover:text-purple-300 text-xs font-medium flex items-center gap-1.5 transition-all shadow-sm"
              >
                <span>{p.icon}</span>
                <span>{p.name}</span>
                <span className="text-[10px] text-neutral-500">({p.tag})</span>
              </button>
            ))}
          </div>

          {/* Custom Fandom input */}
          <div className="flex flex-col sm:flex-row gap-2 pt-2 border-t border-neutral-800">
            <input
              type="text"
              value={fandomName}
              onChange={(e) => setFandomName(e.target.value)}
              placeholder="Или введите любую другую вселенную (напр. 'Берсерк', 'Доктор Кто', 'Клинок')"
              className="flex-1 px-3.5 py-2 rounded-xl bg-neutral-950 border border-neutral-800 text-xs text-neutral-100 placeholder-neutral-500 focus:outline-none focus:border-purple-500"
            />
            <button
              type="button"
              onClick={() => handleGenerateFandom()}
              disabled={isGenerating || !fandomName.trim()}
              className="px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white text-xs font-semibold flex items-center justify-center gap-1.5 shadow-md transition-all"
            >
              {isGenerating ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Sparkles className="w-3.5 h-3.5" />
              )}
              Сгенерировать по фандому
            </button>
          </div>
        </div>
      )}

      {/* Main Creation Form */}
      <form onSubmit={handleCreate} className="space-y-6">
        {/* Narrative & Author Style Settings Card */}
        <div className="p-4 sm:p-5 rounded-2xl bg-neutral-900/60 border border-neutral-800 space-y-4">
          <div className="flex items-center gap-2 pb-2 border-b border-neutral-800">
            <Settings2 className="w-4 h-4 text-purple-400" />
            <span className="text-xs font-bold text-neutral-200 uppercase tracking-wider">
              Тонкие Настройки Повествования & Ультра-Память
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {/* Style */}
            <div className="space-y-1">
              <label className="text-[11px] font-semibold text-neutral-400">
                Стиль текста:
              </label>
              <select
                value={narrativeStyle}
                onChange={(e) => setNarrativeStyle(e.target.value as NarrativeStyle)}
                className="w-full px-3 py-1.5 rounded-xl bg-neutral-950 border border-neutral-800 text-xs text-neutral-200 focus:outline-none focus:border-purple-500"
              >
                <option value={NarrativeStyle.LITERARY}>Литературный (Богатый язык)</option>
                <option value={NarrativeStyle.CONVERSATIONAL}>Разговорный (Живой)</option>
                <option value={NarrativeStyle.NOIR}>Тёмный Нуар (Циничный детектив)</option>
                <option value={NarrativeStyle.CINEMATIC}>Кинематографичный (Экшен)</option>
                <option value={NarrativeStyle.ANIME}>Аниме & Ранобэ (Эмоциональный)</option>
                <option value={NarrativeStyle.FANFICTION}>Фанфикшн (Химия чувств)</option>
              </select>
            </div>

            {/* POV */}
            <div className="space-y-1">
              <label className="text-[11px] font-semibold text-neutral-400">
                Лицо повествования:
              </label>
              <select
                value={narrativePOV}
                onChange={(e) => setNarrativePOV(e.target.value as NarrativePOV)}
                className="w-full px-3 py-1.5 rounded-xl bg-neutral-950 border border-neutral-800 text-xs text-neutral-200 focus:outline-none focus:border-purple-500"
              >
                <option value={NarrativePOV.SECOND}>2-е лицо ("Ты делаешь шаг...")</option>
                <option value={NarrativePOV.FIRST}>1-е лицо ("Я взглянул в темноту...")</option>
                <option value={NarrativePOV.THIRD}>3-е лицо ("Герой шагнул вперёд...")</option>
                <option value={NarrativePOV.COMPANION}>От лица спутника</option>
              </select>
            </div>

            {/* Initial Focus */}
            <div className="space-y-1">
              <label className="text-[11px] font-semibold text-neutral-400">
                Фокус сцен:
              </label>
              <select
                value={sceneFocus}
                onChange={(e) => setSceneFocus(e.target.value as SceneFocus)}
                className="w-full px-3 py-1.5 rounded-xl bg-neutral-950 border border-neutral-800 text-xs text-neutral-200 focus:outline-none focus:border-purple-500"
              >
                <option value={SceneFocus.GENERAL}>Сбалансированный сюжет</option>
                <option value={SceneFocus.ACTION}>Экшен & Схватки</option>
                <option value={SceneFocus.DIALOGUE}>Диалоги & Психология</option>
                <option value={SceneFocus.CRISIS}>Кризис & Острый цейтнот</option>
                <option value={SceneFocus.EXPLORATION}>Исследование & Лор</option>
              </select>
            </div>

            {/* Ultra Memory Toggle */}
            <div className="space-y-1 flex flex-col justify-end">
              <label className="text-[11px] font-semibold text-neutral-400">
                Режим памяти ИИ:
              </label>
              <button
                type="button"
                onClick={() => setUltraMemory(!ultraMemory)}
                className={`w-full py-1.5 px-3 rounded-xl border text-xs font-semibold flex items-center justify-center gap-1.5 transition-all ${
                  ultraMemory
                    ? "bg-purple-950 border-purple-500 text-purple-200"
                    : "bg-neutral-950 border-neutral-800 text-neutral-400"
                }`}
              >
                <Bookmark className="w-3.5 h-3.5 text-purple-400" />
                {ultraMemory ? "Ультра-память (ВКЛ)" : "Стандартная"}
              </button>
            </div>
          </div>
        </div>

        {/* Mode 1: Deep Original Story Vision Studio */}
        {creatorMode === "original" && (
          <div className="p-5 rounded-2xl bg-gradient-to-b from-purple-950/40 to-neutral-900/90 border border-purple-800/50 space-y-4 shadow-xl">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-purple-900/40">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-purple-400" />
                <span className="text-xs sm:text-sm font-bold text-neutral-100 uppercase tracking-wider">
                  Глубокий Авторский Замысел & Идея Сюжета
                </span>
              </div>
              <span className="text-[11px] text-purple-300 font-medium">
                Без поверхностных штампов: ИИ учитывает каждую деталь
              </span>
            </div>

            {/* Inspiration presets */}
            <div className="space-y-1.5">
              <span className="text-[11px] text-neutral-400 font-semibold">
                Вдохновение в 1 клик (выберите или опишите своё):
              </span>
              <div className="flex flex-wrap gap-2">
                {STORY_INSPIRATIONS.map((insp) => (
                  <button
                    key={insp.label}
                    type="button"
                    onClick={() => {
                      sound.playClick();
                      setUserStoryVision(insp.vision);
                      setGenre(insp.genre);
                      setToneAtmosphere(insp.tone);
                    }}
                    className="px-2.5 py-1 rounded-lg bg-neutral-950/80 hover:bg-purple-950/80 border border-neutral-800 hover:border-purple-600/80 text-neutral-300 hover:text-purple-200 text-xs transition-all text-left"
                  >
                    {insp.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Main idea & conflict */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-neutral-200 flex items-center justify-between">
                <span>О чём ваша история? (Главная идея, конфликт, скрытые тайны, чего вы хотите достичь):</span>
                <span className="text-[10px] text-neutral-400 font-normal">Подробные пожелания</span>
              </label>
              <textarea
                value={userStoryVision}
                onChange={(e) => setUserStoryVision(e.target.value)}
                rows={3}
                placeholder="Опишите ваши мысли подробно: например, 'История про наёмника, который охраняет караван, но начинает замечать, что его спутники постепенно меняются... Хочу глубокий психологический триллер с неожиданным предательством и моральной дилеммой'..."
                className="w-full px-3.5 py-2.5 rounded-xl bg-neutral-950 border border-neutral-800 text-xs sm:text-sm text-neutral-100 placeholder-neutral-500 focus:outline-none focus:border-purple-500 leading-relaxed"
              />
            </div>

            {/* Protagonist and Tone */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-neutral-300">
                  Протагонист (кем играет читатель, характер, слабости):
                </label>
                <input
                  type="text"
                  value={protagonistDetails}
                  onChange={(e) => setProtagonistDetails(e.target.value)}
                  placeholder="Например: Бывший лекарь с чувством вины, скрытный, циничный, но верный"
                  className="w-full px-3.5 py-2 rounded-xl bg-neutral-950 border border-neutral-800 text-xs text-neutral-100 placeholder-neutral-500 focus:outline-none focus:border-purple-500"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-neutral-300">
                  Тональность & Атмосфера (настроение сцен):
                </label>
                <input
                  type="text"
                  value={toneAtmosphere}
                  onChange={(e) => setToneAtmosphere(e.target.value)}
                  placeholder="Например: Мрачный нуар, запах дождя, философские диалоги, без детской наивности"
                  className="w-full px-3.5 py-2 rounded-xl bg-neutral-950 border border-neutral-800 text-xs text-neutral-100 placeholder-neutral-500 focus:outline-none focus:border-purple-500"
                />
              </div>
            </div>

            {/* Prominent Action Button */}
            <div className="pt-2">
              <button
                type="button"
                disabled={isGenerating}
                onClick={handleAiGenerateOriginal}
                className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-purple-600 via-indigo-600 to-purple-600 hover:from-purple-500 hover:to-indigo-500 text-white font-bold text-xs sm:text-sm flex items-center justify-center gap-2 shadow-lg shadow-purple-950/60 transition-all hover:scale-[1.01] active:scale-[0.99] disabled:opacity-50"
              >
                {isGenerating ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>ИИ создаёт глубокий пролог, персонажей и завязку...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4" />
                    <span>Воплотить глубокий сюжет через ИИ (Глубокая проработка)</span>
                  </>
                )}
              </button>
            </div>
          </div>
        )}

        {/* Basic Story Information */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="sm:col-span-2 space-y-1.5">
            <label className="text-xs font-semibold text-neutral-300">
              Название истории:
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Например: 'Тени Забытого Оплота' или 'Врата Хогвартса'"
              className="w-full px-3.5 py-2 rounded-xl bg-neutral-950 border border-neutral-800 text-xs text-neutral-100 placeholder-neutral-500 focus:outline-none focus:border-purple-500"
              required
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-neutral-300">
              Жанр:
            </label>
            <select
              value={genre}
              onChange={(e) => setGenre(e.target.value as StoryGenre)}
              className="w-full px-3.5 py-2 rounded-xl bg-neutral-950 border border-neutral-800 text-xs text-neutral-200 focus:outline-none focus:border-purple-500"
            >
              {GENRES.map((g) => (
                <option key={g} value={g}>
                  {g}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Synopsis */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <label className="text-xs font-semibold text-neutral-300">
              Синопсис / Завязка сюжета:
            </label>
            {creatorMode === "original" && (
              <button
                type="button"
                onClick={handleAiGenerateOriginal}
                disabled={isGenerating}
                className="text-[11px] text-purple-400 hover:text-purple-300 flex items-center gap-1 font-semibold"
              >
                <Sparkles className="w-3 h-3" />
                Сгенерировать идею с Gemini
              </button>
            )}
          </div>
          <textarea
            value={synopsis}
            onChange={(e) => setSynopsis(e.target.value)}
            rows={2}
            placeholder="Краткое описание завязки и главной тайны..."
            className="w-full px-3.5 py-2 rounded-xl bg-neutral-950 border border-neutral-800 text-xs text-neutral-200 placeholder-neutral-500 focus:outline-none focus:border-purple-500"
          />
        </div>

        {/* First Scene Text */}
        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-neutral-300">
            Текст первой сцены (Начало игры):
          </label>
          <textarea
            value={firstScene}
            onChange={(e) => setFirstScene(e.target.value)}
            rows={5}
            placeholder="Опишите, где начинается герой, что он видит, слышит и ощущает в первые секунды..."
            className="w-full px-3.5 py-2.5 rounded-xl bg-neutral-950 border border-neutral-800 text-xs sm:text-sm text-neutral-200 placeholder-neutral-500 focus:outline-none focus:border-purple-500 leading-relaxed"
            required
          />
        </div>

        {/* Initial Choices */}
        <div className="space-y-2">
          <label className="text-xs font-semibold text-neutral-300">
            Первые развилки выбора:
          </label>
          <div className="space-y-2">
            {choices.map((c, i) => (
              <div key={c.id} className="flex gap-2">
                <input
                  type="text"
                  value={c.label}
                  onChange={(e) => {
                    const next = [...choices];
                    next[i].label = e.target.value;
                    setChoices(next);
                  }}
                  placeholder={`Выбор #${i + 1}`}
                  className="flex-1 px-3 py-1.5 rounded-xl bg-neutral-950 border border-neutral-800 text-xs text-neutral-200 focus:outline-none focus:border-purple-500"
                />
                <input
                  type="text"
                  value={c.description || ""}
                  onChange={(e) => {
                    const next = [...choices];
                    next[i].description = e.target.value;
                    setChoices(next);
                  }}
                  placeholder="Пояснение"
                  className="flex-1 px-3 py-1.5 rounded-xl bg-neutral-950 border border-neutral-800 text-xs text-neutral-400 focus:outline-none focus:border-purple-500"
                />
              </div>
            ))}
          </div>
        </div>

        {/* Characters Preview */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="text-xs font-semibold text-neutral-300 flex items-center gap-1.5">
              <Users className="w-3.5 h-3.5 text-purple-400" />
              Спутники истории ({characters.length})
            </label>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {characters.map((char) => (
              <div
                key={char.id}
                className="p-2.5 rounded-xl bg-neutral-950 border border-neutral-800 flex items-center gap-3"
              >
                <img
                  src={char.avatar}
                  alt={char.name}
                  className="w-10 h-10 rounded-xl object-cover border border-neutral-700"
                  referrerPolicy="no-referrer"
                />
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-bold text-neutral-200 truncate">
                    {char.name}
                  </div>
                  <div className="text-[10px] text-neutral-400 truncate">
                    {char.role}
                  </div>
                  {char.temperament && (
                    <span className="text-[9px] text-purple-400">
                      [{char.temperament}]
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Footer actions */}
        <div className="flex items-center justify-end gap-3 pt-4 border-t border-neutral-800">
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2 rounded-xl border border-neutral-800 text-xs text-neutral-300 hover:bg-neutral-800 transition-colors"
          >
            Отмена
          </button>
          <button
            type="submit"
            className="px-6 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-semibold shadow-lg shadow-purple-900/40 transition-all"
          >
            Начать приключение
          </button>
        </div>
      </form>
    </div>
  );
};
