import React, { useState } from "react";
import {
  X,
  Download,
  Upload,
  FileText,
  FileJson,
  BookOpen,
  Sparkles,
  Check,
  Copy,
  ArrowRight,
  RefreshCw,
  HelpCircle,
  Package,
  Users2,
  BookMarked,
  Bot,
  MessageSquare,
  Compass,
  CheckCircle2,
  Clock,
  Layers,
  Sliders,
  AlertCircle,
} from "lucide-react";
import {
  ActiveGameState,
  NarrativePOV,
  NarrativeStyle,
  SceneFocus,
  Story,
  StoryGenre,
  StoryChatMessage,
} from "../types";
import { sound } from "../utils/audio";
import { safeFetchJson } from "../utils/safeApi";

interface StoryExportImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  gameState: ActiveGameState | null;
  onImportGameState: (newState: ActiveGameState) => void;
  customApiKey?: string;
  aiPromptDirective?: string;
}

export const StoryExportImportModal: React.FC<StoryExportImportModalProps> = ({
  isOpen,
  onClose,
  gameState,
  onImportGameState,
  customApiKey,
  aiPromptDirective,
}) => {
  const [activeTab, setActiveTab] = useState<"export" | "import">("export");
  const [exportFormat, setExportFormat] = useState<"json" | "markdown" | "coauthor" | "chapter">("json");
  const [copied, setCopied] = useState(false);
  const [includeChat, setIncludeChat] = useState(true);
  const [includeAcceptedEdits, setIncludeAcceptedEdits] = useState(true);
  const [includeLore, setIncludeLore] = useState(true);
  const [importNotification, setImportNotification] = useState<string | null>(null);

  // Import states
  const [importMode, setImportMode] = useState<"ai-text" | "json-file">("ai-text");
  const [rawTextToAnalyze, setRawTextToAnalyze] = useState("");
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analyzedResult, setAnalyzedResult] = useState<any | null>(null);
  const [jsonError, setJsonError] = useState<string | null>(null);

  if (!isOpen) return null;

  // Helper: Format date & time
  const formatDateTime = (ts?: number) => {
    if (!ts) return "";
    return new Date(ts).toLocaleString("ru-RU", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  // Helper: Retrieve all co-author chat messages merged and sorted chronologically
  const getFullChatHistory = (): StoryChatMessage[] => {
    if (!gameState) return [];
    const list: StoryChatMessage[] = [];
    const seen = new Set<string>();

    const addMsg = (m: StoryChatMessage) => {
      if (m && m.id && !seen.has(m.id)) {
        seen.add(m.id);
        list.push(m);
      }
    };

    if (Array.isArray(gameState.chatHistory)) {
      gameState.chatHistory.forEach(addMsg);
    }

    try {
      const saved = localStorage.getItem(`storyzone_chat_${gameState.story.id}`);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          parsed.forEach(addMsg);
        }
      }
    } catch (e) {}

    list.sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0));
    return list;
  };

  // Helper: Translate proposal type to Russian
  const formatProposalType = (type: string) => {
    switch (type) {
      case "change_style": return "Стиль повествования";
      case "change_length": return "Настройка длины глав";
      case "change_genre": return "Изменение жанра";
      case "add_character": return "Добавление спутника";
      case "update_character": return "Отношения & Статус спутника";
      case "inject_scene": return "Сюжетная вставка в сцену";
      case "execute_action": return "Реализация авторского хода";
      case "update_directive": return "Директива ИИ-Соавтору";
      case "update_universe": return "Сеттинг & Законы вселенной";
      case "add_lore_fact": return "Новая тайна лорбука";
      default: return "Сюжетная правка";
    }
  };

  // Helper: Extract accepted co-author edits
  const getAcceptedCoAuthorEdits = (messages: StoryChatMessage[]) => {
    const edits: Array<{
      id: string;
      title: string;
      type: string;
      typeLabel: string;
      description: string;
      timestamp: number;
      payload?: any;
    }> = [];

    messages.forEach((m) => {
      if (m.actionProposal && m.actionProposal.applied) {
        edits.push({
          id: m.id,
          title: m.actionProposal.title,
          type: m.actionProposal.type,
          typeLabel: formatProposalType(m.actionProposal.type),
          description: m.actionProposal.description,
          timestamp: m.timestamp,
          payload: m.actionProposal.payload,
        });
      }
    });

    return edits;
  };

  const currentChatHistory = getFullChatHistory();
  const currentAcceptedEdits = getAcceptedCoAuthorEdits(currentChatHistory);
  const currentEditedChapters = (gameState?.history || []).filter((h) => h.wasEdited);

  // 1. Build JSON export (Complete Full-Archive Dump)
  const generateJsonExport = () => {
    if (!gameState) return "{}";
    const chatMessages = getFullChatHistory();
    const acceptedCoAuthorEdits = getAcceptedCoAuthorEdits(chatMessages);
    const editedChapters = (gameState.history || []).filter((h) => h.wasEdited);
    const activeDirective =
      aiPromptDirective ||
      (typeof localStorage !== "undefined" ? localStorage.getItem("storyzone_prompt_directive") : null);

    const exportData = {
      app: "StoryZone",
      version: "3.0",
      exportedAt: new Date().toISOString(),
      metadata: {
        storyTitle: gameState.story.title,
        genre: gameState.story.genre,
        author: gameState.story.author || "Автор",
        stepCount: gameState.stepCount,
        chaptersCount: gameState.memoryChapters?.length || 1,
        totalChatMessages: chatMessages.length,
        acceptedCoAuthorEditsCount: acceptedCoAuthorEdits.length,
        editedChaptersCount: editedChapters.length,
      },
      gameState: {
        story: gameState.story,
        currentScene: gameState.currentScene,
        dialogueSpeaker: gameState.dialogueSpeaker,
        playerStats: gameState.playerStats,
        inventory: gameState.inventory,
        characters: gameState.characters,
        history: gameState.history,
        currentChoices: gameState.currentChoices,
        stepCount: gameState.stepCount,
        atmosphere: gameState.atmosphere,
        memoryChapters: gameState.memoryChapters,
        lorebook: gameState.lorebook,
        branches: gameState.branches,
        activeBranchId: gameState.activeBranchId,
        narrativeStyle: gameState.narrativeStyle,
        narrativePOV: gameState.narrativePOV,
        currentFocus: gameState.currentFocus,
        sceneArtUrl: gameState.sceneArtUrl,
        universeSetting: gameState.universeSetting,
        suggestedMusic: gameState.suggestedMusic,
        ultraMemory: gameState.ultraMemory,
        divergenceLog: gameState.divergenceLog,
        chatHistory: chatMessages,
        aiPromptDirective: activeDirective || undefined,
      },
      coAuthorCollaboration: {
        totalDiscussions: chatMessages.length,
        acceptedEditsCount: acceptedCoAuthorEdits.length,
        acceptedEdits: acceptedCoAuthorEdits,
        chatMessages: chatMessages,
        promptDirective: activeDirective,
        editedChapters: editedChapters.map((ch) => ({
          stepNumber: ch.stepNumber,
          action: ch.action,
          sceneText: ch.sceneText,
          wasEdited: true,
          timestamp: ch.timestamp,
        })),
      },
    };
    return JSON.stringify(exportData, null, 2);
  };

  // 2. Build Book Markdown export
  const generateMarkdownBook = () => {
    if (!gameState) return "";
    const chatMessages = getFullChatHistory();
    const acceptedCoAuthorEdits = getAcceptedCoAuthorEdits(chatMessages);
    const universe = gameState.universeSetting || {
      universeName: gameState.story.fandomSource || gameState.story.genre,
    };

    let md = `# ${gameState.story.title}\n`;
    md += `*Жанр: ${gameState.story.genre} | Автор: ${gameState.story.author || "Игрок"} | Вселенная: ${universe.universeName}*\n`;
    md += `*Дата сохранения: ${formatDateTime(Date.now())} | Шагов в сюжете: ${gameState.stepCount} | Глав: ${gameState.memoryChapters?.length || 1}*\n\n`;
    md += `## Пролог и Синопсис\n${gameState.story.synopsis}\n\n`;
    md += `---\n\n`;

    // Chronicle of steps and chapters
    md += `## Хроника Событий и Глав\n\n`;
    (gameState.history || []).forEach((item, idx) => {
      const matchingMem = gameState.memoryChapters?.find((m) => m.chapterNumber === item.stepNumber);
      const chapterTitle = matchingMem?.title || `Эпизод ${idx + 1}`;
      const actionText = matchingMem?.chosenAction || item.action || "Ход событий";

      md += `### ${chapterTitle}: ${actionText}\n`;
      if (item.timestamp) {
        md += `*Время: ${formatDateTime(item.timestamp)}*\n\n`;
      }
      md += `> **Выбранное действие / ход автора:** «${actionText}»\n\n`;

      if (item.dialogueSpeaker) {
        md += `> **Говорит ${item.dialogueSpeaker}:**\n\n`;
      }
      md += `${item.sceneText}\n\n`;

      if (item.wasEdited) {
        md += `*(✏️ Текст этой главы был отредактирован автором и адаптирован ИИ)*\n\n`;
      }

      if (item.newItems && item.newItems.length > 0) {
        md += `*Получено: ${item.newItems.join(", ")}*\n\n`;
      }
    });

    // Current scene climax
    md += `### Текущий момент (Кульминация)\n\n${gameState.currentScene}\n\n`;

    // Accepted Co-Author Edits Registry
    if (includeAcceptedEdits && acceptedCoAuthorEdits.length > 0) {
      md += `---\n\n## Принятые правки и решения с ИИ-Соавтором\n\n`;
      md += `Ниже зафиксированы все решения, развилки и сюжетные корректировки, предложенные ИИ-Соавтором и принятые автором:\n\n`;
      acceptedCoAuthorEdits.forEach((edit, idx) => {
        md += `### ${idx + 1}. [${edit.typeLabel}] ${edit.title}\n`;
        md += `> **Время принятия:** ${formatDateTime(edit.timestamp)}\n`;
        md += `> **Суть правки:** ${edit.description}\n`;
        if (edit.payload) {
          if (edit.payload.style) md += `> **Установленный стиль:** ${edit.payload.style}\n`;
          if (edit.payload.length) md += `> **Длина глав:** ${edit.payload.length}\n`;
          if (edit.payload.directive) md += `> **Директива автору/ИИ:** «${edit.payload.directive}»\n`;
          if (edit.payload.character) md += `> **Персонаж:** ${edit.payload.character.name} (${edit.payload.character.role})\n`;
          if (edit.payload.newSceneText) md += `> **Сюжетная вставка:** «${edit.payload.newSceneText}»\n`;
          if (edit.payload.actionLabel) md += `> **Воплощённое действие:** «${edit.payload.actionLabel}»\n`;
        }
        md += `\n`;
      });
    }

    // Co-Author Full Discussion Transcript
    if (includeChat && chatMessages.length > 0) {
      md += `---\n\n## Стенограмма обсуждений с ИИ-Соавтором\n\n`;
      md += `Полный протокол творческих консультаций, вопросов автора и предложений ИИ-Соавтора по сюжету:\n\n`;
      chatMessages.forEach((msg, idx) => {
        const roleName = msg.role === "user" ? "👤 Автор" : msg.role === "assistant" ? "🤖 ИИ-Соавтор" : "⚙️ Система";
        md += `#### #${idx + 1} ${roleName} *(${formatDateTime(msg.timestamp)})*\n\n`;
        md += `${msg.content}\n\n`;

        if (msg.actionProposal) {
          md += `> 📌 **Предложение:** ${msg.actionProposal.title}\n`;
          md += `> *Статус:* ${msg.actionProposal.applied ? "✅ Принято автором и внедрено" : "⏳ На рассмотрении"}\n`;
          md += `> *Описание:* ${msg.actionProposal.description}\n\n`;
        }
      });
    }

    // Companions & Lore Appendix
    if (includeLore) {
      md += `---\n\n## Спутники & Отношения\n`;
      gameState.characters.forEach((c) => {
        md += `- **${c.name}** (${c.role}): Отношение ${c.affinity || 50}%. Черты: ${(c.traits || []).join(", ")}. ${c.bio || ""}\n`;
      });

      if (gameState.lorebook && gameState.lorebook.length > 0) {
        md += `\n## Лорбук & Мироустройство\n`;
        gameState.lorebook.forEach((l) => {
          md += `- **[${l.category}] ${l.title}**: ${l.description}\n`;
        });
      }
    }

    return md;
  };

  // 3. Dedicated Co-Author Collaboration Chronicle Export
  const generateCoAuthorReport = () => {
    if (!gameState) return "";
    const messages = getFullChatHistory();
    const acceptedEdits = getAcceptedCoAuthorEdits(messages);
    const editedChapters = (gameState.history || []).filter((h) => h.wasEdited);
    const universe = gameState.universeSetting || {
      universeName: gameState.story.fandomSource || gameState.story.genre,
    };
    const activeDirective =
      aiPromptDirective ||
      (typeof localStorage !== "undefined" ? localStorage.getItem("storyzone_prompt_directive") : null);

    let md = `# Стенограмма обсуждений & Принятые правки с ИИ-Соавтором\n`;
    md += `## Книга: «${gameState.story.title}»\n\n`;
    md += `*Экспортировано: ${formatDateTime(Date.now())} | Жанр: ${gameState.story.genre} | Вселенная: ${universe.universeName}*\n\n`;
    md += `---\n\n`;

    // Overview Stats
    md += `### Сводка творческого сотрудничества\n`;
    md += `- **Всего реплик и обсуждений в чате:** ${messages.length}\n`;
    md += `- **Принятых предложений и правок соавтора:** ${acceptedEdits.length}\n`;
    md += `- **Отредактированных автором глав повести:** ${editedChapters.length}\n`;
    md += `- **Текущий стиль повести:** ${gameState.narrativeStyle || "Литературный"}\n`;
    if (activeDirective) {
      md += `- **Активная авторская директива:** «${activeDirective}»\n`;
    }
    md += `\n---\n\n`;

    // Section 1: Accepted Edits & Proposals
    md += `## 1. Реестр принятых правок и согласованных решений\n\n`;
    if (acceptedEdits.length === 0) {
      md += `*Пока не зафиксировано применённых правок через интерфейс предложений соавтора.*\n\n`;
    } else {
      acceptedEdits.forEach((edit, idx) => {
        md += `### ${idx + 1}. [${edit.typeLabel}] ${edit.title}\n`;
        md += `> **Дата и время:** ${formatDateTime(edit.timestamp)}\n`;
        md += `> **Описание:** ${edit.description}\n`;
        if (edit.payload) {
          if (edit.payload.style) md += `> **Установленный стиль:** ${edit.payload.style}\n`;
          if (edit.payload.length) md += `> **Объём генерации:** ${edit.payload.length}\n`;
          if (edit.payload.directive) md += `> **Текст директивы:** «${edit.payload.directive}»\n`;
          if (edit.payload.character) md += `> **Параметры персонажа:** ${edit.payload.character.name} (${edit.payload.character.role})\n`;
          if (edit.payload.newSceneText) md += `> **Вставка в сцену:** «${edit.payload.newSceneText}»\n`;
          if (edit.payload.actionLabel) md += `> **Воплощённое действие:** «${edit.payload.actionLabel}»\n`;
          if (edit.payload.title && edit.payload.description) md += `> **Факт лорбука:** ${edit.payload.title} — ${edit.payload.description}\n`;
        }
        md += `\n`;
      });
    }

    // Section 2: Manually edited chapters
    if (editedChapters.length > 0) {
      md += `## 2. Журнал глав с авторской редактурой текста\n\n`;
      editedChapters.forEach((ch) => {
        md += `### Эпизод #${ch.stepNumber}: ${ch.action}\n`;
        md += `*(Текст был отредактирован автором и синхронизирован со стилем ИИ)*\n\n`;
        md += `> ${ch.sceneText}\n\n`;
      });
      md += `---\n\n`;
    }

    // Section 3: Full transcript of discussions
    md += `## 3. Полная стенограмма творческих бесед с ИИ-Соавтором\n\n`;
    if (messages.length === 0) {
      md += `*Диалог с соавтором пока не содержит сохранённых сообщений.*\n\n`;
    } else {
      messages.forEach((msg, idx) => {
        const roleLabel = msg.role === "user" ? "👤 Автор" : msg.role === "assistant" ? "🤖 ИИ-Соавтор" : "⚙️ Система";
        md += `#### Реплика #${idx + 1} — ${roleLabel} *(${formatDateTime(msg.timestamp)})*\n\n`;
        md += `${msg.content}\n\n`;

        if (msg.actionProposal) {
          md += `> 📌 **Предложение соавтора:** ${msg.actionProposal.title}\n`;
          md += `> *Статус:* ${msg.actionProposal.applied ? "✅ Принято автором и внедрено в повесть" : "⏳ Оставлено на рассмотрение"}\n`;
          md += `> *Суть:* ${msg.actionProposal.description}\n\n`;
        }
      });
    }

    return md;
  };

  // 4. Single chapter export
  const generateSingleChapterText = () => {
    if (!gameState) return "";
    const lastHistory = gameState.history?.[gameState.history.length - 1];
    return `ГЛАВА ${gameState.memoryChapters?.length || 1}: ${gameState.story.title}\n` +
      `Действие: «${lastHistory?.action || "Продолжение пути"}»\n\n` +
      `${gameState.currentScene}\n\n` +
      `ДОСТУПНЫЕ ВЫБОРЫ:\n` +
      gameState.currentChoices.map((c, i) => `${i + 1}. ${c.label} (${c.description || ""})`).join("\n");
  };

  const getCurrentExportString = () => {
    if (exportFormat === "json") return generateJsonExport();
    if (exportFormat === "markdown") return generateMarkdownBook();
    if (exportFormat === "coauthor") return generateCoAuthorReport();
    return generateSingleChapterText();
  };

  const handleCopy = () => {
    const text = getCurrentExportString();
    navigator.clipboard.writeText(text);
    setCopied(true);
    sound.playClick();
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    const text = getCurrentExportString();
    const isJson = exportFormat === "json";
    const extension = isJson ? "json" : exportFormat === "chapter" ? "txt" : "md";
    const mime = isJson ? "application/json" : "text/markdown";
    const blob = new Blob([text], { type: `${mime};charset=utf-8` });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    const safeTitle = (gameState?.story.title || "story").replace(/\s+/g, "_");
    const suffix =
      exportFormat === "json"
        ? "FullArchive"
        : exportFormat === "markdown"
        ? "BookChronicle"
        : exportFormat === "coauthor"
        ? "CoAuthorDiscussionsAndEdits"
        : "Chapter";
    link.download = `StoryZone_${safeTitle}_${suffix}.${extension}`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    sound.playFanfare();
  };

  // Handle JSON file upload
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const text = evt.target?.result as string;
        const parsed = JSON.parse(text);
        let importedState: ActiveGameState | null = null;

        if (parsed.gameState) {
          importedState = { ...parsed.gameState };
        } else if (parsed.story && parsed.currentScene) {
          importedState = { ...parsed };
        }

        if (importedState) {
          const storyId = importedState.story?.id;

          // Restore co-author chat messages
          const chatHist =
            parsed.coAuthorCollaboration?.chatMessages ||
            parsed.coAuthorArchive?.fullChatTranscript ||
            importedState.chatHistory ||
            [];

          if (Array.isArray(chatHist) && chatHist.length > 0 && storyId) {
            try {
              localStorage.setItem(`storyzone_chat_${storyId}`, JSON.stringify(chatHist));
            } catch (e) {}
            importedState.chatHistory = chatHist;
          }

          // Restore prompt directive
          const promptDirective =
            parsed.coAuthorCollaboration?.promptDirective ||
            parsed.coAuthorArchive?.activePromptDirective ||
            importedState.aiPromptDirective;

          if (promptDirective) {
            try {
              localStorage.setItem("storyzone_prompt_directive", promptDirective);
            } catch (e) {}
            importedState.aiPromptDirective = promptDirective;
          }

          onImportGameState(importedState);
          sound.playFanfare();
          onClose();
        } else {
          setJsonError("Файл не является валидным сохранением StoryZone.");
        }
      } catch (err: any) {
        setJsonError("Ошибка чтения JSON: " + (err.message || "Неверный формат"));
      }
    };
    reader.readAsText(file);
  };

  // AI Deep Import Analysis of any text
  const handleAnalyzeText = async () => {
    if (!rawTextToAnalyze.trim() || rawTextToAnalyze.trim().length < 25) return;
    setIsAnalyzing(true);
    setAnalyzedResult(null);
    sound.playClick();

    try {
      const res = await safeFetchJson<any>("/api/story/import-analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          importedText: rawTextToAnalyze,
          customKey: customApiKey,
        }),
      });

      if (res.ok && res.data) {
        setAnalyzedResult(res.data);
        sound.playFanfare();
      }
    } catch (e: any) {
      console.error("Analysis error:", e);
    } finally {
      setIsAnalyzing(false);
    }
  };

  // Launch game from AI analyzed text
  const handleLaunchAnalyzedStory = () => {
    if (!analyzedResult) return;

    const importedStory: Story = {
      id: `imported_${Date.now()}`,
      title: analyzedResult.title || "Импортированная история",
      genre: (analyzedResult.genre as StoryGenre) || "Фэнтези",
      synopsis: analyzedResult.synopsis || "История продолжена из импортированного текста.",
      coverImage: "https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=1200&q=80",
      tags: ["Импорт", analyzedResult.genre || "Приключения"],
      rating: 5.0,
      playsCount: 1,
      estimatedTime: "25 мин",
      author: "Импортированный текст",
      difficulty: "Средне",
      startingScene: analyzedResult.currentScene,
      initialChoices: (analyzedResult.starterChoices || []).map((c: any, i: number) => ({
        id: c.id || String(i + 1),
        label: c.label || "Продолжить путь",
        description: c.description,
        statCheck: c.statCheck,
        diceDifficulty: c.diceDifficulty,
      })),
      characters: (analyzedResult.characters || []).map((c: any, i: number) => ({
        id: `char_imp_${i}`,
        name: c.name || "Спутник",
        role: c.role || "Союзник",
        avatar: c.avatar || "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=400",
        bio: c.bio || "Спутник из импортированного сюжета.",
        affinity: c.affinity ?? 60,
        affinityTitle: c.affinityTitle || "Союзник",
        temperament: c.temperament || "сангвиник",
        traits: c.traits || ["Преданный"],
        habits: c.habits || ["Наблюдательный"],
        speechStyle: c.speechStyle,
        isLockedTraits: false,
      })),
      startingStats: analyzedResult.startingStats || {
        hp: 100,
        maxHp: 100,
        energy: 100,
        maxEnergy: 100,
        gold: 50,
        karma: 0,
      },
      startingInventory: analyzedResult.startingInventory || ["Дорожное снаряжение"],
      atmosphere: analyzedResult.atmosphere || "mysterious",
      narrativeStyle: (analyzedResult.narrativeStyle as NarrativeStyle) || NarrativeStyle.LITERARY,
      narrativePOV: (analyzedResult.narrativePOV as NarrativePOV) || NarrativePOV.SECOND,
    };

    const newGameState: ActiveGameState = {
      story: importedStory,
      currentScene: analyzedResult.currentScene,
      playerStats: { ...importedStory.startingStats },
      inventory: [...importedStory.startingInventory],
      characters: [...importedStory.characters],
      history: [
        {
          id: "step_init_imp",
          stepNumber: 1,
          action: "Импорт: Начало с заданной точки",
          sceneText: analyzedResult.currentScene,
          timestamp: Date.now(),
          choicesGiven: importedStory.initialChoices,
        },
      ],
      currentChoices: [...importedStory.initialChoices],
      stepCount: 1,
      atmosphere: importedStory.atmosphere || "mysterious",
      memoryChapters: (analyzedResult.memoryChapters || []).map((m: any, idx: number) => ({
        id: `mem_imp_${idx}`,
        chapterNumber: m.chapterNumber || idx + 1,
        title: m.title || "Начало хроники",
        summary: m.summary || "Импортированные события зафиксированы в памяти.",
        keyFacts: m.keyFacts || ["Контекст импортированного текста сохранён"],
        timestamp: Date.now(),
      })),
      lorebook: (analyzedResult.lorebook || []).map((l: any, idx: number) => ({
        id: `lore_imp_${idx}`,
        category: l.category || "локация",
        title: l.title || "Мир истории",
        description: l.description || "Окружающий мир из текста.",
      })),
      branches: [],
      activeBranchId: "main",
      narrativeStyle: importedStory.narrativeStyle || NarrativeStyle.LITERARY,
      narrativePOV: importedStory.narrativePOV || NarrativePOV.SECOND,
      currentFocus: SceneFocus.GENERAL,
      suggestedMusic: "mystic",
      isLoading: false,
      isEnding: false,
    };

    onImportGameState(newGameState);
    sound.playFanfare();
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/85 backdrop-blur-md animate-fade-in">
      <div className="relative w-full max-w-4xl bg-neutral-950 border border-neutral-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-neutral-800 bg-neutral-900/80">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-purple-950/80 border border-purple-800/60 flex items-center justify-center text-purple-400">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <h2 className="font-cinzel text-lg font-bold text-neutral-100 flex items-center gap-2">
                Импорт & Экспорт Истории
                <span className="text-xs px-2 py-0.5 rounded-full bg-purple-950 border border-purple-800/60 text-purple-300 font-sans font-normal">
                  Синхронизация
                </span>
              </h2>
              <p className="text-xs text-neutral-400">
                Сохраняйте книги, переносите прогресс или продолжайте любой текст с ИИ
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Tab switch */}
            <div className="flex items-center p-1 rounded-xl bg-neutral-950 border border-neutral-800 text-xs">
              <button
                id="tab-export"
                onClick={() => {
                  sound.playClick();
                  setActiveTab("export");
                }}
                className={`flex items-center gap-1.5 px-3 py-1 rounded-lg transition-all ${
                  activeTab === "export"
                    ? "bg-purple-600 text-white font-semibold"
                    : "text-neutral-400 hover:text-neutral-200"
                }`}
              >
                <Download className="w-3.5 h-3.5" />
                <span>Экспорт</span>
              </button>
              <button
                id="tab-import"
                onClick={() => {
                  sound.playClick();
                  setActiveTab("import");
                }}
                className={`flex items-center gap-1.5 px-3 py-1 rounded-lg transition-all ${
                  activeTab === "import"
                    ? "bg-purple-600 text-white font-semibold"
                    : "text-neutral-400 hover:text-neutral-200"
                }`}
              >
                <Upload className="w-3.5 h-3.5" />
                <span>Импорт & ИИ-Анализ</span>
              </button>
            </div>

            <button
              onClick={onClose}
              className="p-1.5 rounded-lg bg-neutral-900 hover:bg-neutral-800 text-neutral-400 hover:text-neutral-200 border border-neutral-800 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6">
          {activeTab === "export" ? (
            /* EXPORT TAB */
            <div className="space-y-5">
              {/* Stats overview banner */}
              <div className="flex flex-wrap items-center gap-2 px-4 py-2.5 rounded-xl bg-purple-950/40 border border-purple-800/40 text-xs">
                <span className="font-semibold text-purple-200 flex items-center gap-1.5 mr-1">
                  <Bot className="w-4 h-4 text-purple-400" />
                  Готово к экспорту:
                </span>
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-purple-900/60 text-purple-200 font-mono text-[11px]">
                  <MessageSquare className="w-3 h-3 text-purple-300" />
                  {currentChatHistory.length} обсуждений
                </span>
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-950/80 border border-emerald-800/50 text-emerald-300 font-mono text-[11px]">
                  <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                  {currentAcceptedEdits.length} принятых правок
                </span>
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-neutral-900 text-neutral-300 font-mono text-[11px]">
                  <BookOpen className="w-3 h-3 text-amber-400" />
                  {gameState?.memoryChapters?.length || 1} глав
                </span>
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-neutral-900 text-neutral-300 font-mono text-[11px]">
                  <Users2 className="w-3 h-3 text-cyan-400" />
                  {gameState?.characters?.length || 0} спутников
                </span>
              </div>

              {/* Format Switcher */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                <button
                  onClick={() => setExportFormat("json")}
                  className={`p-3.5 rounded-xl border text-left flex items-start gap-3 transition-all ${
                    exportFormat === "json"
                      ? "bg-purple-950/70 border-purple-500 text-purple-200 shadow-md ring-1 ring-purple-500/40"
                      : "bg-neutral-900/60 border-neutral-800 text-neutral-400 hover:text-neutral-200 hover:border-neutral-700"
                  }`}
                >
                  <FileJson className="w-5 h-5 text-purple-400 shrink-0 mt-0.5" />
                  <div>
                    <div className="font-semibold text-xs text-neutral-100 flex items-center gap-1.5">
                      <span>Полный архив (JSON)</span>
                    </div>
                    <div className="text-[11px] opacity-75 mt-0.5">
                      Вся повесть, главы, статы + <strong>все обсуждения и принятые правки</strong>
                    </div>
                  </div>
                </button>

                <button
                  onClick={() => setExportFormat("markdown")}
                  className={`p-3.5 rounded-xl border text-left flex items-start gap-3 transition-all ${
                    exportFormat === "markdown"
                      ? "bg-purple-950/70 border-purple-500 text-purple-200 shadow-md ring-1 ring-purple-500/40"
                      : "bg-neutral-900/60 border-neutral-800 text-neutral-400 hover:text-neutral-200 hover:border-neutral-700"
                  }`}
                >
                  <BookOpen className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
                  <div>
                    <div className="font-semibold text-xs text-neutral-100">Книга & Роман (MD)</div>
                    <div className="text-[11px] opacity-75 mt-0.5">
                      Художественный текст всей истории с главами, выборами и стенограммой
                    </div>
                  </div>
                </button>

                <button
                  onClick={() => setExportFormat("coauthor")}
                  className={`p-3.5 rounded-xl border text-left flex items-start gap-3 transition-all ${
                    exportFormat === "coauthor"
                      ? "bg-purple-950/70 border-purple-500 text-purple-200 shadow-md ring-1 ring-purple-500/40"
                      : "bg-neutral-900/60 border-neutral-800 text-neutral-400 hover:text-neutral-200 hover:border-neutral-700"
                  }`}
                >
                  <Bot className="w-5 h-5 text-cyan-400 shrink-0 mt-0.5" />
                  <div>
                    <div className="font-semibold text-xs text-neutral-100 flex items-center gap-1">
                      <span>Диалоги соавтора</span>
                    </div>
                    <div className="text-[11px] opacity-75 mt-0.5">
                      Отдельная стенограмма бесед с соавтором и реестр согласованных правок
                    </div>
                  </div>
                </button>

                <button
                  onClick={() => setExportFormat("chapter")}
                  className={`p-3.5 rounded-xl border text-left flex items-start gap-3 transition-all ${
                    exportFormat === "chapter"
                      ? "bg-purple-950/70 border-purple-500 text-purple-200 shadow-md ring-1 ring-purple-500/40"
                      : "bg-neutral-900/60 border-neutral-800 text-neutral-400 hover:text-neutral-200 hover:border-neutral-700"
                  }`}
                >
                  <FileText className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
                  <div>
                    <div className="font-semibold text-xs text-neutral-100">Текущая глава</div>
                    <div className="text-[11px] opacity-75 mt-0.5">
                      Текст только текущей сцены, действие и доступные выборы
                    </div>
                  </div>
                </button>
              </div>

              {/* Toggles for Markdown and Co-Author exports */}
              {(exportFormat === "markdown" || exportFormat === "coauthor") && (
                <div className="flex flex-wrap items-center gap-4 p-3 rounded-xl bg-neutral-900/80 border border-neutral-800 text-xs">
                  <span className="text-neutral-400 font-semibold flex items-center gap-1.5">
                    <Sliders className="w-3.5 h-3.5 text-purple-400" />
                    Настройки экспорта:
                  </span>
                  <label className="flex items-center gap-1.5 cursor-pointer text-neutral-200 hover:text-white">
                    <input
                      type="checkbox"
                      checked={includeChat}
                      onChange={(e) => setIncludeChat(e.target.checked)}
                      className="rounded border-neutral-700 text-purple-600 focus:ring-purple-500"
                    />
                    <span>Стенограмма обсуждений ({currentChatHistory.length})</span>
                  </label>
                  <label className="flex items-center gap-1.5 cursor-pointer text-neutral-200 hover:text-white">
                    <input
                      type="checkbox"
                      checked={includeAcceptedEdits}
                      onChange={(e) => setIncludeAcceptedEdits(e.target.checked)}
                      className="rounded border-neutral-700 text-purple-600 focus:ring-purple-500"
                    />
                    <span>Реестр принятых правок ({currentAcceptedEdits.length})</span>
                  </label>
                  <label className="flex items-center gap-1.5 cursor-pointer text-neutral-200 hover:text-white">
                    <input
                      type="checkbox"
                      checked={includeLore}
                      onChange={(e) => setIncludeLore(e.target.checked)}
                      className="rounded border-neutral-700 text-purple-600 focus:ring-purple-500"
                    />
                    <span>Досье спутников и лорбук</span>
                  </label>
                </div>
              )}

              {/* Actions & Preview */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-neutral-400 font-semibold">
                    Предпросмотр экспортируемого содержимого:
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={handleCopy}
                      className="px-3 py-1.5 rounded-lg bg-neutral-900 hover:bg-neutral-800 border border-neutral-800 text-xs text-neutral-300 flex items-center gap-1.5 transition-colors"
                    >
                      {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                      <span>{copied ? "Скопировано!" : "Копировать"}</span>
                    </button>
                    <button
                      onClick={handleDownload}
                      className="px-3 py-1.5 rounded-lg bg-purple-600 hover:bg-purple-500 text-xs text-white font-semibold flex items-center gap-1.5 shadow-md transition-colors"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>Скачать файл</span>
                    </button>
                  </div>
                </div>

                <div className="w-full h-72 rounded-xl bg-neutral-950 border border-neutral-800 p-4 font-mono-code text-xs text-neutral-300 overflow-y-auto whitespace-pre-wrap leading-relaxed">
                  {getCurrentExportString()}
                </div>
              </div>
            </div>
          ) : (
            /* IMPORT TAB */
            <div className="space-y-5">
              {/* Import Mode Switcher */}
              <div className="flex items-center gap-2 border-b border-neutral-800 pb-3">
                <button
                  onClick={() => setImportMode("ai-text")}
                  className={`px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-2 transition-all ${
                    importMode === "ai-text"
                      ? "bg-purple-950 border border-purple-700 text-purple-200"
                      : "text-neutral-400 hover:text-neutral-200"
                  }`}
                >
                  <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                  <span>Интеллектуальный ИИ-импорт текста (Главы, Фанфики, Книги)</span>
                </button>
                <button
                  onClick={() => setImportMode("json-file")}
                  className={`px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-2 transition-all ${
                    importMode === "json-file"
                      ? "bg-purple-950 border border-purple-700 text-purple-200"
                      : "text-neutral-400 hover:text-neutral-200"
                  }`}
                >
                  <FileJson className="w-3.5 h-3.5 text-purple-400" />
                  <span>Загрузка файла сохранения (.json)</span>
                </button>
              </div>

              {importMode === "ai-text" ? (
                /* AI Deep Text Import */
                <div className="space-y-4">
                  <div className="p-4 rounded-xl bg-purple-950/30 border border-purple-900/40 text-xs text-purple-200 flex items-start gap-3">
                    <Sparkles className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
                    <div>
                      <p className="font-semibold text-purple-100">
                        Продолжайте любую историю с любого момента с полным учётом контекста!
                      </p>
                      <p className="text-neutral-300 text-[11px] mt-1">
                        Вставьте сюда произвольный текст (главу книги, фанфик, сценарий или черновик). ИИ проанализирует сюжет, выявит всех персонажей с их чертами характера и привычками, соберёт инвентарь и сформирует интерактивную игру для продолжения прямо с этого места!
                      </p>
                    </div>
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-neutral-300 block mb-1.5">
                      Вставьте текст истории или отдельной главы:
                    </label>
                    <textarea
                      value={rawTextToAnalyze}
                      onChange={(e) => setRawTextToAnalyze(e.target.value)}
                      placeholder="Вставьте сюда текст главы, фанфика или книги... Например: «Капитан рейнджеров Элиан опустил клинок и взглянул на руины древней цитадели. В его сумке глухо звенел кристалл Безмолвия, а юная волшебница Арья уже чертила защитный круг на сырой земле...»"
                      rows={8}
                      className="w-full p-4 rounded-xl bg-neutral-900/90 border border-neutral-800 text-xs text-neutral-200 focus:outline-none focus:border-purple-600 font-story leading-relaxed"
                    />
                  </div>

                  <button
                    onClick={handleAnalyzeText}
                    disabled={isAnalyzing || rawTextToAnalyze.trim().length < 25}
                    className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-purple-700 via-indigo-600 to-purple-800 hover:from-purple-600 hover:to-indigo-500 text-white font-semibold text-xs shadow-lg flex items-center justify-center gap-2 transition-all disabled:opacity-50"
                  >
                    {isAnalyzing ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin text-purple-200" />
                        <span>ИИ анализирует персонажей, инвентарь и контекст сюжета...</span>
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-4 h-4 text-amber-300" />
                        <span>Проанализировать через ИИ и подготовить интерактивное продолжение</span>
                      </>
                    )}
                  </button>

                  {/* Analysis Result Card */}
                  {analyzedResult && (
                    <div className="p-5 rounded-2xl bg-neutral-900/90 border border-purple-800/60 shadow-xl space-y-4 animate-fade-in">
                      <div className="flex items-center justify-between border-b border-neutral-800 pb-3">
                        <div>
                          <span className="text-[10px] uppercase font-bold text-purple-400">
                            Сюжет успешно структурирован
                          </span>
                          <h3 className="font-cinzel text-base font-bold text-neutral-100">
                            {analyzedResult.title}
                          </h3>
                        </div>
                        <span className="px-2.5 py-1 rounded-full bg-purple-950 border border-purple-800 text-purple-300 text-xs">
                          {analyzedResult.genre}
                        </span>
                      </div>

                      {/* Characters detected */}
                      {analyzedResult.characters && analyzedResult.characters.length > 0 && (
                        <div>
                          <span className="text-xs text-neutral-400 font-semibold flex items-center gap-1.5 mb-2">
                            <Users2 className="w-3.5 h-3.5 text-purple-400" />
                            Распознанные спутники и персонажи:
                          </span>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                            {analyzedResult.characters.map((c: any, i: number) => (
                              <div
                                key={i}
                                className="p-2.5 rounded-xl bg-neutral-950 border border-neutral-800 flex items-center gap-2.5"
                              >
                                <img
                                  src={c.avatar || "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=400"}
                                  alt={c.name}
                                  className="w-8 h-8 rounded-full object-cover border border-purple-500/40"
                                />
                                <div className="min-w-0">
                                  <div className="font-semibold text-xs text-neutral-200 truncate">
                                    {c.name} ({c.role})
                                  </div>
                                  <div className="text-[10px] text-neutral-400 truncate">
                                    {c.temperament} • {(c.traits || []).join(", ")}
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Starting Inventory */}
                      {analyzedResult.startingInventory && analyzedResult.startingInventory.length > 0 && (
                        <div>
                          <span className="text-xs text-neutral-400 font-semibold flex items-center gap-1.5 mb-1.5">
                            <Package className="w-3.5 h-3.5 text-purple-400" />
                            Извлечённое снаряжение и предметы:
                          </span>
                          <div className="flex flex-wrap gap-1.5">
                            {analyzedResult.startingInventory.map((item: string, i: number) => (
                              <span
                                key={i}
                                className="px-2 py-0.5 rounded-lg bg-neutral-950 border border-neutral-800 text-xs text-neutral-300"
                              >
                                {item}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Climax scene preview */}
                      <div>
                        <span className="text-xs text-neutral-400 font-semibold block mb-1">
                          Точка старта игры (Кульминация):
                        </span>
                        <div className="p-3 rounded-xl bg-neutral-950 border border-neutral-800 text-xs text-neutral-200 font-story leading-relaxed max-h-36 overflow-y-auto">
                          {analyzedResult.currentScene}
                        </div>
                      </div>

                      {/* Launch Button */}
                      <button
                        onClick={handleLaunchAnalyzedStory}
                        className="w-full py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-lg flex items-center justify-center gap-2 transition-all"
                      >
                        <ArrowRight className="w-4 h-4" />
                        <span>Начать интерактивную игру с этой точки</span>
                      </button>
                    </div>
                  )}
                </div>
              ) : (
                /* JSON File Import */
                <div className="space-y-4">
                  <div className="p-8 border-2 border-dashed border-neutral-800 rounded-2xl flex flex-col items-center justify-center text-center space-y-3 hover:border-purple-600 transition-colors">
                    <FileJson className="w-12 h-12 text-purple-400" />
                    <div>
                      <h4 className="text-sm font-semibold text-neutral-200">
                        Перетащите сюда файл сохранения (.json)
                      </h4>
                      <p className="text-xs text-neutral-400 mt-1">
                        Восстановит весь прогресс, ветки, инвентарь и память глав в точности
                      </p>
                    </div>

                    <label className="cursor-pointer px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-semibold transition-colors shadow-md">
                      Выбрать файл на устройстве
                      <input
                        type="file"
                        accept=".json"
                        onChange={handleFileUpload}
                        className="hidden"
                      />
                    </label>
                  </div>

                  {jsonError && (
                    <div className="p-3 rounded-xl bg-rose-950/60 border border-rose-800/80 text-xs text-rose-300">
                      {jsonError}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
