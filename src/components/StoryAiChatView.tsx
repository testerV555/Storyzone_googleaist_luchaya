import React, { useState, useEffect, useRef } from "react";
import {
  ActiveGameState,
  StoryChatMessage,
  StoryChatActionProposal,
  ReaderTheme,
  NarrativeStyle,
  GenerationLength,
  Character,
  UniverseSetting,
  LorebookEntry,
} from "../types";
import {
  Bot,
  Send,
  Sparkles,
  MessageSquare,
  Trash2,
  ArrowLeft,
  Check,
  CheckCheck,
  Loader2,
  UserPlus,
  HeartHandshake,
  Palette,
  Sliders,
  Edit3,
  Compass,
  BookOpen,
  Zap,
  Clock,
  RotateCcw,
  Lightbulb,
  Shield,
  HelpCircle,
  ExternalLink,
  Globe,
  Search,
} from "lucide-react";
import { sound } from "../utils/audio";
import { safeFetchJson } from "../utils/safeApi";

interface StoryAiChatViewProps {
  gameState: ActiveGameState;
  readerTheme: ReaderTheme;
  customApiKey?: string;
  aiSystemPrompt?: string;
  aiPromptDirective?: string;
  universeSetting?: UniverseSetting;
  onBackToStory: () => void;
  onExecuteAction: (actionLabel: string) => void;
  onUpdateNarrativeStyle: (style: NarrativeStyle) => void;
  onUpdateGenerationLength: (length: GenerationLength) => void;
  onUpdateGenre: (genre: string) => void;
  onAddCharacter: (character: Character) => void;
  onUpdateCharacter: (character: Character) => void;
  onInjectSceneText: (newText: string) => void;
  onUpdatePromptDirective: (directive: string) => void;
  onUpdateUniverseSetting?: (newSetting: UniverseSetting) => void;
  onAddLorebookEntry?: (entry: LorebookEntry) => void;
  onOpenUniverseModal?: () => void;
}

export const StoryAiChatView: React.FC<StoryAiChatViewProps> = ({
  gameState,
  readerTheme,
  customApiKey,
  aiSystemPrompt,
  aiPromptDirective,
  universeSetting,
  onBackToStory,
  onExecuteAction,
  onUpdateNarrativeStyle,
  onUpdateGenerationLength,
  onUpdateGenre,
  onAddCharacter,
  onUpdateCharacter,
  onInjectSceneText,
  onUpdatePromptDirective,
  onUpdateUniverseSetting,
  onAddLorebookEntry,
  onOpenUniverseModal,
}) => {
  const storyId = gameState.story.id;
  const storageKey = `storyzone_chat_${storyId}`;

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

  const [searchGroundingEnabled, setSearchGroundingEnabled] = useState<boolean>(
    currentUniverse.searchGroundingEnabled !== false
  );

  // Initial welcome message from AI Co-Author tailored to current story and universe
  const defaultMessages: StoryChatMessage[] = [
    {
      id: `msg_welcome_${storyId}`,
      role: "assistant",
      content: `Приветствую, автор! Я — твой **ИИ-Соавтор и Мастер Игры** для повести **«${gameState.story.title}»**.\n\n🌌 **Вселенная & Сеттинг:** «${currentUniverse.universeName}»\nЯ знаю каждый шаг хроники, характер спутников (${gameState.characters.map((c) => c.name).join(", ") || "пока в одиночку"}), тайны лорбука и законы этого мира.\n\n**Чем могу помочь прямо сейчас:**\n- Свериться с каноном вселенной через **Google Search Grounding**;\n- Предложить варианты следующего хода, фракционные интриги или неожиданный твист;\n- Объяснить мотивы и реакцию персонажей, помочь сблизиться или помириться;\n- Настроить повесть на ходу: стиль, длину глав (кратко/развёрнуто), сеттинг и жанр;\n- Добавить нового спутника или напрямую написать продолжение сцены.\n\nО чём ты хочешь посоветоваться?`,
      timestamp: Date.now(),
    },
  ];

  const [messages, setMessages] = useState<StoryChatMessage[]>(() => {
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed;
        }
      }
    } catch (e) {}
    return defaultMessages;
  });

  const [inputPrompt, setInputPrompt] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [showContextDetails, setShowContextDetails] = useState(false);
  const [suggestedPrompts, setSuggestedPrompts] = useState<string[]>([
    `Свериться с каноном «${currentUniverse.universeName}»`,
    "Что предпринять в текущей ситуации?",
    `Какие фракции мира «${currentUniverse.universeName}» действуют рядом?`,
    "Предложи неожиданный сюжетный твист",
    "Сделай стиль более кинематографичным",
  ]);

  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  // Auto-scroll on new message
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading]);

  // Sync chat history to localStorage
  useEffect(() => {
    try {
      localStorage.setItem(storageKey, JSON.stringify(messages));
    } catch (e) {}
  }, [messages, storageKey]);

  const handleSendMessage = async (textToSend?: string) => {
    const text = (textToSend || inputPrompt).trim();
    if (!text || isLoading) return;

    sound.playClick();
    const userMsg: StoryChatMessage = {
      id: `msg_user_${Date.now()}`,
      role: "user",
      content: text,
      timestamp: Date.now(),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInputPrompt("");
    setIsLoading(true);

    try {
      const res = await safeFetchJson<any>("/api/story/chat", {
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
          inventory: gameState.inventory,
          stepCount: gameState.stepCount,
          memoryChapters: gameState.memoryChapters,
          lorebook: gameState.lorebook,
          narrativeStyle: gameState.narrativeStyle,
          narrativePOV: gameState.narrativePOV,
          generationLength: gameState.generationLength || "medium",
          aiSystemPrompt: aiSystemPrompt,
          aiPromptDirective: aiPromptDirective,
          universeSetting: {
            ...currentUniverse,
            searchGroundingEnabled,
          },
          searchGroundingEnabled,
          messages: messages.map((m) => ({ role: m.role, content: m.content })),
          userMessage: text,
          customKey: customApiKey,
        }),
      });

      if (res.ok && res.data) {
        sound.playAction("magic");
        const assistantMsg: StoryChatMessage = {
          id: `msg_ai_${Date.now()}`,
          role: "assistant",
          content: res.data.reply || "Сюжет готов к продолжению. Каков твой замысел?",
          timestamp: Date.now(),
          actionProposal: res.data.actionProposal || undefined,
          groundingSources: res.data.groundingSources || undefined,
          searchQueries: res.data.searchQueries || undefined,
        };

        setMessages((prev) => [...prev, assistantMsg]);
        if (Array.isArray(res.data.suggestedPrompts) && res.data.suggestedPrompts.length > 0) {
          setSuggestedPrompts(res.data.suggestedPrompts);
        }
      } else {
        throw new Error("API call failed");
      }
    } catch (err) {
      console.warn("Chat error fallback used:", err);
      sound.playAction("click");
      const fallbackMsg: StoryChatMessage = {
        id: `msg_ai_${Date.now()}`,
        role: "assistant",
        content: `Я внимательно обдумал твой вопрос касательно событий в мире «${currentUniverse.universeName}». Рекомендую продвинуться вперёд решительным действием или расспросить соратников. Всё в твоих руках!`,
        timestamp: Date.now(),
      };
      setMessages((prev) => [...prev, fallbackMsg]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleApplyActionProposal = (msgId: string, proposal: StoryChatActionProposal) => {
    sound.playAction("magic");

    // Execute application based on action type
    switch (proposal.type) {
      case "change_style":
        if (proposal.payload?.style) {
          onUpdateNarrativeStyle(proposal.payload.style as NarrativeStyle);
        }
        break;

      case "change_length":
        if (proposal.payload?.length) {
          onUpdateGenerationLength(proposal.payload.length as GenerationLength);
        }
        break;

      case "change_genre":
        if (proposal.payload?.genre) {
          onUpdateGenre(proposal.payload.genre);
        }
        break;

      case "add_character":
        if (proposal.payload?.character) {
          const raw = proposal.payload.character;
          const newChar: Character = {
            id: `char_${Date.now()}`,
            name: raw.name || "Новый спутник",
            role: raw.role || "Соратник",
            affinity: raw.affinity ?? 50,
            affinityTitle: "Знакомый",
            bio: raw.bio || "Присоединился к отряду по совету ИИ-Соавтора",
            avatar:
              raw.avatar ||
              "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=400",
            traits: raw.traits || ["Верный", "Опытный"],
            habits: raw.habits || ["Настороженно изучает обстановку"],
          };
          onAddCharacter(newChar);
        }
        break;

      case "update_character":
        if (proposal.payload?.name) {
          const char = gameState.characters.find(
            (c) => c.name.toLowerCase() === proposal.payload.name.toLowerCase()
          );
          if (char) {
            const nextAffinity = Math.max(
              0,
              Math.min(100, char.affinity + (proposal.payload.delta || 10))
            );
            const updated = {
              ...char,
              affinity: nextAffinity,
              currentStatus: proposal.payload.newStatus || char.currentStatus,
            };
            onUpdateCharacter(updated);
          }
        }
        break;

      case "inject_scene":
        if (proposal.payload?.newSceneText) {
          onInjectSceneText(proposal.payload.newSceneText);
        }
        break;

      case "execute_action":
        if (proposal.payload?.actionLabel) {
          onExecuteAction(proposal.payload.actionLabel);
          onBackToStory();
          return;
        }
        break;

      case "update_directive":
        if (proposal.payload?.directive) {
          onUpdatePromptDirective(proposal.payload.directive);
        }
        break;

      case "update_universe":
        if (proposal.payload && onUpdateUniverseSetting) {
          onUpdateUniverseSetting({
            universeName: proposal.payload.universeName || currentUniverse.universeName,
            settingDescription: proposal.payload.settingDescription || currentUniverse.settingDescription,
            worldRules: proposal.payload.worldRules || currentUniverse.worldRules,
            factions: proposal.payload.factions || currentUniverse.factions,
            canonStrictness: proposal.payload.canonStrictness || currentUniverse.canonStrictness,
            searchGroundingEnabled,
          });
        }
        break;

      case "add_lore_fact":
        if (proposal.payload && onAddLorebookEntry) {
          onAddLorebookEntry({
            id: `lore_${Date.now()}`,
            title: proposal.payload.title || `Тайна мира «${currentUniverse.universeName}»`,
            description: proposal.payload.description || "Каноничный факт вселенной",
            category: proposal.payload.category || "правило_мира",
            discoveredAtStep: gameState.stepCount,
          });
        }
        break;
    }

    // Mark proposal as applied in chat history
    setMessages((prev) =>
      prev.map((m) => {
        if (m.id === msgId && m.actionProposal) {
          return {
            ...m,
            actionProposal: {
              ...m.actionProposal,
              applied: true,
            },
          };
        }
        return m;
      })
    );
  };

  const handleClearHistory = () => {
    sound.playClick();
    if (window.confirm("Очистить историю диалога с ИИ-Соавтором для этой книги?")) {
      setMessages(defaultMessages);
      try {
        localStorage.removeItem(storageKey);
      } catch (e) {}
    }
  };

  const getActionIcon = (type: string) => {
    switch (type) {
      case "change_style":
        return <Palette className="w-4 h-4 text-purple-400" />;
      case "change_length":
        return <Clock className="w-4 h-4 text-amber-400" />;
      case "change_genre":
        return <Sparkles className="w-4 h-4 text-cyan-400" />;
      case "add_character":
        return <UserPlus className="w-4 h-4 text-emerald-400" />;
      case "update_character":
        return <HeartHandshake className="w-4 h-4 text-rose-400" />;
      case "inject_scene":
        return <Edit3 className="w-4 h-4 text-amber-400" />;
      case "execute_action":
        return <Send className="w-4 h-4 text-purple-400" />;
      case "update_directive":
        return <Sliders className="w-4 h-4 text-indigo-400" />;
      case "update_universe":
        return <Globe className="w-4 h-4 text-purple-400" />;
      case "add_lore_fact":
        return <BookOpen className="w-4 h-4 text-cyan-400" />;
      default:
        return <Zap className="w-4 h-4 text-purple-400" />;
    }
  };

  return (
    <div className="flex flex-col h-[calc(100vh-140px)] min-h-[500px] max-w-5xl mx-auto w-full p-2 sm:p-4 animate-fade-in">
      {/* Top Header Card */}
      <div className="p-3.5 sm:p-4 rounded-2xl bg-neutral-900/90 border border-neutral-800 shadow-xl backdrop-blur-xl flex flex-wrap items-center justify-between gap-3 mb-3">
        <div className="flex items-center gap-3">
          <button
            onClick={() => {
              sound.playClick();
              onBackToStory();
            }}
            className="p-2 rounded-xl bg-neutral-950/80 hover:bg-neutral-800 border border-neutral-800 text-neutral-300 hover:text-white transition-colors"
            title="Вернуться к чтению повести"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>

          <div className="flex items-center gap-2.5">
            <div className="relative">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-600 to-indigo-800 flex items-center justify-center text-white shadow-md shadow-purple-900/30">
                <Bot className="w-5 h-5" />
              </div>
              <div className="w-3 h-3 rounded-full bg-emerald-500 border-2 border-neutral-900 absolute -bottom-0.5 -right-0.5" />
            </div>

            <div>
              <div className="flex items-center gap-2">
                <h2 className="font-cinzel text-sm sm:text-base font-bold text-neutral-100 flex items-center gap-1.5">
                  ИИ-Соавтор & Мастер игры
                </h2>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-purple-950 text-purple-300 border border-purple-800/80 font-mono">
                  Online GM
                </span>
              </div>
              <p className="text-[11px] text-neutral-400 truncate max-w-[280px] sm:max-w-md">
                «{gameState.story.title}» • Глава {gameState.stepCount} • {gameState.story.genre}
              </p>
            </div>
          </div>
        </div>

        {/* Action Controls & Universe Button */}
        <div className="flex items-center gap-2">
          {onOpenUniverseModal && (
            <button
              onClick={() => {
                sound.playClick();
                onOpenUniverseModal();
              }}
              className="px-2.5 py-1.5 rounded-xl bg-purple-950/70 hover:bg-purple-900/80 border border-purple-700/60 text-purple-200 text-xs font-semibold flex items-center gap-1.5 transition-all shadow-sm"
              title="Настроить сеттинг, законы мира и поиск канона"
            >
              <Globe className="w-3.5 h-3.5 text-purple-400 shrink-0" />
              <span className="truncate max-w-[110px] sm:max-w-[150px]">
                {currentUniverse.universeName}
              </span>
            </button>
          )}

          <button
            onClick={() => {
              sound.playClick();
              setSearchGroundingEnabled(!searchGroundingEnabled);
            }}
            className={`px-2.5 py-1.5 rounded-xl border text-xs font-semibold flex items-center gap-1.5 transition-all ${
              searchGroundingEnabled
                ? "bg-cyan-950/80 border-cyan-500/80 text-cyan-300 shadow-sm"
                : "bg-neutral-950/60 border-neutral-800 text-neutral-400 hover:text-neutral-200"
            }`}
            title="Google Search Grounding (проверка канона по веб-поиску)"
          >
            <Search className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Google Канон</span>
            {searchGroundingEnabled && (
              <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" />
            )}
          </button>

          <button
            onClick={() => {
              sound.playClick();
              setShowContextDetails(!showContextDetails);
            }}
            className={`px-2.5 py-1.5 rounded-xl border text-xs font-semibold flex items-center gap-1.5 transition-all ${
              showContextDetails
                ? "bg-purple-950/80 border-purple-600 text-purple-200"
                : "bg-neutral-950/60 border-neutral-800 text-neutral-400 hover:text-neutral-200"
            }`}
            title="Посмотреть контекст и параметры истории"
          >
            <Compass className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Контекст</span>
          </button>

          <button
            onClick={handleClearHistory}
            className="p-2 rounded-xl bg-neutral-950/60 hover:bg-rose-950/60 border border-neutral-800 hover:border-rose-800/80 text-neutral-400 hover:text-rose-300 transition-colors"
            title="Очистить историю чата"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Expandable Story Context Inspector Bar */}
      {showContextDetails && (
        <div className="mb-3 p-3.5 rounded-2xl bg-neutral-950/90 border border-purple-900/40 text-xs text-neutral-300 space-y-2 animate-fade-in shadow-inner">
          <div className="flex items-center justify-between border-b border-neutral-800 pb-2">
            <span className="font-bold text-neutral-200 flex items-center gap-1.5">
              <BookOpen className="w-3.5 h-3.5 text-purple-400" />
              Память и текущие настройки книги:
            </span>
            <span className="text-[10px] text-neutral-500 font-mono">
              Сквозная хроника: {gameState.memoryChapters.length} глав
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px]">
            <div className="p-2 rounded-lg bg-neutral-900 border border-neutral-800">
              <span className="text-neutral-500 block text-[10px]">Вселенная & Сеттинг</span>
              <span className="font-semibold text-neutral-200 truncate block">
                {currentUniverse.universeName}
              </span>
            </div>
            <div className="p-2 rounded-lg bg-neutral-900 border border-neutral-800">
              <span className="text-neutral-500 block text-[10px]">Стиль текста</span>
              <span className="font-semibold text-purple-300">{gameState.narrativeStyle}</span>
            </div>
            <div className="p-2 rounded-lg bg-neutral-900 border border-neutral-800">
              <span className="text-neutral-500 block text-[10px]">Длина глав</span>
              <span className="font-semibold text-amber-300">
                {gameState.generationLength === "short"
                  ? "Краткая (1-2 абз)"
                  : gameState.generationLength === "long"
                  ? "Развёрнутая (4-5 абз)"
                  : "Стандарт (2-3 абз)"}
              </span>
            </div>
            <div className="p-2 rounded-lg bg-neutral-900 border border-neutral-800">
              <span className="text-neutral-500 block text-[10px]">Google Grounding</span>
              <span className={`font-semibold ${searchGroundingEnabled ? "text-cyan-400" : "text-neutral-400"}`}>
                {searchGroundingEnabled ? "Включен" : "Выключен"}
              </span>
            </div>
          </div>

          <div className="text-[11px] text-neutral-400 pt-1">
            <span className="font-semibold text-neutral-300">Текущая сцена: </span>
            {gameState.currentScene.slice(0, 160).trim()}...
          </div>
        </div>
      )}

      {/* Message Stream */}
      <div className="flex-1 overflow-y-auto space-y-3.5 p-3 rounded-2xl bg-neutral-950/60 border border-neutral-800/80 shadow-inner">
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex gap-3 ${
              msg.role === "user" ? "justify-end" : "justify-start"
            }`}
          >
            {msg.role === "assistant" && (
              <div className="w-8 h-8 rounded-xl bg-purple-950 border border-purple-800/80 flex items-center justify-center text-purple-300 shrink-0 mt-1 shadow">
                <Bot className="w-4 h-4" />
              </div>
            )}

            <div
              className={`max-w-[85%] sm:max-w-[75%] rounded-2xl p-3.5 sm:p-4 text-xs sm:text-sm leading-relaxed ${
                msg.role === "user"
                  ? "bg-purple-600 text-white shadow-md shadow-purple-900/30 rounded-br-sm"
                  : "bg-neutral-900/95 border border-neutral-800 text-neutral-200 rounded-bl-sm shadow-md"
              }`}
            >
              {/* Message text with basic paragraph formatting */}
              <div className="space-y-2 whitespace-pre-wrap font-sans">
                {msg.content}
              </div>

              {/* Action Proposal Card if attached */}
              {msg.actionProposal && (
                <div className="mt-3 pt-3 border-t border-neutral-800/90 space-y-2">
                  <div className="p-3 rounded-xl bg-neutral-950/90 border border-purple-800/50 space-y-2 shadow-sm">
                    <div className="flex items-center gap-2">
                      <div className="p-1.5 rounded-lg bg-neutral-900 border border-neutral-700">
                        {getActionIcon(msg.actionProposal.type)}
                      </div>
                      <div className="flex-1 truncate">
                        <span className="font-bold text-neutral-100 text-xs block truncate">
                          {msg.actionProposal.title}
                        </span>
                        <span className="text-[11px] text-neutral-400 block truncate">
                          {msg.actionProposal.description}
                        </span>
                      </div>
                    </div>

                    <div className="flex justify-end pt-1">
                      {msg.actionProposal.applied ? (
                        <div className="px-3 py-1.5 rounded-lg bg-emerald-950/80 border border-emerald-700/80 text-emerald-300 text-xs font-semibold flex items-center gap-1.5">
                          <CheckCheck className="w-3.5 h-3.5 text-emerald-400" />
                          <span>Применено в историю</span>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => handleApplyActionProposal(msg.id, msg.actionProposal!)}
                          className="px-3.5 py-1.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold shadow-md shadow-purple-900/40 flex items-center gap-1.5 transition-all hover:scale-105 active:scale-95"
                        >
                          <Zap className="w-3.5 h-3.5" />
                          <span>Применить в игре</span>
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Grounding Sources Badge */}
              {msg.groundingSources && msg.groundingSources.length > 0 && (
                <div className="mt-2.5 pt-2 border-t border-neutral-800/80">
                  <div className="flex items-center gap-1.5 text-[10px] font-bold text-cyan-400 mb-1">
                    <Search className="w-3 h-3 text-cyan-400" />
                    <span>Google Search Grounding (Источники канона):</span>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {msg.groundingSources.map((src, idx) => (
                      <a
                        key={idx}
                        href={src.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-neutral-950 hover:bg-neutral-850 border border-neutral-750 text-[11px] text-cyan-300 hover:text-cyan-200 transition-colors shadow-sm"
                      >
                        <ExternalLink className="w-2.5 h-2.5" />
                        <span className="max-w-[200px] truncate">{src.title}</span>
                      </a>
                    ))}
                  </div>
                </div>
              )}

              <div
                className={`text-[9px] mt-1.5 text-right font-mono ${
                  msg.role === "user" ? "text-purple-200" : "text-neutral-500"
                }`}
              >
                {new Date(msg.timestamp).toLocaleTimeString([], {
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </div>
            </div>
          </div>
        ))}

        {isLoading && (
          <div className="flex gap-3 justify-start animate-pulse">
            <div className="w-8 h-8 rounded-xl bg-purple-950 border border-purple-800/80 flex items-center justify-center text-purple-300 shrink-0">
              <Bot className="w-4 h-4 animate-spin" />
            </div>
            <div className="rounded-2xl p-3.5 bg-neutral-900 border border-neutral-800 text-xs text-neutral-400 flex items-center gap-2">
              <Loader2 className="w-3.5 h-3.5 animate-spin text-purple-400" />
              <span>Соавтор изучает хронику и формулирует ответ...</span>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Categorized System Commands & Quick Directives Toolbar */}
      <div className="pt-2 pb-1 space-y-1.5">
        <div className="flex items-center justify-between text-[11px] text-neutral-400 px-1">
          <span className="font-semibold text-neutral-300 flex items-center gap-1.5">
            <Zap className="w-3.5 h-3.5 text-amber-400" />
            Системные команды и настройки истории:
          </span>
          {onOpenUniverseModal && (
            <button
              onClick={onOpenUniverseModal}
              className="text-[10px] text-cyan-400 hover:text-cyan-200 hover:underline flex items-center gap-1"
            >
              <Globe className="w-3 h-3" />
              <span>Настройки сеттинга</span>
            </button>
          )}
        </div>

        {/* Quick Command Pills */}
        <div className="overflow-x-auto no-scrollbar flex items-center gap-1.5 pb-1">
          {/* Universe Characters Command */}
          <button
            onClick={() =>
              handleSendMessage(
                `Какие ключевые каноничные персонажи, герои и антагонисты есть во вселенной «${currentUniverse.universeName}»? Назови их, раскрой их характеры и предложи, как ввести одного из них в нашу историю.`
              )
            }
            disabled={isLoading}
            className="whitespace-nowrap px-2.5 py-1 rounded-xl bg-cyan-950/80 hover:bg-cyan-900 border border-cyan-800/80 text-[11px] font-semibold text-cyan-200 transition-all flex items-center gap-1 shrink-0 disabled:opacity-50"
          >
            <UserPlus className="w-3 h-3 text-cyan-400" />
            <span>Персонажи канона</span>
          </button>

          {/* Universe Lore Command */}
          <button
            onClick={() =>
              handleSendMessage(
                `Расскажи фундаментальный каноничный лор, мироустройство, законы магии/технологий и баланс сил во вселенной «${currentUniverse.universeName}».`
              )
            }
            disabled={isLoading}
            className="whitespace-nowrap px-2.5 py-1 rounded-xl bg-cyan-950/80 hover:bg-cyan-900 border border-cyan-800/80 text-[11px] font-semibold text-cyan-200 transition-all flex items-center gap-1 shrink-0 disabled:opacity-50"
          >
            <Globe className="w-3 h-3 text-cyan-400" />
            <span>Лор и законы мира</span>
          </button>

          {/* Plot Twists Command */}
          <button
            onClick={() =>
              handleSendMessage(
                "Предложи 3 неожиданных сюжетных поворота или кризисных развилки для текущей сцены с учётом законов нашего мира."
              )
            }
            disabled={isLoading}
            className="whitespace-nowrap px-2.5 py-1 rounded-xl bg-purple-950/80 hover:bg-purple-900 border border-purple-800/80 text-[11px] font-semibold text-purple-200 transition-all flex items-center gap-1 shrink-0 disabled:opacity-50"
          >
            <Sparkles className="w-3 h-3 text-purple-400" />
            <span>3 сюжетных хода</span>
          </button>

          {/* Change Style: Brutal Command */}
          <button
            onClick={() =>
              handleSendMessage(
                "Переключи стиль повествования книги на брутальный динамичный экшен (короткие рубленые фразы, физическая плотность)."
              )
            }
            disabled={isLoading}
            className="whitespace-nowrap px-2.5 py-1 rounded-xl bg-neutral-900 hover:bg-neutral-800 border border-neutral-800 text-[11px] text-neutral-300 transition-all flex items-center gap-1 shrink-0 disabled:opacity-50"
          >
            <Palette className="w-3 h-3 text-rose-400" />
            <span>Стиль: Экшен</span>
          </button>

          {/* Change Style: Literary Command */}
          <button
            onClick={() =>
              handleSendMessage(
                "Переключи стиль повествования на высокую классическую литературу (глубокие метафоры, богатый словарь, кинематографичность)."
              )
            }
            disabled={isLoading}
            className="whitespace-nowrap px-2.5 py-1 rounded-xl bg-neutral-900 hover:bg-neutral-800 border border-neutral-800 text-[11px] text-neutral-300 transition-all flex items-center gap-1 shrink-0 disabled:opacity-50"
          >
            <Palette className="w-3 h-3 text-purple-400" />
            <span>Стиль: Литературный</span>
          </button>

          {/* Short Length Command */}
          <button
            onClick={() =>
              handleSendMessage(
                "Переключи длину генерации глав на краткую (1-2 ёмких абзаца без лишней воды)."
              )
            }
            disabled={isLoading}
            className="whitespace-nowrap px-2.5 py-1 rounded-xl bg-neutral-900 hover:bg-neutral-800 border border-neutral-800 text-[11px] text-neutral-300 transition-all flex items-center gap-1 shrink-0 disabled:opacity-50"
          >
            <Sliders className="w-3 h-3 text-amber-400" />
            <span>Главы: Краткие</span>
          </button>

          {/* Long Length Command */}
          <button
            onClick={() =>
              handleSendMessage(
                "Переключи длину генерации глав на развёрнутую (4-5 богатых абзацев с деталями окружения)."
              )
            }
            disabled={isLoading}
            className="whitespace-nowrap px-2.5 py-1 rounded-xl bg-neutral-900 hover:bg-neutral-800 border border-neutral-800 text-[11px] text-neutral-300 transition-all flex items-center gap-1 shrink-0 disabled:opacity-50"
          >
            <Sliders className="w-3 h-3 text-amber-400" />
            <span>Главы: Развёрнутые</span>
          </button>

          {/* Directive Command */}
          <button
            onClick={() =>
              handleSendMessage(
                "Обнови директиву автора: сделай упор на психологию спутников, напряженные диалоги и моральные дилеммы."
              )
            }
            disabled={isLoading}
            className="whitespace-nowrap px-2.5 py-1 rounded-xl bg-neutral-900 hover:bg-neutral-800 border border-neutral-800 text-[11px] text-neutral-300 transition-all flex items-center gap-1 shrink-0 disabled:opacity-50"
          >
            <Edit3 className="w-3 h-3 text-emerald-400" />
            <span>Упор на диалоги</span>
          </button>
        </div>
      </div>

      {/* Suggested Quick Prompt Chips */}
      <div className="pt-1 pb-1 overflow-x-auto no-scrollbar flex items-center gap-1.5">
        <Lightbulb className="w-3.5 h-3.5 text-purple-400 shrink-0 ml-1" />
        {suggestedPrompts.slice(0, 4).map((p, i) => (
          <button
            key={i}
            onClick={() => handleSendMessage(p)}
            disabled={isLoading}
            className="whitespace-nowrap px-2.5 py-1 rounded-lg bg-neutral-900 hover:bg-purple-950/80 border border-neutral-800 hover:border-purple-700/80 text-[11px] text-neutral-300 hover:text-purple-200 transition-colors shrink-0 disabled:opacity-50"
          >
            {p}
          </button>
        ))}
      </div>

      {/* Input Bar */}
      <div className="pt-1.5">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSendMessage();
          }}
          className="relative flex items-center gap-2 rounded-2xl bg-neutral-900 border border-neutral-800 focus-within:border-purple-600 focus-within:ring-1 focus-within:ring-purple-600 p-2 shadow-xl transition-all"
        >
          <input
            type="text"
            value={inputPrompt}
            onChange={(e) => setInputPrompt(e.target.value)}
            placeholder="Спроси о сюжете, персонажах или скомандуй изменить стиль/длину глав..."
            disabled={isLoading}
            className="flex-1 bg-transparent px-3 py-1.5 text-xs sm:text-sm text-neutral-100 placeholder-neutral-500 focus:outline-none disabled:opacity-50"
          />

          <button
            type="submit"
            disabled={!inputPrompt.trim() || isLoading}
            className="p-2 sm:px-4 sm:py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold disabled:opacity-40 disabled:hover:bg-purple-600 flex items-center gap-1.5 transition-all shadow-md shadow-purple-900/30 shrink-0"
          >
            {isLoading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <>
                <Send className="w-4 h-4" />
                <span className="hidden sm:inline">Отправить</span>
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  );
};
