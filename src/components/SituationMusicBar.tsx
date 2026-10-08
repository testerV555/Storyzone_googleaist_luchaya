import React, { useState, useEffect, useRef } from "react";
import {
  Music,
  Volume2,
  Play,
  Pause,
  Sparkles,
  ChevronDown,
  Disc,
  Radio,
  Sliders,
  Globe,
  Activity,
  Plus,
  Check,
  Search,
  Loader2,
  Headphones,
} from "lucide-react";
import { sound, TrackType } from "../utils/audio";
import { safeFetchJson } from "../utils/safeApi";

interface SituationMusicBarProps {
  currentAtmosphere?: string;
  suggestedTrack?: TrackType;
  autoSwitch: boolean;
  setAutoSwitch: (val: boolean) => void;
  currentBpm?: number;
  onBpmChange?: (bpm: number, rhythmDesc: string) => void;
}

// Built-in synthesized tracks
const SYNTH_TRACKS: { id: TrackType; name: string; icon: string; mood: string; defaultBpm: number }[] = [
  { id: "battle", name: "Боевой адреналин", icon: "⚔️", mood: "Схватка, погоня, опасность", defaultBpm: 140 },
  { id: "mystic", name: "Тайны и магия", icon: "🔮", mood: "Древние руны, скрытые залы", defaultBpm: 80 },
  { id: "cyber", name: "Неоновый нуар", icon: "🌧️", mood: "Киберпанк, дождь, мегаполис", defaultBpm: 105 },
  { id: "campfire", name: "У костра", icon: "🕯️", mood: "Отдых, тепло, душевный диалог", defaultBpm: 75 },
  { id: "romance", name: "Драма & Чувства", icon: "💔", mood: "Романтика, признания, тоска", defaultBpm: 70 },
  { id: "dark", name: "Бездна и ужас", icon: "🌑", mood: "Гнетущая тьма, саспенс", defaultBpm: 60 },
  { id: "calm", name: "Безмятежный бриз", icon: "🍃", mood: "Спокойствие и созерцание", defaultBpm: 70 },
];

// Curated internet ambient streams and online stations
const INTERNET_PRESET_STREAMS = [
  {
    id: "stream-cyber",
    name: "Cyberpunk Synth Radio",
    genre: "Киберпанк / Синтвейв",
    icon: "🌆",
    bpm: 110,
    mood: "Неон, ночной город, драйв",
    url: "https://stream.zeno.fm/f3wvbbqmdg8uv",
  },
  {
    id: "stream-dark-ambient",
    name: "Dark Dungeon & Abyss",
    genre: "Тёмный эмбиент / Мистика",
    icon: "🏰",
    bpm: 65,
    mood: "Подземелья, заброшенные замки",
    url: "https://ice6.somafm.com/dronezone-128-mp3",
  },
  {
    id: "stream-fantasy-tavern",
    name: "Fantasy Bard & Tavern",
    genre: "Фэнтези / Лютня и костёр",
    icon: "🍺",
    bpm: 90,
    mood: "Тепло таверны, странствия",
    url: "https://ice2.somafm.com/thistle-128-mp3",
  },
  {
    id: "stream-space",
    name: "Space Deep Drone",
    genre: "Космоопера / Звёздная бездна",
    icon: "🛸",
    bpm: 55,
    mood: "Невесомость, далёкие галактики",
    url: "https://ice4.somafm.com/spacestation-128-mp3",
  },
  {
    id: "stream-lofi",
    name: "Midnight Story Lofi",
    genre: "Лоу-фай / Спокойствие",
    icon: "☕",
    bpm: 85,
    mood: "Чтение под дождём, ностальгия",
    url: "https://ice4.somafm.com/groovesalad-128-mp3",
  },
];

const BPM_PRESETS = [
  { label: "Медитативный", bpm: 65, desc: "Медленный, гипнотический ритм. Глубокие описания, неспешное погружение." },
  { label: "Сюжетный", bpm: 90, desc: "Умеренный темп. Вдумчивые диалоги, исследование и кинематографичность." },
  { label: "Боевой марш", bpm: 125, desc: "Энергичный, напряжённый ритм. Тактические манёвры, нарастающая угроза." },
  { label: "Адреналин", bpm: 155, desc: "Стремительный драйв! Короткие хлёсткие фразы, экшен, взрывные события." },
];

export const SituationMusicBar: React.FC<SituationMusicBarProps> = ({
  currentAtmosphere,
  suggestedTrack,
  autoSwitch,
  setAutoSwitch,
  currentBpm = 90,
  onBpmChange,
}) => {
  const [isPlaying, setIsPlaying] = useState(sound.musicEnabled || sound.isStreamPlaying);
  const [currentTrack, setCurrentTrack] = useState<string>(sound.currentTrack);
  const [volume, setVolume] = useState(sound.volume);
  const [isExpanded, setIsExpanded] = useState(false);
  const [activeSubTab, setActiveSubTab] = useState<"synth" | "internet" | "rhythm">("synth");
  
  // Custom URL & Online Music Search
  const [customStreamUrl, setCustomStreamUrl] = useState("");
  const [customStreamTitle, setCustomStreamTitle] = useState("");
  const [activeStreamUrl, setActiveStreamUrl] = useState<string>("");
  const [activeStreamTitle, setActiveStreamTitle] = useState<string>("");
  const [streamSearch, setStreamSearch] = useState("");
  const [sourceFilter, setSourceFilter] = useState<"all" | "itunes" | "radio" | "presets">("all");
  const [onlineResults, setOnlineResults] = useState<any[]>([]);
  const [isSearchingOnline, setIsSearchingOnline] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);

  // Search online music databases (iTunes, Radio Browser, Ambient Presets)
  const handleSearchOnline = async (queryText?: string, source?: "all" | "itunes" | "radio" | "presets") => {
    const q = (queryText !== undefined ? queryText : streamSearch).trim();
    const src = source || sourceFilter;
    if (!q) {
      setOnlineResults([]);
      setHasSearched(false);
      return;
    }

    setIsSearchingOnline(true);
    setHasSearched(true);
    try {
      const res = await safeFetchJson<any>(`/api/music/search?query=${encodeURIComponent(q)}&source=${src}`);
      if (res.ok && res.data && Array.isArray(res.data.results)) {
        setOnlineResults(res.data.results);
      } else {
        const local = INTERNET_PRESET_STREAMS.filter(
          (s) =>
            s.name.toLowerCase().includes(q.toLowerCase()) ||
            s.genre.toLowerCase().includes(q.toLowerCase()) ||
            s.mood.toLowerCase().includes(q.toLowerCase())
        );
        setOnlineResults(local);
      }
    } catch (e) {
      const local = INTERNET_PRESET_STREAMS.filter(
        (s) =>
          s.name.toLowerCase().includes(q.toLowerCase()) ||
          s.genre.toLowerCase().includes(q.toLowerCase()) ||
          s.mood.toLowerCase().includes(q.toLowerCase())
      );
      setOnlineResults(local);
    } finally {
      setIsSearchingOnline(false);
    }
  };

  // BPM & Tap Tempo
  const [bpm, setBpm] = useState<number>(() => {
    const saved = localStorage.getItem("storyzone_music_bpm");
    return saved ? parseInt(saved, 10) : currentBpm;
  });
  const tapTimesRef = useRef<number[]>([]);
  const [beatPulse, setBeatPulse] = useState(false);

  // Sync BPM with sound engine & notify parent
  useEffect(() => {
    sound.setBpm(bpm);
    localStorage.setItem("storyzone_music_bpm", String(bpm));
    const preset = BPM_PRESETS.find((p) => Math.abs(p.bpm - bpm) <= 15);
    const desc = preset ? preset.desc : `Ритм ${bpm} BPM. Соответствующая динамика текста.`;
    if (onBpmChange) {
      onBpmChange(bpm, desc);
    }
  }, [bpm]);

  // Visual beat pulse effect in UI
  useEffect(() => {
    const intervalMs = (60 / bpm) * 1000;
    const interval = setInterval(() => {
      setBeatPulse(true);
      setTimeout(() => setBeatPulse(false), 120);
    }, intervalMs);
    return () => clearInterval(interval);
  }, [bpm]);

  // Auto switch track when scene atmosphere changes
  useEffect(() => {
    if (autoSwitch && suggestedTrack && suggestedTrack !== "none" && suggestedTrack !== currentTrack) {
      sound.playTrack(suggestedTrack);
      setCurrentTrack(suggestedTrack);
      setIsPlaying(true);
      const synthObj = SYNTH_TRACKS.find((s) => s.id === suggestedTrack);
      if (synthObj) {
        setBpm(synthObj.defaultBpm);
      }
    }
  }, [suggestedTrack, autoSwitch]);

  const togglePlayback = () => {
    const next = !isPlaying;
    setIsPlaying(next);
    sound.musicEnabled = next;
    if (next) {
      if (currentTrack === "custom-stream" && activeStreamUrl) {
        sound.playInternetStream(activeStreamUrl, activeStreamTitle || "Интернет-поток", bpm);
      } else {
        const trackToPlay = (currentTrack === "none" || !currentTrack || currentTrack === "custom-stream")
          ? (suggestedTrack || "mystic")
          : (currentTrack as TrackType);
        sound.playTrack(trackToPlay);
        setCurrentTrack(trackToPlay);
      }
    } else {
      sound.stopMusic();
      sound.stopInternetStream();
    }
    sound.playClick();
  };

  const handleSelectSynthTrack = (track: TrackType) => {
    sound.stopInternetStream();
    setActiveStreamUrl("");
    setActiveStreamTitle("");
    setCurrentTrack(track);
    setIsPlaying(true);
    sound.musicEnabled = true;
    sound.playTrack(track);
    sound.playClick();
    const synthObj = SYNTH_TRACKS.find((s) => s.id === track);
    if (synthObj) {
      setBpm(synthObj.defaultBpm);
    }
  };

  const handleSelectInternetStream = (url: string, title: string, streamBpm: number) => {
    setActiveStreamUrl(url);
    setActiveStreamTitle(title);
    setCurrentTrack("custom-stream");
    sound.playInternetStream(url, title, streamBpm);
    setIsPlaying(true);
    setBpm(streamBpm);
    sound.playClick();
  };

  const handlePlayCustomUrl = (e: React.FormEvent) => {
    e.preventDefault();
    if (!customStreamUrl.trim()) return;
    const title = customStreamTitle.trim() || "Свой аудиопоток";
    handleSelectInternetStream(customStreamUrl.trim(), title, bpm);
  };

  // Tap Tempo algorithm
  const handleTapTempo = () => {
    const now = performance.now();
    const recent = tapTimesRef.current.filter((t) => now - t < 3000);
    recent.push(now);
    tapTimesRef.current = recent;

    sound.playRhythmBeat(true);

    if (recent.length >= 2) {
      const intervals = [];
      for (let i = 1; i < recent.length; i++) {
        intervals.push(recent[i] - recent[i - 1]);
      }
      const avgInterval = intervals.reduce((a, b) => a + b, 0) / intervals.length;
      const calculatedBpm = Math.round(60000 / avgInterval);
      if (calculatedBpm >= 45 && calculatedBpm <= 200) {
        setBpm(calculatedBpm);
      }
    }
  };

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = parseFloat(e.target.value);
    setVolume(v);
    sound.setVolume(v);
  };

  const activeSynth = SYNTH_TRACKS.find((t) => t.id === currentTrack);
  const currentTitle = currentTrack === "custom-stream"
    ? (sound.currentStreamTitle || "Интернет-поток")
    : (activeSynth?.name || "Атмосферный саундтрек");
  const currentIcon = currentTrack === "custom-stream" ? "🌐" : (activeSynth?.icon || "🎵");

  const filteredStreams = INTERNET_PRESET_STREAMS.filter(
    (s) =>
      s.name.toLowerCase().includes(streamSearch.toLowerCase()) ||
      s.genre.toLowerCase().includes(streamSearch.toLowerCase()) ||
      s.mood.toLowerCase().includes(streamSearch.toLowerCase())
  );

  return (
    <div className="relative">
      <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-neutral-900/90 border border-neutral-800 text-xs shadow-md backdrop-blur-sm">
        {/* Play/Pause Button */}
        <button
          onClick={togglePlayback}
          className={`p-1.5 rounded-lg transition-all ${
            isPlaying
              ? "bg-purple-600 text-white shadow-sm shadow-purple-500/40"
              : "bg-neutral-800 text-neutral-400 hover:text-neutral-200"
          }`}
          title={isPlaying ? "Остановить музыку" : "Включить атмосферную музыку"}
        >
          {isPlaying ? (
            <Disc className="w-3.5 h-3.5 animate-spin text-purple-200" />
          ) : (
            <Play className="w-3.5 h-3.5" />
          )}
        </button>

        {/* Current Track Label with Dropdown Toggle */}
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="flex items-center gap-1.5 text-neutral-300 hover:text-neutral-100 max-w-[130px] sm:max-w-[170px] truncate"
        >
          <span className="text-sm">{currentIcon}</span>
          <span className="truncate font-medium">{currentTitle}</span>
          <ChevronDown
            className={`w-3 h-3 text-neutral-500 transition-transform ${
              isExpanded ? "rotate-180" : ""
            }`}
          />
        </button>

        {/* Dynamic Rhythm Pulse Dot */}
        <div
          className={`w-2.5 h-2.5 rounded-full transition-transform duration-100 ${
            beatPulse
              ? "bg-purple-400 scale-125 shadow-sm shadow-purple-400"
              : "bg-neutral-700 scale-95"
          }`}
          title={`Темп сцены: ${bpm} BPM`}
        />

        {/* BPM Badge Button */}
        <button
          onClick={() => {
            setIsExpanded(true);
            setActiveSubTab("rhythm");
          }}
          className="hidden sm:inline-block px-1.5 py-0.5 rounded-md bg-neutral-800/80 hover:bg-neutral-700 text-[10px] text-purple-300 font-mono"
          title="Нажмите, чтобы настроить ритм повествования под музыку"
        >
          {bpm} BPM
        </button>

        {/* Suggested AI Track Pill */}
        {suggestedTrack && suggestedTrack !== currentTrack && (
          <button
            onClick={() => handleSelectSynthTrack(suggestedTrack)}
            className="hidden lg:flex items-center gap-1 px-2 py-0.5 rounded-full bg-purple-950/80 border border-purple-700/60 text-[10px] text-purple-300 hover:bg-purple-900/80 transition-colors"
            title="ИИ рекомендует этот саундтрек для текущей сцены"
          >
            <Sparkles className="w-2.5 h-2.5 text-purple-400" />
            ИИ: {SYNTH_TRACKS.find((t) => t.id === suggestedTrack)?.name}
          </button>
        )}

        {/* Volume slider */}
        <div className="hidden md:flex items-center gap-1.5 pl-1 border-l border-neutral-800">
          <Volume2 className="w-3 h-3 text-neutral-500" />
          <input
            type="range"
            min="0"
            max="1"
            step="0.05"
            value={volume}
            onChange={handleVolumeChange}
            className="w-14 accent-purple-500 h-1 bg-neutral-800 rounded-lg cursor-pointer"
          />
        </div>
      </div>

      {/* Expanded Track & Rhythm Control Popover */}
      {isExpanded && (
        <div className="absolute right-0 top-full mt-2 w-80 sm:w-96 p-3.5 rounded-2xl bg-neutral-900 border border-neutral-800 shadow-2xl z-50 space-y-3 animate-fade-in">
          {/* Header with Tabs */}
          <div className="flex items-center justify-between pb-2 border-b border-neutral-800">
            <div className="flex items-center gap-1">
              <button
                onClick={() => setActiveSubTab("synth")}
                className={`px-2.5 py-1 rounded-lg text-xs font-semibold flex items-center gap-1 transition-colors ${
                  activeSubTab === "synth"
                    ? "bg-purple-600 text-white"
                    : "text-neutral-400 hover:text-neutral-200"
                }`}
              >
                <Music className="w-3 h-3" />
                Синтезатор
              </button>

              <button
                onClick={() => setActiveSubTab("internet")}
                className={`px-2.5 py-1 rounded-lg text-xs font-semibold flex items-center gap-1 transition-colors ${
                  activeSubTab === "internet"
                    ? "bg-cyan-600 text-white"
                    : "text-neutral-400 hover:text-neutral-200"
                }`}
              >
                <Globe className="w-3 h-3" />
                Интернет-потоки
              </button>

              <button
                onClick={() => setActiveSubTab("rhythm")}
                className={`px-2.5 py-1 rounded-lg text-xs font-semibold flex items-center gap-1 transition-colors ${
                  activeSubTab === "rhythm"
                    ? "bg-indigo-600 text-white"
                    : "text-neutral-400 hover:text-neutral-200"
                }`}
              >
                <Activity className="w-3 h-3" />
                Ритм {bpm} BPM
              </button>
            </div>

            <button
              onClick={() => setAutoSwitch(!autoSwitch)}
              className={`text-[10px] px-2 py-0.5 rounded-full border transition-all ${
                autoSwitch
                  ? "bg-purple-950 border-purple-500 text-purple-300 font-semibold"
                  : "bg-neutral-800 border-neutral-700 text-neutral-400"
              }`}
              title="Автоматически переключать музыку под настроение сцены"
            >
              Авто: {autoSwitch ? "ВКЛ" : "ВЫКЛ"}
            </button>
          </div>

          {/* TAB 1: Synthesizer Tracks */}
          {activeSubTab === "synth" && (
            <div className="space-y-1 max-h-60 overflow-y-auto pr-1">
              {SYNTH_TRACKS.map((t) => {
                const isSelected = currentTrack === t.id && isPlaying;
                return (
                  <button
                    key={t.id}
                    onClick={() => {
                      handleSelectSynthTrack(t.id);
                    }}
                    className={`w-full p-2 rounded-xl flex items-center justify-between text-left transition-all ${
                      isSelected
                        ? "bg-purple-950/70 border border-purple-600/80 text-purple-200"
                        : "hover:bg-neutral-800/60 text-neutral-300"
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <span className="text-base">{t.icon}</span>
                      <div>
                        <div className="text-xs font-semibold flex items-center gap-1.5">
                          <span>{t.name}</span>
                          <span className="text-[10px] text-neutral-500 font-mono">
                            {t.defaultBpm} BPM
                          </span>
                        </div>
                        <div className="text-[10px] text-neutral-400">{t.mood}</div>
                      </div>
                    </div>
                    {t.id === suggestedTrack && (
                      <span className="text-[9px] px-1.5 py-0.5 rounded bg-purple-900 text-purple-300">
                        ИИ
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          )}

          {/* TAB 2: Internet Music Bases, iTunes, Web Radio & Streams */}
          {activeSubTab === "internet" && (
            <div className="space-y-3 max-h-80 overflow-y-auto pr-1">
              {/* Search Form */}
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  handleSearchOnline();
                }}
                className="space-y-2"
              >
                <div className="relative flex items-center gap-1.5">
                  <div className="relative flex-1">
                    <Search className="w-3.5 h-3.5 text-neutral-500 absolute left-2.5 top-2.5" />
                    <input
                      type="text"
                      placeholder="Искать любую музыку, OST, радио (Witcher, Skyrim, Zimmer)..."
                      value={streamSearch}
                      onChange={(e) => setStreamSearch(e.target.value)}
                      className="w-full pl-8 pr-8 py-2 rounded-xl bg-neutral-950/80 border border-neutral-800 text-xs text-neutral-200 focus:outline-none focus:border-cyan-500 placeholder-neutral-500"
                    />
                    {streamSearch && (
                      <button
                        type="button"
                        onClick={() => {
                          setStreamSearch("");
                          setHasSearched(false);
                          setOnlineResults([]);
                        }}
                        className="absolute right-2.5 top-2 text-neutral-500 hover:text-neutral-300 text-xs"
                      >
                        ✕
                      </button>
                    )}
                  </div>
                  <button
                    type="submit"
                    disabled={isSearchingOnline || !streamSearch.trim()}
                    className="px-3 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-semibold flex items-center gap-1.5 disabled:opacity-50 transition-colors shrink-0 shadow-sm"
                  >
                    {isSearchingOnline ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Search className="w-3.5 h-3.5" />
                    )}
                    <span>Найти</span>
                  </button>
                </div>

                {/* Source Filter Badges */}
                <div className="flex items-center gap-1 overflow-x-auto pb-0.5 text-[10px]">
                  {[
                    { id: "all", label: "Все базы" },
                    { id: "itunes", label: "iTunes & OST" },
                    { id: "radio", label: "Радиостанции мира" },
                    { id: "presets", label: "Эмбиент-потоки" },
                  ].map((s) => (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => {
                        const newSource = s.id as any;
                        setSourceFilter(newSource);
                        if (streamSearch.trim()) {
                          handleSearchOnline(streamSearch, newSource);
                        }
                      }}
                      className={`px-2 py-0.5 rounded-lg border whitespace-nowrap transition-colors ${
                        sourceFilter === s.id
                          ? "bg-cyan-950 border-cyan-500 text-cyan-200 font-semibold"
                          : "bg-neutral-950 border-neutral-800 text-neutral-400 hover:text-neutral-200"
                      }`}
                    >
                      {s.label}
                    </button>
                  ))}
                </div>

                {/* Quick Suggestion Tags */}
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="text-[10px] text-neutral-500">Популярное:</span>
                  {[
                    "Witcher",
                    "Skyrim",
                    "Cyberpunk",
                    "Hans Zimmer",
                    "Lofi Chill",
                    "Anime OST",
                    "Dark Souls",
                    "Таверна",
                  ].map((tag) => (
                    <button
                      key={tag}
                      type="button"
                      onClick={() => {
                        setStreamSearch(tag);
                        handleSearchOnline(tag);
                      }}
                      className="text-[10px] px-2 py-0.5 rounded-full bg-neutral-900 hover:bg-neutral-800 border border-neutral-800 hover:border-cyan-800 text-neutral-300 transition-colors"
                    >
                      {tag}
                    </button>
                  ))}
                </div>
              </form>

              {/* Search Loading */}
              {isSearchingOnline && (
                <div className="py-6 flex flex-col items-center justify-center text-center gap-2 text-neutral-400">
                  <Loader2 className="w-5 h-5 animate-spin text-cyan-400" />
                  <span className="text-xs">Поиск треков и радиостанций по мировым базам...</span>
                </div>
              )}

              {/* Results List */}
              {!isSearchingOnline && hasSearched && onlineResults.length > 0 && (
                <div className="space-y-1">
                  <div className="text-[11px] font-semibold text-neutral-400 px-1 flex items-center justify-between">
                    <span>Найдено результатов: {onlineResults.length}</span>
                    <span className="text-[10px] text-neutral-500">Нажмите для запуска</span>
                  </div>
                  {onlineResults.map((track) => {
                    const isSelected =
                      currentTrack === "custom-stream" &&
                      (sound.currentStreamTitle === track.name || sound.currentStreamTitle === `${track.name} — ${track.artist}`) &&
                      isPlaying;

                    return (
                      <div
                        key={track.id}
                        className={`w-full p-2 rounded-xl flex items-center justify-between transition-all ${
                          isSelected
                            ? "bg-cyan-950/70 border border-cyan-500/80 text-cyan-200"
                            : "bg-neutral-950/50 hover:bg-neutral-800/60 border border-neutral-800/60 text-neutral-300"
                        }`}
                      >
                        <div className="flex items-center gap-2.5 overflow-hidden flex-1 mr-2">
                          {track.artwork ? (
                            <img
                              src={track.artwork}
                              alt=""
                              className="w-9 h-9 rounded-lg object-cover shrink-0 border border-neutral-800"
                              onError={(e) => {
                                (e.target as HTMLElement).style.display = "none";
                              }}
                            />
                          ) : (
                            <div className="w-9 h-9 rounded-lg bg-neutral-800 flex items-center justify-center shrink-0 text-sm">
                              {track.source === "iTunes" ? "🎵" : "📻"}
                            </div>
                          )}
                          <div className="overflow-hidden">
                            <div className="text-xs font-semibold truncate flex items-center gap-1.5">
                              <span className="truncate">{track.name}</span>
                              <span className="text-[9px] px-1.5 py-0.2 rounded bg-neutral-800 text-cyan-400 border border-neutral-700 font-mono shrink-0">
                                {track.source}
                              </span>
                            </div>
                            <div className="text-[10px] text-neutral-400 truncate">
                              {track.artist} {track.genre ? `• ${track.genre}` : ""}
                            </div>
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={() => {
                            if (isSelected) {
                              togglePlayback();
                            } else {
                              handleSelectInternetStream(
                                track.url,
                                `${track.name} — ${track.artist}`,
                                track.bpm || bpm
                              );
                            }
                          }}
                          className={`p-1.5 rounded-lg shrink-0 transition-all ${
                            isSelected
                              ? "bg-cyan-500 text-neutral-950 font-bold shadow-md shadow-cyan-500/40"
                              : "bg-neutral-800 hover:bg-cyan-600 hover:text-white text-neutral-300"
                          }`}
                          title={isSelected ? "Остановить" : "Слушать"}
                        >
                          {isSelected ? (
                            <Disc className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <Play className="w-3.5 h-3.5" />
                          )}
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* No results */}
              {!isSearchingOnline && hasSearched && onlineResults.length === 0 && (
                <div className="py-6 text-center space-y-1.5 text-neutral-400">
                  <p className="text-xs">Ничего не найдено по запросу «{streamSearch}».</p>
                  <p className="text-[11px] text-neutral-500">
                    Попробуйте ввести исполнителя на латинице (например, «Hans Zimmer», «Witcher») или воспользуйтесь формой ниже для прямой ссылки.
                  </p>
                </div>
              )}

              {/* Presets List when not searching */}
              {!hasSearched && (
                <div className="space-y-1">
                  <div className="text-[11px] font-semibold text-neutral-400 px-1">
                    Популярные онлайн радиостанции и эмбиент:
                  </div>
                  {filteredStreams.map((stream) => {
                    const isSelected =
                      currentTrack === "custom-stream" &&
                      sound.currentStreamTitle === stream.name &&
                      isPlaying;

                    return (
                      <button
                        key={stream.id}
                        type="button"
                        onClick={() =>
                          handleSelectInternetStream(stream.url, stream.name, stream.bpm)
                        }
                        className={`w-full p-2 rounded-xl flex items-center justify-between text-left transition-all ${
                          isSelected
                            ? "bg-cyan-950/70 border border-cyan-500/80 text-cyan-200"
                            : "hover:bg-neutral-800/60 text-neutral-300"
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <span className="text-base">{stream.icon}</span>
                          <div>
                            <div className="text-xs font-semibold flex items-center gap-1.5">
                              <span>{stream.name}</span>
                              <span className="text-[10px] text-cyan-400/80 font-mono">
                                {stream.bpm} BPM
                              </span>
                            </div>
                            <div className="text-[10px] text-neutral-400">
                              {stream.genre} • {stream.mood}
                            </div>
                          </div>
                        </div>
                        {isSelected ? (
                          <Disc className="w-4 h-4 text-cyan-400 animate-spin" />
                        ) : (
                          <Play className="w-3.5 h-3.5 text-neutral-500" />
                        )}
                      </button>
                    );
                  })}
                </div>
              )}

              {/* Custom Direct URL Input */}
              <form onSubmit={handlePlayCustomUrl} className="pt-2 border-t border-neutral-800 space-y-2">
                <div className="text-[11px] font-semibold text-neutral-300 flex items-center gap-1">
                  <Radio className="w-3 h-3 text-cyan-400" />
                  Вставить свой аудиопоток или прямую ссылку:
                </div>
                <input
                  type="url"
                  placeholder="https://... (mp3, ogg, радиопоток)"
                  value={customStreamUrl}
                  onChange={(e) => setCustomStreamUrl(e.target.value)}
                  className="w-full px-2.5 py-1.5 rounded-lg bg-neutral-950 border border-neutral-800 text-xs text-neutral-200 focus:outline-none focus:border-cyan-500"
                />
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    placeholder="Название трека..."
                    value={customStreamTitle}
                    onChange={(e) => setCustomStreamTitle(e.target.value)}
                    className="flex-1 px-2.5 py-1.5 rounded-lg bg-neutral-950 border border-neutral-800 text-xs text-neutral-200 focus:outline-none focus:border-cyan-500"
                  />
                  <button
                    type="submit"
                    className="px-3 py-1.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-semibold flex items-center gap-1 transition-colors"
                  >
                    <Play className="w-3 h-3" />
                    Запуск
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* TAB 3: Narrative Rhythm & BPM Adaptation */}
          {activeSubTab === "rhythm" && (
            <div className="space-y-3.5">
              <div className="p-3 rounded-xl bg-indigo-950/40 border border-indigo-800/40 space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-indigo-200">
                    Ритм сцены: {bpm} BPM
                  </span>
                  <span className="text-[10px] text-indigo-400 font-medium">
                    ИИ подстраивает темп текста
                  </span>
                </div>
                <p className="text-[11px] text-neutral-400 leading-relaxed">
                  {BPM_PRESETS.find((p) => Math.abs(p.bpm - bpm) <= 15)?.desc ||
                    "ИИ генерирует текст с динамикой и длиной предложений, адаптированными под этот пульс."}
                </p>
              </div>

              {/* BPM Slider */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-xs text-neutral-400">
                  <span>50 BPM (Медленно)</span>
                  <span className="font-mono text-purple-300 font-bold text-sm">
                    {bpm} BPM
                  </span>
                  <span>180 BPM (Шторм)</span>
                </div>
                <input
                  type="range"
                  min="50"
                  max="180"
                  step="5"
                  value={bpm}
                  onChange={(e) => setBpm(parseInt(e.target.value, 10))}
                  className="w-full accent-indigo-500 h-1.5 bg-neutral-800 rounded-lg cursor-pointer"
                />
              </div>

              {/* Preset Buttons */}
              <div className="grid grid-cols-2 gap-1.5">
                {BPM_PRESETS.map((p) => (
                  <button
                    key={p.bpm}
                    onClick={() => setBpm(p.bpm)}
                    className={`p-2 rounded-xl text-left border text-xs transition-all ${
                      Math.abs(p.bpm - bpm) <= 8
                        ? "bg-indigo-950/70 border-indigo-500 text-indigo-200 font-semibold"
                        : "bg-neutral-950/60 border-neutral-800 text-neutral-300 hover:bg-neutral-800"
                    }`}
                  >
                    <div>{p.label}</div>
                    <div className="text-[10px] text-neutral-500 font-mono">{p.bpm} BPM</div>
                  </button>
                ))}
              </div>

              {/* Tap Tempo Button */}
              <div className="pt-2 border-t border-neutral-800 flex items-center justify-between">
                <button
                  type="button"
                  onClick={handleTapTempo}
                  className="w-full py-2.5 rounded-xl bg-neutral-950 hover:bg-neutral-800 border border-neutral-700 text-indigo-300 font-semibold text-xs flex items-center justify-center gap-2 active:scale-95 transition-all"
                  title="Кликайте в такт любой внешней музыке"
                >
                  <Activity className="w-3.5 h-3.5 text-indigo-400" />
                  <span>Отстучать ритм пальцем (Tap Tempo)</span>
                </button>
              </div>
            </div>
          )}

          {/* Close button */}
          <div className="pt-2 border-t border-neutral-800 flex justify-end">
            <button
              onClick={() => setIsExpanded(false)}
              className="text-[11px] text-neutral-400 hover:text-neutral-200"
            >
              Свернуть панель
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
