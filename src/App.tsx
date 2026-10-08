import React, { useState, useEffect } from "react";
import {
  Story,
  ActiveGameState,
  StoryChoice,
  SaveSlot,
  ReaderTheme,
  SceneHistoryItem,
  StoryMemoryChapter,
  LorebookEntry,
  StoryBranch,
  NarrativeStyle,
  NarrativePOV,
  SceneFocus,
  Character,
  UniverseSetting,
} from "./types";
import { PRESET_STORIES } from "./data/presets";
import { Header } from "./components/Header";
import { StoryCatalog } from "./components/StoryCatalog";
import { StoryGameScreen } from "./components/StoryGameScreen";
import { StoryCreatorModal } from "./components/StoryCreatorModal";
import { CharactersModal } from "./components/CharactersModal";
import { SaveLoadModal } from "./components/SaveLoadModal";
import {
  SettingsModal,
  DEFAULT_AI_PROMPT_DIRECTIVE,
  DEFAULT_AI_SYSTEM_PROMPT,
} from "./components/SettingsModal";
import { StoryExportImportModal } from "./components/StoryExportImportModal";
import { InternetUniverseFinderModal } from "./components/InternetUniverseFinderModal";
import { TacticalComboChain, DivergencePayload } from "./types";
import { sound, TrackType } from "./utils/audio";
import { safeFetchJson } from "./utils/safeApi";
import {
  generateClientStoryStepFallback,
  generateClientTacticalFallback,
  generateClientDivergenceFallback,
  StoryStepResponse,
} from "./utils/clientFallbacks";
import { extractAuthorStyleHeuristic } from "./utils/styleAnalyzer";

export default function App() {
  const [activeTab, setActiveTab] = useState<
    "catalog" | "game" | "creator" | "characters" | "saves"
  >(() => {
    try {
      const saved = localStorage.getItem("storyzone_active_tab");
      if (saved && ["catalog", "game", "creator", "characters", "saves"].includes(saved)) {
        return saved as any;
      }
    } catch (e) {}
    return "catalog";
  });

  const [isExportImportOpen, setIsExportImportOpen] = useState(false);
  const [isInternetFinderOpen, setIsInternetFinderOpen] = useState(false);

  // Music BPM & Narrative pacing
  const [musicBpm, setMusicBpm] = useState<number>(() => {
    try {
      const saved = localStorage.getItem("storyzone_music_bpm");
      if (saved) return Number(saved);
    } catch (e) {}
    return 90;
  });

  // Stories list (Presets + User Custom Stories)
  const [stories, setStories] = useState<Story[]>(() => {
    try {
      const saved = localStorage.getItem("storyzone_custom_stories");
      if (saved) {
        const parsed = JSON.parse(saved);
        return [...PRESET_STORIES, ...parsed];
      }
    } catch (e) {}
    return PRESET_STORIES;
  });

  // Active Game State with 100% localStorage persistence
  const [gameState, setGameState] = useState<ActiveGameState | null>(() => {
    try {
      const saved = localStorage.getItem("storyzone_active_game_state");
      if (saved) {
        return JSON.parse(saved);
      }
    } catch (e) {
      console.warn("Failed to parse saved active game state:", e);
    }
    return null;
  });

  // Saved Games Slots
  const [saves, setSaves] = useState<SaveSlot[]>(() => {
    try {
      const saved = localStorage.getItem("storyzone_save_slots");
      if (saved) return JSON.parse(saved);
    } catch (e) {}
    return [];
  });

  // Settings & Theme
  const [readerTheme, setReaderTheme] = useState<ReaderTheme>(() => {
    return (localStorage.getItem("storyzone_theme") as ReaderTheme) || "dark-obsidian";
  });
  const [fontSize, setFontSize] = useState<"sm" | "md" | "lg" | "xl">(() => {
    return (localStorage.getItem("storyzone_font_size") as any) || "md";
  });
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [isAiEnabled, setIsAiEnabled] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  // Advanced Narrative & Memory Settings
  const [customApiKey, setCustomApiKey] = useState<string>(() => {
    return localStorage.getItem("storyzone_custom_api_key") || "";
  });
  const [ultraMemory, setUltraMemory] = useState<boolean>(() => {
    const s = localStorage.getItem("storyzone_ultra_memory");
    return s !== null ? s === "true" : true;
  });
  const [autoSituationMusic, setAutoSituationMusic] = useState<boolean>(() => {
    const s = localStorage.getItem("storyzone_auto_music");
    return s !== null ? s === "true" : true;
  });
  const [aiPromptDirective, setAiPromptDirective] = useState<string>(() => {
    return (
      localStorage.getItem("storyzone_prompt_directive") ||
      DEFAULT_AI_PROMPT_DIRECTIVE
    );
  });
  const [aiSystemPrompt, setAiSystemPrompt] = useState<string>(() => {
    return (
      localStorage.getItem("storyzone_ai_system_prompt") ||
      DEFAULT_AI_SYSTEM_PROMPT
    );
  });

  // Check backend Gemini availability
  useEffect(() => {
    fetch("/api/health", {
      headers: customApiKey ? { "x-custom-api-key": customApiKey } : {},
    })
      .then((r) => r.json())
      .then((data) => {
        setIsAiEnabled(!!data.aiEnabled);
      })
      .catch(() => {
        setIsAiEnabled(false);
      });
  }, [customApiKey]);

  // Sync settings to localStorage
  useEffect(() => {
    localStorage.setItem("storyzone_theme", readerTheme);
  }, [readerTheme]);

  useEffect(() => {
    localStorage.setItem("storyzone_font_size", fontSize);
  }, [fontSize]);

  useEffect(() => {
    localStorage.setItem("storyzone_save_slots", JSON.stringify(saves));
  }, [saves]);

  useEffect(() => {
    localStorage.setItem("storyzone_auto_music", String(autoSituationMusic));
  }, [autoSituationMusic]);

  useEffect(() => {
    try {
      localStorage.setItem("storyzone_prompt_directive", aiPromptDirective);
    } catch (e) {}
  }, [aiPromptDirective]);

  useEffect(() => {
    try {
      localStorage.setItem("storyzone_ai_system_prompt", aiSystemPrompt);
    } catch (e) {}
  }, [aiSystemPrompt]);

  // Sync active game state to localStorage
  useEffect(() => {
    try {
      if (gameState) {
        localStorage.setItem("storyzone_active_game_state", JSON.stringify(gameState));
      } else {
        localStorage.removeItem("storyzone_active_game_state");
      }
    } catch (e) {}
  }, [gameState]);

  // Sync active tab to localStorage
  useEffect(() => {
    try {
      localStorage.setItem("storyzone_active_tab", activeTab);
    } catch (e) {}
  }, [activeTab]);

  // Sync music BPM to localStorage
  useEffect(() => {
    try {
      localStorage.setItem("storyzone_music_bpm", String(musicBpm));
    } catch (e) {}
  }, [musicBpm]);

  // Start new story or switch to existing
  const handleSelectStory = (
    story: Story,
    narrativeOverrides?: {
      style: NarrativeStyle;
      pov: NarrativePOV;
      focus: SceneFocus;
      ultraMemory: boolean;
    }
  ) => {
    if (gameState && gameState.story.id === story.id && !narrativeOverrides) {
      setActiveTab("game");
      return;
    }

    const initialHistory: SceneHistoryItem = {
      id: `step_0`,
      stepNumber: 1,
      action: "Пролог: Начало пути",
      sceneText: story.startingScene,
      timestamp: Date.now(),
      choicesGiven: story.initialChoices,
    };

    const initialMemoryChapter: StoryMemoryChapter = {
      id: `mem_1`,
      chapterNumber: 1,
      title: "Пролог: Вступление",
      summary: story.synopsis || "Герой начинает путь в неизведанном мире.",
      keyFacts: ["Спутники объединились для общей цели"],
      timestamp: Date.now(),
    };

    const initialLorebook: LorebookEntry[] = [
      {
        id: "lore_init",
        title: "Мир: " + story.title,
        category: "правило_мира",
        description: story.synopsis || "Законы и атмосфера вселенной.",
      },
    ];

    const initialUniverseSetting: UniverseSetting = story.universeSetting || {
      universeName: story.fandomSource || story.title,
      settingDescription: story.synopsis || "Уникальный авторский мир со своими законами и тайнами.",
      worldRules: [
        "Действуют законы магии, технологий и социума выбранного сеттинга.",
        "Решения героя влияют на баланс сил и отношение фракций.",
      ],
      factions: ["Главные фракции и обитатели мира"],
      canonStrictness: "adaptive",
      searchGroundingEnabled: true,
    };

    setGameState({
      story,
      currentScene: story.startingScene,
      playerStats: { ...story.startingStats },
      inventory: [...story.startingInventory],
      characters: story.characters.map((c) => ({
        ...c,
        temperament: c.temperament || "сангвиник",
        traits: c.traits || ["Внимательный", "Преданный"],
        habits: c.habits || ["Наблюдает за обстановкой"],
        isLockedTraits: false,
      })),
      history: [initialHistory],
      currentChoices: [...story.initialChoices],
      stepCount: 1,
      atmosphere: story.atmosphere || "mysterious",
      memoryChapters: [initialMemoryChapter],
      lorebook: initialLorebook,
      branches: [],
      activeBranchId: "main",
      narrativeStyle: narrativeOverrides?.style || NarrativeStyle.LITERARY,
      narrativePOV: narrativeOverrides?.pov || NarrativePOV.SECOND,
      currentFocus: narrativeOverrides?.focus || SceneFocus.GENERAL,
      ultraMemory: narrativeOverrides?.ultraMemory ?? ultraMemory,
      suggestedMusic: "mystic",
      universeSetting: initialUniverseSetting,
      isEnding: false,
      isLoading: false,
    });

    setActiveTab("game");
  };

  // Execute a choice or custom action
  const executeStoryStep = async (actionLabel: string) => {
    if (!gameState || gameState.isLoading) return;

    setGameState((prev) => (prev ? { ...prev, isLoading: true } : null));

    try {
      const fallback = generateClientStoryStepFallback(gameState, actionLabel);
      const res = await safeFetchJson<StoryStepResponse>(
        "/api/story/act",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(customApiKey ? { "x-custom-api-key": customApiKey } : {}),
          },
          body: JSON.stringify({
            storyTitle: gameState.story.title,
            genre: gameState.story.genre,
            currentScene: gameState.currentScene,
            history: gameState.history,
            action: actionLabel,
            playerStats: gameState.playerStats,
            characters: gameState.characters,
            inventory: gameState.inventory,
            narrativeStyle: gameState.narrativeStyle,
            generationLength: gameState.generationLength || "medium",
            narrativePOV: gameState.narrativePOV,
            povCompanionName: gameState.povCompanionName,
            sceneFocus: gameState.currentFocus,
            memoryChapters: gameState.memoryChapters,
            lorebook: gameState.lorebook,
            ultraMemory: gameState.ultraMemory,
            universeSetting: gameState.universeSetting || gameState.story.universeSetting,
            searchGroundingEnabled:
              (gameState.universeSetting?.searchGroundingEnabled ?? true),
            musicBpm: musicBpm,
            customKey: customApiKey,
            aiPromptDirective: aiPromptDirective,
            aiSystemPrompt: aiSystemPrompt,
          }),
        },
        fallback
      );

      const data = res.data && res.data.sceneText ? res.data : fallback;

      setGameState((prev) => {
        if (!prev) return null;

        // Calculate stat changes
        const nextHp = Math.max(
          0,
          Math.min(
            prev.playerStats.maxHp,
            prev.playerStats.hp + (data.statChanges?.hp || 0)
          )
        );
        const nextEnergy = Math.max(
          0,
          Math.min(
            prev.playerStats.maxEnergy,
            prev.playerStats.energy + (data.statChanges?.energy || 0)
          )
        );
        const nextGold = Math.max(0, prev.playerStats.gold + (data.statChanges?.gold || 0));

        // Update characters affinity and trait evolution
        let updatedCharacters = prev.characters.map((char) => {
          let updated = { ...char };

          // Affinity change
          const affChange = (data.affinityChanges || []).find(
            (c: any) => c.name.toLowerCase() === char.name.toLowerCase()
          );
          if (affChange) {
            const nextAff = Math.max(0, Math.min(100, char.affinity + (affChange.delta || 0)));
            updated.affinity = nextAff;
          }

          // Trait evolution if not locked by user
          if (!char.isLockedTraits && data.characterEvolution && Array.isArray(data.characterEvolution)) {
            const evo = data.characterEvolution.find(
              (e: any) => e.name.toLowerCase() === char.name.toLowerCase()
            );
            if (evo) {
              const currentTraits = updated.traits ? [...updated.traits] : [];
              if (evo.addedTrait && !currentTraits.includes(evo.addedTrait)) {
                currentTraits.push(evo.addedTrait);
              }
              const currentHabits = updated.habits ? [...updated.habits] : [];
              if (evo.addedHabit && !currentHabits.includes(evo.addedHabit)) {
                currentHabits.push(evo.addedHabit);
              }
              updated.traits = currentTraits;
              updated.habits = currentHabits;
            }
          }

          return updated;
        });

        // Dynamic addition of new characters by user action/world event
        if (data.characterUpdates?.add && Array.isArray(data.characterUpdates.add)) {
          data.characterUpdates.add.forEach((newChar: any) => {
            if (
              newChar.name &&
              !updatedCharacters.some((c) => c.name.toLowerCase() === newChar.name.toLowerCase())
            ) {
              updatedCharacters.push({
                id: `char_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
                name: newChar.name,
                role: newChar.role || "Новое действующее лицо",
                affinity: newChar.affinity ?? 50,
                affinityTitle: newChar.affinityTitle || "Новое знакомство",
                bio: newChar.bio || "Появился по воле автора и разворачивающихся событий",
                avatar: newChar.avatar || "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=400",
                temperament: newChar.temperament || "сангвиник",
                traits: newChar.traits || ["Непредсказуемый"],
                habits: newChar.habits || ["Изучает обстановку"],
                origin: newChar.origin,
                abilities: newChar.abilities,
                merits: newChar.merits,
                currentStatus: newChar.currentStatus,
              });
            }
          });
        }

        // Dynamic removal of characters (if killed, left, or dismissed by user)
        if (data.characterUpdates?.remove && Array.isArray(data.characterUpdates.remove)) {
          const toRemove = data.characterUpdates.remove.map((r: string) => r.toLowerCase().trim());
          updatedCharacters = updatedCharacters.filter(
            (c) => !toRemove.includes(c.name.toLowerCase().trim())
          );
        }

        // Dynamic merits evolution from deeds in this scene
        if (data.characterUpdates?.meritChanges && Array.isArray(data.characterUpdates.meritChanges)) {
          data.characterUpdates.meritChanges.forEach((mc: any) => {
            const char = updatedCharacters.find(
              (c) => c.name.toLowerCase() === (mc.name || "").toLowerCase()
            );
            if (char && mc.newMerit) {
              if (!char.merits) char.merits = [];
              if (!char.merits.includes(mc.newMerit)) {
                char.merits.push(mc.newMerit);
              }
            }
          });
        }

        // Dynamic status/role evolution from deeds in this scene
        if (data.characterUpdates?.statusChanges && Array.isArray(data.characterUpdates.statusChanges)) {
          data.characterUpdates.statusChanges.forEach((sc: any) => {
            const char = updatedCharacters.find(
              (c) => c.name.toLowerCase() === (sc.name || "").toLowerCase()
            );
            if (char && sc.newStatus) {
              char.currentStatus = sc.newStatus;
            }
          });
        }

        // Update inventory
        const updatedInventory = [...prev.inventory];
        if (data.newItems && Array.isArray(data.newItems)) {
          data.newItems.forEach((item: string) => {
            if (!updatedInventory.includes(item)) {
              updatedInventory.push(item);
              sound.playAction("item");
            }
          });
        }

        const newStepNumber = prev.stepCount + 1;
        const newHistoryItem: SceneHistoryItem = {
          id: `step_${newStepNumber}`,
          stepNumber: newStepNumber,
          action: actionLabel,
          sceneText: data.sceneText || prev.currentScene,
          dialogueSpeaker: data.dialogueSpeaker,
          timestamp: Date.now(),
          statChanges: data.statChanges,
          affinityChanges: data.affinityChanges,
          newItems: data.newItems,
          atmosphere: data.atmosphere,
          choicesGiven: data.choices || [],
          groundingSources: data.groundingSources,
        };

        // Update Memory Chapters
        const updatedMemoryChapters = [...prev.memoryChapters];
        if (data.chapterSummary) {
          updatedMemoryChapters.push({
            id: `mem_${newStepNumber}`,
            chapterNumber: updatedMemoryChapters.length + 1,
            title: `Событие #${newStepNumber}`,
            summary: data.chapterSummary,
            keyFacts: [actionLabel],
            timestamp: Date.now(),
          });
        }

        // Update Lorebook
        const updatedLorebook = [...prev.lorebook];
        if (data.newLore && data.newLore.title) {
          const exists = updatedLorebook.some(
            (l) => l.title.toLowerCase() === data.newLore.title.toLowerCase()
          );
          if (!exists) {
            updatedLorebook.push({
              id: `lore_${Date.now()}`,
              title: data.newLore.title,
              description: data.newLore.description || "",
              category: data.newLore.category || "правило_мира",
              discoveredAtStep: newStepNumber,
            });
          }
        }

        // Apply world changes from user action
        if (data.worldChange) {
          updatedLorebook.push({
            id: `lore_world_${Date.now()}`,
            title: "Изменение мира",
            description: data.worldChange,
            category: "правило_мира",
            discoveredAtStep: newStepNumber,
          });
        }

        return {
          ...prev,
          currentScene: data.sceneText || prev.currentScene,
          dialogueSpeaker: data.dialogueSpeaker || undefined,
          playerStats: {
            ...prev.playerStats,
            hp: nextHp,
            energy: nextEnergy,
            gold: nextGold,
          },
          characters: updatedCharacters,
          inventory: updatedInventory,
          history: [...prev.history, newHistoryItem],
          currentChoices: data.choices || prev.currentChoices,
          stepCount: newStepNumber,
          atmosphere: data.atmosphere || prev.atmosphere,
          memoryChapters: updatedMemoryChapters,
          lorebook: updatedLorebook,
          suggestedMusic: (data.suggestedMusic as TrackType) || prev.suggestedMusic,
          isEnding: !!data.isEnding,
          endingTitle: data.endingTitle || null,
          lastGroundingSources: data.groundingSources,
          isLoading: false,
        };
      });

      // Auto-save on each turn
      handleSaveToSlot("slot_auto", false);
    } catch (e) {
      console.error("Story step error:", e);
      setGameState((prev) => (prev ? { ...prev, isLoading: false } : null));
    }
  };

  // Execute tactical combat combo chain
  const handleExecuteTacticalCombo = async (combo: TacticalComboChain) => {
    if (!gameState || gameState.isLoading) return;
    setGameState((prev) => (prev ? { ...prev, isLoading: true } : null));

    try {
      const fallback = generateClientTacticalFallback(gameState, combo);
      const res = await safeFetchJson<any>(
        "/api/story/tactical-action",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(customApiKey ? { "x-custom-api-key": customApiKey } : {}),
          },
          body: JSON.stringify({
            storyTitle: gameState.story.title,
            genre: gameState.story.genre,
            currentScene: gameState.currentScene,
            characters: gameState.characters,
            playerStats: gameState.playerStats,
            inventory: gameState.inventory,
            tacticalCombo: combo,
            musicBpm: musicBpm,
            customKey: customApiKey,
            aiSystemPrompt: aiSystemPrompt,
          }),
        },
        fallback
      );

      const data = res.data && res.data.sceneText ? res.data : fallback;
      setGameState((prev) => {
        if (!prev) return null;

        const nextHp = Math.max(
          0,
          Math.min(
            prev.playerStats.maxHp,
            prev.playerStats.hp + (data.statChanges?.hp || 0)
          )
        );
        const nextEnergy = Math.max(
          0,
          Math.min(
            prev.playerStats.maxEnergy,
            prev.playerStats.energy + (data.statChanges?.energy || 0)
          )
        );
        const nextGold = Math.max(
          0,
          prev.playerStats.gold + (data.statChanges?.gold || 0)
        );

        const newStepNumber = prev.stepCount + 1;
        const newHistoryItem: SceneHistoryItem = {
          id: `step_${newStepNumber}`,
          stepNumber: newStepNumber,
          action: `⚡ [${combo.stanceName}] Комбо связка (${combo.moves.map((m) => m.name).join(" → ")})`,
          sceneText: data.sceneText || prev.currentScene,
          dialogueSpeaker: data.dialogueSpeaker,
          timestamp: Date.now(),
          statChanges: data.statChanges,
          affinityChanges: data.affinityChanges,
          atmosphere: data.atmosphere || "action",
          choicesGiven: data.choices || [],
        };

        const updatedMemoryChapters = [...prev.memoryChapters];
        if (data.chapterSummary) {
          updatedMemoryChapters.push({
            id: `mem_${newStepNumber}`,
            chapterNumber: updatedMemoryChapters.length + 1,
            title: `Тактический триумф #${newStepNumber}`,
            summary: data.chapterSummary,
            keyFacts: [`Стойка: ${combo.stanceName}`, `Ранг стиля: ${combo.styleRank}`],
            timestamp: Date.now(),
          });
        }

        return {
          ...prev,
          currentScene: data.sceneText || prev.currentScene,
          dialogueSpeaker: data.dialogueSpeaker || undefined,
          playerStats: {
            ...prev.playerStats,
            hp: nextHp,
            energy: nextEnergy,
            gold: nextGold,
          },
          history: [...prev.history, newHistoryItem],
          currentChoices: data.choices || prev.currentChoices,
          stepCount: newStepNumber,
          atmosphere: data.atmosphere || "action",
          suggestedMusic: data.suggestedMusic || "battle",
          memoryChapters: updatedMemoryChapters,
          isLoading: false,
        };
      });
      sound.playAction("combat");
    } catch (e) {
      console.error("Failed to execute tactical combo:", e);
      setGameState((prev) => (prev ? { ...prev, isLoading: false } : null));
    }
  };

  // Apply Canon Divergence / Butterfly Effect Twist
  const handleApplyDivergence = async (payload: DivergencePayload) => {
    if (!gameState || gameState.isLoading) return;
    setGameState((prev) => (prev ? { ...prev, isLoading: true } : null));

    try {
      const fallback = generateClientDivergenceFallback(gameState, payload);
      const res = await safeFetchJson<any>(
        "/api/story/inject-divergence",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(customApiKey ? { "x-custom-api-key": customApiKey } : {}),
          },
          body: JSON.stringify({
            storyTitle: gameState.story.title,
            genre: gameState.story.genre,
            currentScene: gameState.currentScene,
            characters: gameState.characters,
            divergencePayload: payload,
            memoryChapters: gameState.memoryChapters,
            customKey: customApiKey,
            aiSystemPrompt: aiSystemPrompt,
          }),
        },
        fallback
      );

      const data = res.data && res.data.sceneText ? res.data : fallback;
      setGameState((prev) => {
        if (!prev) return null;

        const updatedCharacters = [...prev.characters];
        if (payload.type === "inject_character" && payload.characterData) {
          const newChar: Character = {
            id: `char_injected_${Date.now()}`,
            name: payload.characterData.name,
            role: payload.characterData.role,
            affinity: 50,
            affinityTitle: "Знакомый",
            temperament: payload.characterData.temperament || "сангвиник",
            traits: payload.characterData.traits || ["Непредсказуемый", "Таинственный"],
            habits: payload.characterData.habits || ["Наблюдает за развитием событий"],
            speechStyle: payload.characterData.speechStyle || "Выразительный",
            bio: payload.characterData.bio || "Появился из иной вселенной через временную развилку.",
            avatar:
              payload.characterData.avatar ||
              "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=400",
            fandomUniverse: payload.characterData.fandomUniverse,
            isLockedTraits: false,
          };
          updatedCharacters.push(newChar);
        }

        const newStepNumber = prev.stepCount + 1;
        const newHistoryItem: SceneHistoryItem = {
          id: `step_${newStepNumber}`,
          stepNumber: newStepNumber,
          action: `🌀 [Развилка канона: ${payload.title}]`,
          sceneText: data.sceneText || prev.currentScene,
          dialogueSpeaker: data.dialogueSpeaker,
          timestamp: Date.now(),
          atmosphere: data.atmosphere || "mysterious",
          choicesGiven: data.choices || [],
        };

        const updatedMemoryChapters = [...prev.memoryChapters];
        updatedMemoryChapters.push({
          id: `mem_${newStepNumber}`,
          chapterNumber: updatedMemoryChapters.length + 1,
          title: `Развилка: ${payload.title}`,
          summary: data.divergenceSummary || payload.description,
          keyFacts: [`Эффект бабочки: ${payload.type}`, payload.title],
          timestamp: Date.now(),
        });

        return {
          ...prev,
          currentScene: data.sceneText || prev.currentScene,
          dialogueSpeaker: data.dialogueSpeaker || undefined,
          characters: updatedCharacters,
          history: [...prev.history, newHistoryItem],
          currentChoices: data.choices || prev.currentChoices,
          stepCount: newStepNumber,
          atmosphere: data.atmosphere || prev.atmosphere,
          suggestedMusic: data.suggestedMusic || prev.suggestedMusic,
          memoryChapters: updatedMemoryChapters,
          isLoading: false,
        };
      });
      sound.playChoice();
    } catch (e) {
      console.error("Failed to inject divergence:", e);
      setGameState((prev) => (prev ? { ...prev, isLoading: false } : null));
    }
  };

  // Chapter editing with AI memory synchronization, choices adaptation & automatic style mirroring
  const handleSaveEditedChapter = async (
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
  ) => {
    if (!gameState) return;

    const trimmedText = editedText.trim();
    if (!trimmedText) return;

    // 1. Automatic Style Analysis:
    // Extract authorial style from edited text immediately via heuristic analyzer,
    // or use provided extractedStyleDirective, and update aiPromptDirective
    const styleAnalysis = extractAuthorStyleHeuristic(trimmedText);
    const directiveToApply =
      options?.extractedStyleDirective || styleAnalysis.promptDirective;
    if (directiveToApply && directiveToApply.trim()) {
      setAiPromptDirective(directiveToApply);
      try {
        localStorage.setItem("storyzone_prompt_directive", directiveToApply);
      } catch (e) {}
    }

    const currentStepNum = gameState.stepCount;
    const isCurrentChapter =
      targetStepNumber === undefined ||
      targetStepNumber === currentStepNum ||
      gameState.history.length === 0;

    const shouldAutoAdvance = options?.autoAdvanceNextStep ?? false;
    const precomputedNextStep = options?.nextLogicalStep;

    // Fast-path: If next logical step is ALREADY provided (e.g. from ChapterEditModal):
    if (shouldAutoAdvance && precomputedNextStep) {
      setGameState((prev) => {
        if (!prev) return null;

        // 1) Update edited chapter in history
        let updatedHistory = [...prev.history];
        const targetStep = targetStepNumber ?? prev.stepCount;
        const editedHistoryItem: SceneHistoryItem = {
          id: `step_${targetStep}`,
          stepNumber: targetStep,
          action: "Авторская редакция главы",
          sceneText: trimmedText,
          choicesGiven:
            updatedChoices && updatedChoices.length > 0
              ? updatedChoices
              : prev.currentChoices,
          timestamp: Date.now(),
          wasEdited: true,
        };

        if (updatedHistory.length === 0) {
          updatedHistory = [editedHistoryItem];
        } else {
          let matched = false;
          updatedHistory = updatedHistory.map((h) => {
            if (h.stepNumber === targetStep) {
              matched = true;
              return {
                ...h,
                sceneText: trimmedText,
                choicesGiven:
                  updatedChoices && updatedChoices.length > 0
                    ? updatedChoices
                    : h.choicesGiven,
                wasEdited: true,
              };
            }
            return h;
          });
          if (!matched) {
            updatedHistory.push(editedHistoryItem);
          }
        }

        // 2) Update memory chapters
        let updatedMemories = [...prev.memoryChapters];
        const summaryText =
          updatedSummary || trimmedText.slice(0, 200).trim() + "...";
        let foundMem = false;
        updatedMemories = updatedMemories.map((m) => {
          if (m.chapterNumber === targetStep) {
            foundMem = true;
            return { ...m, summary: summaryText };
          }
          return m;
        });
        if (!foundMem) {
          updatedMemories.push({
            id: `mem_${targetStep}`,
            chapterNumber: targetStep,
            title: `Глава #${targetStep}`,
            summary: summaryText,
            keyFacts: ["Текст адаптирован автором"],
            timestamp: Date.now(),
          });
        }

        // 3) Update Lorebook
        const updatedLore = [...prev.lorebook];
        if (newLoreFact && newLoreFact.trim()) {
          const fact = newLoreFact.trim();
          if (
            !updatedLore.some(
              (l) => l.description.toLowerCase() === fact.toLowerCase()
            )
          ) {
            updatedLore.push({
              id: `lore_edit_${Date.now()}`,
              title: "Авторская деталь главы",
              description: fact,
              category: "событие",
              discoveredAtStep: targetStep,
            });
          }
        }

        // 4) Advance to next logical step!
        const nextStepNumber = targetStep + 1;
        const nextHistoryItem: SceneHistoryItem = {
          id: `step_${nextStepNumber}`,
          stepNumber: nextStepNumber,
          action:
            precomputedNextStep.actionLabel ||
            "Сюжетное продолжение авторских правок",
          sceneText: precomputedNextStep.sceneText,
          choicesGiven: precomputedNextStep.choices,
          timestamp: Date.now(),
        };

        // Add memory entry for next step
        updatedMemories.push({
          id: `mem_${nextStepNumber}`,
          chapterNumber: nextStepNumber,
          title: `Глава #${nextStepNumber}`,
          summary: precomputedNextStep.sceneText.slice(0, 180).trim() + "...",
          keyFacts: ["Сюжет адаптирован под авторские правки"],
          timestamp: Date.now(),
        });

        return {
          ...prev,
          stepCount: nextStepNumber,
          currentScene: precomputedNextStep.sceneText,
          currentChoices: precomputedNextStep.choices,
          history: [...updatedHistory, nextHistoryItem],
          memoryChapters: updatedMemories,
          lorebook: updatedLore,
          isLoading: false,
        };
      });

      sound.playChoice();
      return;
    }

    // Apply immediate local changes first so the UI responds instantly
    setGameState((prev) => {
      if (!prev) return null;

      const targetStep = targetStepNumber ?? prev.stepCount;

      // Update history item
      let updatedHistory = [...prev.history];
      if (updatedHistory.length === 0) {
        updatedHistory = [
          {
            id: `step_${prev.stepCount}`,
            stepNumber: prev.stepCount,
            action: "Начало повести (Авторская редакция)",
            sceneText: trimmedText,
            timestamp: Date.now(),
            choicesGiven:
              updatedChoices && updatedChoices.length > 0
                ? updatedChoices
                : prev.currentChoices,
            wasEdited: true,
          },
        ];
      } else {
        let matched = false;
        updatedHistory = updatedHistory.map((item, idx) => {
          const isMatch =
            targetStepNumber !== undefined
              ? item.stepNumber === targetStepNumber
              : idx === updatedHistory.length - 1;

          if (isMatch) {
            matched = true;
            return {
              ...item,
              sceneText: trimmedText,
              choicesGiven:
                updatedChoices && updatedChoices.length > 0
                  ? updatedChoices
                  : item.choicesGiven,
              wasEdited: true,
            };
          }
          return item;
        });

        if (!matched && isCurrentChapter && updatedHistory.length > 0) {
          const lastIdx = updatedHistory.length - 1;
          updatedHistory[lastIdx] = {
            ...updatedHistory[lastIdx],
            sceneText: trimmedText,
            choicesGiven:
              updatedChoices && updatedChoices.length > 0
                ? updatedChoices
                : updatedHistory[lastIdx].choicesGiven,
            wasEdited: true,
          };
        }
      }

      // Update memory chapters
      let updatedMemories = [...prev.memoryChapters];
      const summaryToUse =
        updatedSummary || trimmedText.slice(0, 200).trim() + "...";
      let foundMem = false;
      updatedMemories = updatedMemories.map((mem, idx) => {
        const isMatch =
          targetStepNumber !== undefined
            ? mem.chapterNumber === targetStepNumber
            : idx === updatedMemories.length - 1;

        if (isMatch) {
          foundMem = true;
          return {
            ...mem,
            summary: summaryToUse,
          };
        }
        return mem;
      });

      if (!foundMem) {
        updatedMemories.push({
          id: `mem_${targetStep}`,
          chapterNumber: targetStep,
          title: `Глава #${targetStep}`,
          summary: summaryToUse,
          keyFacts: ["Текст адаптирован автором"],
          timestamp: Date.now(),
        });
      }

      // Add lore fact if provided
      const updatedLore = [...prev.lorebook];
      if (newLoreFact && newLoreFact.trim()) {
        const factText = newLoreFact.trim();
        const exists = updatedLore.some(
          (l) => l.description.toLowerCase() === factText.toLowerCase()
        );
        if (!exists) {
          updatedLore.push({
            id: `lore_edit_${Date.now()}`,
            title: "Авторская деталь главы",
            description: factText,
            category: "событие",
            discoveredAtStep: targetStep,
          });
        }
      }

      return {
        ...prev,
        currentScene: isCurrentChapter ? trimmedText : prev.currentScene,
        currentChoices:
          isCurrentChapter && updatedChoices && updatedChoices.length > 0
            ? updatedChoices
            : prev.currentChoices,
        history: updatedHistory,
        memoryChapters: updatedMemories,
        lorebook: updatedLore,
      };
    });

    // Check if we need to call AI for through-update / choices recalculation:
    const needsAiCall =
      (!updatedChoices || updatedChoices.length === 0) || shouldAutoAdvance;

    if (needsAiCall) {
      try {
        setGameState((prev) => (prev ? { ...prev, isLoading: true } : null));
        const res = await safeFetchJson<any>("/api/story/edit-chapter", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(customApiKey ? { "x-custom-api-key": customApiKey } : {}),
          },
          body: JSON.stringify({
            originalText: gameState.currentScene,
            editedText: trimmedText,
            storyTitle: gameState.story.title,
            genre: gameState.story.genre,
            currentChoices: gameState.currentChoices,
            generateNextStep: shouldAutoAdvance,
            customKey: customApiKey,
            aiSystemPrompt: aiSystemPrompt,
          }),
        });

        if (res.ok && res.data) {
          const data = res.data;

          // Apply AI extracted author style
          if (data.extractedAuthorStyle?.promptDirective) {
            setAiPromptDirective(data.extractedAuthorStyle.promptDirective);
            try {
              localStorage.setItem(
                "storyzone_prompt_directive",
                data.extractedAuthorStyle.promptDirective
              );
            } catch (e) {}
          }

          setGameState((prev) => {
            if (!prev) return null;

            const aiChoices: StoryChoice[] =
              Array.isArray(data.updatedChoices) && data.updatedChoices.length > 0
                ? data.updatedChoices
                : prev.currentChoices;

            // Update Lorebook if new fact discovered
            let updatedLore = [...prev.lorebook];
            if (data.newLoreFact && typeof data.newLoreFact === "string") {
              const factText = data.newLoreFact.trim();
              if (
                !updatedLore.some(
                  (l) => l.description.toLowerCase() === factText.toLowerCase()
                )
              ) {
                updatedLore.push({
                  id: `lore_edit_${Date.now()}`,
                  title: "Авторская деталь главы",
                  description: factText,
                  category: "событие",
                  discoveredAtStep: targetStepNumber || prev.stepCount,
                });
              }
            }

            // Update characters affinity if chapter edit changed relationships
            let updatedCharacters = [...prev.characters];
            if (Array.isArray(data.affinityChanges) && data.affinityChanges.length > 0) {
              updatedCharacters = updatedCharacters.map((c) => {
                const change = data.affinityChanges.find(
                  (a: any) =>
                    a.name &&
                    (c.name.toLowerCase().includes(a.name.toLowerCase()) ||
                      a.name.toLowerCase().includes(c.name.toLowerCase()))
                );
                if (change && typeof change.delta === "number") {
                  return {
                    ...c,
                    affinity: Math.max(0, Math.min(100, c.affinity + change.delta)),
                  };
                }
                return c;
              });
            }

            // If auto-advance requested and nextLogicalStep returned:
            if (
              shouldAutoAdvance &&
              data.nextLogicalStep &&
              data.nextLogicalStep.sceneText
            ) {
              const newStepNumber = (targetStepNumber ?? prev.stepCount) + 1;
              const nextHistoryItem: SceneHistoryItem = {
                id: `step_${newStepNumber}`,
                stepNumber: newStepNumber,
                action:
                  data.nextLogicalStep.actionLabel ||
                  "Сюжетное продолжение авторских правок",
                sceneText: data.nextLogicalStep.sceneText,
                choicesGiven: data.nextLogicalStep.choices || aiChoices,
                timestamp: Date.now(),
              };

              let updatedMemories = [...prev.memoryChapters];
              updatedMemories.push({
                id: `mem_${newStepNumber}`,
                chapterNumber: newStepNumber,
                title: `Глава #${newStepNumber}`,
                summary:
                  data.nextLogicalStep.sceneText.slice(0, 180).trim() + "...",
                keyFacts: ["Сюжет адаптирован под авторские правки"],
                timestamp: Date.now(),
              });

              return {
                ...prev,
                stepCount: newStepNumber,
                currentScene: data.nextLogicalStep.sceneText,
                currentChoices: data.nextLogicalStep.choices || aiChoices,
                characters: updatedCharacters,
                history: [...prev.history, nextHistoryItem],
                memoryChapters: updatedMemories,
                lorebook: updatedLore,
                isLoading: false,
              };
            }

            // Otherwise, update choices for current chapter
            return {
              ...prev,
              currentChoices: isCurrentChapter ? aiChoices : prev.currentChoices,
              characters: updatedCharacters,
              lorebook: updatedLore,
              isLoading: false,
            };
          });

          sound.playChoice();
        } else {
          setGameState((prev) => (prev ? { ...prev, isLoading: false } : null));
        }
      } catch (e) {
        console.error("Through-update failed:", e);
        setGameState((prev) => (prev ? { ...prev, isLoading: false } : null));
      }
    }
  };

  // Branching / What If?
  const handleForkBranch = (branchName: string, description: string) => {
    if (!gameState) return;

    const newBranch: StoryBranch = {
      id: `branch_${Date.now()}`,
      name: branchName,
      description,
      forkedAtStep: gameState.stepCount,
      historySnapshot: [...gameState.history],
      currentSceneSnapshot: gameState.currentScene,
      inventorySnapshot: [...gameState.inventory],
      charactersSnapshot: gameState.characters.map((c) => ({ ...c })),
    };

    setGameState((prev) => {
      if (!prev) return null;
      return {
        ...prev,
        branches: [...prev.branches, newBranch],
        activeBranchId: newBranch.id,
      };
    });
  };

  const handleSwitchBranch = (branchId: string) => {
    if (!gameState) return;

    if (branchId === "main") {
      setGameState((prev) => (prev ? { ...prev, activeBranchId: "main" } : null));
      return;
    }

    const branch = gameState.branches.find((b) => b.id === branchId);
    if (!branch) return;

    setGameState((prev) => {
      if (!prev) return null;
      return {
        ...prev,
        activeBranchId: branchId,
        history: [...branch.historySnapshot],
        currentScene: branch.currentSceneSnapshot,
        inventory: [...branch.inventorySnapshot],
        characters: branch.charactersSnapshot.map((c) => ({ ...c })),
        stepCount: branch.forkedAtStep,
      };
    });
  };

  const handleChangeFocus = (focus: SceneFocus) => {
    setGameState((prev) => (prev ? { ...prev, currentFocus: focus } : null));
  };

  const handleUpdateCharacter = (updatedChar: Character) => {
    setGameState((prev) => {
      if (!prev) return null;
      const nextChars = prev.characters.map((c) =>
        c.id === updatedChar.id ? updatedChar : c
      );
      return { ...prev, characters: nextChars };
    });
  };

  const handleAddCharacter = (newChar: Character) => {
    setGameState((prev) => {
      if (!prev) return null;
      return { ...prev, characters: [...prev.characters, newChar] };
    });
  };

  // Rollback to a previous step in history
  const handleRollbackStep = (stepIndex: number) => {
    if (!gameState || stepIndex < 0 || stepIndex >= gameState.history.length) return;

    const targetStep = gameState.history[stepIndex];
    const slicedHistory = gameState.history.slice(0, stepIndex + 1);

    setGameState((prev) => {
      if (!prev) return null;
      return {
        ...prev,
        currentScene: targetStep.sceneText,
        dialogueSpeaker: targetStep.dialogueSpeaker,
        history: slicedHistory,
        currentChoices:
          targetStep.choicesGiven.length > 0 ? targetStep.choicesGiven : prev.currentChoices,
        stepCount: targetStep.stepNumber,
        isEnding: false,
        isLoading: false,
      };
    });
  };

  // Rewind back to the previous chapter
  const handleRewindPreviousChapter = () => {
    if (!gameState || gameState.isLoading) return;
    if (gameState.history.length === 0) return;

    if (gameState.history.length === 1) {
      setGameState((prev) => {
        if (!prev) return null;
        return {
          ...prev,
          currentScene: prev.story.startingScene,
          dialogueSpeaker: undefined,
          history: [],
          currentChoices: prev.story.initialChoices,
          stepCount: 0,
          memoryChapters: [],
          isEnding: false,
          isLoading: false,
        };
      });
      return;
    }

    const targetIndex = gameState.history.length - 2;
    const targetStep = gameState.history[targetIndex];
    const slicedHistory = gameState.history.slice(0, targetIndex + 1);

    setGameState((prev) => {
      if (!prev) return null;
      return {
        ...prev,
        currentScene: targetStep.sceneText,
        dialogueSpeaker: targetStep.dialogueSpeaker,
        history: slicedHistory,
        currentChoices:
          targetStep.choicesGiven && targetStep.choicesGiven.length > 0
            ? targetStep.choicesGiven
            : prev.currentChoices,
        stepCount: targetStep.stepNumber,
        memoryChapters: prev.memoryChapters.slice(0, targetIndex + 1),
        isEnding: false,
        isLoading: false,
      };
    });
  };

  // Delete current chapter and roll back to previous chapter state
  const handleDeleteCurrentChapter = () => {
    if (!gameState || gameState.isLoading) return;
    if (gameState.history.length === 0) return;

    if (gameState.history.length === 1) {
      setGameState((prev) => {
        if (!prev) return null;
        return {
          ...prev,
          currentScene: prev.story.startingScene,
          dialogueSpeaker: undefined,
          history: [],
          currentChoices: prev.story.initialChoices,
          stepCount: 0,
          memoryChapters: [],
          isEnding: false,
          isLoading: false,
        };
      });
      return;
    }

    const targetIndex = gameState.history.length - 2;
    const targetStep = gameState.history[targetIndex];
    const slicedHistory = gameState.history.slice(0, -1);

    setGameState((prev) => {
      if (!prev) return null;
      return {
        ...prev,
        currentScene: targetStep.sceneText,
        dialogueSpeaker: targetStep.dialogueSpeaker,
        history: slicedHistory,
        currentChoices:
          targetStep.choicesGiven && targetStep.choicesGiven.length > 0
            ? targetStep.choicesGiven
            : prev.currentChoices,
        stepCount: targetStep.stepNumber,
        memoryChapters: prev.memoryChapters.slice(0, -1),
        isEnding: false,
        isLoading: false,
      };
    });
  };

  // Save current game into a slot
  const handleSaveToSlot = (slotId: string, playSound = true) => {
    if (!gameState) return;

    const newSave: SaveSlot = {
      id: slotId,
      storyId: gameState.story.id,
      storyTitle: gameState.story.title,
      storyGenre: gameState.story.genre,
      coverImage: gameState.story.coverImage,
      timestamp: Date.now(),
      currentStep: gameState.stepCount,
      sceneText: gameState.currentScene.slice(0, 150) + "...",
      playerStats: { ...gameState.playerStats },
      inventory: [...gameState.inventory],
      characters: [...gameState.characters],
      history: [...gameState.history],
      choices: [...gameState.currentChoices],
    };

    setSaves((prev) => {
      const filtered = prev.filter((s) => s.id !== slotId);
      return [...filtered, newSave];
    });

    if (playSound) {
      sound.playAction("affinity");
    }
  };

  // Load game from a slot
  const handleLoadSave = (save: SaveSlot) => {
    const story = stories.find((s) => s.id === save.storyId) || {
      id: save.storyId,
      title: save.storyTitle,
      genre: (save.storyGenre as any) || "Фэнтези",
      synopsis: "Сохранённая история",
      coverImage: save.coverImage,
      tags: ["Сохранение"],
      rating: 5.0,
      playsCount: 1,
      estimatedTime: "40 мин",
      author: "Игрок",
      difficulty: "Средне",
      startingStats: save.playerStats,
      startingInventory: save.inventory,
      characters: save.characters,
      startingScene: save.sceneText,
      initialChoices: save.choices,
    };

    setGameState({
      story,
      currentScene: save.sceneText,
      playerStats: { ...save.playerStats },
      inventory: [...save.inventory],
      characters: save.characters.map((c) => ({ ...c })),
      history: [...save.history],
      currentChoices: [...save.choices],
      stepCount: save.currentStep,
      atmosphere: "mysterious",
      memoryChapters: [
        {
          id: "m_saved",
          chapterNumber: 1,
          title: "Сохранённый прогресс",
          summary: save.sceneText.slice(0, 100),
          timestamp: save.timestamp,
        },
      ],
      lorebook: [],
      branches: [],
      activeBranchId: "main",
      narrativeStyle: NarrativeStyle.LITERARY,
      narrativePOV: NarrativePOV.SECOND,
      currentFocus: SceneFocus.GENERAL,
      ultraMemory: true,
      suggestedMusic: "calm",
      isEnding: false,
      isLoading: false,
    });

    setActiveTab("game");
  };

  const handleDeleteSave = (slotId: string) => {
    setSaves((prev) => prev.filter((s) => s.id !== slotId));
  };

  const handleImportSaves = (jsonString: string) => {
    try {
      const parsed = JSON.parse(jsonString);
      if (Array.isArray(parsed)) {
        setSaves(parsed);
        sound.playAction("magic");
      } else if (parsed.gameState || (parsed.story && parsed.currentScene)) {
        const loaded: ActiveGameState = parsed.gameState || parsed;
        setGameState(loaded);
        setActiveTab("game");
        sound.playAction("magic");
      }
    } catch (e) {
      console.error("Save import error:", e);
    }
  };

  const handleCreateCustomStory = (
    newStory: Story,
    narrativeSettings?: {
      style: NarrativeStyle;
      pov: NarrativePOV;
      focus: SceneFocus;
      ultraMemory: boolean;
    }
  ) => {
    const updated = [newStory, ...stories];
    setStories(updated);

    try {
      const customOnly = updated.filter((s) => s.isCustom);
      localStorage.setItem("storyzone_custom_stories", JSON.stringify(customOnly));
    } catch (e) {}

    handleSelectStory(newStory, narrativeSettings);
  };

  const handleApplySceneArt = (artUrl: string) => {
    setGameState((prev) => (prev ? { ...prev, sceneArtUrl: artUrl } : null));
  };

  const handleApplyImprovedText = (improvedText: string) => {
    handleSaveEditedChapter(
      improvedText,
      "Сцена стилистически отшлифована ИИ-редактором под авторский канон."
    );
  };

  const handleImportGameState = (newState: ActiveGameState) => {
    setGameState(newState);
    setActiveTab("game");
  };

  const handleStartSummonedStory = (summonedStory: Story) => {
    setIsInternetFinderOpen(false);
    handleCreateCustomStory(summonedStory);
  };

  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-100 flex flex-col antialiased selection:bg-purple-600 selection:text-white">
      {/* Top Main Navigation Header */}
      <Header
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        hasActiveGame={!!gameState}
        onOpenSettings={() => setIsSettingsOpen(true)}
        onOpenExportImport={() => setIsExportImportOpen(true)}
        onOpenInternetFinder={() => setIsInternetFinderOpen(true)}
        isAiEnabled={isAiEnabled}
        soundEnabled={soundEnabled}
        setSoundEnabled={setSoundEnabled}
      />

      {/* Main Content Area */}
      <main className="flex-1 w-full">
        {activeTab === "catalog" && (
          <StoryCatalog
            stories={stories}
            onSelectStory={(s) => handleSelectStory(s)}
            onOpenCreator={() => setActiveTab("creator")}
            onOpenExportImport={() => setIsExportImportOpen(true)}
            onOpenInternetFinder={() => setIsInternetFinderOpen(true)}
            activeStoryId={gameState?.story.id}
          />
        )}

        {activeTab === "game" && gameState && (
          <StoryGameScreen
            gameState={gameState}
            onExecuteChoice={(choice) => executeStoryStep(choice.label)}
            onExecuteCustomAction={(action) => executeStoryStep(action)}
            onRollbackStep={handleRollbackStep}
            onRewindPreviousChapter={handleRewindPreviousChapter}
            onDeleteCurrentChapter={handleDeleteCurrentChapter}
            onQuickSave={() => handleSaveToSlot("slot_1")}
            onExitToCatalog={() => setActiveTab("catalog")}
            onSaveEditedChapter={handleSaveEditedChapter}
            onForkBranch={handleForkBranch}
            onSwitchBranch={handleSwitchBranch}
            onChangeFocus={handleChangeFocus}
            readerTheme={readerTheme}
            fontSize={fontSize}
            setFontSize={setFontSize}
            isAiEnabled={isAiEnabled}
            customApiKey={customApiKey}
            autoSituationMusic={autoSituationMusic}
            setAutoSituationMusic={setAutoSituationMusic}
            onApplySceneArt={handleApplySceneArt}
            onApplyImprovedText={handleApplyImprovedText}
            onImportGameState={handleImportGameState}
            onExecuteTacticalCombo={handleExecuteTacticalCombo}
            onApplyDivergence={handleApplyDivergence}
            onUpdateCharacter={handleUpdateCharacter}
            currentBpm={musicBpm}
            onBpmChange={(bpm) => setMusicBpm(bpm)}
            onOpenSettings={() => setIsSettingsOpen(true)}
            aiSystemPrompt={aiSystemPrompt}
            aiPromptDirective={aiPromptDirective}
            onUpdateNarrativeStyle={(style) =>
              setGameState((prev) => (prev ? { ...prev, narrativeStyle: style } : null))
            }
            onUpdateGenerationLength={(length) =>
              setGameState((prev) => (prev ? { ...prev, generationLength: length } : null))
            }
            onUpdateGenre={(genre) =>
              setGameState((prev) =>
                prev ? { ...prev, story: { ...prev.story, genre: genre as any } } : null
              )
            }
            onAddCharacter={handleAddCharacter}
            onUpdatePromptDirective={(directive) => setAiPromptDirective(directive)}
            onUpdateUniverseSetting={(newSetting) => {
              setGameState((prev) => {
                if (!prev) return null;
                return {
                  ...prev,
                  universeSetting: newSetting,
                  story: {
                    ...prev.story,
                    universeSetting: newSetting,
                  },
                };
              });
            }}
            onAddLorebookEntry={(entry) => {
              setGameState((prev) => {
                if (!prev) return null;
                const exists = prev.lorebook.some(
                  (l) => l.title.toLowerCase() === entry.title.toLowerCase()
                );
                if (exists) return prev;
                return {
                  ...prev,
                  lorebook: [...prev.lorebook, entry],
                };
              });
            }}
          />
        )}

        {activeTab === "creator" && (
          <StoryCreatorModal
            onCreateStory={handleCreateCustomStory}
            onCancel={() => setActiveTab("catalog")}
            customApiKey={customApiKey}
          />
        )}

        {activeTab === "characters" && (
          <CharactersModal
            characters={gameState?.characters || PRESET_STORIES[0].characters}
            currentStory={gameState?.story || null}
            onUpdateCharacter={handleUpdateCharacter}
            onAddCharacter={handleAddCharacter}
            customApiKey={customApiKey}
          />
        )}

        {activeTab === "saves" && (
          <SaveLoadModal
            saves={saves}
            onLoadSave={handleLoadSave}
            onSaveToSlot={(slotId) => handleSaveToSlot(slotId)}
            onDeleteSave={handleDeleteSave}
            hasActiveGame={!!gameState}
            onImportSaves={handleImportSaves}
          />
        )}
      </main>

      {/* Universal Internet Universe Summoner Modal */}
      <InternetUniverseFinderModal
        isOpen={isInternetFinderOpen}
        onClose={() => setIsInternetFinderOpen(false)}
        onStartStory={handleStartSummonedStory}
        customApiKey={customApiKey}
      />

      {/* Global Story & Chapter Export/Import Modal */}
      <StoryExportImportModal
        isOpen={isExportImportOpen}
        onClose={() => setIsExportImportOpen(false)}
        gameState={gameState}
        onImportGameState={handleImportGameState}
        customApiKey={customApiKey}
      />

      {/* Preferences & Settings Modal */}
      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        readerTheme={readerTheme}
        setReaderTheme={setReaderTheme}
        fontSize={fontSize}
        setFontSize={setFontSize}
        soundEnabled={soundEnabled}
        setSoundEnabled={setSoundEnabled}
        isAiEnabled={isAiEnabled}
        customApiKey={customApiKey}
        setCustomApiKey={setCustomApiKey}
        ultraMemory={ultraMemory}
        setUltraMemory={setUltraMemory}
        autoSituationMusic={autoSituationMusic}
        setAutoSituationMusic={setAutoSituationMusic}
        aiPromptDirective={aiPromptDirective}
        setAiPromptDirective={setAiPromptDirective}
        aiSystemPrompt={aiSystemPrompt}
        setAiSystemPrompt={setAiSystemPrompt}
        gameState={gameState}
        onImportGameState={handleImportGameState}
      />
    </div>
  );
}
