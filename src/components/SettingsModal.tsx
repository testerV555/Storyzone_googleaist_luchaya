import React, { useState } from "react";
import { ReaderTheme, NarrativeStyle, NarrativePOV, ActiveGameState } from "../types";
import {
  Settings,
  X,
  Palette,
  Type,
  Volume2,
  Sparkles,
  ShieldCheck,
  Cpu,
  Key,
  Bookmark,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Music,
  ScrollText,
  RotateCcw,
  PenTool,
  Download,
  Upload,
  FileJson,
  Check,
  BookOpen,
  ShieldAlert,
  Bot,
  Zap,
  Sliders,
  CheckCheck,
  Plus,
} from "lucide-react";
import { sound } from "../utils/audio";
import { safeFetchJson } from "../utils/safeApi";

export const DEFAULT_AI_PROMPT_DIRECTIVE =
  "Исполняй действие игрока точно и без задержек. Излагай текст в строгом соответствии с выбранным стилем повествования, без навязчивого морализаторства, нравоучений и лишней воды.";

export const DEFAULT_AI_SYSTEM_PROMPT = `Ты — беспристрастный ведущий и живой литературный соавтор интерактивной повести в StoryZone.

СТРОЖАЙШИЕ ЗАКОНЫ ПОВЕДЕНИЯ И ЛОГИКИ:
1. АБСОЛЮТНЫЙ ЗАПРЕТ ШАБЛОННЫХ И ОДНОТИПНЫХ ОТВЕТОВ:
   • Категорически запрещено использовать заезженные штампы (например: «Воздух вокруг сгущается», «Тени вокруг замирают», «Каждый звук отдаётся резонансом», «Вы чувствуете прилив чистой решимости»).
   • Категорически запрещено механически цитировать выбор игрока в кавычках («Вы решаете: "..."»). Никаких цитат и шаблонных префиксов!
   • Каждое действие игрока воплощается немедленно в первом же предложении через осязаемые поступки, реальные слова, изменения обстановки и динамику сюжета.

2. ДИНАМИЧЕСКИЕ И ЧЕСТНЫЕ ОТНОШЕНИЯ (ЗАПРЕТ НАВЯЗЫВАНИЯ НЕПРИЯЗНИ):
   • Запрещено искусственно удерживать персонажа в шаблонной враждебности, недоверии или холоде, игнорируя контекст.
   • Если глава была отредактирована автором, если лорбук обновлён или игрок совершил поступок в сторону помощи, защиты, союза или щедрости — отношение персонажа ОБЯЗАНО немедленно и органично теплеть.
   • Персонажи способны замечать добро, признавать авторитет, прощать разногласия и становиться верными союзниками без искусственного занудства.

3. ЗАПРЕТ ВСЕВЕДЕНИЯ И ЗНАНИЙ О БУДУЩЕМ (АНТИ-МЕТАГЕЙМИНГ):
   • Ни персонажи, ни повествователь НЕ ЗНАЮТ будущего, скрытых мыслей других людей и событий, которые ещё не произошли.
   • СТРОГОЕ ПРАВИЛО ИМЁН: Если персонаж незнаком герою, категорически запрещено называть его по личному имени до тех пор, пока он сам не представится вслух в диалоге! До этого момента используй статус, внешность или одежду («бедуин», «незнакомец в тюрбане», «раненый всадник», «молчаливый проводник»).

4. СВЯТОСТЬ ПРАВОК И СКВОЗНАЯ ПАМЯТЬ ЗА ВСЕ 10-15+ ГЛАВ:
   • Всё, что написано или отредактировано в предыдущих главах и текущей сцене — это нерушимый живой канон.
   • Персонажи помнят все совместные испытания, клятвы и события за последние 10-15 глав, не страдая амнезией.
   • Если автор отредактировал главу или сцену, сюжет развивается строго от нового состояния, никогда не возвращаясь к отменённым событиям.`;

export const SYSTEM_PROMPT_PRESETS = [
  {
    id: "anti-templates",
    label: "🛡️ Анти-шаблоны",
    title: "Строго запретить фразы «Воздух сгущается» и цитирование в кавычках",
    rule: "\n\n[СТРОГОЕ ПРАВИЛО]: Категорически запрещены любые литературные клише, фразы вроде «Воздух сгущается», «Тени замирают», механическое цитирование в кавычках («Вы решаете: \"...\"») и одинаковые предсказуемые конструкции предложений. Любое действие исполняется сразу и физически.",
  },
  {
    id: "honest-relationships",
    label: "🤝 Честные отношения",
    title: "Запретить навязывание неприязни и обязать теплеть при помощи",
    rule: "\n\n[СТРОГОЕ ПРАВИЛО]: Запрещено навязывать персонажам неприязнь, подозрительность или холод, если игрок помог им, проявил заботу, договорился или отредактировал сцену. Отношения обязаны немедленно теплеть и развиваться в сторону союза.",
  },
  {
    id: "anti-metagaming",
    label: "👁️ Анти-всеведение & Имена",
    title: "Запретить знание будущего и незнакомых имён до диалога",
    rule: "\n\n[СТРОГОЕ ПРАВИЛО]: Запрет на использование знаний о будущем и чтение скрытых мыслей. До знакомства вслух незнакомца строго запрещено называть по личному имени — только по роли или внешности («незнакомец», «проводник», «бедуин»).",
  },
  {
    id: "canon-memory",
    label: "📜 Память 10-15+ глав",
    title: "Обязать помнить все события и правки за 10-15+ глав",
    rule: "\n\n[СТРОГОЕ ПРАВИЛО]: Все отредактированные главы и хроника прошлых 10-15+ событий священны. Сюжет развивается строго от нового состояния, без амнезии и без возврата к отменённым событиям.",
  },
  {
    id: "concise-punchy",
    label: "⚡ Лаконичный динамизм",
    title: "Требовать ёмкого слога без воды и нравоучений",
    rule: "\n\n[СТРОГОЕ ПРАВИЛО]: Излагай события ёмко, динамично и без нравоучений. Каждая фраза обязана двигать сюжет вперёд.",
  },
];

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  readerTheme: ReaderTheme;
  setReaderTheme: (theme: ReaderTheme) => void;
  fontSize: "sm" | "md" | "lg" | "xl";
  setFontSize: (size: "sm" | "md" | "lg" | "xl") => void;
  soundEnabled: boolean;
  setSoundEnabled: (val: boolean) => void;
  isAiEnabled: boolean;
  customApiKey: string;
  setCustomApiKey: (key: string) => void;
  ultraMemory: boolean;
  setUltraMemory: (val: boolean) => void;
  autoSituationMusic: boolean;
  setAutoSituationMusic: (val: boolean) => void;
  aiPromptDirective: string;
  setAiPromptDirective: (directive: string) => void;
  aiSystemPrompt: string;
  setAiSystemPrompt: (prompt: string) => void;
  gameState?: ActiveGameState | null;
  onImportGameState?: (newState: ActiveGameState) => void;
}

const THEMES: { id: ReaderTheme; name: string; previewColor: string }[] = [
  { id: "dark-obsidian", name: "Тёмный Обсидиан", previewColor: "bg-neutral-950 border-purple-500" },
  { id: "cozy-parchment", name: "Уютный Пергамент", previewColor: "bg-[#1c1815] border-amber-500" },
  { id: "cyber-neon", name: "Киберпанк Неон", previewColor: "bg-[#080912] border-cyan-400" },
  { id: "vampire-velvet", name: "Вампирский Бархат", previewColor: "bg-[#14080e] border-rose-500" },
  { id: "clean-slate", name: "Минималистичный Слейт", previewColor: "bg-slate-950 border-indigo-400" },
];

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  readerTheme,
  setReaderTheme,
  fontSize,
  setFontSize,
  soundEnabled,
  setSoundEnabled,
  isAiEnabled,
  customApiKey,
  setCustomApiKey,
  ultraMemory,
  setUltraMemory,
  autoSituationMusic,
  setAutoSituationMusic,
  aiPromptDirective,
  setAiPromptDirective,
  aiSystemPrompt,
  setAiSystemPrompt,
  gameState,
  onImportGameState,
}) => {
  const [activeTab, setActiveTab] = useState<"ai" | "appearance" | "backup">("ai");
  const [testingKey, setTestingKey] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; msg: string } | null>(null);
  const [exportNotice, setExportNotice] = useState<string | null>(null);
  const [importNotice, setImportNotice] = useState<{ ok: boolean; msg: string } | null>(null);
  const [ruleNotice, setRuleNotice] = useState<string | null>(null);

  if (!isOpen) return null;

  // Handle Quick Insertion of preset rules
  const handleInsertRule = (ruleSnippet: string, label: string) => {
    sound.playClick();
    if (aiSystemPrompt.includes(ruleSnippet.trim())) {
      setRuleNotice(`Правило «${label}» уже активно в системном промпте.`);
      setTimeout(() => setRuleNotice(null), 2500);
      return;
    }

    const updated = (aiSystemPrompt.trim() + ruleSnippet).trim();
    setAiSystemPrompt(updated);
    setRuleNotice(`✓ Добавлено: ${label}`);
    setTimeout(() => setRuleNotice(null), 3000);
  };

  // Handle Export of Full Story GameState as JSON file
  const handleExportHistoryJson = () => {
    if (!gameState) {
      setExportNotice("Нет активной истории для экспорта.");
      return;
    }

    try {
      const exportData = {
        app: "StoryZone",
        version: "2.1",
        exportedAt: new Date().toISOString(),
        storyTitle: gameState.story.title,
        genre: gameState.story.genre,
        aiSystemPrompt: aiSystemPrompt,
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
        },
      };

      const jsonStr = JSON.stringify(exportData, null, 2);
      const blob = new Blob([jsonStr], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      const safeTitle = (gameState.story.title || "story")
        .trim()
        .replace(/[^a-zA-Zа-яА-Я0-9_-]/g, "_")
        .slice(0, 40);
      a.href = url;
      a.download = `storyzone-save-${safeTitle}-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      sound.playAction("magic");
      setExportNotice(`Файл «${a.download}» успешно скачан!`);
      setTimeout(() => setExportNotice(null), 4000);
    } catch (err: any) {
      console.error("Export error:", err);
      setExportNotice("Ошибка при формировании файла экспорта.");
    }
  };

  // Handle Import of Story GameState from JSON file
  const handleImportHistoryJson = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const text = event.target?.result as string;
        const parsed = JSON.parse(text);

        if (parsed.aiSystemPrompt && typeof parsed.aiSystemPrompt === "string") {
          setAiSystemPrompt(parsed.aiSystemPrompt);
        }

        const loadedState: ActiveGameState = parsed.gameState || (parsed.story && parsed.currentScene ? parsed : null);

        if (loadedState && loadedState.story && loadedState.currentScene) {
          if (onImportGameState) {
            onImportGameState(loadedState);
            sound.playAction("magic");
            setImportNotice({
              ok: true,
              msg: `История «${loadedState.story.title}» успешно загружена! Переход в игру...`,
            });
            setTimeout(() => {
              setImportNotice(null);
              onClose();
            }, 1200);
          }
        } else {
          setImportNotice({
            ok: false,
            msg: "Неверный формат файла. Требуется JSON-файл сохранения StoryZone.",
          });
        }
      } catch (err) {
        setImportNotice({
          ok: false,
          msg: "Ошибка чтения JSON файла. Проверьте целостность файла.",
        });
      }
    };
    reader.readAsText(file);
    e.target.value = "";
  };

  const handleTestConnection = async () => {
    setTestingKey(true);
    setTestResult(null);
    sound.playAction("magic");

    try {
      const res = await safeFetchJson<any>("/api/ai/test-connection", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ customKey: customApiKey }),
      });

      const data = res.data;
      if (res.ok && data?.ok) {
        setTestResult({ ok: true, msg: `Подключение успешно! Модель: ${data.model}` });
      } else {
        setTestResult({ ok: false, msg: data?.error || res.error || "Ошибка подключения" });
      }
    } catch (e: any) {
      setTestResult({ ok: false, msg: "Не удалось связаться с сервером" });
    } finally {
      setTestingKey(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-md animate-fade-in">
      <div className="relative w-full max-w-2xl max-h-[92vh] flex flex-col rounded-2xl bg-neutral-900 border border-neutral-800 shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-4 sm:p-5 border-b border-neutral-800 bg-neutral-950/70">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-purple-950/80 border border-purple-800/60 text-purple-400">
              <Settings className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-cinzel text-base sm:text-lg font-bold text-neutral-100">
                Параметры & Системный промпт ИИ
              </h3>
              <p className="text-[11px] text-neutral-400">
                Глобальный контроль поведения нейросети, стиль повествования и интерфейс
              </p>
            </div>
          </div>
          <button
            onClick={() => {
              sound.playClick();
              onClose();
            }}
            className="p-1.5 rounded-lg text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-neutral-800 bg-neutral-950/40 px-4 sm:px-5 gap-2 pt-2">
          <button
            onClick={() => {
              sound.playClick();
              setActiveTab("ai");
            }}
            className={`pb-2.5 px-3 text-xs font-semibold flex items-center gap-2 border-b-2 transition-all ${
              activeTab === "ai"
                ? "border-purple-500 text-purple-300"
                : "border-transparent text-neutral-400 hover:text-neutral-200"
            }`}
          >
            <Bot className="w-4 h-4" />
            <span>Системный промпт & ИИ</span>
          </button>

          <button
            onClick={() => {
              sound.playClick();
              setActiveTab("appearance");
            }}
            className={`pb-2.5 px-3 text-xs font-semibold flex items-center gap-2 border-b-2 transition-all ${
              activeTab === "appearance"
                ? "border-purple-500 text-purple-300"
                : "border-transparent text-neutral-400 hover:text-neutral-200"
            }`}
          >
            <Palette className="w-4 h-4" />
            <span>Оформление и Чтение</span>
          </button>

          <button
            onClick={() => {
              sound.playClick();
              setActiveTab("backup");
            }}
            className={`pb-2.5 px-3 text-xs font-semibold flex items-center gap-2 border-b-2 transition-all ${
              activeTab === "backup"
                ? "border-purple-500 text-purple-300"
                : "border-transparent text-neutral-400 hover:text-neutral-200"
            }`}
          >
            <FileJson className="w-4 h-4" />
            <span>Резервные копии (JSON)</span>
          </button>
        </div>

        {/* Content Body */}
        <div className="p-4 sm:p-5 overflow-y-auto space-y-5 flex-1">
          {activeTab === "ai" && (
            <>
              {/* GLOBAL AI SYSTEM PROMPT SECTION */}
              <div className="p-4 rounded-xl bg-neutral-950/90 border border-purple-700/50 space-y-3.5 shadow-lg relative">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <ShieldAlert className="w-4 h-4 text-purple-400 shrink-0" />
                    <div>
                      <span className="text-xs font-bold text-neutral-100 block">
                        Глобальный Системный промпт ИИ (System Instruction)
                      </span>
                      <span className="text-[10px] text-purple-400 font-mono">
                        Высший приоритет правил поведения нейросети
                      </span>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      sound.playClick();
                      setAiSystemPrompt(DEFAULT_AI_SYSTEM_PROMPT);
                      setRuleNotice("Системный промпт сброшен к эталонному состоянию.");
                      setTimeout(() => setRuleNotice(null), 3000);
                    }}
                    className="text-[11px] text-purple-300 hover:text-purple-200 bg-purple-950/60 hover:bg-purple-900 border border-purple-800/60 px-2.5 py-1 rounded-lg flex items-center gap-1.5 transition-colors shadow-sm"
                    title="Восстановить каноничный системный промпт с защитой от шаблонов"
                  >
                    <RotateCcw className="w-3 h-3" />
                    <span>Сброс к эталону</span>
                  </button>
                </div>

                <p className="text-[11px] text-neutral-300 leading-relaxed">
                  Передаётся напрямую в ядро модели Gemini как системная инструкция наивысшего приоритета. Вы можете строго ограничить ИИ от следования шаблонным ответам, навязывания отношений и использования знаний о будущих событиях или незнакомых именах:
                </p>

                {/* Quick Rule Injection Preset Chips */}
                <div className="space-y-1.5">
                  <span className="text-[10px] font-semibold text-neutral-400 uppercase tracking-wider block">
                    Быстрые ограничения (нажмите, чтобы добавить правило в промпт):
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {SYSTEM_PROMPT_PRESETS.map((preset) => (
                      <button
                        key={preset.id}
                        type="button"
                        onClick={() => handleInsertRule(preset.rule, preset.label)}
                        className="px-2.5 py-1 rounded-lg bg-neutral-900 hover:bg-purple-950 border border-neutral-700 hover:border-purple-600 text-[11px] text-neutral-300 hover:text-purple-200 transition-colors flex items-center gap-1.5 shadow-sm"
                        title={preset.title}
                      >
                        <Plus className="w-3 h-3 text-purple-400" />
                        <span>{preset.label}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {ruleNotice && (
                  <div className="p-2 rounded-lg bg-purple-950/80 border border-purple-700 text-purple-200 text-xs flex items-center gap-1.5 animate-fade-in">
                    <CheckCheck className="w-3.5 h-3.5 text-purple-400 shrink-0" />
                    <span>{ruleNotice}</span>
                  </div>
                )}

                {/* Main System Prompt Textarea */}
                <textarea
                  rows={9}
                  value={aiSystemPrompt}
                  onChange={(e) => setAiSystemPrompt(e.target.value)}
                  placeholder="Введите глобальный системный промпт для ИИ..."
                  className="w-full bg-neutral-900 border border-neutral-700 hover:border-purple-600 focus:border-purple-500 rounded-xl p-3 text-xs text-neutral-100 placeholder-neutral-500 focus:outline-none focus:ring-1 focus:ring-purple-500 leading-relaxed font-mono resize-y shadow-inner transition-colors"
                />

                <div className="flex flex-wrap items-center justify-between text-[10px] text-neutral-400 pt-0.5">
                  <span>Символов: {aiSystemPrompt.length} • Слов: {aiSystemPrompt.trim().split(/\s+/).filter(Boolean).length}</span>
                  <span className="text-emerald-400 flex items-center gap-1 font-medium">
                    <CheckCircle2 className="w-3 h-3" />
                    Активен во всех сценах, сюжетных выборах и каскадных обновлениях
                  </span>
                </div>

                {/* Behavioral Rules Overview */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-1">
                  <div className="p-2 rounded-lg bg-neutral-900/80 border border-neutral-800 text-[10px] space-y-0.5">
                    <span className="font-bold text-neutral-200 block flex items-center gap-1">
                      🛡️ Анти-шаблоны
                    </span>
                    <p className="text-neutral-400">
                      Запрещены штампы («Воздух вокруг сгущается»), цитаты в кавычках и заготовки.
                    </p>
                  </div>

                  <div className="p-2 rounded-lg bg-neutral-900/80 border border-neutral-800 text-[10px] space-y-0.5">
                    <span className="font-bold text-neutral-200 block flex items-center gap-1">
                      🤝 Честные отношения
                    </span>
                    <p className="text-neutral-400">
                      Запрещено упорствовать во враждебности, если герой помог или глава была отредактирована.
                    </p>
                  </div>

                  <div className="p-2 rounded-lg bg-neutral-900/80 border border-neutral-800 text-[10px] space-y-0.5">
                    <span className="font-bold text-neutral-200 block flex items-center gap-1">
                      👁️ Анти-всеведение
                    </span>
                    <p className="text-neutral-400">
                      Запрет знания будущего. Незнакомец не называется по имени до личного знакомства.
                    </p>
                  </div>
                </div>
              </div>

              {/* AI Prompt Directive & Creative Law */}
              <div className="p-3.5 sm:p-4 rounded-xl bg-neutral-950/80 border border-neutral-800 space-y-3">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold text-neutral-200 flex items-center gap-1.5">
                    <ScrollText className="w-4 h-4 text-purple-400" />
                    <span>Творческая директива автора (Локальный стиль повествования)</span>
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      sound.playClick();
                      setAiPromptDirective(DEFAULT_AI_PROMPT_DIRECTIVE);
                    }}
                    className="text-[11px] text-purple-400 hover:text-purple-300 flex items-center gap-1 hover:underline transition-colors"
                    title="Сбросить к каноничной литературной инструкции"
                  >
                    <RotateCcw className="w-3 h-3" />
                    <span>Сброс</span>
                  </button>
                </div>

                <p className="text-[11px] text-neutral-400 leading-relaxed">
                  Определяет художественный темп и слог повести (например, лаконичный экшен или созерцательное фэнтези):
                </p>

                <textarea
                  rows={2}
                  value={aiPromptDirective}
                  onChange={(e) => setAiPromptDirective(e.target.value)}
                  placeholder="Введите авторскую директиву стиля..."
                  className="w-full bg-neutral-900 border border-neutral-700 hover:border-purple-600 focus:border-purple-500 rounded-xl p-3 text-xs text-neutral-200 placeholder-neutral-500 focus:outline-none focus:ring-1 focus:ring-purple-500 leading-relaxed resize-none shadow-sm transition-colors"
                />
              </div>

              {/* Ultra Memory Mode */}
              <div className="p-3.5 rounded-xl bg-neutral-950/80 border border-neutral-800 flex items-center justify-between">
                <div className="space-y-0.5 pr-2">
                  <div className="text-xs font-semibold text-neutral-200 flex items-center gap-1.5">
                    <Bookmark className="w-3.5 h-3.5 text-purple-400" />
                    Ультра-память ИИ (Глубокий контекст за 10-15+ глав)
                  </div>
                  <p className="text-[11px] text-neutral-400">
                    Передаёт в каждый ход расширенную историю глав, клятв и факты лорбука для максимальной последовательности сюжета.
                  </p>
                </div>
                <button
                  onClick={() => {
                    const next = !ultraMemory;
                    setUltraMemory(next);
                    localStorage.setItem("storyzone_ultra_memory", String(next));
                    sound.playClick();
                  }}
                  className={`w-11 h-6 rounded-full transition-colors relative shrink-0 ${
                    ultraMemory ? "bg-purple-600" : "bg-neutral-800"
                  }`}
                >
                  <div
                    className={`w-4 h-4 rounded-full bg-white absolute top-1 transition-transform ${
                      ultraMemory ? "left-6" : "left-1"
                    }`}
                  />
                </button>
              </div>

              {/* Auto Situation Music */}
              <div className="p-3.5 rounded-xl bg-neutral-950/80 border border-neutral-800 flex items-center justify-between">
                <div className="space-y-0.5 pr-2">
                  <div className="text-xs font-semibold text-neutral-200 flex items-center gap-1.5">
                    <Music className="w-3.5 h-3.5 text-purple-400" />
                    Авто-смена музыки под ситуацию (Адаптивный саундтрек)
                  </div>
                  <p className="text-[11px] text-neutral-400">
                    ИИ автоматически подбирает трек (битва, тайна, киберпанк, костёр, романтика) в зависимости от атмосферы сцены.
                  </p>
                </div>
                <button
                  onClick={() => {
                    const next = !autoSituationMusic;
                    setAutoSituationMusic(next);
                    sound.playClick();
                  }}
                  className={`w-11 h-6 rounded-full transition-colors relative shrink-0 ${
                    autoSituationMusic ? "bg-purple-600" : "bg-neutral-800"
                  }`}
                >
                  <div
                    className={`w-4 h-4 rounded-full bg-white absolute top-1 transition-transform ${
                      autoSituationMusic ? "left-6" : "left-1"
                    }`}
                  />
                </button>
              </div>

              {/* Custom API Key Configuration */}
              <div className="p-3.5 rounded-xl bg-neutral-950/80 border border-neutral-800 space-y-2.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold text-neutral-200 flex items-center gap-1.5">
                    <Key className="w-4 h-4 text-purple-400" />
                    Пользовательский Google Gemini API Key
                  </label>
                  <span className="text-[10px] text-neutral-500">Опционально</span>
                </div>
                <p className="text-[11px] text-neutral-400">
                  По умолчанию используется встроенный ключ проекта с авто-ротацией моделей. Если вы хотите использовать собственный ключ, укажите его ниже:
                </p>
                <div className="flex gap-2">
                  <input
                    type="password"
                    value={customApiKey}
                    onChange={(e) => {
                      setCustomApiKey(e.target.value);
                      localStorage.setItem("storyzone_custom_api_key", e.target.value);
                    }}
                    placeholder="AIzaSy..."
                    className="flex-1 px-3 py-1.5 rounded-lg bg-neutral-900 border border-neutral-800 text-xs text-neutral-200 focus:outline-none focus:border-purple-500 font-mono"
                  />
                  <button
                    type="button"
                    onClick={handleTestConnection}
                    disabled={testingKey}
                    className="px-3 py-1.5 rounded-lg bg-purple-950 border border-purple-800 text-purple-200 hover:bg-purple-900 text-xs font-semibold flex items-center gap-1.5 disabled:opacity-50 transition-colors"
                  >
                    {testingKey ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
                    Проверить
                  </button>
                </div>
                {testResult && (
                  <div
                    className={`text-xs p-2 rounded-lg flex items-center gap-1.5 ${
                      testResult.ok
                        ? "bg-emerald-950/60 text-emerald-300 border border-emerald-800/60"
                        : "bg-amber-950/60 text-amber-300 border border-amber-800/60"
                    }`}
                  >
                    {testResult.ok ? (
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                    ) : (
                      <AlertCircle className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                    )}
                    <span>{testResult.msg}</span>
                  </div>
                )}
              </div>
            </>
          )}

          {activeTab === "appearance" && (
            <div className="space-y-5">
              {/* Themes Selector */}
              <div className="space-y-2.5">
                <label className="text-xs font-semibold text-neutral-300 flex items-center gap-2">
                  <Palette className="w-4 h-4 text-purple-400" />
                  Цветовая тема читалки
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {THEMES.map((t) => (
                    <button
                      key={t.id}
                      onClick={() => {
                        sound.playClick();
                        setReaderTheme(t.id);
                      }}
                      className={`flex items-center gap-2.5 p-3 rounded-xl border text-xs text-left transition-all ${
                        readerTheme === t.id
                          ? "bg-purple-950/60 border-purple-500 text-purple-200 font-semibold shadow-md"
                          : "bg-neutral-950/60 border-neutral-800 text-neutral-400 hover:text-neutral-200"
                      }`}
                    >
                      <div className={`w-4 h-4 rounded-full border ${t.previewColor}`} />
                      <span className="truncate">{t.name}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Font Size Selector */}
              <div className="space-y-2.5">
                <label className="text-xs font-semibold text-neutral-300 flex items-center gap-2">
                  <Type className="w-4 h-4 text-purple-400" />
                  Размер шрифта повествования
                </label>
                <div className="grid grid-cols-4 gap-2">
                  {(
                    [
                      { id: "sm", label: "Компакт (A-)" },
                      { id: "md", label: "Стандарт (A)" },
                      { id: "lg", label: "Крупный (A+)" },
                      { id: "xl", label: "Книжный (A++)" },
                    ] as const
                  ).map((s) => (
                    <button
                      key={s.id}
                      onClick={() => {
                        sound.playClick();
                        setFontSize(s.id);
                      }}
                      className={`py-2 px-1 text-center rounded-xl border text-xs font-medium transition-all ${
                        fontSize === s.id
                          ? "bg-purple-600 text-white font-bold shadow"
                          : "bg-neutral-950/60 border-neutral-800 text-neutral-400 hover:text-neutral-200"
                      }`}
                    >
                      {s.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Sound Effects Toggle */}
              <div className="p-3.5 rounded-xl bg-neutral-950/80 border border-neutral-800 flex items-center justify-between">
                <div className="space-y-0.5 pr-2">
                  <div className="text-xs font-semibold text-neutral-200 flex items-center gap-1.5">
                    <Volume2 className="w-3.5 h-3.5 text-purple-400" />
                    Звуковые эффекты интерфейса и действий
                  </div>
                  <p className="text-[11px] text-neutral-400">
                    Атмосферные щелчки, магия, тактические звуки и смены глав.
                  </p>
                </div>
                <button
                  onClick={() => {
                    const next = !soundEnabled;
                    setSoundEnabled(next);
                    localStorage.setItem("storyzone_sound_enabled", String(next));
                    sound.playClick();
                  }}
                  className={`w-11 h-6 rounded-full transition-colors relative shrink-0 ${
                    soundEnabled ? "bg-purple-600" : "bg-neutral-800"
                  }`}
                >
                  <div
                    className={`w-4 h-4 rounded-full bg-white absolute top-1 transition-transform ${
                      soundEnabled ? "left-6" : "left-1"
                    }`}
                  />
                </button>
              </div>
            </div>
          )}

          {activeTab === "backup" && (
            <div className="space-y-4">
              {/* JSON Story Export & Backup */}
              <div className="p-4 rounded-xl bg-neutral-950/80 border border-purple-900/50 space-y-3.5 shadow-inner">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold text-neutral-200 flex items-center gap-1.5">
                    <FileJson className="w-4 h-4 text-purple-400" />
                    <span>Экспорт и Импорт истории (JSON файл)</span>
                  </label>
                  <span className="text-[10px] text-purple-400 font-mono bg-purple-950 px-2 py-0.5 rounded-full border border-purple-800">
                    Полный бэкап
                  </span>
                </div>

                <p className="text-[11px] text-neutral-400 leading-relaxed">
                  Экспортирует всю текущую историю (все главы, персонажей, инвентарь, развилки, лор и Системный промпт ИИ) в отдельный файл JSON, который можно сохранить на устройство и загрузить в любой момент.
                </p>

                {gameState ? (
                  <div className="p-3.5 rounded-xl bg-neutral-900/90 border border-neutral-800 space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="truncate pr-2">
                        <span className="text-xs font-bold text-neutral-100 truncate block">
                          {gameState.story.title}
                        </span>
                        <span className="text-[10px] text-neutral-400">
                          {gameState.story.genre} • Главы: {gameState.memoryChapters?.length || 0} • Спутники: {gameState.characters?.length || 0} • Ход: {gameState.stepCount}
                        </span>
                      </div>
                      <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-950 text-emerald-300 border border-emerald-800 shrink-0 font-medium">
                        Активна
                      </span>
                    </div>

                    <div className="flex flex-col sm:flex-row gap-2 pt-1">
                      <button
                        type="button"
                        onClick={handleExportHistoryJson}
                        className="flex-1 py-2 px-3 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold shadow-md shadow-purple-900/40 flex items-center justify-center gap-2 transition-all"
                      >
                        <Download className="w-3.5 h-3.5" />
                        <span>Скачать историю (.json)</span>
                      </button>

                      <label className="py-2 px-3 rounded-xl bg-neutral-950 hover:bg-neutral-800 border border-neutral-800 text-neutral-300 text-xs font-semibold flex items-center justify-center gap-1.5 cursor-pointer transition-colors">
                        <Upload className="w-3.5 h-3.5 text-purple-400" />
                        <span>Загрузить другой JSON</span>
                        <input
                          type="file"
                          accept=".json"
                          onChange={handleImportHistoryJson}
                          className="hidden"
                        />
                      </label>
                    </div>
                  </div>
                ) : (
                  <div className="p-4 rounded-xl bg-neutral-900/90 border border-neutral-800 space-y-2 text-center">
                    <p className="text-[11px] text-neutral-400">
                      Активная история не запущена. Выберите историю в каталоге или загрузите сохранённый ранее файл JSON:
                    </p>
                    <label className="inline-flex py-2 px-4 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-semibold items-center justify-center gap-2 cursor-pointer transition-colors shadow">
                      <Upload className="w-3.5 h-3.5" />
                      <span>Выбрать JSON файл для продолжения</span>
                      <input
                        type="file"
                        accept=".json"
                        onChange={handleImportHistoryJson}
                        className="hidden"
                      />
                    </label>
                  </div>
                )}

                {exportNotice && (
                  <div className="p-2 rounded-lg bg-emerald-950/70 border border-emerald-800 text-emerald-300 text-xs flex items-center gap-1.5 animate-fade-in">
                    <Check className="w-3.5 h-3.5 shrink-0 text-emerald-400" />
                    <span>{exportNotice}</span>
                  </div>
                )}

                {importNotice && (
                  <div
                    className={`p-2 rounded-lg text-xs flex items-center gap-1.5 animate-fade-in ${
                      importNotice.ok
                        ? "bg-emerald-950/70 border border-emerald-800 text-emerald-300"
                        : "bg-rose-950/70 border border-rose-800 text-rose-300"
                    }`}
                  >
                    {importNotice.ok ? (
                      <Check className="w-3.5 h-3.5 shrink-0 text-emerald-400" />
                    ) : (
                      <AlertCircle className="w-3.5 h-3.5 shrink-0 text-rose-400" />
                    )}
                    <span>{importNotice.msg}</span>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-neutral-800 bg-neutral-950/80 flex items-center justify-between">
          <div className="text-[11px] text-neutral-400 flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-purple-400" />
            <span>Настройки сохраняются автоматически в памяти браузера</span>
          </div>

          <button
            onClick={() => {
              sound.playClick();
              onClose();
            }}
            className="px-5 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold shadow-lg shadow-purple-900/40 transition-all"
          >
            Готово
          </button>
        </div>
      </div>
    </div>
  );
};
