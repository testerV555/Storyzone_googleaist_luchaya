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
  // Voice, Appearance & Pose Multimedia
  voiceSampleUrl?: string;       // Загруженное аудио голоса персонажа или ссылка
  voiceTimbre?: string;          // Тембр: "Низкий бархатный баритон", "Звонкий насмешливый альт", "Хриплый шёпот"
  voicePitch?: number;           // Высота голоса (0.5 - 1.8) для речевого синтезатора
  voiceRate?: number;            // Скорость речи (0.7 - 1.4)
  appearancePhotos?: string[];   // Галерея фото внешности, костюмов, артов персонажа
  poseReferenceUrl?: string;     // Фото текущей позы или сцены персонажа
  poseDescription?: string;      // Описание позы: "Скрестив руки, опираясь на колонну"
}

export type AttachmentCategory = "photo" | "audio" | "video" | "text_doc";

export interface MediaAttachment {
  id: string;
  name: string;
  category: AttachmentCategory;
  fileType: string;              // "image/png", "audio/mp3", "video/mp4", "text/plain", "application/json", etc.
  size: number;
  dataUrl?: string;              // base64 / blob / external URL
  textPreview?: string;          // Предпросмотр текста (.txt, .md, .docx, .json, .fountain)
  duration?: number;             // Длительность аудио/видео в сек
  analysisSummary?: string;      // Выжимка ИИ (описание позы, освещения, тембра голоса, музыки)
  assignedCharacterId?: string;  // Привязка к конкретному персонажу
  usageTarget?: "scene_detail" | "character_voice" | "character_appearance" | "character_pose" | "story_script" | "lorebook" | "background_ost";
  timestamp: number;
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
  chosenAction?: string; // Действие или выбор игрока, приведший к этой главе
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
  coAuthorAgreements?: CoAuthorAgreement[];
  authorDictateMode?: boolean;
  strictActionFidelity?: boolean;
  proportionalActionScaling?: boolean;
  coAuthorMode?: boolean;
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
  chatHistory?: StoryChatMessage[];
  aiPromptDirective?: string;
  divergenceLog?: { step: number; title: string; divergenceType: string; timestamp: number }[];
  attachedMedia?: MediaAttachment[];
  coAuthorAgreements?: CoAuthorAgreement[];
  authorDictateMode?: boolean;
  strictActionFidelity?: boolean;
  proportionalActionScaling?: boolean;
  coAuthorMode?: boolean;
}

export interface CoAuthorAgreement {
  id: string;
  title: string;
  content: string;
  category?: "plot_rule" | "character_trait" | "world_fact" | "style_note";
  timestamp: number;
}

export interface PendingStoryStep {
  actionLabel: string;
  response: any;
  timestamp: number;
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
  aiPromptDirective?: string;
  narrativeContextSummary?: string;
  attachedMedia?: MediaAttachment[];
  coAuthorAgreements?: CoAuthorAgreement[];
  authorDictateMode?: boolean;
  strictActionFidelity?: boolean;
  proportionalActionScaling?: boolean;
  coAuthorMode?: boolean;
  pendingStep?: PendingStoryStep | null;
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
  | "add_lore_fact"
  | "accept_plot";

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
  attachedMedia?: MediaAttachment[];
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

// 1. Narrative Continuity & Character Consistency Context
export interface NarrativeContextSummary {
  activeTension: string;          // Непосредственный конфликт и ставки текущей сцены
  companionPsychology: string;    // Психологическое состояние каждого спутника, доверие, обиды
  causalChain: string;            // Неразрывная цепочка предыдущих шагов и последствий
  environmentalReality: string;   // Окружение, ранения, предметы в руках, освещение
  unresolvedThreads: string;      // Открытые обещания, ожидаемые угрозы
  generatedAtStep: number;
  rawText?: string;
}

// 2. Cross-Device Cloud Sync & Account
export interface CloudSyncAccount {
  accountKey: string;             // Email or custom sync code
  shortCode: string;              // Easy 6-character mobile PIN
  lastSyncedAt: number;
  storiesCount: number;
}

export interface CloudSyncStoryPayload {
  accountKey: string;
  storyId: string;
  storyTitle: string;
  storyGenre: string;
  gameState: ActiveGameState;
  saves?: SaveSlot[];
  chatHistory?: StoryChatMessage[];
  syncedAt: number;
  deviceType?: string;
}

// 3. Co-Author Scenario Formats & Multimedia Reference
export type ScenarioFormatType =
  | "screenplay"        // Киносценарий (Голливудский / Режиссерский формат)
  | "stage_play"        // Театральная пьеса и полифонический диалог
  | "light_novel"       // Ранобэ / Японская новелла (внутренний монолог)
  | "rpg_dialogue_tree" // RPG-квест (ветвящиеся реплики в стиле Witcher 3 / BG3)
  | "combat_choreography" // Пошаговая боевая хореография и трюки
  | "sensory_vignette"; // Сенсорная атмосферная зарисовка (5 чувств)

export interface ScenarioExample {
  id: ScenarioFormatType;
  title: string;
  badge: string;
  description: string;
  iconName: string;
  formatGuide: string;
  sampleSceneText: string;
  coAuthorPromptPrompt: string;
}

export interface UniverseReferenceLink {
  title: string;
  url: string;
  sourceType: "wiki" | "tvtropes" | "lore_bible" | "script" | "encyclopedia";
  description: string;
  universeName: string;
}

export interface MultimediaReferenceItem {
  id: string;
  category: "visual_photo" | "cinematic_video" | "audio_soundscape";
  title: string;
  description: string;
  assetUrl?: string;
  directorNotes: string;
  injectedDetailProposal: string;
}

export interface UserAccountProfile {
  id: string;
  username: string;
  email: string;
  pinCode: string;
  createdAt: number;
  lastSyncedAt: number;
  devices?: { deviceId: string; deviceName: string; lastSeen: number }[];
}

export interface AccountDataSnapshot {
  activeGameState: ActiveGameState | null;
  saves: SaveSlot[];
  customStories: Story[];
  chatHistories?: Record<string, StoryChatMessage[]>;
  settings?: {
    readerTheme?: ReaderTheme;
    fontSize?: "sm" | "md" | "lg" | "xl";
    soundEnabled?: boolean;
    autoSituationMusic?: boolean;
    aiPromptDirective?: string;
    aiSystemPrompt?: string;
    ultraMemory?: boolean;
    customApiKey?: string;
  };
  syncedAt: number;
  stepCount?: number;
  storyTitle?: string;
}

export type WorldMapMode = "canon" | "past" | "future" | "unified";

export interface WorldMapLocation {
  id: string;
  name: string;
  description: string;
  category: "capital" | "city" | "region" | "dungeon" | "wilds" | "landmark" | "sanctuary";
  region?: string;
  dangerLevel: 1 | 2 | 3 | 4 | 5;
  loreSnippet?: string;
  visitedSteps: number[];
  isCurrentLocation: boolean;
  isPastVisited: boolean;
  isFutureChoice: boolean;
  choiceLabel?: string;
  charactersHere: string[];
  source: "lorebook" | "universe_setting" | "chapter_history" | "choice" | "canon";
  coordinates?: { x: number; y: number };
  x?: number;
  y?: number;
  fx?: number | null;
  fy?: number | null;
}

export interface WorldMapConnection {
  id: string;
  source: string | any;
  target: string | any;
  type: "road" | "trail" | "border" | "journey_past" | "future_choice" | "sea_route";
  name?: string;
  danger?: number;
}

