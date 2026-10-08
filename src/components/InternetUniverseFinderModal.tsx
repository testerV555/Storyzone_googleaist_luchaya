import React, { useState } from "react";
import {
  Globe,
  Search,
  Sparkles,
  BookOpen,
  Wand2,
  X,
  Loader2,
  Compass,
  ArrowRight,
  Flame,
  Shield,
  Film,
  Tv,
} from "lucide-react";
import { Story, StoryGenre } from "../types";
import { sound } from "../utils/audio";
import { safeFetchJson } from "../utils/safeApi";

interface InternetUniverseFinderModalProps {
  isOpen: boolean;
  onClose: () => void;
  onStartStory: (story: Story) => void;
  customApiKey?: string;
}

const POPULAR_UNIVERSES = [
  {
    name: "Властелин Колец",
    genre: "Фэнтези" as StoryGenre,
    prompt: "Средиземье, Война Кольца. Взгляд со стороны следопытов Севера.",
    icon: "🗡️",
    badge: "Легендарная классика",
  },
  {
    name: "Дюна: Арракис",
    genre: "Космоопера" as StoryGenre,
    prompt: "Песчаные черви, пряность, интриги Великих Домов и фримены.",
    icon: "🪐",
    badge: "Глубокий сай-фай",
  },
  {
    name: "Клинок, рассекающий демонов",
    genre: "Аниме и исекай" as StoryGenre,
    prompt: "Япония эпохи Тайсё, корпус истребителей демонов, дыхание стихий.",
    icon: "⚡",
    badge: "Топ аниме",
  },
  {
    name: "Ведьмак: Дикая Охота",
    genre: "Фэнтези" as StoryGenre,
    prompt: "Нелинейный тёмный мир, чудовища, древние проклятия и цинизм.",
    icon: "🐺",
    badge: "Тёмное фэнтези",
  },
  {
    name: "Киберпанк 2077: Найт-Сити",
    genre: "Киберпанк" as StoryGenre,
    prompt: "Неоновый мегаполис, корпоративные войны, киберимпланты и брейнданс.",
    icon: "🏙️",
    badge: "Высокие технологии",
  },
  {
    name: "Лавкрафт: Зов Ктулху",
    genre: "Мистика и детектив" as StoryGenre,
    prompt: "Викторианский портовый город, древние культы и медленное погружение в безумие.",
    icon: "🐙",
    badge: "Космический ужас",
  },
  {
    name: "Берсерк: Золотой Век",
    genre: "Фэнтези" as StoryGenre,
    prompt: "Отряд Сокола, наёмные войны, дружба, амбиции и приближение Затмения.",
    icon: "⚔️",
    badge: "Культовая манга",
  },
  {
    name: "Гарри Поттер: Запретная Секция",
    genre: "Фанфики" as StoryGenre,
    prompt: "Хогвартс во времена тайных исследований тёмной магии в подземельях Слизерина.",
    icon: "🪄",
    badge: "Магический мир",
  },
];

export const InternetUniverseFinderModal: React.FC<InternetUniverseFinderModalProps> = ({
  isOpen,
  onClose,
  onStartStory,
  customApiKey,
}) => {
  const [searchQuery, setSearchQuery] = useState("");
  const [customWishes, setCustomWishes] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  if (!isOpen) return null;

  const handleSummon = async (universeName: string, promptDetails?: string) => {
    if (!universeName.trim() || isLoading) return;
    setIsLoading(true);
    setErrorMessage("");
    sound.playAction("magic");

    try {
      const res = await safeFetchJson<any>("/api/story/summon-universe", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(customApiKey ? { "x-custom-api-key": customApiKey } : {}),
        },
        body: JSON.stringify({
          universeQuery: universeName,
          userPrompt: promptDetails || customWishes,
          customKey: customApiKey,
        }),
      });

      const data = res.data;
      if (!res.ok || !data) {
        throw new Error("Не удалось воссоздать историю из вселенной");
      }

      const newStory: Story = {
        id: `universe_${Date.now()}`,
        title: data.title || universeName,
        genre: (data.genre as StoryGenre) || "Фанфики",
        synopsis: data.synopsis || `Интерактивная история во вселенной «${universeName}».`,
        coverImage:
          data.coverImage ||
          "https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=800",
        tags: [universeName, "Интернет-канон", "ИИ-вселенная"],
        rating: 5.0,
        playsCount: 1,
        estimatedTime: "25-35 мин",
        author: "Канон & ИИ StoryZone",
        difficulty: "Средне",
        startingScene: data.startingScene,
        initialChoices: data.starterChoices || [
          { id: "1", label: "Сделать решительный шаг", description: "Начать действие" },
          { id: "2", label: "Оценить окружение", description: "Изучить местность" },
          { id: "3", label: "Заговорить со спутником", description: "Обсудить ситуацию" },
        ],
        characters: (data.characters || []).map((c: any, i: number) => ({
          id: `char_uni_${i}`,
          name: c.name || "Спутник",
          role: c.role || "Союзник",
          avatar:
            c.avatar ||
            "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=400",
          bio: c.bio || "Один из ключевых обитателей этого мира.",
          affinity: c.affinity || 50,
          affinityTitle: c.affinityTitle || "Знакомый",
          temperament: c.temperament || "сангвиник",
          traits: c.traits || ["Характерный", "Каноничный"],
          habits: c.habits || ["Настороженно смотрит по сторонам"],
          speechStyle: c.speechStyle || "Уверенный",
          isLockedTraits: false,
        })),
        startingStats: {
          hp: 100,
          maxHp: 100,
          energy: 100,
          maxEnergy: 100,
          gold: 50,
          karma: 0,
        },
        startingInventory: data.startingInventory || ["Дорожный плащ", "Кинжал"],
        fandomSource: universeName,
        isCustom: true,
      };

      // Save custom story to local list
      try {
        const existing = JSON.parse(
          localStorage.getItem("storyzone_custom_stories") || "[]"
        );
        localStorage.setItem(
          "storyzone_custom_stories",
          JSON.stringify([newStory, ...existing])
        );
      } catch (e) {}

      sound.playFanfare();
      onStartStory(newStory);
      onClose();
    } catch (err: any) {
      console.error("Universe summon error:", err);
      setErrorMessage("Ошибка воссоздания. Попробуйте уточнить запрос или повторите снова.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleCustomFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;
    handleSummon(searchQuery.trim(), customWishes.trim());
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/85 backdrop-blur-md animate-fade-in">
      <div className="w-full max-w-3xl max-h-[92vh] flex flex-col rounded-3xl bg-neutral-900 border border-cyan-500/40 shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="p-4 sm:p-5 bg-gradient-to-r from-cyan-950/70 via-neutral-900 to-neutral-900 border-b border-cyan-900/40 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-cyan-500/20 border border-cyan-500/40 flex items-center justify-center text-cyan-400">
              <Globe className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-neutral-100 flex items-center gap-2">
                Поиск & Воссоздание Любой Истории из Интернета
              </h2>
              <p className="text-xs text-neutral-400">
                Введите название любой книги, фильма, аниме, игры или фанфика — ИИ воссоздаст мир и канон
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-xl text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6">
          {/* Universal Search Input */}
          <form onSubmit={handleCustomFormSubmit} className="space-y-3">
            <div className="relative">
              <Search className="w-4 h-4 text-cyan-400 absolute left-3.5 top-3.5" />
              <input
                type="text"
                required
                placeholder="Введите название: например, 'Звёздные Войны: Мандалорец', 'Стальной Алхимик', 'Шерлок Холмс'..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-3 rounded-2xl bg-neutral-950 border border-cyan-500/40 text-sm text-neutral-100 placeholder:text-neutral-500 focus:outline-none focus:border-cyan-400 shadow-inner"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-[11px] font-semibold text-neutral-400">
                Особые вводные или пожелания к сюжету (по желанию):
              </label>
              <input
                type="text"
                placeholder="Например: 'Я играю за дезертира имперской армии', 'Начни с погони в переулке'..."
                value={customWishes}
                onChange={(e) => setCustomWishes(e.target.value)}
                className="w-full px-3.5 py-2 rounded-xl bg-neutral-950 border border-neutral-800 text-xs text-neutral-200 focus:outline-none focus:border-cyan-500"
              />
            </div>

            <button
              type="submit"
              disabled={!searchQuery.trim() || isLoading}
              className="w-full py-3 rounded-2xl bg-gradient-to-r from-cyan-600 via-indigo-600 to-purple-600 hover:from-cyan-500 hover:to-purple-500 text-white font-bold text-xs sm:text-sm flex items-center justify-center gap-2 shadow-lg shadow-cyan-950/50 disabled:opacity-50 transition-all"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>ИИ изучает интернет-канон и создаёт мир...</span>
                </>
              ) : (
                <>
                  <Wand2 className="w-4 h-4" />
                  <span>Воссоздать Вселенную и Начать Игру</span>
                </>
              )}
            </button>
          </form>

          {errorMessage && (
            <div className="p-3 rounded-xl bg-red-950/50 border border-red-800/50 text-red-300 text-xs">
              {errorMessage}
            </div>
          )}

          {/* Popular Internet Presets Grid */}
          <div className="space-y-3 pt-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-neutral-200 flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
                Популярные готовые вселенные из сети:
              </span>
              <span className="text-[10px] text-neutral-500">
                Кликните для мгновенного погружения
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {POPULAR_UNIVERSES.map((item, idx) => (
                <button
                  key={idx}
                  type="button"
                  disabled={isLoading}
                  onClick={() => handleSummon(item.name, item.prompt)}
                  className="p-3 rounded-2xl bg-neutral-950/70 border border-neutral-800 hover:border-cyan-600/60 hover:bg-neutral-900/80 text-left transition-all group flex flex-col justify-between"
                >
                  <div>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 text-xs font-bold text-neutral-100 group-hover:text-cyan-300 transition-colors">
                        <span className="text-base">{item.icon}</span>
                        <span>{item.name}</span>
                      </div>
                      <span className="text-[9px] px-2 py-0.5 rounded-full bg-neutral-900 border border-neutral-800 text-neutral-400">
                        {item.badge}
                      </span>
                    </div>
                    <p className="text-[11px] text-neutral-400 mt-1 leading-snug line-clamp-2">
                      {item.prompt}
                    </p>
                  </div>

                  <div className="flex items-center justify-between pt-2 mt-2 border-t border-neutral-900 text-[10px] text-neutral-500">
                    <span>Жанр: {item.genre}</span>
                    <span className="text-cyan-400 font-semibold flex items-center gap-0.5 group-hover:translate-x-1 transition-transform">
                      Войти в мир <ArrowRight className="w-3 h-3" />
                    </span>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
