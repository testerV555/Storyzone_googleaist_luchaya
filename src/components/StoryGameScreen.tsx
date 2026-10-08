import React, { useState, useEffect, useRef } from "react";
import {
  ActiveGameState,
  StoryChoice,
  ReaderTheme,
  SceneFocus,
  NarrativeStyle,
  NarrativePOV,
  Character,
  UniverseSetting,
  LorebookEntry,
} from "../types";
import {
  Heart,
  Zap,
  Coins,
  Shield,
  Volume2,
  VolumeX,
  RotateCcw,
  Save,
  Send,
  Sparkles,
  Swords,
  MessageSquare,
  Wand2,
  EyeOff,
  Flame,
  ArrowLeft,
  BookOpen,
  Package,
  History,
  X,
  CheckCircle2,
  AlertCircle,
  Trophy,
  BookMarked,
  Edit3,
  GitBranch,
  Lightbulb,
  Compass,
  Bookmark,
  Network,
  Palette,
  Award,
  FileText,
  SlidersHorizontal,
  Scroll,
  Settings,
  Bot,
  Globe,
  ExternalLink,
  Trash2,
  Maximize2,
  Minimize2,
  SkipBack,
  Eye,
} from "lucide-react";
import { sound, TrackType } from "../utils/audio";
import { safeFetchJson } from "../utils/safeApi";
import { StoryMemoryDrawer } from "./StoryMemoryDrawer";
import { StoryJournalView } from "./StoryJournalView";
import { ChapterEditModal } from "./ChapterEditModal";
import { BranchManagerModal } from "./BranchManagerModal";
import { AiMuseModal } from "./AiMuseModal";
import { SituationMusicBar } from "./SituationMusicBar";
import { RelationshipGraphModal } from "./RelationshipGraphModal";
import { SceneArtModal } from "./SceneArtModal";
import { StyleAnalysisModal } from "./StyleAnalysisModal";
import { StoryExportImportModal } from "./StoryExportImportModal";
import { TacticalActionModal } from "./TacticalActionModal";
import { CanonDivergenceModal } from "./CanonDivergenceModal";
import { StoryRelationshipsView } from "./StoryRelationshipsView";
import { StoryAiChatView } from "./StoryAiChatView";
import { StoryAiChatDrawer } from "./StoryAiChatDrawer";
import { StoryUniverseView } from "./StoryUniverseView";
import { UniverseSettingModal } from "./UniverseSettingModal";
import { TacticalComboChain, DivergencePayload, GenerationLength } from "../types";

interface StoryGameScreenProps {
  gameState: ActiveGameState;
  onExecuteChoice: (choice: StoryChoice) => void;
  onExecuteCustomAction: (actionText: string) => void;
  onRollbackStep: (stepIndex: number) => void;
  onQuickSave: () => void;
  onExitToCatalog: () => void;
  onSaveEditedChapter: (
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
  onForkBranch: (name: string, desc: string) => void;
  onSwitchBranch: (branchId: string) => void;
  onChangeFocus: (focus: SceneFocus) => void;
  readerTheme: ReaderTheme;
  fontSize: "sm" | "md" | "lg" | "xl";
  setFontSize: (size: "sm" | "md" | "lg" | "xl") => void;
  isAiEnabled: boolean;
  customApiKey?: string;
  autoSituationMusic: boolean;
  setAutoSituationMusic: (val: boolean) => void;
  onApplySceneArt?: (artUrl: string) => void;
  onApplyImprovedText?: (improvedText: string) => void;
  onImportGameState?: (newState: ActiveGameState) => void;
  onExecuteTacticalCombo?: (combo: TacticalComboChain) => void;
  onApplyDivergence?: (payload: DivergencePayload) => Promise<void>;
  onUpdateCharacter?: (updatedChar: Character) => void;
  currentBpm?: number;
  onBpmChange?: (bpm: number, desc: string) => void;
  onOpenSettings?: () => void;
  aiSystemPrompt?: string;
  aiPromptDirective?: string;
  onUpdateNarrativeStyle?: (style: NarrativeStyle) => void;
  onUpdateGenerationLength?: (length: GenerationLength) => void;
  onUpdateGenre?: (genre: string) => void;
  onAddCharacter?: (character: Character) => void;
  onUpdatePromptDirective?: (directive: string) => void;
  onUpdateUniverseSetting?: (newSetting: UniverseSetting) => void;
  onAddLorebookEntry?: (entry: LorebookEntry) => void;
  onRewindPreviousChapter?: () => void;
  onDeleteCurrentChapter?: () => void;
}

const THEME_CLASSES: Record<
  ReaderTheme,
  { bg: string; card: string; text: string; accent: string; border: string }
> = {
  "dark-obsidian": {
    bg: "bg-neutral-950",
    card: "bg-neutral-900/80",
    text: "text-neutral-100",
    accent: "text-purple-400",
    border: "border-purple-900/30",
  },
  "cozy-parchment": {
    bg: "bg-[#1c1815]",
    card: "bg-[#27211b]/80",
    text: "text-[#ecd9c6]",
    accent: "text-amber-400",
    border: "border-amber-900/40",
  },
  "cyber-neon": {
    bg: "bg-[#080912]",
    card: "bg-[#0f1124]/90",
    text: "text-cyan-100",
    accent: "text-cyan-400",
    border: "border-cyan-800/40",
  },
  "vampire-velvet": {
    bg: "bg-[#14080e]",
    card: "bg-[#240e19]/80",
    text: "text-rose-100",
    accent: "text-rose-400",
    border: "border-rose-900/40",
  },
  "clean-slate": {
    bg: "bg-slate-950",
    card: "bg-slate-900/80",
    text: "text-slate-100",
    accent: "text-indigo-400",
    border: "border-slate-800",
  },
};

const FONT_SIZES = {
  sm: "text-sm sm:text-base leading-relaxed",
  md: "text-base sm:text-lg leading-relaxed",
  lg: "text-lg sm:text-xl leading-relaxed",
  xl: "text-xl sm:text-2xl leading-loose",
};

const FOCUS_LABELS: Record<SceneFocus, { label: string; icon: string }> = {
  general: { label: "Сбалансированно", icon: "⚖️" },
  action: { label: "Экшен & Схватка", icon: "⚔️" },
  dialogue: { label: "Диалог & Чувства", icon: "💬" },
  crisis: { label: "Острый цейтнот", icon: "⚡" },
  exploration: { label: "Исследование & Лор", icon: "🔍" },
};

export const StoryGameScreen: React.FC<StoryGameScreenProps> = ({
  gameState,
  onExecuteChoice,
  onExecuteCustomAction,
  onRollbackStep,
  onQuickSave,
  onExitToCatalog,
  onSaveEditedChapter,
  onForkBranch,
  onSwitchBranch,
  onChangeFocus,
  readerTheme,
  fontSize,
  setFontSize,
  isAiEnabled,
  customApiKey,
  autoSituationMusic,
  setAutoSituationMusic,
  onApplySceneArt,
  onApplyImprovedText,
  onImportGameState,
  onExecuteTacticalCombo,
  onApplyDivergence,
  onUpdateCharacter,
  currentBpm = 90,
  onBpmChange,
  onOpenSettings,
  aiSystemPrompt,
  aiPromptDirective,
  onUpdateNarrativeStyle,
  onUpdateGenerationLength,
  onUpdateGenre,
  onAddCharacter,
  onUpdatePromptDirective,
  onUpdateUniverseSetting,
  onAddLorebookEntry,
  onRewindPreviousChapter,
  onDeleteCurrentChapter,
}) => {
  const [activeGameView, setActiveGameView] = useState<
    "story" | "journal" | "relationships" | "chat" | "universe"
  >("story");
  const [isZenMode, setIsZenMode] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showAiChatDrawer, setShowAiChatDrawer] = useState(false);
  const [showUniverseModal, setShowUniverseModal] = useState(false);
  const [showStylePanel, setShowStylePanel] = useState(false);
  const [currentNarrativeStyle, setCurrentNarrativeStyle] = useState<NarrativeStyle>(
    gameState.narrativeStyle || NarrativeStyle.BRUTAL
  );
  const [currentGenLength, setCurrentGenLength] = useState<"short" | "medium" | "long">(
    gameState.generationLength || "medium"
  );
  const [customActionText, setCustomActionText] = useState("");
  const [showInventory, setShowInventory] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [editingTargetStep, setEditingTargetStep] = useState<number | null>(null);
  const [editingTargetText, setEditingTargetText] = useState<string>("");
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [notification, setNotification] = useState<string | null>(null);
  const [showToolsMenu, setShowToolsMenu] = useState(false);
  const [showStatsInHud, setShowStatsInHud] = useState(false);

  // Modals & Drawers
  const [showMemoryDrawer, setShowMemoryDrawer] = useState(false);
  const [showChapterEdit, setShowChapterEdit] = useState(false);
  const [showBranchManager, setShowBranchManager] = useState(false);
  const [showAiMuse, setShowAiMuse] = useState(false);
  const [showRelationshipGraph, setShowRelationshipGraph] = useState(false);
  const [showSceneArtModal, setShowSceneArtModal] = useState(false);
  const [showStyleAnalysisModal, setShowStyleAnalysisModal] = useState(false);
  const [showExportImportModal, setShowExportImportModal] = useState(false);
  const [showTacticalModal, setShowTacticalModal] = useState(false);
  const [showDivergenceModal, setShowDivergenceModal] = useState(false);

  const handleEnrichCharacter = async (char: Character) => {
    try {
      const res = await safeFetchJson<any>("/api/characters/deep-enrich", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(customApiKey ? { "x-custom-api-key": customApiKey } : {}),
        },
        body: JSON.stringify({
          characterName: char.name,
          role: char.role,
          universe: gameState.story.genre,
          currentStory: gameState.story.title,
          currentBio: char.bio,
          customKey: customApiKey,
        }),
      });

      if (res.ok && res.data) {
        const data = res.data;
        const updated: Character = {
          ...char,
          origin: data.origin || char.origin,
          abilities: data.abilities || char.abilities,
          merits: data.merits || char.merits,
          currentStatus: data.currentStatus || char.currentStatus,
          temperament: data.temperament || char.temperament,
          traits: data.traits || char.traits,
          habits: data.habits || char.habits,
          speechStyle: data.speechStyle || char.speechStyle,
          secret: data.secret || char.secret,
          fandomArchetypeNotes: data.fandomArchetypeNotes || char.fandomArchetypeNotes,
          bio: data.bio || char.bio,
        };
        if (onUpdateCharacter) {
          onUpdateCharacter(updated);
        }
        setNotification(`Досье спутника «${char.name}» обогащено знаниями из мирового канона!`);
        setTimeout(() => setNotification(null), 3000);
      }
    } catch (e) {
      console.error("Failed to enrich character:", e);
    }
  };

  const sceneEndRef = useRef<HTMLDivElement>(null);
  const theme = THEME_CLASSES[readerTheme] || THEME_CLASSES["dark-obsidian"];

  const handleRewindChapter = () => {
    if (gameState.history.length === 0 || gameState.isLoading) return;
    sound.playClick();
    if (onRewindPreviousChapter) {
      onRewindPreviousChapter();
    } else {
      const targetIndex = Math.max(0, gameState.history.length - 2);
      onRollbackStep(targetIndex);
    }
    setNotification("⏪ Повесть перемотана назад к предыдущей главе");
    setTimeout(() => setNotification(null), 3000);
  };

  const handleConfirmDeleteChapter = () => {
    if (gameState.history.length === 0 || gameState.isLoading) return;
    sound.playClick();
    setShowDeleteConfirm(false);
    if (onDeleteCurrentChapter) {
      onDeleteCurrentChapter();
    } else {
      const targetIndex = Math.max(0, gameState.history.length - 2);
      onRollbackStep(targetIndex);
    }
    setNotification("🗑️ Глава удалена. История возвращена к предыдущему моменту.");
    setTimeout(() => setNotification(null), 3500);
  };

  // Keyboard shortcut listener for Esc (exit Zen mode) and F/H (toggle Zen mode)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable)) {
        if (e.key === "Escape" && isZenMode) {
          setIsZenMode(false);
        }
        return;
      }

      if (e.key === "Escape" && isZenMode) {
        setIsZenMode(false);
      } else if (e.key === "f" || e.key === "F" || e.key === "а" || e.key === "А") {
        if (!showChapterEdit && !showHistory && !showUniverseModal) {
          setIsZenMode((prev) => !prev);
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isZenMode, showChapterEdit, showHistory, showUniverseModal]);

  // Scroll to new scene on step change
  useEffect(() => {
    sceneEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [gameState.stepCount, gameState.currentScene]);

  const handleCustomSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!customActionText.trim() || gameState.isLoading) return;
    sound.playChoice();
    onExecuteCustomAction(customActionText.trim());
    setCustomActionText("");
  };

  const toggleTTS = () => {
    if (isSpeaking) {
      sound.stopSpeaking();
      setIsSpeaking(false);
    } else {
      setIsSpeaking(true);
      sound.speakScene(gameState.currentScene, () => setIsSpeaking(false));
    }
  };

  const getChoiceIcon = (type?: string) => {
    switch (type) {
      case "combat":
        return <Swords className="w-4 h-4 text-rose-400 shrink-0" />;
      case "magic":
        return <Wand2 className="w-4 h-4 text-purple-400 shrink-0" />;
      case "stealth":
        return <EyeOff className="w-4 h-4 text-emerald-400 shrink-0" />;
      case "romantic":
        return <Heart className="w-4 h-4 text-pink-400 fill-pink-400/30 shrink-0" />;
      default:
        return <MessageSquare className="w-4 h-4 text-amber-400 shrink-0" />;
    }
  };

  const activeSpeakerChar = gameState.characters.find(
    (c) => c.name.toLowerCase() === gameState.dialogueSpeaker?.toLowerCase()
  );

  return (
    <div className={`min-h-[calc(100vh-70px)] ${theme.bg} ${theme.text} pb-16 transition-colors duration-300`}>
      {/* Game HUD Bar / Reader Ribbon */}
      {isZenMode ? (
        <div className="sticky top-0 z-40 w-full border-b border-neutral-800/80 bg-neutral-950/90 backdrop-blur-md px-3 sm:px-6 py-2.5 shadow-xl flex items-center justify-between gap-3 animate-fade-in">
          <div className="flex items-center gap-2.5 min-w-0">
            <span className="font-cinzel text-xs sm:text-sm font-bold text-neutral-200 truncate max-w-[180px] sm:max-w-sm">
              {gameState.story.title}
            </span>
            <span className="text-[11px] px-2 py-0.5 rounded-full bg-purple-950/80 border border-purple-800/60 text-purple-300 font-mono shrink-0">
              Глава {gameState.memoryChapters.length || Math.floor(gameState.stepCount / 3) + 1} • Шаг #{gameState.stepCount}
            </span>
          </div>

          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
            {/* Rewind Chapter Button */}
            <button
              onClick={handleRewindChapter}
              disabled={gameState.history.length === 0 || gameState.isLoading}
              className="px-2 sm:px-2.5 py-1.5 rounded-xl bg-neutral-900 hover:bg-neutral-800 disabled:opacity-40 disabled:cursor-not-allowed border border-neutral-800 text-xs text-amber-300 font-medium flex items-center gap-1.5 transition-colors"
              title={gameState.history.length > 0 ? "Перемотать назад к предыдущей главе" : "Это начальная глава истории"}
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span className="hidden md:inline">Перемотать назад</span>
            </button>

            {/* Delete Chapter Button */}
            <button
              onClick={() => setShowDeleteConfirm(true)}
              disabled={gameState.history.length === 0 || gameState.isLoading}
              className="px-2 sm:px-2.5 py-1.5 rounded-xl bg-neutral-900 hover:bg-rose-950/50 disabled:opacity-40 disabled:cursor-not-allowed border border-neutral-800 hover:border-rose-800/50 text-xs text-rose-300 font-medium flex items-center gap-1.5 transition-colors"
              title="Удалить текущую главу"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span className="hidden md:inline">Удалить главу</span>
            </button>

            {/* Font size +/- */}
            <div className="hidden sm:flex items-center gap-1 px-1.5 py-1 rounded-xl bg-neutral-900 border border-neutral-800 text-xs text-neutral-300 font-mono">
              <button
                onClick={() => {
                  const sizes: ("sm" | "md" | "lg" | "xl")[] = ["sm", "md", "lg", "xl"];
                  const idx = sizes.indexOf(fontSize);
                  if (idx > 0) setFontSize(sizes[idx - 1]);
                }}
                className="px-1.5 py-0.5 hover:text-white rounded"
                title="Уменьшить шрифт"
              >
                A-
              </button>
              <span className="text-[10px] text-neutral-500">•</span>
              <button
                onClick={() => {
                  const sizes: ("sm" | "md" | "lg" | "xl")[] = ["sm", "md", "lg", "xl"];
                  const idx = sizes.indexOf(fontSize);
                  if (idx < sizes.length - 1) setFontSize(sizes[idx + 1]);
                }}
                className="px-1.5 py-0.5 hover:text-white rounded"
                title="Увеличить шрифт"
              >
                A+
              </button>
            </div>

            {/* Exit Zen Mode */}
            <button
              onClick={() => {
                sound.playClick();
                setIsZenMode(false);
              }}
              className="px-3 py-1.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-semibold flex items-center gap-1.5 shadow-md shadow-purple-950/50 transition-colors"
              title="Показать полный интерфейс (Esc или F)"
            >
              <Eye className="w-3.5 h-3.5" />
              <span>Показать HUD</span>
              <span className="text-[10px] opacity-70 hidden sm:inline">(Esc)</span>
            </button>
          </div>
        </div>
      ) : (
        <div className={`sticky top-[61px] z-30 w-full border-b ${theme.border} bg-neutral-950/95 backdrop-blur-md px-3 sm:px-6 py-2 shadow-md`}>
        <div className="max-w-5xl mx-auto flex items-center justify-between gap-2 sm:gap-4">
          {/* Left: Exit & Story Title */}
          <div className="flex items-center gap-2 sm:gap-3 min-w-0">
            <button
              id="btn-game-back-to-catalog"
              onClick={() => {
                sound.playClick();
                onExitToCatalog();
              }}
              className="p-1.5 sm:px-2.5 sm:py-1.5 rounded-xl bg-neutral-900 hover:bg-neutral-800 text-neutral-400 hover:text-neutral-200 border border-neutral-800 text-xs flex items-center gap-1.5 transition-colors shrink-0"
              title="Выйти в каталог"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Каталог</span>
            </button>

            <div className="min-w-0">
              <div className="flex items-center gap-1.5 min-w-0">
                <h2 className="font-cinzel text-xs sm:text-sm font-bold truncate text-neutral-200" title={gameState.story.title}>
                  {gameState.story.title}
                </h2>
                {gameState.activeBranchId !== "main" && (
                  <span className="shrink-0 text-[10px] px-1.5 py-0.5 rounded bg-emerald-950 border border-emerald-700/60 text-emerald-300 font-semibold flex items-center gap-1">
                    <GitBranch className="w-2.5 h-2.5" />
                    Ветка
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2 text-[10px] text-neutral-400">
                <span>Глава {gameState.memoryChapters.length || Math.floor(gameState.stepCount / 3) + 1}</span>
                <span>•</span>
                <span>Шаг #{gameState.stepCount}</span>
                {showStatsInHud && (
                  <>
                    <span>•</span>
                    <span className="text-rose-400 font-mono-code">❤️ {gameState.playerStats.hp}</span>
                    <span>•</span>
                    <span className="text-amber-400 font-mono-code">⚡ {gameState.playerStats.energy}</span>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Right Controls: Anti-Overflow & Streamlined */}
          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
            {/* View Switcher: Story vs Journal vs Relationships */}
            <div className="flex items-center p-0.5 rounded-xl bg-neutral-900 border border-neutral-800 shadow-inner">
              <button
                id="btn-view-story"
                onClick={() => {
                  sound.playClick();
                  setActiveGameView("story");
                }}
                className={`px-2 sm:px-2.5 py-1 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all ${
                  activeGameView === "story"
                    ? "bg-purple-600 text-white shadow-sm"
                    : "text-neutral-400 hover:text-neutral-200"
                }`}
                title="Режим чтения повести"
              >
                <BookOpen className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Повесть</span>
              </button>
              <button
                id="btn-view-journal"
                onClick={() => {
                  sound.playClick();
                  setActiveGameView("journal");
                }}
                className={`px-2 sm:px-2.5 py-1 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all ${
                  activeGameView === "journal"
                    ? "bg-purple-600 text-white shadow-sm"
                    : "text-neutral-400 hover:text-neutral-200"
                }`}
                title="Открыть Журнал странствий и летопись"
              >
                <Scroll className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Журнал</span>
                <span className="text-[10px] px-1 rounded-full bg-neutral-800 text-purple-300 font-mono">
                  {gameState.memoryChapters.length + gameState.lorebook.length}
                </span>
              </button>
              <button
                id="btn-view-relationships"
                onClick={() => {
                  sound.playClick();
                  setActiveGameView("relationships");
                }}
                className={`px-2 sm:px-2.5 py-1 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all ${
                  activeGameView === "relationships"
                    ? "bg-purple-600 text-white shadow-sm"
                    : "text-neutral-400 hover:text-neutral-200"
                }`}
                title="Матрица и таблица связей между персонажами на основе affinity"
              >
                <Heart className="w-3.5 h-3.5 text-rose-400" />
                <span className="hidden sm:inline">Отношения</span>
                <span className="text-[10px] px-1 rounded-full bg-neutral-800 text-rose-300 font-mono">
                  {gameState.characters.length}
                </span>
              </button>
              <button
                id="btn-view-ai-chat"
                onClick={() => {
                  sound.playClick();
                  setActiveGameView("chat");
                }}
                className={`px-2 sm:px-2.5 py-1 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all ${
                  activeGameView === "chat"
                    ? "bg-purple-600 text-white shadow-sm"
                    : "text-neutral-400 hover:text-neutral-200"
                }`}
                title="Чат с ИИ-Соавтором и Мастером игры"
              >
                <Bot className="w-3.5 h-3.5 text-purple-400" />
                <span className="hidden sm:inline">ИИ-Соавтор</span>
                <span className="text-[10px] px-1 rounded-full bg-purple-950 text-purple-300 font-mono border border-purple-800">
                  GM
                </span>
              </button>

              <button
                id="btn-view-universe"
                onClick={() => {
                  sound.playClick();
                  setActiveGameView("universe");
                }}
                className={`px-2 sm:px-2.5 py-1 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all ${
                  activeGameView === "universe"
                    ? "bg-cyan-600 text-white shadow-sm"
                    : "text-neutral-400 hover:text-neutral-200"
                }`}
                title="Настройки вселенной, сеттинга и правил мира"
              >
                <Globe className="w-3.5 h-3.5 text-cyan-400" />
                <span className="hidden sm:inline">Вселенная</span>
                <span className="text-[10px] px-1 rounded-full bg-cyan-950 text-cyan-300 font-mono border border-cyan-800">
                  Лор
                </span>
              </button>
            </div>

            {/* Auto-Save indicator */}
            <div
              className="hidden md:flex items-center gap-1 px-2 py-1 rounded-xl bg-emerald-950/40 border border-emerald-800/40 text-[10px] text-emerald-300 font-mono-code"
              title="Прогресс непрерывно сохраняется автоматически"
            >
              <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              <span>Автосохранение</span>
            </div>

            {/* Adaptive Situation Music Player */}
            <SituationMusicBar
              currentAtmosphere={gameState.atmosphere}
              suggestedTrack={gameState.suggestedMusic}
              autoSwitch={autoSituationMusic}
              setAutoSwitch={setAutoSituationMusic}
              currentBpm={currentBpm}
              onBpmChange={onBpmChange}
            />

            {/* Memory & Chronicles Drawer Button */}
            <button
              id="btn-memory-drawer"
              onClick={() => {
                sound.playClick();
                setShowMemoryDrawer(true);
              }}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-purple-950/60 hover:bg-purple-900/60 border border-purple-800/60 text-purple-300 text-xs font-semibold shadow-sm transition-all"
              title="Открыть Хронику и Память глав"
            >
              <BookMarked className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Память</span>
              <span className="text-[10px] px-1 rounded-full bg-purple-900 text-purple-200">
                {gameState.memoryChapters.length}
              </span>
            </button>

            {/* Universe & Setting Inspector Button */}
            <button
              id="btn-universe-modal"
              onClick={() => {
                sound.playClick();
                setShowUniverseModal(true);
              }}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-cyan-950/60 hover:bg-cyan-900/60 border border-cyan-800/60 text-cyan-300 text-xs font-semibold shadow-sm transition-all"
              title="Настроить вселенную, сеттинг, правила мира и канон Google Search"
            >
              <Globe className="w-3.5 h-3.5 text-cyan-400" />
              <span className="hidden lg:inline max-w-[130px] truncate">
                {gameState.universeSetting?.universeName || gameState.story.fandomSource || "Вселенная"}
              </span>
              <span className="lg:hidden hidden sm:inline">Сеттинг</span>
            </button>

            {/* Story Tools Menu Dropdown */}
            <div className="relative">
              <button
                id="btn-story-tools-menu"
                onClick={() => setShowToolsMenu(!showToolsMenu)}
                className={`p-1.5 sm:px-2.5 sm:py-1.5 rounded-xl border text-xs font-medium flex items-center gap-1.5 transition-all ${
                  showToolsMenu
                    ? "bg-purple-900/80 border-purple-600 text-purple-100 shadow-md"
                    : "bg-neutral-900 border-neutral-800 text-neutral-300 hover:text-neutral-100 hover:bg-neutral-800"
                }`}
                title="Инструменты книги и персонажей"
              >
                <SlidersHorizontal className="w-3.5 h-3.5 text-purple-400" />
                <span className="hidden sm:inline">Инструменты</span>
              </button>

              {showToolsMenu && (
                <>
                  <div
                    className="fixed inset-0 z-40"
                    onClick={() => setShowToolsMenu(false)}
                  />
                  <div className="absolute right-0 mt-2 w-64 rounded-2xl bg-neutral-900/95 border border-neutral-800 shadow-2xl backdrop-blur-xl p-2 z-50 space-y-1 animate-scale-up">
                    <div className="px-3 py-1.5 border-b border-neutral-800 text-[10px] font-bold uppercase tracking-wider text-neutral-400">
                      Инструменты истории
                    </div>

                    <button
                      onClick={() => {
                        setShowToolsMenu(false);
                        setShowUniverseModal(true);
                      }}
                      className="w-full px-3 py-2 rounded-xl text-left text-xs text-neutral-200 hover:bg-cyan-950/60 hover:text-cyan-300 flex items-center gap-2 transition-colors"
                    >
                      <Globe className="w-4 h-4 text-cyan-400" />
                      <span>Вселенная, сеттинг и канон</span>
                    </button>

                    <button
                      onClick={() => {
                        setShowToolsMenu(false);
                        setEditingTargetStep(gameState.stepCount);
                        setEditingTargetText(gameState.currentScene);
                        setShowChapterEdit(true);
                      }}
                      className="w-full px-3 py-2 rounded-xl text-left text-xs text-neutral-200 hover:bg-amber-950/60 hover:text-amber-300 flex items-center gap-2 transition-colors"
                    >
                      <Edit3 className="w-4 h-4 text-amber-400" />
                      <span>Редактировать текущую главу</span>
                    </button>

                    <button
                      onClick={() => {
                        setShowToolsMenu(false);
                        setActiveGameView("journal");
                      }}
                      className="w-full px-3 py-2 rounded-xl text-left text-xs text-neutral-200 hover:bg-purple-950/60 hover:text-purple-300 flex items-center gap-2 transition-colors"
                    >
                      <Scroll className="w-4 h-4 text-purple-400" />
                      <span>Журнал странствий & Летопись</span>
                    </button>

                    <button
                      onClick={() => {
                        setShowToolsMenu(false);
                        setShowHistory(true);
                      }}
                      className="w-full px-3 py-2 rounded-xl text-left text-xs text-neutral-200 hover:bg-purple-950/60 hover:text-purple-300 flex items-center gap-2 transition-colors"
                    >
                      <History className="w-4 h-4 text-amber-400" />
                      <span>История шагов & Откат ({gameState.history.length})</span>
                    </button>

                    <button
                      onClick={() => {
                        setShowToolsMenu(false);
                        setShowBranchManager(true);
                      }}
                      className="w-full px-3 py-2 rounded-xl text-left text-xs text-neutral-200 hover:bg-purple-950/60 hover:text-purple-300 flex items-center gap-2 transition-colors"
                    >
                      <GitBranch className="w-4 h-4 text-emerald-400" />
                      <span>Ветки сюжета (What If?)</span>
                    </button>

                    <button
                      onClick={() => {
                        setShowToolsMenu(false);
                        setShowRelationshipGraph(true);
                      }}
                      className="w-full px-3 py-2 rounded-xl text-left text-xs text-neutral-200 hover:bg-purple-950/60 hover:text-purple-300 flex items-center gap-2 transition-colors"
                    >
                      <Network className="w-4 h-4 text-purple-400" />
                      <span>Спутники и связи</span>
                    </button>

                    <button
                      onClick={() => {
                        setShowToolsMenu(false);
                        setShowInventory(true);
                      }}
                      className="w-full px-3 py-2 rounded-xl text-left text-xs text-neutral-200 hover:bg-purple-950/60 hover:text-purple-300 flex items-center gap-2 transition-colors"
                    >
                      <Package className="w-4 h-4 text-purple-400" />
                      <span>Личные вещи & Инвентарь ({gameState.inventory.length})</span>
                    </button>

                    <button
                      onClick={() => {
                        setShowToolsMenu(false);
                        setShowExportImportModal(true);
                      }}
                      className="w-full px-3 py-2 rounded-xl text-left text-xs text-neutral-200 hover:bg-cyan-950/60 hover:text-cyan-300 flex items-center gap-2 transition-colors"
                    >
                      <FileText className="w-4 h-4 text-cyan-400" />
                      <span>Экспорт & Импорт книги</span>
                    </button>

                    <button
                      onClick={() => {
                        setShowToolsMenu(false);
                        sound.playClick();
                        setActiveGameView("chat");
                      }}
                      className="w-full px-3 py-2 rounded-xl text-left text-xs text-neutral-200 hover:bg-purple-950/60 hover:text-purple-300 flex items-center gap-2 transition-colors"
                    >
                      <Bot className="w-4 h-4 text-purple-400" />
                      <span>ИИ-Соавтор & Мастер сюжета</span>
                    </button>

                    <button
                      onClick={() => {
                        setShowToolsMenu(false);
                        onQuickSave();
                        setNotification("Книга успешно сохранена в локальную память!");
                        setTimeout(() => setNotification(null), 2500);
                      }}
                      className="w-full px-3 py-2 rounded-xl text-left text-xs text-neutral-200 hover:bg-emerald-950/60 hover:text-emerald-300 flex items-center gap-2 transition-colors"
                    >
                      <Save className="w-4 h-4 text-emerald-400" />
                      <span>Сохранить в память</span>
                    </button>

                    {onOpenSettings && (
                      <button
                        onClick={() => {
                          setShowToolsMenu(false);
                          sound.playClick();
                          onOpenSettings();
                        }}
                        className="w-full px-3 py-2 rounded-xl text-left text-xs text-neutral-200 hover:bg-purple-950/60 hover:text-purple-300 flex items-center gap-2 transition-colors border-t border-neutral-800/80 mt-1 pt-2"
                      >
                        <Settings className="w-4 h-4 text-purple-400" />
                        <span>Настройки & Системный промпт ИИ</span>
                      </button>
                    )}

                    <div className="pt-1 mt-1 border-t border-neutral-800">
                      <button
                        onClick={() => setShowStatsInHud(!showStatsInHud)}
                        className="w-full px-3 py-1.5 rounded-xl text-left text-[11px] text-neutral-400 hover:text-neutral-200 flex items-center justify-between"
                      >
                        <span>Отображение RPG-статов</span>
                        <span className="font-mono-code text-[10px] text-purple-400">
                          {showStatsInHud ? "[Вкл]" : "[Выкл (Книга)]"}
                        </span>
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>

            {/* Zen Mode / Fullscreen Toggle Button */}
            <button
              id="btn-toggle-zen-mode"
              onClick={() => {
                sound.playClick();
                setIsZenMode(true);
              }}
              className="p-1.5 sm:px-2.5 sm:py-1.5 rounded-xl border border-neutral-800 bg-neutral-900 text-neutral-300 hover:text-neutral-100 hover:bg-neutral-800 text-xs font-medium flex items-center gap-1.5 transition-all"
              title="Скрыть лишний HUD: оставить только текст и строку действия (Клавиша F или Esc)"
            >
              <EyeOff className="w-3.5 h-3.5 text-purple-400" />
              <span className="hidden sm:inline">Скрыть HUD</span>
            </button>
          </div>
        </div>
      </div>
      )}

      {/* Floating Save Notification Banner */}
      {notification && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-950/90 border border-emerald-700/80 text-emerald-200 text-xs font-medium shadow-xl backdrop-blur-md animate-bounce">
          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          {notification}
        </div>
      )}

      {/* Inventory Drawer Dropdown */}
      {showInventory && (
        <div className="max-w-5xl mx-auto px-4 sm:px-6 pt-3">
          <div className="p-4 rounded-2xl border border-purple-900/40 bg-neutral-900/95 backdrop-blur-lg shadow-2xl">
            <div className="flex items-center justify-between pb-2 border-b border-neutral-800">
              <h3 className="font-cinzel text-sm font-bold text-purple-300 flex items-center gap-2">
                <Package className="w-4 h-4" />
                Сумка Путешественника ({gameState.inventory.length})
              </h3>
              <button
                onClick={() => setShowInventory(false)}
                className="text-xs text-neutral-400 hover:text-neutral-200"
              >
                Закрыть ✕
              </button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5 pt-3">
              {gameState.inventory.length === 0 ? (
                <p className="text-xs text-neutral-500 col-span-3 py-4 text-center">
                  Инвентарь пуст. Исследуйте мир, чтобы найти артефакты и снаряжение.
                </p>
              ) : (
                gameState.inventory.map((item, idx) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between p-2.5 rounded-xl bg-neutral-950/80 border border-neutral-800/80 text-xs text-neutral-200"
                  >
                    <span className="font-medium">{item}</span>
                    <button
                      onClick={() => {
                        sound.playClick();
                        onExecuteCustomAction(`Использовать предмет: "${item}"`);
                        setShowInventory(false);
                      }}
                      className="px-2 py-1 rounded bg-purple-950 border border-purple-800/60 text-purple-300 text-[10px] hover:bg-purple-900/60"
                    >
                      Применить
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* Main Story Content Container OR Journal View OR Relationships View OR AI Chat View */}
      {activeGameView === "chat" ? (
        <StoryAiChatView
          gameState={gameState}
          readerTheme={readerTheme}
          customApiKey={customApiKey}
          aiSystemPrompt={aiSystemPrompt}
          aiPromptDirective={aiPromptDirective}
          onBackToStory={() => {
            sound.playClick();
            setActiveGameView("story");
          }}
          onExecuteAction={(action) => {
            onExecuteCustomAction(action);
            setActiveGameView("story");
          }}
          onUpdateNarrativeStyle={(style) => {
            setCurrentNarrativeStyle(style);
            if (onUpdateNarrativeStyle) onUpdateNarrativeStyle(style);
            setNotification(`Стиль повести изменён на: ${style}`);
            setTimeout(() => setNotification(null), 3000);
          }}
          onUpdateGenerationLength={(length) => {
            setCurrentGenLength(length);
            if (onUpdateGenerationLength) onUpdateGenerationLength(length);
            setNotification(`Длина глав изменена: ${length}`);
            setTimeout(() => setNotification(null), 3000);
          }}
          onUpdateGenre={(genre) => {
            if (onUpdateGenre) onUpdateGenre(genre);
            setNotification(`Жанр повести обновлён: ${genre}`);
            setTimeout(() => setNotification(null), 3000);
          }}
          onAddCharacter={(char) => {
            if (onAddCharacter) onAddCharacter(char);
            setNotification(`Новый персонаж добавлен в историю: ${char.name}`);
            setTimeout(() => setNotification(null), 3500);
          }}
          onUpdateCharacter={(char) => {
            if (onUpdateCharacter) onUpdateCharacter(char);
            setNotification(`Отношения и статус обновлены: ${char.name}`);
            setTimeout(() => setNotification(null), 3000);
          }}
          onInjectSceneText={(newText) => {
            onSaveEditedChapter(newText, "Сцена обновлена по согласованию с ИИ-Соавтором");
            setNotification("Сцена успешно обновлена по решению с Соавтором!");
            setTimeout(() => setNotification(null), 3500);
          }}
          onUpdatePromptDirective={(directive) => {
            if (onUpdatePromptDirective) onUpdatePromptDirective(directive);
            setNotification("Директива автора обновлена!");
            setTimeout(() => setNotification(null), 3000);
          }}
          universeSetting={gameState.universeSetting || gameState.story.universeSetting}
          onUpdateUniverseSetting={(newSetting) => {
            if (onUpdateUniverseSetting) onUpdateUniverseSetting(newSetting);
            setNotification(`Вселенная «${newSetting.universeName}» обновлена!`);
            setTimeout(() => setNotification(null), 3500);
          }}
          onAddLorebookEntry={(entry) => {
            if (onAddLorebookEntry) onAddLorebookEntry(entry);
            setNotification(`Факт «${entry.title}» добавлен в лорбук!`);
            setTimeout(() => setNotification(null), 3500);
          }}
          onOpenUniverseModal={() => setShowUniverseModal(true)}
        />
      ) : activeGameView === "universe" ? (
        <StoryUniverseView
          gameState={gameState}
          readerTheme={readerTheme}
          customApiKey={customApiKey}
          onBackToStory={() => {
            sound.playClick();
            setActiveGameView("story");
          }}
          onUpdateUniverseSetting={(newSetting) => {
            if (onUpdateUniverseSetting) onUpdateUniverseSetting(newSetting);
            setNotification(`Вселенная «${newSetting.universeName}» успешно обновлена!`);
            setTimeout(() => setNotification(null), 3500);
          }}
          onAddLorebookEntry={(entry) => {
            if (onAddLorebookEntry) onAddLorebookEntry(entry);
            setNotification(`Факт «${entry.title}» добавлен в лорбук!`);
            setTimeout(() => setNotification(null), 3500);
          }}
        />
      ) : activeGameView === "relationships" ? (
        <StoryRelationshipsView
          gameState={gameState}
          readerTheme={readerTheme}
          onBackToStory={() => {
            sound.playClick();
            setActiveGameView("story");
          }}
          onUpdateCharacter={onUpdateCharacter}
          customApiKey={customApiKey}
        />
      ) : activeGameView === "journal" ? (
        <StoryJournalView
          gameState={gameState}
          readerTheme={readerTheme}
          onBackToStory={() => {
            sound.playClick();
            setActiveGameView("story");
          }}
          onEnrichCharacter={handleEnrichCharacter}
          customApiKey={customApiKey}
          onEditChapter={(chapterNumber, currentText) => {
            setEditingTargetStep(chapterNumber);
            setEditingTargetText(currentText);
            setShowChapterEdit(true);
          }}
          onRollbackToChapter={(chapterNumber) => {
            const idx = gameState.history.findIndex(
              (h) => h.stepNumber === chapterNumber
            );
            if (idx >= 0) {
              onRollbackStep(idx);
              setActiveGameView("story");
              sound.playChoice();
              setNotification(`Откат сюжета к главе #${chapterNumber} выполнен!`);
              setTimeout(() => setNotification(null), 3000);
            }
          }}
        />
      ) : (
        <div className="max-w-4xl mx-auto px-4 sm:px-6 pt-6 space-y-6">
        {/* Scene Cover Banner with Atmosphere Vignette */}
        <div className="relative h-44 sm:h-64 rounded-2xl overflow-hidden border border-neutral-800/80 shadow-2xl">
          <img
            src={gameState.sceneArtUrl || gameState.story.coverImage}
            alt={gameState.story.title}
            className="w-full h-full object-cover filter brightness-75 contrast-110 transition-all duration-700"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-neutral-950 via-neutral-950/40 to-transparent" />

          {/* Top Left: Genre & Narrative Style Badges */}
          <div className="absolute top-3 left-3 flex flex-wrap items-center gap-1.5">
            <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-neutral-950/85 backdrop-blur-md text-amber-300 border border-amber-500/30 flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-amber-400" />
              {gameState.story.genre}
            </span>
            <button
              type="button"
              onClick={() => {
                sound.playClick();
                setShowStylePanel((prev) => !prev);
              }}
              className="px-2.5 py-1 rounded-full text-[11px] font-medium bg-neutral-950/85 hover:bg-purple-950 backdrop-blur-md text-purple-300 border border-purple-800/40 flex items-center gap-1 cursor-pointer transition-all"
              title="Нажмите для смены стиля повествования и объёма текста"
            >
              <SlidersHorizontal className="w-3 h-3 text-purple-400" />
              <span>Стиль: {currentNarrativeStyle}</span>
            </button>
          </div>

          {/* Top Right: AI Scene Art Generation Button & Reader font size */}
          <div className="absolute top-3 right-3 flex items-center gap-2">
            <button
              id="btn-generate-scene-art"
              onClick={() => {
                sound.playClick();
                setShowSceneArtModal(true);
              }}
              className="px-2.5 py-1 rounded-xl bg-purple-950/85 hover:bg-purple-900/90 backdrop-blur-md border border-purple-700/80 text-purple-200 text-xs font-semibold flex items-center gap-1.5 shadow-lg transition-all"
              title="Сгенерировать визуальное сопровождение сцены с помощью ИИ"
            >
              <Palette className="w-3.5 h-3.5 text-purple-400" />
              <span className="hidden sm:inline">
                {gameState.sceneArtUrl ? "Арт сцены (ИИ)" : "Создать арт сцены"}
              </span>
            </button>

            {/* Reader font size adjustment widget */}
            <div className="flex items-center gap-1 bg-neutral-950/85 backdrop-blur-md p-1 rounded-xl border border-neutral-800 text-xs">
              {(["sm", "md", "lg", "xl"] as const).map((s) => (
                <button
                  key={s}
                  onClick={() => setFontSize(s)}
                  className={`px-2 py-0.5 rounded-lg transition-colors ${
                    fontSize === s
                      ? "bg-purple-600 text-white font-bold"
                      : "text-neutral-400 hover:text-neutral-200"
                  }`}
                >
                  {s.toUpperCase()}
                </button>
              ))}
            </div>
          </div>

          {/* Active Characters Strip on Banner */}
          <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between gap-2 min-w-0">
            <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none flex-1 min-w-0">
              {gameState.characters.map((char) => (
                <div
                  key={char.id}
                  className="flex items-center gap-2 px-2.5 py-1.5 rounded-xl bg-neutral-950/85 backdrop-blur-md border border-neutral-800/80 shrink-0 text-xs cursor-pointer hover:border-purple-500/70 transition-colors"
                  onClick={() => {
                    sound.playClick();
                    setShowRelationshipGraph(true);
                  }}
                  title="Нажмите, чтобы открыть карту отношений"
                >
                  <img
                    src={char.avatar}
                    alt={char.name}
                    className="w-6 h-6 rounded-full object-cover border border-purple-500/50"
                  />
                  <div>
                    <div className="font-semibold text-neutral-200 leading-tight">
                      {char.name}
                    </div>
                    <div className="flex items-center gap-1 text-[10px] text-pink-300 font-mono-code">
                      <span>{char.affinity}%</span>
                      {char.temperament && (
                        <span className="text-[9px] text-neutral-400 capitalize">
                          • {char.temperament}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <button
              id="btn-banner-relationships"
              onClick={() => {
                sound.playClick();
                setShowRelationshipGraph(true);
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-purple-950/85 hover:bg-purple-900/90 backdrop-blur-md border border-purple-700/80 text-purple-200 text-xs font-semibold shrink-0 transition-all"
              title="Визуализация отношений и связей спутников"
            >
              <Network className="w-3.5 h-3.5 text-purple-400" />
              <span className="hidden sm:inline">Связи</span>
            </button>
          </div>
        </div>

        {/* Interactive Style & Dynamics Controller */}
        {showStylePanel && !isZenMode && (
          <div className="p-3.5 sm:p-4 rounded-2xl bg-neutral-900/90 border border-neutral-800 shadow-xl space-y-3 backdrop-blur-md">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-2">
                <SlidersHorizontal className="w-4 h-4 text-purple-400" />
                <span className="text-xs font-bold text-neutral-100">
                  Стиль изложения & Темп генерации:
                </span>
                <span className="text-[11px] px-2 py-0.5 rounded-full bg-purple-950 border border-purple-800 text-purple-300 font-semibold font-mono">
                  {currentNarrativeStyle}
                </span>
              </div>

              {/* Generation Length Controls */}
              <div className="flex items-center gap-1.5 text-xs">
                <span className="text-[11px] text-neutral-400">Объём главы:</span>
                {[
                  { id: "short", label: "⚡ Кратко (2-3 абз.)", title: "Динамичный темп без затягивания" },
                  { id: "medium", label: "📖 Средний (3-5 абз.)", title: "Богатый литературный слог с диалогами и атмосферой" },
                  { id: "long", label: "📚 Развёрнутый (5-8 абз.)", title: "Эпическая проза высокой детализации с развёрнутыми описаниями" },
                ].map((len) => (
                  <button
                    key={len.id}
                    type="button"
                    onClick={() => {
                      sound.playClick();
                      const next = len.id as "short" | "medium" | "long";
                      setCurrentGenLength(next);
                      gameState.generationLength = next;
                      if (onUpdateGenerationLength) onUpdateGenerationLength(next);
                      setNotification(`Объём генерации глав: ${len.label}`);
                      setTimeout(() => setNotification(null), 2500);
                    }}
                    className={`px-2.5 py-1 rounded-lg text-[10px] font-semibold transition-all ${
                      currentGenLength === len.id
                        ? "bg-purple-600 text-white shadow-sm"
                        : "bg-neutral-950 hover:bg-neutral-800 border border-neutral-800 text-neutral-400 hover:text-neutral-200"
                    }`}
                    title={len.title}
                  >
                    {len.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Quick Style Switcher Chips */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 pt-1">
              {[
                { id: NarrativeStyle.BRUTAL, label: "⚡ Экшен & Реализм", desc: "Хлёсткий слог, драйв, без воды" },
                { id: NarrativeStyle.CINEMATIC, label: "🎬 Кино-блокбастер", desc: "Визуальная мощь, ракурсы" },
                { id: NarrativeStyle.ANIME, label: "⚔️ Аниме & Ранобэ", desc: "Сёнэн, эмоции, пафос стоек" },
                { id: NarrativeStyle.NOIR, label: "🕵️ Нуар-детектив", desc: "Циничный герой, тени, расследование" },
                { id: NarrativeStyle.CONVERSATIONAL, label: "💬 Живая речь", desc: "Простой язык, естественный диалог" },
                { id: NarrativeStyle.SATIRE, label: "🎭 Ирония & Сарказм", desc: "Едкий юмор, без напыщенности" },
                { id: NarrativeStyle.LITERARY, label: "📖 Классическая проза", desc: "Образность и психологизм" },
                { id: NarrativeStyle.FANFICTION, label: "❤️ Фанфикшн / Чувства", desc: "Химия и взгляды персонажей" },
              ].map((st) => (
                <button
                  key={st.id}
                  type="button"
                  onClick={() => {
                    sound.playClick();
                    setCurrentNarrativeStyle(st.id);
                    gameState.narrativeStyle = st.id;
                    if (onUpdateNarrativeStyle) onUpdateNarrativeStyle(st.id);
                    setNotification(`Стиль изложения изменён на: ${st.label}`);
                    setTimeout(() => setNotification(null), 2500);
                  }}
                  className={`p-2 rounded-xl text-left border transition-all ${
                    currentNarrativeStyle === st.id
                      ? "bg-purple-950/80 border-purple-500 text-purple-200 shadow-md font-semibold ring-1 ring-purple-500/50"
                      : "bg-neutral-950/60 hover:bg-neutral-800/60 border-neutral-800 text-neutral-300"
                  }`}
                >
                  <div className="text-xs font-semibold leading-tight">{st.label}</div>
                  <div className="text-[10px] text-neutral-400 mt-0.5 leading-tight truncate">{st.desc}</div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Narrative Presentation Box */}
        <div
          style={{ width: "770.96px", height: "1593.21px", maxWidth: "100%" }}
          className={`p-6 sm:p-8 rounded-2xl border ${theme.border} ${theme.card} shadow-xl relative backdrop-blur-sm space-y-5 overflow-y-auto`}
        >
          {/* Top Bar inside Scene: Rewind, Delete, Edit, Focus, Zen mode */}
          <div className="flex items-center justify-between pb-3 border-b border-neutral-800/60 flex-wrap gap-2">
            <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
              {/* Rewind Chapter Button */}
              <button
                id="btn-scene-rewind"
                onClick={handleRewindChapter}
                disabled={gameState.history.length === 0 || gameState.isLoading}
                className="px-2.5 py-1 rounded-lg bg-neutral-950/80 hover:bg-neutral-800 disabled:opacity-40 disabled:cursor-not-allowed border border-neutral-800 text-neutral-300 hover:text-amber-300 text-xs font-semibold flex items-center gap-1.5 transition-colors"
                title={gameState.history.length > 0 ? "Перемотать назад к предыдущей главе" : "Это начальная глава истории"}
              >
                <RotateCcw className="w-3.5 h-3.5 text-amber-400" />
                <span>Перемотать назад</span>
              </button>

              {/* Delete Chapter Button */}
              <button
                id="btn-scene-delete"
                onClick={() => setShowDeleteConfirm(true)}
                disabled={gameState.history.length === 0 || gameState.isLoading}
                className="px-2.5 py-1 rounded-lg bg-neutral-950/80 hover:bg-rose-950/60 disabled:opacity-40 disabled:cursor-not-allowed border border-neutral-800 hover:border-rose-800/60 text-neutral-300 hover:text-rose-200 text-xs font-semibold flex items-center gap-1.5 transition-colors"
                title="Удалить текущую главу и восстановить предыдущее состояние"
              >
                <Trash2 className="w-3.5 h-3.5 text-rose-400" />
                <span>Удалить главу</span>
              </button>

              <button
                onClick={() => {
                  sound.playClick();
                  setEditingTargetStep(gameState.stepCount);
                  setEditingTargetText(gameState.currentScene);
                  setShowChapterEdit(true);
                }}
                className="px-2.5 py-1 rounded-lg bg-neutral-950/80 hover:bg-neutral-800 border border-neutral-800 text-neutral-300 text-xs font-semibold flex items-center gap-1.5 transition-colors"
                title="Отредактировать текст этой главы со сквозным обновлением и синхронизацией стиля"
              >
                <Edit3 className="w-3.5 h-3.5 text-amber-400" />
                <span className="hidden sm:inline">Редактировать</span>
              </button>

              <button
                id="btn-open-style-analysis"
                onClick={() => {
                  sound.playClick();
                  setShowStyleAnalysisModal(true);
                }}
                className="px-2.5 py-1 rounded-lg bg-neutral-950/80 hover:bg-neutral-800 border border-neutral-800 text-indigo-300 text-xs font-semibold flex items-center gap-1.5 transition-colors"
                title="Оценить соответствие выбранному стилю и получить советы ИИ"
              >
                <Award className="w-3.5 h-3.5 text-indigo-400" />
                <span className="hidden md:inline">Анализ стиля</span>
              </button>

              <button
                onClick={toggleTTS}
                className={`p-1.5 rounded-lg border text-xs flex items-center gap-1 transition-all ${
                  isSpeaking
                    ? "bg-amber-500/20 border-amber-500/60 text-amber-300 animate-pulse"
                    : "bg-neutral-950/80 border-neutral-800 text-neutral-400 hover:text-neutral-200"
                }`}
                title={isSpeaking ? "Остановить чтение" : "Озвучить сцену"}
              >
                <Volume2 className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Озвучить</span>
              </button>
            </div>

            <div className="flex items-center gap-2">
              {/* Scene Focus Selector */}
              <div className="flex items-center gap-1">
                <span className="text-[11px] text-neutral-500 hidden sm:inline">Фокус:</span>
                <select
                  value={gameState.currentFocus}
                  onChange={(e) => onChangeFocus(e.target.value as SceneFocus)}
                  className="px-2 py-1 rounded-lg bg-neutral-950/80 border border-neutral-800 text-xs text-purple-300 focus:outline-none focus:border-purple-500"
                >
                  <option value={SceneFocus.GENERAL}>⚖️ Сбалансированно</option>
                  <option value={SceneFocus.ACTION}>⚔️ Экшен & Схватка</option>
                  <option value={SceneFocus.DIALOGUE}>💬 Диалоги & Чувства</option>
                  <option value={SceneFocus.CRISIS}>⚡ Острый цейтнот</option>
                  <option value={SceneFocus.EXPLORATION}>🔍 Исследование & Лор</option>
                </select>
              </div>

              {/* Zen Reading Mode Toggle */}
              <button
                id="btn-scene-zen-toggle"
                onClick={() => {
                  sound.playClick();
                  setIsZenMode(!isZenMode);
                }}
                className={`px-2.5 py-1 rounded-lg border text-xs font-semibold flex items-center gap-1.5 transition-all ${
                  isZenMode
                    ? "bg-purple-600 text-white border-purple-500 shadow-md"
                    : "bg-neutral-950/80 hover:bg-neutral-800 border-neutral-800 text-purple-300 hover:text-purple-200"
                }`}
                title="Полноэкранный режим чтения: скрыть лишний интерфейс и оставить только текст и строку действия (Клавиша F или Esc)"
              >
                {isZenMode ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
                <span className="hidden sm:inline">{isZenMode ? "Показать HUD" : "Скрыть HUD"}</span>
              </button>
            </div>
          </div>

          {/* Speaker Header (if character is talking) */}
          {gameState.dialogueSpeaker && (
            <div className="flex items-center gap-3 pb-2">
              {activeSpeakerChar ? (
                <img
                  src={activeSpeakerChar.avatar}
                  alt={gameState.dialogueSpeaker}
                  className="w-10 h-10 rounded-full object-cover ring-2 ring-purple-500 shadow-md"
                />
              ) : (
                <div className="w-10 h-10 rounded-full bg-purple-900/60 flex items-center justify-center text-purple-300 font-bold">
                  {gameState.dialogueSpeaker[0]}
                </div>
              )}
              <div>
                <span className="text-xs uppercase tracking-wider text-purple-400 font-bold">
                  Говорит персонаж
                </span>
                <h4 className="font-cinzel text-base font-bold text-neutral-100">
                  {gameState.dialogueSpeaker}
                </h4>
              </div>
            </div>
          )}

          {/* Scene Body Text */}
          <div className={`font-story ${FONT_SIZES[fontSize]} text-neutral-200 whitespace-pre-line tracking-wide selection:bg-purple-600/40`}>
            {gameState.currentScene}
          </div>

          {/* Google Search Grounding & Canon Sources Badge */}
          {((gameState.history[gameState.history.length - 1]?.groundingSources &&
            gameState.history[gameState.history.length - 1].groundingSources!.length > 0) ||
            (gameState.lastGroundingSources && gameState.lastGroundingSources.length > 0)) && (
            <div className="mt-4 p-3 rounded-xl bg-cyan-950/40 border border-cyan-800/50 text-xs text-cyan-200/90 space-y-1.5 animate-fade-in shadow-sm">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 font-semibold text-cyan-300 text-[11px]">
                  <Globe className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                  <span>Канон и факты подтверждены Google Search Grounding:</span>
                </div>
                <button
                  onClick={() => setShowUniverseModal(true)}
                  className="text-[10px] text-cyan-400 hover:text-cyan-200 hover:underline flex items-center gap-1"
                >
                  <span>Вселенная: {gameState.universeSetting?.universeName || "Сеттинг"}</span>
                </button>
              </div>
              <div className="flex flex-wrap gap-1.5 pt-0.5">
                {(
                  gameState.history[gameState.history.length - 1]?.groundingSources ||
                  gameState.lastGroundingSources ||
                  []
                ).map((src, i) => (
                  <a
                    key={i}
                    href={src.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-cyan-900/60 hover:bg-cyan-800/80 border border-cyan-700/60 text-[11px] text-cyan-100 transition-colors"
                  >
                    <span className="truncate max-w-[200px]">{src.title || src.url}</span>
                    <ExternalLink className="w-2.5 h-2.5 opacity-70 shrink-0" />
                  </a>
                ))}
              </div>
            </div>
          )}

          <div ref={sceneEndRef} />

          {/* AI Game Master Thinking Indicator */}
          {gameState.isLoading && (
            <div className="flex items-center gap-3 py-4 px-5 rounded-xl bg-purple-950/40 border border-purple-800/40 text-purple-200 text-xs animate-pulse">
              <Sparkles className="w-4 h-4 text-purple-400 animate-spin" />
              <span>
                ИИ Game Master осмысляет ваши действия и ткёт нити сюжета...
              </span>
            </div>
          )}
        </div>

        {/* Story Ending Card */}
        {gameState.isEnding && (
          <div className="p-6 sm:p-8 rounded-2xl border border-amber-500/50 bg-gradient-to-r from-amber-950/40 via-neutral-900 to-purple-950/40 text-center space-y-4 shadow-2xl">
            <Trophy className="w-12 h-12 text-amber-400 mx-auto animate-bounce" />
            <h3 className="font-cinzel text-2xl font-bold text-amber-300">
              {gameState.endingTitle || "Финал Истории Достигнут!"}
            </h3>
            <p className="text-xs sm:text-sm text-neutral-300 max-w-lg mx-auto">
              Вы завершили это незабываемое приключение! Вы можете продолжить в свободной форме
              или вернуться в каталог, чтобы начать новую историю.
            </p>
            <div className="flex justify-center gap-3 pt-2">
              <button
                onClick={() => {
                  sound.playClick();
                  onExitToCatalog();
                }}
                className="px-6 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-semibold"
              >
                Вернуться в Каталог
              </button>
            </div>
          </div>
        )}

        {/* Choices & Interaction Section */}
        {!gameState.isEnding && (
          <div className="space-y-3 pt-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="font-cinzel text-sm font-bold text-neutral-300 uppercase tracking-wider flex items-center gap-2">
                <Flame className="w-4 h-4 text-purple-400" />
                Варианты развития
              </h3>

              {!isZenMode && (
                <div className="flex flex-wrap items-center gap-1.5">
                  {/* Tactical Combo & Minigame Modal Button */}
                  <button
                    id="btn-open-tactical-combo"
                    onClick={() => {
                      sound.playClick();
                      setShowTacticalModal(true);
                    }}
                    className="px-2.5 py-1 rounded-lg bg-gradient-to-r from-rose-950/80 to-amber-950/80 hover:from-rose-900 hover:to-amber-900 border border-rose-700/60 text-rose-200 text-xs font-semibold flex items-center gap-1.5 shadow-sm transition-all hover:scale-[1.02] active:scale-[0.98]"
                    title="Описать красивый тактический выпад, дуэль или решительный шаг"
                  >
                    <Swords className="w-3.5 h-3.5 text-rose-400" />
                    <span>⚔️ Решающий манёвр</span>
                  </button>

                  {/* Canon Divergence / What-If Twist Button */}
                  <button
                    id="btn-open-canon-divergence"
                    onClick={() => {
                      sound.playClick();
                      setShowDivergenceModal(true);
                    }}
                    className="px-2.5 py-1 rounded-lg bg-gradient-to-r from-indigo-950/80 to-purple-950/80 hover:from-indigo-900 hover:to-purple-900 border border-indigo-700/60 text-indigo-200 text-xs font-semibold flex items-center gap-1.5 shadow-sm transition-all hover:scale-[1.02] active:scale-[0.98]"
                    title="Вплести неожиданный поворот сюжета или изменить ход событий"
                  >
                    <GitBranch className="w-3.5 h-3.5 text-indigo-400" />
                    <span>🌀 Сюжетный поворот</span>
                  </button>

                  {/* AI Muse Trigger Button */}
                  <button
                    id="btn-ai-muse"
                    onClick={() => {
                      sound.playClick();
                      setShowAiMuse(true);
                    }}
                    className="px-2.5 py-1 rounded-lg bg-purple-950/80 hover:bg-purple-900/80 border border-purple-700/60 text-purple-300 text-xs font-semibold flex items-center gap-1.5 shadow-sm transition-all"
                    title="Подсказка Музы: совет по развитию сюжета или диалогу"
                  >
                    <Lightbulb className="w-3.5 h-3.5 text-amber-400" />
                    <span>💡 Муза</span>
                  </button>
                </div>
              )}
            </div>

            {/* Choices Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {gameState.currentChoices.map((choice, idx) => {
                return (
                  <button
                    key={choice.id || idx}
                    id={`btn-game-choice-${choice.id || idx}`}
                    disabled={gameState.isLoading}
                    onClick={() => {
                      sound.playChoice();
                      onExecuteChoice(choice);
                    }}
                    className={`group relative p-4 rounded-xl border text-left transition-all duration-200 flex items-start gap-3 ${
                      !gameState.isLoading
                        ? "bg-neutral-900/80 hover:bg-purple-950/50 border-neutral-800 hover:border-purple-600/80 hover:scale-[1.01] active:scale-[0.99] shadow-md hover:shadow-purple-950/40"
                        : "bg-neutral-900/30 border-neutral-800/40 opacity-50 cursor-not-allowed"
                    }`}
                  >
                    <div className="mt-0.5">{getChoiceIcon(choice.type)}</div>
                    <div className="space-y-1 flex-1">
                      <div className="text-xs sm:text-sm font-semibold text-neutral-100 group-hover:text-purple-300 transition-colors leading-snug">
                        <span className="text-purple-400 font-mono-code mr-1.5">
                          {idx + 1}.
                        </span>
                        {choice.label}
                      </div>
                      {choice.description && (
                        <p className="text-[11px] text-neutral-400 leading-snug line-clamp-2 font-normal">
                          {choice.description}
                        </p>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Custom Action Form with Multiline & Large Action Support */}
            <form
              onSubmit={handleCustomSubmit}
              className="pt-3 relative flex flex-col gap-2"
            >
              <div className="relative w-full">
                <textarea
                  id="input-custom-action"
                  rows={customActionText.length > 80 || customActionText.includes("\n") ? 3 : 2}
                  value={customActionText}
                  disabled={gameState.isLoading}
                  onChange={(e) => setCustomActionText(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      handleCustomSubmit(e);
                    }
                  }}
                  placeholder="Свободное действие любого объёма: детальный поступок, развёрнутые реплики диалога, тактический манёвр, применение заклинаний или поворот сюжета..."
                  className="w-full bg-neutral-900/95 border border-purple-900/50 hover:border-purple-600/80 rounded-xl pl-4 pr-12 py-2.5 text-xs sm:text-sm text-neutral-100 placeholder-neutral-500 focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500 shadow-lg shadow-purple-950/20 resize-y min-h-[52px] max-h-48 transition-all"
                />
                <button
                  type="submit"
                  disabled={!customActionText.trim() || gameState.isLoading}
                  id="btn-submit-custom-action"
                  className="absolute right-2.5 bottom-3 p-2 rounded-lg bg-purple-600 hover:bg-purple-500 disabled:bg-neutral-800 text-white disabled:text-neutral-500 transition-colors shadow-md"
                  title="Воплотить действие автора в истории (Enter — отправить, Shift+Enter — перенос строки)"
                >
                  <Send className="w-4 h-4" />
                </button>
              </div>

              {customActionText.length > 0 && (
                <div className="flex items-center justify-between text-[11px] px-1 text-neutral-400">
                  <span className="text-purple-300 flex items-center gap-1">
                    <span>⚡</span>
                    {customActionText.length > 150 ? "Развёрнутое действие: ИИ детально воплотит каждый пункт!" : "Нажмите Enter для отправки, Shift+Enter для новой строки"}
                  </span>
                  <span className="text-neutral-500 font-mono text-[10px]">
                    Символов: {customActionText.length}
                  </span>
                </div>
              )}
            </form>

            {/* Quick Inspiration Chips & Creative Omnipotence Note */}
            {!isZenMode && (
              <div className="space-y-1.5 pt-1">
                <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-neutral-400">
                  <span className="text-neutral-500 text-[10px]">Идеи автора:</span>
                  {[
                    "Внезапный поворот сюжета: раскрывается тайна...",
                    "Появление нового персонажа: из тени шагает путник...",
                    "Изменение мира: реальность вокруг трансформируется...",
                    "Использовать скрытую магию или решительный выпад...",
                    "Обратиться к спутникам и изменить маршрут...",
                  ].map((hint, i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => setCustomActionText(hint)}
                      className="px-2 py-0.5 rounded-full bg-neutral-900/80 hover:bg-neutral-800 text-neutral-400 hover:text-neutral-200 border border-neutral-800 text-[10px] transition-colors"
                    >
                      + {hint}
                    </button>
                  ))}
                </div>

                <div className="text-[10px] text-purple-400/80 flex items-center gap-1.5 pl-1">
                  <span>✨</span>
                  <span>Всё, что вы напишете в строку, безоговорочно воплощается ИИ в истории с сохранением памяти всех прошлых глав.</span>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
      )}

      {/* Story Memory Drawer */}
      <StoryMemoryDrawer
        isOpen={showMemoryDrawer}
        onClose={() => setShowMemoryDrawer(false)}
        memoryChapters={gameState.memoryChapters}
        lorebook={gameState.lorebook}
        characters={gameState.characters}
        storyTitle={gameState.story.title}
        customApiKey={customApiKey}
      />

      {/* Chapter Edit Modal */}
      <ChapterEditModal
        isOpen={showChapterEdit}
        onClose={() => {
          setShowChapterEdit(false);
          setEditingTargetStep(null);
          setEditingTargetText("");
        }}
        originalText={
          editingTargetStep !== null && editingTargetText
            ? editingTargetText
            : gameState.currentScene
        }
        stepNumber={
          editingTargetStep !== null ? editingTargetStep : gameState.stepCount
        }
        storyTitle={gameState.story.title}
        customApiKey={customApiKey}
        currentChoices={
          editingTargetStep === null || editingTargetStep === gameState.stepCount
            ? gameState.currentChoices
            : gameState.history.find((h) => h.stepNumber === editingTargetStep)
                ?.choicesGiven || gameState.currentChoices
        }
        onSaveChapter={(text, summary, lore, choices, step, options) => {
          onSaveEditedChapter(text, summary, lore, choices, step, options);
          if (options?.autoAdvanceNextStep) {
            setNotification(
              "Сквозное обновление: следующий шаг истории сгенерирован, стиль автора перенят ИИ!"
            );
          } else {
            setNotification(
              "Глава отредактирована! Варианты выбора пересчитаны, стиль автора передан ИИ."
            );
          }
          setTimeout(() => setNotification(null), 3500);
          setShowChapterEdit(false);
          setEditingTargetStep(null);
          setEditingTargetText("");
        }}
      />

      {/* Branch / What If? Manager */}
      <BranchManagerModal
        isOpen={showBranchManager}
        onClose={() => setShowBranchManager(false)}
        branches={gameState.branches}
        activeBranchId={gameState.activeBranchId}
        currentStep={gameState.stepCount}
        onForkBranch={onForkBranch}
        onSwitchBranch={onSwitchBranch}
      />

      {/* AI Muse Suggestions Modal */}
      <AiMuseModal
        isOpen={showAiMuse}
        onClose={() => setShowAiMuse(false)}
        storyTitle={gameState.story.title}
        genre={gameState.story.genre}
        currentScene={gameState.currentScene}
        characters={gameState.characters}
        customApiKey={customApiKey}
        onApplySuggestion={(suggestion) => setCustomActionText(suggestion)}
      />

      {/* Relationship Graph & Matrix Modal */}
      <RelationshipGraphModal
        isOpen={showRelationshipGraph}
        onClose={() => setShowRelationshipGraph(false)}
        characters={gameState.characters}
        protagonistName="Вы (Главный Герой)"
        karma={gameState.playerStats.karma}
        storyTitle={gameState.story.title}
        customApiKey={customApiKey}
      />

      {/* AI Scene Art Generator Modal */}
      <SceneArtModal
        isOpen={showSceneArtModal}
        onClose={() => setShowSceneArtModal(false)}
        sceneText={gameState.currentScene}
        storyTitle={gameState.story.title}
        genre={gameState.story.genre}
        atmosphere={gameState.atmosphere}
        characters={gameState.characters}
        currentArtUrl={gameState.sceneArtUrl}
        onApplySceneArt={(url) => {
          if (onApplySceneArt) onApplySceneArt(url);
        }}
        customApiKey={customApiKey}
      />

      {/* AI Style Analysis & Improvement Modal */}
      <StyleAnalysisModal
        isOpen={showStyleAnalysisModal}
        onClose={() => setShowStyleAnalysisModal(false)}
        sceneText={gameState.currentScene}
        targetStyle={gameState.narrativeStyle}
        targetPOV={gameState.narrativePOV}
        genre={gameState.story.genre}
        onApplyImprovedText={(improvedText) => {
          if (onApplyImprovedText) {
            onApplyImprovedText(improvedText);
          } else {
            onSaveEditedChapter(
              improvedText,
              "Сцена стилистически отшлифована ИИ-редактором под авторский канон."
            );
          }
        }}
        customApiKey={customApiKey}
      />

      {/* Story & Chapter Export/Import Modal */}
      <StoryExportImportModal
        isOpen={showExportImportModal}
        onClose={() => setShowExportImportModal(false)}
        gameState={gameState}
        onImportGameState={(newState) => {
          if (onImportGameState) {
            onImportGameState(newState);
          }
        }}
        customApiKey={customApiKey}
      />

      {/* Tactical Combat Stance & Minigames Modal */}
      <TacticalActionModal
        isOpen={showTacticalModal}
        onClose={() => setShowTacticalModal(false)}
        currentScene={gameState.currentScene}
        onExecuteCombo={(combo) => {
          if (onExecuteTacticalCombo) {
            onExecuteTacticalCombo(combo);
          }
        }}
        isExecuting={gameState.isLoading}
      />

      {/* Canon Divergence & Event / Character Injector Modal */}
      <CanonDivergenceModal
        isOpen={showDivergenceModal}
        onClose={() => setShowDivergenceModal(false)}
        history={gameState.history}
        currentScene={gameState.currentScene}
        onApplyDivergence={async (payload) => {
          if (onApplyDivergence) {
            await onApplyDivergence(payload);
          }
        }}
        isApplying={gameState.isLoading}
      />

      {/* History & Rollback Modal */}
      {showHistory && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-md animate-fade-in">
          <div className="relative w-full max-w-3xl max-h-[88vh] flex flex-col rounded-2xl bg-neutral-900 border border-neutral-800 shadow-2xl overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between p-4 sm:p-5 border-b border-neutral-800 bg-neutral-950/70">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl bg-purple-950/60 border border-purple-500/40 text-purple-400">
                  <History className="w-5 h-5 text-amber-400" />
                </div>
                <div>
                  <h3 className="font-cinzel text-base sm:text-lg font-bold text-neutral-100 flex items-center gap-2">
                    История Шагов & Откат Повести
                    <span className="text-xs px-2 py-0.5 rounded-full bg-purple-900/60 text-purple-300 font-sans font-medium">
                      {gameState.history.length} записей
                    </span>
                  </h3>
                  <p className="text-xs text-neutral-400">
                    Редактируйте текст любой пройденной главы или откатывайтесь к ключевым развилкам.
                  </p>
                </div>
              </div>
              <button
                onClick={() => {
                  sound.playClick();
                  setShowHistory(false);
                }}
                className="p-1.5 rounded-xl text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* List of Steps */}
            <div className="p-4 sm:p-5 overflow-y-auto space-y-4 max-h-[70vh]">
              {gameState.history.length === 0 ? (
                <div className="p-8 text-center text-xs text-neutral-500 rounded-xl bg-neutral-950/40 border border-neutral-800">
                  История повести только началась. Делайте выборы, чтобы летопись наполнялась шагами!
                </div>
              ) : (
                gameState.history.map((step, idx) => {
                  const isLatest = idx === gameState.history.length - 1;
                  return (
                    <div
                      key={step.id || idx}
                      className={`p-4 rounded-xl border transition-all ${
                        isLatest
                          ? "bg-purple-950/20 border-purple-800/60 shadow-md ring-1 ring-purple-600/30"
                          : "bg-neutral-950/70 border-neutral-800/80 hover:border-neutral-700"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3 pb-2 border-b border-neutral-800/60">
                        <div className="flex items-center gap-2">
                          <span className="px-2 py-0.5 rounded-md bg-neutral-800 text-amber-300 font-mono text-xs font-bold">
                            Шаг #{step.stepNumber}
                          </span>
                          <span className="text-xs font-semibold text-neutral-200 truncate max-w-xs sm:max-w-md">
                            {step.action}
                          </span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          {step.wasEdited && (
                            <span className="text-[10px] px-2 py-0.5 rounded bg-amber-950/80 border border-amber-700/60 text-amber-300 font-mono">
                              ✏️ Отредактировано
                            </span>
                          )}
                          {isLatest && (
                            <span className="text-[10px] px-2 py-0.5 rounded bg-purple-900/80 border border-purple-700/60 text-purple-200 font-semibold">
                              Текущая глава
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Scene Text Preview */}
                      <p className="text-xs text-neutral-300 py-2.5 font-serif line-clamp-4 leading-relaxed whitespace-pre-line">
                        {step.sceneText}
                      </p>

                      {/* Actions */}
                      <div className="flex items-center justify-end gap-2 pt-2 border-t border-neutral-800/50">
                        <button
                          onClick={() => {
                            sound.playClick();
                            setEditingTargetStep(step.stepNumber);
                            setEditingTargetText(step.sceneText);
                            setShowHistory(false);
                            setShowChapterEdit(true);
                          }}
                          className="px-2.5 py-1 rounded-lg bg-amber-950/60 hover:bg-amber-900/70 border border-amber-600/50 text-amber-200 text-xs font-semibold flex items-center gap-1.5 transition-colors"
                          title="Отредактировать текст этой главы"
                        >
                          <Edit3 className="w-3.5 h-3.5 text-amber-400" />
                          <span>Редактировать текст</span>
                        </button>

                        {!isLatest && (
                          <button
                            onClick={() => {
                              sound.playClick();
                              onRollbackStep(idx);
                              setShowHistory(false);
                              setNotification(
                                `Откат сюжета к шагу #${step.stepNumber} выполнен!`
                              );
                              setTimeout(() => setNotification(null), 3000);
                            }}
                            className="px-2.5 py-1 rounded-lg bg-neutral-800 hover:bg-neutral-700 border border-neutral-700 text-neutral-300 text-xs font-semibold flex items-center gap-1.5 transition-colors"
                            title="Откатить сюжет к этому моменту времени"
                          >
                            <RotateCcw className="w-3.5 h-3.5 text-purple-400" />
                            <span>Откатить сюжет сюда</span>
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}

      {/* Floating AI Co-Author Quick Access Button (visible when not in full-page chat view) */}
      {activeGameView !== "chat" && (
        <button
          id="btn-floating-ai-assistant"
          onClick={() => {
            sound.playClick();
            setShowAiChatDrawer(true);
          }}
          style={{
            borderRadius: "17px",
            borderWidth: "2.01627px",
            borderStyle: "solid",
            backgroundColor: "#533232",
            width: "108.9px",
            height: "58.5185px",
          }}
          className="fixed bottom-20 right-4 sm:bottom-6 sm:right-6 z-40 text-white shadow-2xl flex items-center justify-center gap-2 transition-all hover:scale-105 active:scale-95 group overflow-hidden"
          title="Открыть боковую панель ИИ-чат-ассистента для отправки команд и настройки повести"
        >
          <div className="relative shrink-0">
            <Bot className="w-5 h-5 group-hover:rotate-12 transition-transform text-white" />
            <span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-emerald-400 ring-2 ring-purple-900 animate-pulse" />
          </div>
          <div className="flex flex-col text-left shrink-0">
            <span
              style={{ width: "45.1599px" }}
              className="text-xs font-bold leading-tight flex items-center gap-1 overflow-hidden"
            >
              ИИ
              <Sparkles className="w-3 h-3 text-amber-300 shrink-0" />
            </span>
            <span className="text-[10px] text-red-200 hidden sm:inline leading-tight">
              Чат
            </span>
          </div>
        </button>
      )}

      {/* Floating Slide-over AI Co-Author Drawer */}
      <StoryAiChatDrawer
        isOpen={showAiChatDrawer}
        onClose={() => setShowAiChatDrawer(false)}
        gameState={gameState}
        readerTheme={readerTheme}
        customApiKey={customApiKey}
        aiSystemPrompt={aiSystemPrompt}
        aiPromptDirective={aiPromptDirective}
        onExecuteAction={(action) => {
          onExecuteCustomAction(action);
          setShowAiChatDrawer(false);
        }}
        onUpdateNarrativeStyle={(style) => {
          setCurrentNarrativeStyle(style);
          if (onUpdateNarrativeStyle) onUpdateNarrativeStyle(style);
          setNotification(`Стиль повести изменён на: ${style}`);
          setTimeout(() => setNotification(null), 3000);
        }}
        onUpdateGenerationLength={(length) => {
          setCurrentGenLength(length);
          if (onUpdateGenerationLength) onUpdateGenerationLength(length);
          setNotification(`Длина глав изменена: ${length}`);
          setTimeout(() => setNotification(null), 3000);
        }}
        onUpdateGenre={(genre) => {
          if (onUpdateGenre) onUpdateGenre(genre);
          setNotification(`Жанр повести обновлён: ${genre}`);
          setTimeout(() => setNotification(null), 3000);
        }}
        onAddCharacter={(char) => {
          if (onAddCharacter) onAddCharacter(char);
          setNotification(`Новый персонаж добавлен в историю: ${char.name}`);
          setTimeout(() => setNotification(null), 3500);
        }}
        onUpdateCharacter={(char) => {
          if (onUpdateCharacter) onUpdateCharacter(char);
          setNotification(`Отношения и статус обновлены: ${char.name}`);
          setTimeout(() => setNotification(null), 3000);
        }}
        onInjectSceneText={(newText) => {
          onSaveEditedChapter(newText, "Сцена обновлена по согласованию с ИИ-Соавтором");
          setNotification("Сцена успешно обновлена по решению с Соавтором!");
          setTimeout(() => setNotification(null), 3500);
        }}
        onUpdatePromptDirective={(directive) => {
          if (onUpdatePromptDirective) onUpdatePromptDirective(directive);
          setNotification("Директива автора обновлена!");
          setTimeout(() => setNotification(null), 3000);
        }}
        universeSetting={gameState.universeSetting || gameState.story.universeSetting}
        onUpdateUniverseSetting={(newSetting) => {
          if (onUpdateUniverseSetting) onUpdateUniverseSetting(newSetting);
          setNotification(`Вселенная «${newSetting.universeName}» обновлена!`);
          setTimeout(() => setNotification(null), 3500);
        }}
        onAddLorebookEntry={(entry) => {
          if (onAddLorebookEntry) onAddLorebookEntry(entry);
          setNotification(`Факт «${entry.title}» добавлен в лорбук!`);
          setTimeout(() => setNotification(null), 3500);
        }}
        onOpenUniverseModal={() => setShowUniverseModal(true)}
      />

      {/* Universe & Setting Modal with Google Search Grounding */}
      <UniverseSettingModal
        isOpen={showUniverseModal}
        onClose={() => setShowUniverseModal(false)}
        gameState={gameState}
        onUpdateUniverseSetting={(newSetting) => {
          if (onUpdateUniverseSetting) {
            onUpdateUniverseSetting(newSetting);
          }
          setNotification(`Вселенная «${newSetting.universeName}» и правила сеттинга обновлены!`);
          setTimeout(() => setNotification(null), 3500);
        }}
        onAddLorebookEntry={(entry) => {
          if (onAddLorebookEntry) {
            onAddLorebookEntry(entry);
          }
          setNotification(`Новая запись лорбука добавлена: ${entry.title}`);
          setTimeout(() => setNotification(null), 3500);
        }}
        customApiKey={customApiKey}
        readerTheme={readerTheme}
      />

      {/* Delete Chapter Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
          <div className="relative w-full max-w-md p-6 rounded-2xl bg-neutral-900 border border-neutral-800 shadow-2xl space-y-4">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-rose-950/60 border border-rose-800/40 text-rose-400">
                <Trash2 className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-cinzel text-base font-bold text-neutral-100">
                  Удалить текущую главу?
                </h3>
                <p className="text-xs text-neutral-400">
                  Отменит генерацию шага #{gameState.stepCount} и вернёт историю назад
                </p>
              </div>
            </div>

            <div className="p-3 rounded-xl bg-neutral-950/70 border border-neutral-800 text-xs text-neutral-300 font-serif leading-relaxed line-clamp-3">
              «{gameState.currentScene.slice(0, 160).trim()}...»
            </div>

            <p className="text-xs text-neutral-400 leading-relaxed">
              Текущий текст будет сброшен, а состояние вернётся к предыдущей главе. Вы сможете заново выбрать путь или ввести другое действие.
            </p>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-neutral-800/60">
              <button
                onClick={() => {
                  sound.playClick();
                  setShowDeleteConfirm(false);
                }}
                className="px-4 py-2 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-300 text-xs font-semibold transition-colors"
              >
                Отмена
              </button>
              <button
                onClick={handleConfirmDeleteChapter}
                className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold flex items-center gap-1.5 transition-colors shadow-lg shadow-rose-950/40"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Да, удалить главу</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
