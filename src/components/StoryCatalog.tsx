import React, { useState } from "react";
import {
  Search,
  Star,
  Clock,
  Play,
  Flame,
  Sparkles,
  Shield,
  Tag,
  PlusCircle,
  Filter,
  Compass,
  FileText,
} from "lucide-react";
import { Story, StoryGenre } from "../types";
import { sound } from "../utils/audio";

interface StoryCatalogProps {
  stories: Story[];
  onSelectStory: (story: Story) => void;
  onOpenCreator: () => void;
  onOpenExportImport?: () => void;
  onOpenInternetFinder?: () => void;
  activeStoryId?: string;
}

const GENRES: ("Все" | StoryGenre)[] = [
  "Все",
  "Фэнтези",
  "Киберпанк",
  "Тёмная романтика",
  "Постапокалипсис",
  "Аниме и исекай",
  "Мистика и детектив",
];

export const StoryCatalog: React.FC<StoryCatalogProps> = ({
  stories,
  onSelectStory,
  onOpenCreator,
  onOpenExportImport,
  onOpenInternetFinder,
  activeStoryId,
}) => {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedGenre, setSelectedGenre] = useState<"Все" | StoryGenre>("Все");

  const filteredStories = stories.filter((s) => {
    const matchesGenre = selectedGenre === "Все" || s.genre === selectedGenre;
    const matchesSearch =
      s.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.synopsis.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.tags.some((t) => t.toLowerCase().includes(searchQuery.toLowerCase()));
    return matchesGenre && matchesSearch;
  });

  const featuredStory = stories[0];

  return (
    <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-8 space-y-8">
      {/* Hero Showcase for Featured Story */}
      {featuredStory && selectedGenre === "Все" && !searchQuery && (
        <div className="relative overflow-hidden rounded-2xl border border-purple-800/40 bg-gradient-to-r from-purple-950/70 via-neutral-900 to-neutral-950 p-6 sm:p-10 shadow-2xl shadow-purple-950/40">
          <div
            className="absolute inset-0 bg-cover bg-center opacity-25 mix-blend-luminosity filter blur-[1px]"
            style={{ backgroundImage: `url(${featuredStory.coverImage})` }}
          />
          <div className="absolute inset-0 bg-gradient-to-t from-neutral-950 via-neutral-950/80 to-transparent" />

          <div className="relative z-10 max-w-2xl space-y-4">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/20 border border-amber-500/40 text-amber-300 text-xs font-semibold uppercase tracking-wider">
              <Flame className="w-3.5 h-3.5 text-amber-400 fill-amber-400" />
              Хит недели в StoryZone
            </div>

            <h1 className="font-cinzel text-2xl sm:text-4xl font-black text-white tracking-wide leading-tight drop-shadow-md">
              {featuredStory.title}
            </h1>

            <p className="text-sm sm:text-base text-neutral-300 line-clamp-3 leading-relaxed font-light">
              {featuredStory.synopsis}
            </p>

            <div className="flex flex-wrap items-center gap-4 text-xs text-neutral-300 pt-1">
              <span className="flex items-center gap-1.5 text-amber-400 font-semibold">
                <Star className="w-4 h-4 fill-amber-400 text-amber-400" />
                {featuredStory.rating} ({(featuredStory.playsCount / 1000).toFixed(1)}k читателей)
              </span>
              <span className="flex items-center gap-1.5 text-neutral-400">
                <Clock className="w-4 h-4" />
                {featuredStory.estimatedTime}
              </span>
              <span className="px-2.5 py-0.5 rounded bg-purple-900/50 border border-purple-700/50 text-purple-200">
                {featuredStory.genre}
              </span>
            </div>

            {/* Featured Characters Avatars */}
            <div className="flex items-center gap-3 pt-2">
              <span className="text-xs text-neutral-400">Ключевые герои:</span>
              <div className="flex -space-x-2 overflow-hidden">
                {featuredStory.characters.map((c) => (
                  <img
                    key={c.id}
                    src={c.avatar}
                    alt={c.name}
                    className="inline-block h-8 w-8 rounded-full ring-2 ring-neutral-900 object-cover"
                    title={`${c.name} — ${c.role}`}
                  />
                ))}
              </div>
            </div>

            <div className="pt-3 flex items-center gap-3">
              <button
                id="btn-play-featured-story"
                onClick={() => {
                  sound.playChoice();
                  onSelectStory(featuredStory);
                }}
                className="flex items-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-semibold text-sm shadow-xl shadow-purple-900/50 hover:shadow-purple-700/70 transition-all hover:scale-[1.02] active:scale-[0.98]"
              >
                <Play className="w-4 h-4 fill-white" />
                {activeStoryId === featuredStory.id ? "Продолжить главу" : "Начать историю"}
              </button>

              <button
                id="btn-creator-featured-banner"
                onClick={() => {
                  sound.playClick();
                  onOpenCreator();
                }}
                className="flex items-center gap-2 px-4 py-3 rounded-xl bg-neutral-900/80 hover:bg-neutral-800 border border-neutral-700 text-neutral-300 text-sm font-medium transition-all"
              >
                <Sparkles className="w-4 h-4 text-purple-400" />
                Создать свою
              </button>

              {onOpenExportImport && (
                <button
                  id="btn-catalog-import-export"
                  onClick={() => {
                    sound.playClick();
                    onOpenExportImport();
                  }}
                  className="flex items-center gap-2 px-4 py-3 rounded-xl bg-cyan-950/40 hover:bg-cyan-900/60 border border-cyan-800/60 text-cyan-300 text-sm font-medium transition-all"
                  title="Импорт & Экспорт историй и глав"
                >
                  <FileText className="w-4 h-4 text-cyan-400" />
                  <span>Импорт / Экспорт</span>
                </button>
              )}

              {onOpenInternetFinder && (
                <button
                  id="btn-catalog-internet-finder"
                  onClick={() => {
                    sound.playClick();
                    onOpenInternetFinder();
                  }}
                  className="flex items-center gap-2 px-4 py-3 rounded-xl bg-gradient-to-r from-cyan-900/60 to-indigo-900/60 hover:from-cyan-800/80 hover:to-indigo-800/80 border border-cyan-600/60 text-cyan-200 text-sm font-medium shadow-md transition-all"
                  title="Найти или воссоздать любую книгу, фильм, аниме или историю из Интернета"
                >
                  <span>🌐</span>
                  <span>Найти Вселенную</span>
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Filter and Search Controls */}
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="font-cinzel text-xl sm:text-2xl font-bold text-neutral-100 flex items-center gap-2">
              <Compass className="w-5 h-5 text-purple-400" />
              Каталог Миров StoryZone
            </h2>
            <p className="text-xs sm:text-sm text-neutral-400">
              Выберите готовую историю или создайте уникальный сюжет с ИИ Game Master
            </p>
          </div>

          {/* Search Input */}
          <div className="relative w-full sm:w-72">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-500" />
            <input
              id="input-search-stories"
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Поиск по названию, жанру, тегу..."
              className="w-full bg-neutral-900/90 border border-neutral-800 rounded-xl pl-9 pr-4 py-2 text-xs sm:text-sm text-neutral-200 placeholder-neutral-500 focus:outline-none focus:border-purple-600 focus:ring-1 focus:ring-purple-600 transition-all"
            />
          </div>
        </div>

        {/* Genre Filter Chips */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1.5 scrollbar-none">
          {GENRES.map((genre) => (
            <button
              key={genre}
              id={`chip-genre-${genre}`}
              onClick={() => {
                sound.playClick();
                setSelectedGenre(genre);
              }}
              className={`px-3.5 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-all ${
                selectedGenre === genre
                  ? "bg-purple-600 text-white shadow-md shadow-purple-900/40"
                  : "bg-neutral-900 text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800 border border-neutral-800"
              }`}
            >
              {genre}
            </button>
          ))}
        </div>
      </div>

      {/* Stories Grid */}
      {filteredStories.length === 0 ? (
        <div className="text-center py-16 px-4 rounded-2xl border border-dashed border-neutral-800 bg-neutral-900/30">
          <Filter className="w-10 h-10 text-neutral-600 mx-auto mb-3" />
          <p className="text-neutral-300 font-medium">Ничего не найдено</p>
          <p className="text-xs text-neutral-500 mt-1">
            Попробуйте изменить поисковый запрос или создайте историю в Конструкторе
          </p>
          <button
            onClick={onOpenCreator}
            className="mt-4 inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-purple-600 text-white text-xs font-semibold hover:bg-purple-500 transition-colors"
          >
            <PlusCircle className="w-4 h-4" />
            Создать новую историю
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredStories.map((story) => {
            const isActive = activeStoryId === story.id;

            return (
              <div
                key={story.id}
                id={`card-story-${story.id}`}
                className="group relative flex flex-col rounded-2xl border border-neutral-800/80 bg-neutral-900/50 hover:bg-neutral-900/90 hover:border-purple-800/60 transition-all duration-300 hover:shadow-xl hover:shadow-purple-950/30 overflow-hidden"
              >
                {/* Cover Image with Vignette */}
                <div className="relative h-48 w-full overflow-hidden bg-neutral-950">
                  <img
                    src={story.coverImage}
                    alt={story.title}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                    loading="lazy"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-neutral-900 via-transparent to-black/40" />

                  {/* Badges on Top of Cover */}
                  <div className="absolute top-3 left-3 flex items-center gap-2">
                    <span className="px-2.5 py-1 rounded-md text-[11px] font-semibold bg-neutral-950/80 backdrop-blur-md text-purple-300 border border-purple-800/40 shadow-sm">
                      {story.genre}
                    </span>
                    {story.isCustom && (
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-emerald-950/80 border border-emerald-800/60 text-emerald-300">
                        Пользовательская
                      </span>
                    )}
                  </div>

                  <div className="absolute top-3 right-3 flex items-center gap-1 px-2 py-1 rounded-md text-xs font-bold bg-neutral-950/85 backdrop-blur-md text-amber-300 border border-neutral-800">
                    <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
                    {story.rating}
                  </div>

                  {/* Character Avatars Floating on Cover bottom */}
                  <div className="absolute bottom-3 left-3 flex items-center -space-x-1.5">
                    {story.characters.slice(0, 3).map((c) => (
                      <img
                        key={c.id}
                        src={c.avatar}
                        alt={c.name}
                        className="h-7 w-7 rounded-full border-2 border-neutral-900 object-cover shadow"
                        title={`${c.name} (${c.role})`}
                      />
                    ))}
                    {story.characters.length > 3 && (
                      <span className="h-7 w-7 rounded-full bg-neutral-800 border-2 border-neutral-900 flex items-center justify-center text-[10px] text-neutral-300 font-bold">
                        +{story.characters.length - 3}
                      </span>
                    )}
                  </div>
                </div>

                {/* Card Body */}
                <div className="flex-1 p-5 flex flex-col justify-between space-y-4">
                  <div className="space-y-2">
                    <h3 className="font-cinzel text-lg font-bold text-neutral-100 group-hover:text-purple-300 transition-colors line-clamp-1">
                      {story.title}
                    </h3>

                    <p className="text-xs text-neutral-400 line-clamp-2 leading-relaxed">
                      {story.synopsis}
                    </p>

                    {/* Tags */}
                    <div className="flex flex-wrap gap-1.5 pt-1">
                      {story.tags.slice(0, 3).map((tag, i) => (
                        <span
                          key={i}
                          className="text-[10px] px-2 py-0.5 rounded bg-neutral-800/80 text-neutral-400 border border-neutral-700/50"
                        >
                          #{tag}
                        </span>
                      ))}
                    </div>
                  </div>

                  {/* Bottom info & Play action */}
                  <div className="pt-2 border-t border-neutral-800/70 flex items-center justify-between gap-2">
                    <div className="text-[11px] text-neutral-500 space-y-0.5">
                      <div className="flex items-center gap-1 text-neutral-400">
                        <Clock className="w-3 h-3" />
                        <span>{story.estimatedTime}</span>
                      </div>
                      <div>
                        Сложность: <span className="text-neutral-300">{story.difficulty}</span>
                      </div>
                    </div>

                    <button
                      id={`btn-start-story-${story.id}`}
                      onClick={() => {
                        sound.playChoice();
                        onSelectStory(story);
                      }}
                      className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold transition-all ${
                        isActive
                          ? "bg-amber-500 hover:bg-amber-400 text-neutral-950 font-bold shadow-md shadow-amber-900/40"
                          : "bg-purple-600 hover:bg-purple-500 text-white shadow-md shadow-purple-950/50"
                      }`}
                    >
                      <Play className="w-3.5 h-3.5 fill-current" />
                      {isActive ? "Продолжить" : "Играть"}
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
