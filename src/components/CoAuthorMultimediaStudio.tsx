import React, { useState, useEffect } from "react";
import {
  Film,
  BookOpen,
  Globe,
  Image as ImageIcon,
  Volume2,
  VolumeX,
  Sparkles,
  Copy,
  Check,
  Send,
  Edit3,
  ExternalLink,
  Play,
  Square,
  Loader2,
  RefreshCw,
  Sliders,
  Camera,
  Music,
  Clapperboard,
  Compass,
  Cloud,
  Layers,
  Swords,
  Theater,
  HelpCircle,
  Plus,
  BookmarkPlus,
  Share2,
} from "lucide-react";
import {
  ActiveGameState,
  Character,
  UniverseSetting,
  LorebookEntry,
} from "../types";
import { sound } from "../utils/audio";
import { safeFetchJson } from "../utils/safeApi";

interface CoAuthorMultimediaStudioProps {
  gameState: ActiveGameState;
  customApiKey?: string;
  universeSetting?: UniverseSetting;
  onInjectSceneText: (newText: string) => void;
  onExecuteAction: (actionLabel: string) => void;
  onAddLorebookEntry?: (entry: LorebookEntry) => void;
  onOpenCloudSync?: () => void;
  onClose?: () => void;
}

export type StudioTab = "scenarios" | "links" | "visuals" | "audio" | "video";

export const CoAuthorMultimediaStudio: React.FC<CoAuthorMultimediaStudioProps> = ({
  gameState,
  customApiKey,
  universeSetting,
  onInjectSceneText,
  onExecuteAction,
  onAddLorebookEntry,
  onOpenCloudSync,
  onClose,
}) => {
  const [activeTab, setActiveTab] = useState<StudioTab>("scenarios");

  // --- 1. Scenario Lab State ---
  const [scenarioFormat, setScenarioFormat] = useState<
    "screenplay" | "branching" | "novel" | "drama" | "beatsheet" | "tactical"
  >("screenplay");
  const [scenarioSize, setScenarioSize] = useState<"short" | "medium" | "epic">("medium");
  const [scenarioFocus, setScenarioFocus] = useState("");
  const [isGeneratingScenario, setIsGeneratingScenario] = useState(false);
  const [generatedScenario, setGeneratedScenario] = useState<any>(null);
  const [copiedScenario, setCopiedScenario] = useState(false);

  // --- 2. Links & Study State ---
  const [studyLinks, setStudyLinks] = useState<any[]>([]);
  const [customSearchQuery, setCustomSearchQuery] = useState("");
  const [newLoreTitle, setNewLoreTitle] = useState("");
  const [newLoreDesc, setNewLoreDesc] = useState("");
  const [loreSavedSuccess, setLoreSavedSuccess] = useState(false);

  // --- 3. Visual Concept Art State ---
  const [visualArtUrl, setVisualArtUrl] = useState<string | null>(null);
  const [artPrompt, setArtPrompt] = useState<string>("");
  const [artNotes, setArtNotes] = useState<string>("");
  const [selectedArtStyle, setSelectedArtStyle] = useState("cinematic digital painting");
  const [isGeneratingArt, setIsGeneratingArt] = useState(false);
  const [extractedSensoryDetails, setExtractedSensoryDetails] = useState<string[]>([]);
  const [narrativeInjection, setNarrativeInjection] = useState<string>("");

  // --- 4. Audio & Soundscapes State ---
  const [activeSoundscape, setActiveSoundscape] = useState<string>("none");
  const [isSpeakingTts, setIsSpeakingTts] = useState(false);
  const [audioMarkersCopied, setAudioMarkersCopied] = useState(false);

  const currentUniverse =
    universeSetting ||
    gameState.universeSetting || {
      universeName: gameState.story.fandomSource || gameState.story.genre,
      settingDescription: gameState.story.synopsis,
      worldRules: [],
      factions: [],
      canonStrictness: "adaptive",
      searchGroundingEnabled: true,
    };

  // Preload scenario on first visit
  useEffect(() => {
    handleGenerateScenario(false);
  }, [scenarioFormat, scenarioSize]);

  // Generate Scenario Handler
  const handleGenerateScenario = async (playSfx: boolean = true) => {
    if (playSfx) sound.playClick();
    setIsGeneratingScenario(true);

    try {
      const res = await safeFetchJson<any>("/api/story/scenario-lab", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(customApiKey ? { "x-custom-api-key": customApiKey } : {}),
        },
        body: JSON.stringify({
          scenarioFormat,
          scenarioSize,
          storyTitle: gameState.story.title,
          genre: gameState.story.genre,
          currentScene: gameState.currentScene,
          characters: gameState.characters,
          universeSetting: currentUniverse,
          focusGoal: scenarioFocus || undefined,
          customKey: customApiKey,
        }),
      });

      if (res.ok && res.data) {
        setGeneratedScenario(res.data);
        if (Array.isArray(res.data.studyLinks)) {
          setStudyLinks(res.data.studyLinks);
        }
        if (playSfx) sound.playChoice();
      }
    } catch (err) {
      console.warn("Scenario generation error:", err);
    } finally {
      setIsGeneratingScenario(false);
    }
  };

  // Generate Concept Art
  const handleGenerateVisualArt = async () => {
    sound.playClick();
    setIsGeneratingArt(true);

    try {
      const res = await safeFetchJson<any>("/api/ai/generate-scene-art", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(customApiKey ? { "x-custom-api-key": customApiKey } : {}),
        },
        body: JSON.stringify({
          sceneText: gameState.currentScene,
          storyTitle: gameState.story.title,
          genre: gameState.story.genre,
          atmosphere: gameState.story.atmosphere || "dramatic",
          characters: gameState.characters,
          artStyle: selectedArtStyle,
          customKey: customApiKey,
        }),
      });

      if (res.ok && res.data) {
        sound.playFanfare();
        setVisualArtUrl(res.data.imageUrl);
        setArtPrompt(res.data.prompt || "");
        setArtNotes(res.data.artNotes || "Визуальная концепция текущей сцены");

        // Extract sensory details
        const mediaRes = await safeFetchJson<any>("/api/story/extract-media-details", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(customApiKey ? { "x-custom-api-key": customApiKey } : {}),
          },
          body: JSON.stringify({
            mediaNotes: `${res.data.prompt} (${selectedArtStyle})`,
            sceneContext: gameState.currentScene,
            universeName: currentUniverse.universeName,
            customKey: customApiKey,
          }),
        });

        if (mediaRes.ok && mediaRes.data) {
          setExtractedSensoryDetails(mediaRes.data.sensoryDetails || []);
          setNarrativeInjection(mediaRes.data.narrativeInjection || "");
        }
      }
    } catch (e) {
      console.warn("Visual art generation error:", e);
    } finally {
      setIsGeneratingArt(false);
    }
  };

  // Copy Scenario text
  const handleCopyScenario = () => {
    if (!generatedScenario?.content) return;
    navigator.clipboard.writeText(generatedScenario.content);
    setCopiedScenario(true);
    sound.playClick();
    setTimeout(() => setCopiedScenario(false), 2000);
  };

  // Soundscape Play/Stop
  const handleToggleSoundscape = (track: string) => {
    sound.playClick();
    if (activeSoundscape === track) {
      sound.stopAmbient();
      setActiveSoundscape("none");
    } else {
      sound.ambientEnabled = true;
      sound.setAmbient(track);
      setActiveSoundscape(track);
    }
  };

  // TTS Narrator
  const handleToggleTts = () => {
    sound.playClick();
    if (isSpeakingTts) {
      sound.stopSpeaking();
      setIsSpeakingTts(false);
    } else {
      setIsSpeakingTts(true);
      const textToSpeak = generatedScenario?.content || gameState.currentScene;
      sound.speakScene(textToSpeak, () => {
        setIsSpeakingTts(false);
      });
    }
  };

  // Add lore entry
  const handleSaveLoreEntry = () => {
    if (!newLoreTitle.trim() || !newLoreDesc.trim() || !onAddLorebookEntry) return;
    sound.playChoice();
    onAddLorebookEntry({
      id: `lore_custom_${Date.now()}`,
      category: "правило_мира",
      title: newLoreTitle.trim(),
      description: newLoreDesc.trim(),
      discoveredAtStep: gameState.stepCount,
    });
    setNewLoreTitle("");
    setNewLoreDesc("");
    setLoreSavedSuccess(true);
    setTimeout(() => setLoreSavedSuccess(false), 3000);
  };

  return (
    <div className="flex flex-col h-full bg-neutral-950/90 rounded-2xl border border-neutral-800/90 overflow-hidden shadow-2xl animate-fade-in text-neutral-200">
      {/* Studio Header Bar */}
      <div className="p-3 sm:p-4 border-b border-neutral-800 bg-neutral-900/80 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-xl bg-gradient-to-br from-purple-600 to-indigo-700 text-white shadow-md shadow-purple-900/30">
            <Film className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-cinzel text-sm sm:text-base font-bold text-neutral-100">
                Мастерская Соавтора & Мультимедиа
              </h3>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-indigo-950 text-indigo-300 border border-indigo-800/80 font-mono">
                Studio Lab
              </span>
            </div>
            <p className="text-[11px] text-neutral-400">
              Сценарии любых форматов, интернет-источники, визуал, звук и раскадровка
            </p>
          </div>
        </div>

        {/* Global Action Buttons */}
        <div className="flex items-center gap-2">
          {onOpenCloudSync && (
            <button
              onClick={() => {
                sound.playClick();
                onOpenCloudSync();
              }}
              className="px-3 py-1.5 rounded-xl bg-purple-950/80 hover:bg-purple-900 border border-purple-700/80 text-purple-200 text-xs font-semibold flex items-center gap-1.5 transition-all shadow-sm"
              title="Перенести всю историю и обсуждения на телефон или другое устройство"
            >
              <Cloud className="w-3.5 h-3.5 text-purple-400" />
              <span className="hidden sm:inline">Перенос на телефон</span>
            </button>
          )}

          {onClose && (
            <button
              onClick={() => {
                sound.playClick();
                onClose();
              }}
              className="p-1.5 rounded-xl text-neutral-400 hover:text-white hover:bg-neutral-800 transition-colors"
            >
              ✕
            </button>
          )}
        </div>
      </div>

      {/* Workshop Navigation Tabs */}
      <div className="flex items-center gap-1 p-2 bg-neutral-900/40 border-b border-neutral-800/80 overflow-x-auto no-scrollbar">
        <button
          onClick={() => {
            sound.playClick();
            setActiveTab("scenarios");
          }}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all shrink-0 ${
            activeTab === "scenarios"
              ? "bg-purple-600 text-white shadow-md shadow-purple-900/40"
              : "text-neutral-400 hover:text-neutral-200 hover:bg-neutral-850"
          }`}
        >
          <Film className="w-3.5 h-3.5" />
          <span>Сценарная мастерская</span>
        </button>

        <button
          onClick={() => {
            sound.playClick();
            setActiveTab("links");
          }}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all shrink-0 ${
            activeTab === "links"
              ? "bg-purple-600 text-white shadow-md shadow-purple-900/40"
              : "text-neutral-400 hover:text-neutral-200 hover:bg-neutral-850"
          }`}
        >
          <Globe className="w-3.5 h-3.5" />
          <span>Источники & Канон</span>
        </button>

        <button
          onClick={() => {
            sound.playClick();
            setActiveTab("visuals");
          }}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all shrink-0 ${
            activeTab === "visuals"
              ? "bg-purple-600 text-white shadow-md shadow-purple-900/40"
              : "text-neutral-400 hover:text-neutral-200 hover:bg-neutral-850"
          }`}
        >
          <ImageIcon className="w-3.5 h-3.5" />
          <span>Фото & Концепт-Арт</span>
        </button>

        <button
          onClick={() => {
            sound.playClick();
            setActiveTab("audio");
          }}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all shrink-0 ${
            activeTab === "audio"
              ? "bg-purple-600 text-white shadow-md shadow-purple-900/40"
              : "text-neutral-400 hover:text-neutral-200 hover:bg-neutral-850"
          }`}
        >
          <Volume2 className="w-3.5 h-3.5" />
          <span>Аудио & Саундскейпы</span>
        </button>

        <button
          onClick={() => {
            sound.playClick();
            setActiveTab("video");
          }}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all shrink-0 ${
            activeTab === "video"
              ? "bg-purple-600 text-white shadow-md shadow-purple-900/40"
              : "text-neutral-400 hover:text-neutral-200 hover:bg-neutral-850"
          }`}
        >
          <Clapperboard className="w-3.5 h-3.5" />
          <span>Видео & Раскадровка</span>
        </button>
      </div>

      {/* Main Tab Content */}
      <div className="flex-1 overflow-y-auto p-3 sm:p-5 space-y-4">
        {/* ========================================================================= */}
        {/* TAB 1: SCENARIOS LAB */}
        {/* ========================================================================= */}
        {activeTab === "scenarios" && (
          <div className="space-y-4 animate-fade-in">
            {/* Format & Size Controls Card */}
            <div className="p-3 sm:p-4 rounded-2xl bg-neutral-900/70 border border-neutral-800 space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <span className="text-xs font-bold text-neutral-200 flex items-center gap-1.5">
                  <Sliders className="w-3.5 h-3.5 text-purple-400" />
                  Выберите формат сценарной формы:
                </span>
                <span className="text-[11px] text-neutral-400">
                  Вселенная: <b className="text-purple-300">{currentUniverse.universeName}</b>
                </span>
              </div>

              {/* Format Pills */}
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2">
                {[
                  { id: "screenplay", label: "Киносценарий", icon: Film, desc: "Sluglines, ремарки" },
                  { id: "branching", label: "Развилка", icon: Layers, desc: "Ветки со ставками" },
                  { id: "novel", label: "Проза & Роман", icon: BookOpen, desc: "Сенсорные якоря" },
                  { id: "drama", label: "Пьеса & Драма", icon: Theater, desc: "Сценический диалог" },
                  { id: "beatsheet", label: "Бит-шит", icon: Clapperboard, desc: "Save the Cat" },
                  { id: "tactical", label: "Тактический бой", icon: Swords, desc: "Схватка & навыки" },
                ].map((fmt) => {
                  const Icon = fmt.icon;
                  const isActive = scenarioFormat === fmt.id;
                  return (
                    <button
                      key={fmt.id}
                      onClick={() => {
                        sound.playClick();
                        setScenarioFormat(fmt.id as any);
                      }}
                      className={`p-2 rounded-xl border text-left transition-all ${
                        isActive
                          ? "bg-purple-950/80 border-purple-500 text-white shadow-md shadow-purple-950/40"
                          : "bg-neutral-950/50 border-neutral-800/80 text-neutral-400 hover:text-neutral-200 hover:bg-neutral-900"
                      }`}
                    >
                      <div className="flex items-center gap-1.5 mb-1">
                        <Icon className={`w-3.5 h-3.5 ${isActive ? "text-purple-400" : "text-neutral-500"}`} />
                        <span className="text-xs font-bold truncate">{fmt.label}</span>
                      </div>
                      <span className="text-[10px] text-neutral-500 block truncate">{fmt.desc}</span>
                    </button>
                  );
                })}
              </div>

              {/* Size & Focus Row */}
              <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-neutral-800/60">
                <div className="flex items-center gap-2 text-xs">
                  <span className="text-neutral-400 text-[11px]">Масштаб:</span>
                  {(["short", "medium", "epic"] as const).map((s) => (
                    <button
                      key={s}
                      onClick={() => {
                        sound.playClick();
                        setScenarioSize(s);
                      }}
                      className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-colors ${
                        scenarioSize === s
                          ? "bg-purple-600 text-white"
                          : "bg-neutral-950/60 text-neutral-400 hover:text-neutral-200 border border-neutral-800"
                      }`}
                    >
                      {s === "short" ? "Краткий" : s === "medium" ? "Стандарт" : "Монументальный"}
                    </button>
                  ))}
                </div>

                <button
                  onClick={() => handleGenerateScenario(true)}
                  disabled={isGeneratingScenario}
                  className="px-3.5 py-1.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold flex items-center gap-1.5 shadow-md shadow-purple-900/30 transition-all hover:scale-105 disabled:opacity-50"
                >
                  {isGeneratingScenario ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <RefreshCw className="w-3.5 h-3.5" />
                  )}
                  <span>Сгенерировать по текущей сцене</span>
                </button>
              </div>
            </div>

            {/* Generated Scenario Display Card */}
            {generatedScenario && (
              <div className="p-4 sm:p-5 rounded-2xl bg-neutral-900/90 border border-purple-900/40 shadow-xl space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-neutral-800 pb-2.5">
                  <div>
                    <h4 className="font-cinzel text-sm sm:text-base font-bold text-neutral-100 flex items-center gap-2">
                      <Sparkles className="w-4 h-4 text-purple-400" />
                      {generatedScenario.title || "Образец сценария"}
                    </h4>
                    <p className="text-[11px] text-neutral-400">
                      {generatedScenario.formattingNotes}
                    </p>
                  </div>

                  {/* Actions on Generated Scenario */}
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={handleCopyScenario}
                      className="px-2.5 py-1.5 rounded-lg bg-neutral-800 hover:bg-neutral-750 text-neutral-300 text-xs font-semibold flex items-center gap-1 transition-colors"
                      title="Скопировать сценарий в буфер обмена"
                    >
                      {copiedScenario ? (
                        <>
                          <Check className="w-3.5 h-3.5 text-emerald-400" />
                          <span className="text-emerald-300">Скопировано</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3.5 h-3.5" />
                          <span>Копировать</span>
                        </>
                      )}
                    </button>

                    <button
                      onClick={() => {
                        sound.playAction("magic");
                        onInjectSceneText(generatedScenario.content);
                      }}
                      className="px-3 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-500 text-white text-xs font-bold flex items-center gap-1 shadow-md shadow-amber-950/40 transition-all hover:scale-105"
                      title="Вставить сценарный текст прямо в текущую главу книги"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                      <span>Вставить в главу</span>
                    </button>

                    <button
                      onClick={() => {
                        sound.playAction("click");
                        onExecuteAction(
                          `Развивать сцену по сценарию: «${generatedScenario.title}»`
                        );
                      }}
                      className="px-3 py-1.5 rounded-lg bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold flex items-center gap-1 shadow-md shadow-purple-950/40 transition-all hover:scale-105"
                      title="Запустить этот сценарий как следующий шаг автора"
                    >
                      <Send className="w-3.5 h-3.5" />
                      <span>Сделать ходом</span>
                    </button>
                  </div>
                </div>

                {/* Scenario Script Body */}
                <div className="p-3.5 sm:p-4 rounded-xl bg-neutral-950 border border-neutral-800/80 font-mono text-xs sm:text-sm text-neutral-200 whitespace-pre-wrap leading-relaxed max-h-[360px] overflow-y-auto select-text shadow-inner">
                  {generatedScenario.content}
                </div>

                {/* Directing Cues & Audio Markers Footer */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs pt-2">
                  {generatedScenario.visualCues && (
                    <div className="p-2.5 rounded-xl bg-neutral-950/60 border border-neutral-800">
                      <span className="text-[10px] uppercase font-bold text-cyan-400 block mb-1">
                        Визуальные маркеры сцены:
                      </span>
                      <ul className="list-disc list-inside text-neutral-300 space-y-0.5 text-[11px]">
                        {generatedScenario.visualCues.map((v: string, i: number) => (
                          <li key={i}>{v}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {generatedScenario.audioCues && (
                    <div className="p-2.5 rounded-xl bg-neutral-950/60 border border-neutral-800">
                      <span className="text-[10px] uppercase font-bold text-amber-400 block mb-1">
                        Аудио и звуковые эффекты:
                      </span>
                      <p className="text-[11px] text-neutral-300 mb-1">
                        Темп: {generatedScenario.audioCues.suggestedBpm} BPM | Трек: «
                        {generatedScenario.audioCues.soundscapeTrack}»
                      </p>
                      <div className="flex flex-wrap gap-1">
                        {(generatedScenario.audioCues.sfxMarkers || []).map(
                          (sfx: string, i: number) => (
                            <span
                              key={i}
                              className="px-2 py-0.5 rounded-md bg-neutral-900 border border-neutral-750 text-[10px] text-amber-200"
                            >
                              🔊 {sfx}
                            </span>
                          )
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ========================================================================= */}
        {/* TAB 2: LINKS & CANON STUDY */}
        {/* ========================================================================= */}
        {activeTab === "links" && (
          <div className="space-y-4 animate-fade-in">
            <div className="p-3.5 sm:p-4 rounded-2xl bg-neutral-900/70 border border-neutral-800 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="font-cinzel text-sm sm:text-base font-bold text-neutral-100 flex items-center gap-1.5">
                    <Globe className="w-4 h-4 text-cyan-400" />
                    База источников и глубокого изучения канона
                  </h4>
                  <p className="text-[11px] text-neutral-400">
                    Прямые ссылки на энциклопедии, сценарные базы и архивы для проверки фактов
                  </p>
                </div>
              </div>

              {/* Curated Links Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
                {studyLinks.map((link, idx) => (
                  <a
                    key={idx}
                    href={link.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-3 rounded-xl bg-neutral-950 hover:bg-neutral-900 border border-neutral-800 hover:border-cyan-600/70 transition-all flex flex-col justify-between group shadow-sm"
                  >
                    <div>
                      <div className="flex items-center justify-between gap-1 mb-1">
                        <span className="font-bold text-xs text-neutral-200 group-hover:text-cyan-300 transition-colors truncate">
                          {link.title}
                        </span>
                        <ExternalLink className="w-3.5 h-3.5 text-neutral-500 group-hover:text-cyan-400 shrink-0" />
                      </div>
                      <p className="text-[11px] text-neutral-400 leading-snug line-clamp-2">
                        {link.description}
                      </p>
                    </div>
                    <span className="text-[9px] uppercase tracking-wider text-cyan-500 font-mono mt-2">
                      {link.category}
                    </span>
                  </a>
                ))}
              </div>
            </div>

            {/* Quick Lorebook Fact Insertion */}
            <div className="p-3.5 sm:p-4 rounded-2xl bg-neutral-900/70 border border-neutral-800 space-y-3">
              <span className="text-xs font-bold text-neutral-200 flex items-center gap-1.5">
                <BookmarkPlus className="w-3.5 h-3.5 text-emerald-400" />
                Зафиксировать проверенный каноничный факт в Лорбук книги:
              </span>

              <div className="space-y-2">
                <input
                  type="text"
                  value={newLoreTitle}
                  onChange={(e) => setNewLoreTitle(e.target.value)}
                  placeholder="Заголовок факта (например: Серебряный меч Школы Волка)"
                  className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-3 py-1.5 text-xs text-neutral-100 placeholder-neutral-500 focus:outline-none focus:border-purple-600"
                />
                <textarea
                  value={newLoreDesc}
                  onChange={(e) => setNewLoreDesc(e.target.value)}
                  rows={2}
                  placeholder="Точное описание закона мира, правила магии или фракционного правила..."
                  className="w-full bg-neutral-950 border border-neutral-800 rounded-xl p-3 text-xs text-neutral-100 placeholder-neutral-500 focus:outline-none focus:border-purple-600"
                />
                <div className="flex justify-between items-center">
                  {loreSavedSuccess && (
                    <span className="text-xs text-emerald-400 flex items-center gap-1">
                      <Check className="w-3.5 h-3.5" /> Факт добавлен в память повести!
                    </span>
                  )}
                  <button
                    onClick={handleSaveLoreEntry}
                    disabled={!newLoreTitle.trim() || !newLoreDesc.trim()}
                    className="ml-auto px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white text-xs font-bold flex items-center gap-1.5 shadow-md shadow-emerald-950/40 transition-all"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Добавить в Лорбук</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* TAB 3: VISUAL ART & SENSORY EXTRACTION */}
        {/* ========================================================================= */}
        {activeTab === "visuals" && (
          <div className="space-y-4 animate-fade-in">
            <div className="p-3.5 sm:p-4 rounded-2xl bg-neutral-900/70 border border-neutral-800 space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <h4 className="font-cinzel text-sm sm:text-base font-bold text-neutral-100 flex items-center gap-1.5">
                    <Camera className="w-4 h-4 text-purple-400" />
                    Генератор концепт-арта и визуальная детализация
                  </h4>
                  <p className="text-[11px] text-neutral-400">
                    Создавайте образ сцены и извлекайте текстуры, освещение и материалы для текста
                  </p>
                </div>

                <button
                  onClick={handleGenerateVisualArt}
                  disabled={isGeneratingArt}
                  className="px-4 py-2 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white text-xs font-bold flex items-center gap-1.5 shadow-md shadow-purple-900/40 transition-all hover:scale-105 disabled:opacity-50"
                >
                  {isGeneratingArt ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Sparkles className="w-3.5 h-3.5" />
                  )}
                  <span>Сгенерировать арт сцены</span>
                </button>
              </div>

              {/* Style Presets */}
              <div className="flex flex-wrap gap-1.5 text-xs">
                <span className="text-neutral-400 text-[11px] self-center mr-1">Стиль:</span>
                {[
                  "cinematic digital painting",
                  "dark fantasy photorealistic",
                  "cyberpunk neon atmosphere",
                  "anime Makoto Shinkai style",
                  "classic Renaissance oil canvas",
                ].map((st) => (
                  <button
                    key={st}
                    onClick={() => {
                      sound.playClick();
                      setSelectedArtStyle(st);
                    }}
                    className={`px-2.5 py-1 rounded-lg text-[10px] font-semibold transition-colors ${
                      selectedArtStyle === st
                        ? "bg-purple-600 text-white"
                        : "bg-neutral-950/60 text-neutral-400 hover:text-neutral-200 border border-neutral-800"
                    }`}
                  >
                    {st.replace(/_/g, " ")}
                  </button>
                ))}
              </div>
            </div>

            {/* Visual Art Result & Sensory Details */}
            {visualArtUrl && (
              <div className="p-4 rounded-2xl bg-neutral-900/90 border border-purple-900/40 space-y-3">
                <div className="relative rounded-xl overflow-hidden max-h-[380px] bg-neutral-950 flex items-center justify-center border border-neutral-800">
                  <img
                    src={visualArtUrl}
                    alt="Visual Concept"
                    className="w-full h-full object-cover object-center max-h-[380px]"
                  />
                  <div className="absolute bottom-0 inset-x-0 p-3 bg-gradient-to-t from-black/90 via-black/50 to-transparent text-xs text-neutral-200">
                    <p className="font-semibold text-white drop-shadow">{artNotes}</p>
                    <p className="text-[10px] text-neutral-400 truncate">{artPrompt}</p>
                  </div>
                </div>

                {/* Extracted Sensory Details & Narrative Injection */}
                {narrativeInjection && (
                  <div className="p-3.5 rounded-xl bg-neutral-950 border border-neutral-800/90 space-y-2">
                    <span className="text-xs font-bold text-amber-300 flex items-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5" />
                      Художественные детали для вставки в главу:
                    </span>
                    <p className="text-xs text-neutral-200 italic leading-relaxed">
                      «{narrativeInjection}»
                    </p>
                    <div className="flex justify-end pt-1">
                      <button
                        onClick={() => {
                          sound.playAction("magic");
                          onInjectSceneText(narrativeInjection);
                        }}
                        className="px-3 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-500 text-white text-xs font-bold flex items-center gap-1 shadow-md transition-all hover:scale-105"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                        <span>Внедрить эти детали в текст главы</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* ========================================================================= */}
        {/* TAB 4: AUDIO & SOUNDSCAPES */}
        {/* ========================================================================= */}
        {activeTab === "audio" && (
          <div className="space-y-4 animate-fade-in">
            <div className="p-3.5 sm:p-4 rounded-2xl bg-neutral-900/70 border border-neutral-800 space-y-3">
              <div>
                <h4 className="font-cinzel text-sm sm:text-base font-bold text-neutral-100 flex items-center gap-1.5">
                  <Volume2 className="w-4 h-4 text-amber-400" />
                  Аудио-генератор и звуковые ландшафты сцены
                </h4>
                <p className="text-[11px] text-neutral-400">
                  Живые синтезированные фоновые звуки Web Audio и дикторская озвучка диалогов
                </p>
              </div>

              {/* Soundscape presets */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 pt-1">
                {[
                  { id: "campfire", title: "Костёр в таверне", desc: "Уютный треск дерева", icon: "🔥" },
                  { id: "dark", title: "Тёмный склеп / Дождь", desc: "Гул и капли влаги", icon: "🌧️" },
                  { id: "cyber", title: "Киберпанк-улица", desc: "Неон и низкий бас", icon: "🌆" },
                  { id: "mystic", title: "Мистический лес", desc: "Колокольчики ветра", icon: "🌲" },
                  { id: "battle", title: "Боевой адреналин", desc: "Ритмичный марш", icon: "⚔️" },
                  { id: "romance", title: "Мелодичный покой", desc: "Мягкие гармоники", icon: "✨" },
                ].map((track) => {
                  const isPlaying = activeSoundscape === track.id;
                  return (
                    <button
                      key={track.id}
                      onClick={() => handleToggleSoundscape(track.id)}
                      className={`p-3 rounded-xl border text-left transition-all ${
                        isPlaying
                          ? "bg-amber-950/80 border-amber-500 text-white shadow-md shadow-amber-950/40"
                          : "bg-neutral-950/50 border-neutral-800 text-neutral-400 hover:text-neutral-200 hover:bg-neutral-900"
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-base">{track.icon}</span>
                        {isPlaying ? (
                          <Square className="w-3.5 h-3.5 text-amber-400 fill-amber-400" />
                        ) : (
                          <Play className="w-3.5 h-3.5 text-neutral-500" />
                        )}
                      </div>
                      <span className="font-bold text-xs block text-neutral-200 truncate">
                        {track.title}
                      </span>
                      <span className="text-[10px] text-neutral-500 block truncate">
                        {track.desc}
                      </span>
                    </button>
                  );
                })}
              </div>

              {/* Narrator Voice Preview */}
              <div className="p-3 rounded-xl bg-neutral-950 border border-neutral-800/80 flex items-center justify-between gap-3 mt-2">
                <div className="flex items-center gap-2">
                  <Music className="w-4 h-4 text-purple-400" />
                  <div>
                    <span className="text-xs font-bold text-neutral-200 block">
                      Голосовой диктор сцены (Speech Synthesis)
                    </span>
                    <span className="text-[10px] text-neutral-500">
                      Прослушать диалог или сцену в живом исполнении
                    </span>
                  </div>
                </div>

                <button
                  onClick={handleToggleTts}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all shadow-md ${
                    isSpeakingTts
                      ? "bg-rose-600 hover:bg-rose-500 text-white"
                      : "bg-purple-600 hover:bg-purple-500 text-white"
                  }`}
                >
                  {isSpeakingTts ? (
                    <>
                      <VolumeX className="w-3.5 h-3.5" />
                      <span>Остановить речь</span>
                    </>
                  ) : (
                    <>
                      <Volume2 className="w-3.5 h-3.5" />
                      <span>Озвучить сцену</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* TAB 5: VIDEO & CINEMATIC STORYBOARD */}
        {/* ========================================================================= */}
        {activeTab === "video" && (
          <div className="space-y-4 animate-fade-in">
            <div className="p-3.5 sm:p-4 rounded-2xl bg-neutral-900/70 border border-neutral-800 space-y-3">
              <div>
                <h4 className="font-cinzel text-sm sm:text-base font-bold text-neutral-100 flex items-center gap-1.5">
                  <Clapperboard className="w-4 h-4 text-purple-400" />
                  Кинематографическая раскадровка и режиссура
                </h4>
                <p className="text-[11px] text-neutral-400">
                  Пошаговая раскадровка сцены по законам киномонтажа и визуального повествования
                </p>
              </div>

              {/* 4-Shot Storyboard Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                {[
                  {
                    shot: "КАДР 1: ОБЩИЙ ПЛАН (ESTABLISHING SHOT)",
                    angle: "Широкоугольный объектив 24mm, панорама",
                    focus: "Окружение, погодные эффекты, масштаб угрозы",
                    desc: "Камера показывает локацию целиком. Зритель считывает атмосферу и расстановку сил.",
                  },
                  {
                    shot: "КАДР 2: СРЕДНИЙ ПЛАН (MEDIUM TWO-SHOT)",
                    angle: "Объектив 50mm, уровень глаз",
                    focus: "Взаимодействие главного героя и спутника",
                    desc: "Позы персонажей, язык тела, расстояние между ними и напряжённый зрительный контакт.",
                  },
                  {
                    shot: "КАДР 3: КРУПНЫЙ ПЛАН (EXTREME CLOSE-UP)",
                    angle: "Объектив 85mm, малая глубина резкости (bokeh)",
                    focus: "Микромимика, напряжение губ, сжатая ладонь",
                    desc: "Фокус на ключевой эмоции перед решающим выбором. Звук приглушается.",
                  },
                  {
                    shot: "КАДР 4: ДИНАМИЧНЫЙ ПЛАН (TRACKING ACTION)",
                    angle: "Ручная камера / стедикам на полной скорости",
                    focus: "Исполнение действия автора в движении",
                    desc: "Резкий рывок, вспышка света, физический контакт или парирование удара.",
                  },
                ].map((item, i) => (
                  <div
                    key={i}
                    className="p-3.5 rounded-xl bg-neutral-950 border border-neutral-800 space-y-1.5"
                  >
                    <span className="text-[11px] font-bold text-purple-300 block">
                      {item.shot}
                    </span>
                    <p className="text-[11px] text-neutral-300 leading-snug">{item.desc}</p>
                    <div className="pt-1 border-t border-neutral-850 flex flex-col gap-0.5 text-[10px] text-neutral-400">
                      <span>🎥 <b>Оптика:</b> {item.angle}</span>
                      <span>🎯 <b>Фокус:</b> {item.focus}</span>
                    </div>
                  </div>
                ))}
              </div>

              {/* Directing Notes */}
              <div className="p-3 rounded-xl bg-neutral-950/70 border border-neutral-850 flex items-center justify-between gap-3 text-xs">
                <span className="text-neutral-300">
                  Хотите изучить режиссуру аналогичных сцен в мировом кинематографе?
                </span>
                <a
                  href={`https://www.youtube.com/results?search_query=${encodeURIComponent(
                    `cinematography scene breakdown analysis ${gameState.story.genre}`
                  )}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-3 py-1.5 rounded-lg bg-neutral-900 hover:bg-neutral-800 border border-neutral-750 text-cyan-300 text-xs font-semibold flex items-center gap-1.5 transition-colors shrink-0"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  <span>Видеоразборы на YouTube</span>
                </a>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
