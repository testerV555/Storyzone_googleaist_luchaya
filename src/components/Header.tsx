import React from "react";
import {
  Sparkles,
  BookOpen,
  Compass,
  PlusCircle,
  Users,
  Save,
  Volume2,
  VolumeX,
  Settings,
  Flame,
  FileText,
} from "lucide-react";
import { sound } from "../utils/audio";

interface HeaderProps {
  activeTab: "catalog" | "game" | "creator" | "characters" | "saves";
  setActiveTab: (tab: "catalog" | "game" | "creator" | "characters" | "saves") => void;
  hasActiveGame: boolean;
  onOpenSettings: () => void;
  onOpenExportImport?: () => void;
  onOpenInternetFinder?: () => void;
  isAiEnabled: boolean;
  soundEnabled: boolean;
  setSoundEnabled: (val: boolean) => void;
}

export const Header: React.FC<HeaderProps> = ({
  activeTab,
  setActiveTab,
  hasActiveGame,
  onOpenSettings,
  onOpenExportImport,
  onOpenInternetFinder,
  isAiEnabled,
  soundEnabled,
  setSoundEnabled,
}) => {
  const toggleSound = () => {
    const next = !soundEnabled;
    setSoundEnabled(next);
    sound.sfxEnabled = next;
    sound.ambientEnabled = next;
    if (!next) {
      sound.stopAmbient();
      sound.stopSpeaking();
    } else {
      sound.playClick();
    }
  };

  return (
    <header className="sticky top-0 z-40 w-full border-b border-purple-900/30 bg-neutral-950/85 backdrop-blur-md px-4 sm:px-6 py-3">
      <div className="max-w-7xl mx-auto flex items-center justify-between gap-3">
        {/* Brand Logo */}
        <div
          id="btn-brand-logo"
          onClick={() => {
            sound.playClick();
            setActiveTab("catalog");
          }}
          className="flex items-center gap-2.5 cursor-pointer group select-none"
        >
          <div className="relative w-10 h-10 rounded-xl bg-gradient-to-tr from-purple-600 via-indigo-600 to-amber-400 p-0.5 shadow-lg shadow-purple-900/40 group-hover:shadow-purple-700/60 transition-all duration-300">
            <div className="w-full h-full bg-neutral-950 rounded-[10px] flex items-center justify-center">
              <Sparkles className="w-5 h-5 text-purple-400 group-hover:rotate-12 transition-transform duration-300" />
            </div>
            <div className="absolute -top-1 -right-1 w-3 h-3 rounded-full bg-amber-400 animate-ping opacity-75" />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="font-cinzel text-xl font-bold tracking-wider bg-gradient-to-r from-purple-200 via-pink-200 to-amber-200 bg-clip-text text-transparent">
                StoryZone
              </span>
              <span className="text-[10px] uppercase font-bold tracking-widest px-1.5 py-0.5 rounded bg-purple-950/80 text-purple-300 border border-purple-800/60">
                PRO
              </span>
            </div>
            <p className="text-[11px] text-neutral-400 font-sans tracking-wide">
              Интерактивные ИИ Истории
            </p>
          </div>
        </div>

        {/* Navigation Tabs */}
        <nav className="hidden md:flex items-center gap-1 bg-neutral-900/80 p-1 rounded-xl border border-neutral-800/80">
          <button
            id="nav-tab-catalog"
            onClick={() => {
              sound.playClick();
              setActiveTab("catalog");
            }}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-medium transition-all ${
              activeTab === "catalog"
                ? "bg-purple-600/90 text-white shadow-md shadow-purple-900/50"
                : "text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800/60"
            }`}
          >
            <Compass className="w-3.5 h-3.5" />
            Каталог
          </button>

          {hasActiveGame && (
            <button
              id="nav-tab-game"
              onClick={() => {
                sound.playClick();
                setActiveTab("game");
              }}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-medium transition-all ${
                activeTab === "game"
                  ? "bg-purple-600/90 text-white shadow-md shadow-purple-900/50"
                  : "text-amber-400 hover:text-amber-300 hover:bg-neutral-800/60 font-semibold"
              }`}
            >
              <Flame className="w-3.5 h-3.5 text-amber-400 animate-pulse" />
              Текущая игра
            </button>
          )}

          <button
            id="nav-tab-creator"
            onClick={() => {
              sound.playClick();
              setActiveTab("creator");
            }}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-medium transition-all ${
              activeTab === "creator"
                ? "bg-purple-600/90 text-white shadow-md shadow-purple-900/50"
                : "text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800/60"
            }`}
          >
            <PlusCircle className="w-3.5 h-3.5 text-emerald-400" />
            Конструктор
          </button>

          <button
            id="nav-tab-characters"
            onClick={() => {
              sound.playClick();
              setActiveTab("characters");
            }}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-medium transition-all ${
              activeTab === "characters"
                ? "bg-purple-600/90 text-white shadow-md shadow-purple-900/50"
                : "text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800/60"
            }`}
          >
            <Users className="w-3.5 h-3.5" />
            Персонажи
          </button>

          <button
            id="nav-tab-saves"
            onClick={() => {
              sound.playClick();
              setActiveTab("saves");
            }}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-medium transition-all ${
              activeTab === "saves"
                ? "bg-purple-600/90 text-white shadow-md shadow-purple-900/50"
                : "text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800/60"
            }`}
          >
            <Save className="w-3.5 h-3.5" />
            Сохранения
          </button>
        </nav>

        {/* Right Status Actions */}
        <div className="flex items-center gap-2 sm:gap-3">
          {/* Internet Universe Finder Button */}
          {onOpenInternetFinder && (
            <button
              id="btn-header-internet-universe"
              onClick={() => {
                sound.playClick();
                onOpenInternetFinder();
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-gradient-to-r from-cyan-950/80 to-indigo-950/80 hover:from-cyan-900 hover:to-indigo-900 border border-cyan-600/50 text-cyan-300 text-xs font-semibold shadow-sm transition-all hover:scale-[1.02] active:scale-[0.98]"
              title="Воссоздать любую книгу, фильм, аниме или историю из Интернета с помощью ИИ"
            >
              <span>🌐</span>
              <span className="hidden sm:inline">Найти Вселенную</span>
            </button>
          )}

          {/* AI Master Status */}
          <div
            className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium border bg-neutral-900/60 border-neutral-800 text-neutral-300"
            title={isAiEnabled ? "ИИ Game Master (Gemini 3.8 Flash) подключен" : "Локальный Game Master активен"}
          >
            <div
              className={`w-2 h-2 rounded-full ${
                isAiEnabled ? "bg-emerald-400 shadow-[0_0_8px_#34d399]" : "bg-amber-400"
              }`}
            />
            <span>{isAiEnabled ? "Gemini AI Master" : "Game Master"}</span>
          </div>

          {/* Sound Toggle Button */}
          <button
            id="btn-toggle-sound"
            onClick={toggleSound}
            aria-label="Переключить звук"
            className={`p-2 rounded-lg border transition-colors ${
              soundEnabled
                ? "bg-purple-950/40 border-purple-800 text-purple-300 hover:bg-purple-900/60"
                : "bg-neutral-900 border-neutral-800 text-neutral-500 hover:text-neutral-300"
            }`}
          >
            {soundEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
          </button>

          {/* Export / Import Modal Trigger */}
          {onOpenExportImport && (
            <button
              id="btn-header-export-import"
              onClick={() => {
                sound.playClick();
                onOpenExportImport();
              }}
              aria-label="Импорт и Экспорт"
              className="p-2 rounded-lg bg-neutral-900 hover:bg-neutral-800 border border-neutral-800 text-cyan-400 hover:text-cyan-200 transition-colors"
              title="Импорт & Экспорт историй и глав"
            >
              <FileText className="w-4 h-4" />
            </button>
          )}

          {/* Settings Button */}
          <button
            id="btn-settings-modal"
            onClick={() => {
              sound.playClick();
              onOpenSettings();
            }}
            aria-label="Настройки"
            className="p-2 rounded-lg bg-neutral-900 hover:bg-neutral-800 border border-neutral-800 text-neutral-400 hover:text-neutral-200 transition-colors"
          >
            <Settings className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Mobile Bottom Sub-Navigation */}
      <div className="flex md:hidden items-center justify-around gap-1 pt-2.5 mt-2 border-t border-neutral-900 text-xs">
        <button
          id="m-nav-catalog"
          onClick={() => {
            sound.playClick();
            setActiveTab("catalog");
          }}
          className={`flex items-center gap-1 py-1 px-2 rounded-md ${
            activeTab === "catalog" ? "text-purple-400 font-semibold" : "text-neutral-400"
          }`}
        >
          <Compass className="w-3.5 h-3.5" />
          Каталог
        </button>
        {hasActiveGame && (
          <button
            id="m-nav-game"
            onClick={() => {
              sound.playClick();
              setActiveTab("game");
            }}
            className={`flex items-center gap-1 py-1 px-2 rounded-md ${
              activeTab === "game" ? "text-amber-400 font-semibold" : "text-neutral-400"
            }`}
          >
            <Flame className="w-3.5 h-3.5 text-amber-400" />
            Игра
          </button>
        )}
        <button
          id="m-nav-creator"
          onClick={() => {
            sound.playClick();
            setActiveTab("creator");
          }}
          className={`flex items-center gap-1 py-1 px-2 rounded-md ${
            activeTab === "creator" ? "text-purple-400 font-semibold" : "text-neutral-400"
          }`}
        >
          <PlusCircle className="w-3.5 h-3.5 text-emerald-400" />
          Создать
        </button>
        <button
          id="m-nav-characters"
          onClick={() => {
            sound.playClick();
            setActiveTab("characters");
          }}
          className={`flex items-center gap-1 py-1 px-2 rounded-md ${
            activeTab === "characters" ? "text-purple-400 font-semibold" : "text-neutral-400"
          }`}
        >
          <Users className="w-3.5 h-3.5" />
          Герои
        </button>
        <button
          id="m-nav-saves"
          onClick={() => {
            sound.playClick();
            setActiveTab("saves");
          }}
          className={`flex items-center gap-1 py-1 px-2 rounded-md ${
            activeTab === "saves" ? "text-purple-400 font-semibold" : "text-neutral-400"
          }`}
        >
          <Save className="w-3.5 h-3.5" />
          Сохр.
        </button>
      </div>
    </header>
  );
};
