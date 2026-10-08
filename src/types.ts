export type StoryGenre =
  | "Фэнтези"
  | "Киберпанк"
  | "Тёмная романтика"
  | "Мистика и детектив"
  | "Постапокалипсис"
  | "Аниме и исекай"
  | "Космоопера"
  | "Фанфики";

export interface GroundingSource {
  title: string;
  url: string;
}

export interface UniverseSetting {
  universeName: string;            // e.g. "Ведьмак (The Witcher)", "Киберпанк 2077", "Звёздные Войны"
  settingDescription?: string;     // Описание эпохи, локации, магии/технологий
  worldRules?: string[];           // Непреложные законы мира (e.g. "Серебряный меч для чудовищ, стальной для людей")
  factions?: string[];             // Активные фракции (e.g. "Ложа Чародеек, Нильфгаард, Редания")
  canonStrictness?: "strict" | "adaptive" | "alternate"; // Строгий канон, адаптивный или альтернативная реальность
  searchGroundingEnabled?: boolean;// Использовать поиск Google Search для проверки канона и актуального лора
  lastGroundingSources?: GroundingSource[];
  searchQueries?: string[];
}

export type ReaderTheme =
  | "dark-obsidian"
  | "cozy-parchment"
  | "cyber-neon"
  | "vampire-velvet"
  | "clean-slate";

export type AtmosphereType =
  | "mysterious"
  | "action"
  | "romantic"
  | "dark"
  | "triumphant"
  | "calm";

export enum NarrativeStyle {
  LITERARY = "literary",
  CONVERSATIONAL = "conversational",
  NOIR = "noir",
  CINEMATIC = "cinematic",
  ANIME = "anime",
  FANFICTION = "fanfiction",
  BRUTAL = "brutal",
  CYBERPUNK = "cyberpunk",
  SATIRE = "satire",
  CUSTOM = "custom",
}

export type GenerationLength = "short" | "medium" | "long";

export enum NarrativePOV {
  FIRST = "first",
  SECOND = "second",
  THIRD = "third",
  COMPANION = "companion",
}

export enum SceneFocus {
  GENERAL = "general",
  ACTION = "action",
  DIALOGUE = "dialogue",
  CRISIS = "crisis",
  EXPLORATION = "exploration",
}

export type CharacterTemperament =
  | "холерик"
  | "сангвиник"
  | "флегматик"
  | "меланхолик";

export interface Character {
  id: string;
  name: string;
  role: string;
  avatar: string;
  bio: string;
  affinity: number; // 0 to 100
  affinityTitle?: string;
  mood?: string;
  // Deep Personality and evolution
  temperament?: CharacterTemperament;
  traits?: string[];           // e.g. ["Преданный", "Скептик", "Острый на язык"]
  habits?: string[];           // e.g. ["теребит амулет при волнении", "прищуривается"]
  speechStyle?: string;        // e.g. "красноречивый, чуть насмешливый"
  secret?: string;             // Тайный мотив или скелет в шкафу
  fandomUniverse?: string;     // Вселенная персонажа
  isLockedTraits?: boolean;    // Заморозка черт от случайных авто-изменений
  evolutionLog?: string[];     // История добавленных деталей характера
  // Deep world/fandom grounding and dynamic evolution
  origin?: string;             // Место происхождения / родина / мир
  abilities?: string[];        // Умения, боевые или магические навыки, таланты
  merits?: string[];           // Заслуги, подвиги, признание и репутация
  currentStatus?: string;      // Текущее занятие, миссия или состояние в отряде
  allegiance?: string;         // Фракция, орден, клан или верность
  fandomArchetypeNotes?: string; // Синтез канона/фанфиков/обзоров со всего мира
}

export interface PlayerStats {
  hp: number;
  maxHp: number;
  energy: number;
  maxEnergy: number;
  gold: number;
  karma: number; // -100 to 100
  strength?: number;
  agility?: number;
  intellect?: number;
  charisma?: number;
}

export interface StoryChoice {
  id: string;
  label: string;
  description?: string;
  type?: "combat" | "dialogue" | "magic" | "stealth" | "romantic" | "special";
  reqItem?: string;
  reqEnergy?: number;
  statCheck?: "strength" | "agility" | "intellect" | "charisma";
  diceDifficulty?: number;
}

export interface SceneHistoryItem {
  id: string;
  stepNumber: number;
  action: string;
  sceneText: string;
  dialogueSpeaker?: string;
  timestamp: number;
  statChanges?: Partial<PlayerStats>;
  affinityChanges?: { name: string; delta: number; reason?: string }[];
  newItems?: string[];
  atmosphere?: AtmosphereType;
  choicesGiven: StoryChoice[];
  focus?: SceneFocus;
  wasEdited?: boolean;
  groundingSources?: GroundingSource[];
}

// Memory chapter summary
export interface StoryMemoryChapter {
  id: string;
  chapterNumber: number;
  title: string;
  summary: string;
  keyFacts: string[];
  characterInteractions?: string[];
  timestamp: number;
}

// Lorebook knowledge entry
export interface LorebookEntry {
  id: string;
  category: "персонаж" | "локация" | "артефакт" | "событие" | "правило_мира";
  title: string;
  description: string;
  discoveredAtStep?: number;
}

// Alternative story branch (What If?)
export interface StoryBranch {
  id: string;
  name: string;
  description: string;
  forkedAtStep: number;
  createdAt?: number;
  historySnapshot: SceneHistoryItem[];
  currentSceneSnapshot: string;
  inventorySnapshot: string[];
  charactersSnapshot: Character[];
  playerStatsSnapshot?: PlayerStats;
}

export interface Story {
  id: string;
  title: string;
  genre: StoryGenre;
  synopsis: string;
  coverImage: string;
  tags: string[];
  rating: number;
  playsCount: number;
  estimatedTime: string;
  author: string;
  difficulty: "Легко" | "Средне" | "Хардкор";
  startingScene: string;
  initialChoices: StoryChoice[];
  characters: Character[];
  startingStats: PlayerStats;
  startingInventory: string[];
  systemPrompt?: string;
  atmosphere?: AtmosphereType;
  isCustom?: boolean;
  fandomSource?: string;        // e.g. "Гарри Поттер", "Ведьмак", "Атака Титанов"
  narrativeStyle?: NarrativeStyle;
  narrativePOV?: NarrativePOV;
  povCompanionName?: string;
  lorebook?: LorebookEntry[];
  universeSetting?: UniverseSetting;
}

export interface SaveSlot {
  id: string;
  storyId: string;
  storyTitle: string;
  storyGenre: string;
  coverImage: string;
  timestamp: number;
  currentStep: number;
  sceneText: string;
  playerStats: PlayerStats;
  inventory: string[];
  characters: Character[];
  history: SceneHistoryItem[];
  choices: StoryChoice[];
  memoryChapters?: StoryMemoryChapter[];
  lorebook?: LorebookEntry[];
  branches?: StoryBranch[];
  activeBranchId?: string;
  narrativeStyle?: NarrativeStyle;
  narrativePOV?: NarrativePOV;
  universeSetting?: UniverseSetting;
}

export interface ActiveGameState {
  story: Story;
  currentScene: string;
  dialogueSpeaker?: string;
  playerStats: PlayerStats;
  inventory: string[];
  characters: Character[];
  history: SceneHistoryItem[];
  currentChoices: StoryChoice[];
  stepCount: number;
  atmosphere: AtmosphereType;
  isEnding: boolean;
  endingTitle?: string | null;
  isLoading: boolean;
  selectedHistoryIndex?: number | null;
  // Deep memory & Lorebook
  memoryChapters: StoryMemoryChapter[];
  lorebook: LorebookEntry[];
  // Alternative timelines
  branches: StoryBranch[];
  activeBranchId: string;
  // Dynamic settings for current playthrough
  narrativeStyle: NarrativeStyle;
  customStylePrompt?: string;
  generationLength?: GenerationLength;
  narrativePOV: NarrativePOV;
  povCompanionName?: string;
  currentFocus: SceneFocus;
  ultraMemory?: boolean;
  suggestedMusic?: string;
  sceneArtUrl?: string;
  affinityHistory?: { step: number; charName: string; delta: number; reason: string }[];
  // Rhythm & Tension
  currentBpm?: number;
  currentTension?: number; // 0 to 100
  divergenceLog?: { step: number; title: string; divergenceType: string; timestamp: number }[];
  chatHistory?: StoryChatMessage[];
  universeSetting?: UniverseSetting;
  lastGroundingSources?: GroundingSource[];
}

export type StoryChatActionType =
  | "change_style"
  | "change_length"
  | "change_genre"
  | "add_character"
  | "update_character"
  | "inject_scene"
  | "execute_action"
  | "update_directive"
  | "update_universe"
  | "add_lore_fact";

export interface StoryChatActionProposal {
  type: StoryChatActionType;
  title: string;
  description: string;
  payload: any;
  applied?: boolean;
}

export interface StoryChatMessage {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  timestamp: number;
  actionProposal?: StoryChatActionProposal;
  groundingSources?: GroundingSource[];
  searchQueries?: string[];
}

export type MusicRhythmPreset = "meditative" | "narrative" | "march" | "adrenaline" | "custom";

export interface InternetStreamTrack {
  id: string;
  name: string;
  genre: string;
  icon: string;
  bpm: number;
  mood: string;
  streamUrl: string;
  description: string;
}

export type TacticalStance =
  | "berserk"
  | "shadow_duelist"
  | "battle_mage"
  | "street_brawler"
  | "tactical_ranger"
  | "diplomat_gambit";

export interface TacticalMove {
  id: string;
  name: string;
  category: "initiation" | "feint" | "control" | "finisher" | "magic" | "item";
  description: string;
  icon: string;
  staminaCost: number;
  riskLevel: "low" | "medium" | "high";
}

export interface TacticalComboChain {
  stance: TacticalStance;
  stanceName: string;
  moves: TacticalMove[];
  targetDescription?: string;
  styleRank: "B" | "A" | "S" | "SSS";
  minigameResult?: {
    type: "lockpick" | "rune" | "qte" | "bargain";
    success: boolean;
    score?: number;
    details?: string;
  };
}

export type DivergenceType = "inject_event" | "inject_character" | "retcon_history";

export interface DivergencePayload {
  type: DivergenceType;
  title: string;
  description: string;
  characterData?: {
    name: string;
    fandomUniverse?: string;
    role: string;
    temperament: CharacterTemperament;
    traits: string[];
    habits: string[];
    speechStyle: string;
    bio: string;
    initialAffinity: number;
    avatar?: string;
  };
  retconTargetStep?: number;
  alternativeChoice?: string;
}

export interface CharacterRelationship {
  fromCharName: string;
  toCharName: string;
  type: "ally" | "rival" | "friend" | "love" | "distrust" | "mentor" | "neutral";
  label: string;
  intensity: number; // 0 to 100
  notes?: string;
}

export interface StyleAnalysisResult {
  overallScore: number;
  styleMatchRating: string;
  breakdown: {
    vocabularyScore: number;
    pacingScore: number;
    dialogueBalanceScore: number;
    atmosphereScore: number;
  };
  strengths: string[];
  divergences: string[];
  actionableTips: string[];
  improvedVersion: string;
}
