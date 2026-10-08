import React, { useState } from "react";
import { Character, Story, CharacterTemperament } from "../types";
import {
  Users,
  Heart,
  MessageSquare,
  Send,
  Sparkles,
  X,
  Shield,
  Lock,
  Unlock,
  Edit2,
  Camera,
  Upload,
  Plus,
  Check,
  Loader2,
  Smile,
  AlertCircle,
  Award,
  Zap,
  Compass,
  Globe,
  Scroll,
} from "lucide-react";
import { sound } from "../utils/audio";
import { safeFetchJson } from "../utils/safeApi";

interface CharactersModalProps {
  characters: Character[];
  currentStory?: Story | null;
  onUpdateCharacter?: (updatedChar: Character) => void;
  onAddCharacter?: (newChar: Character) => void;
  customApiKey?: string;
}

export const CharactersModal: React.FC<CharactersModalProps> = ({
  characters,
  currentStory,
  onUpdateCharacter,
  onAddCharacter,
  customApiKey,
}) => {
  const [selectedChar, setSelectedChar] = useState<Character | null>(
    characters[0] || null
  );
  const [activeTab, setActiveTab] = useState<"dossier" | "chat" | "photo_create">("dossier");

  // Character Chat
  const [chatInput, setChatInput] = useState("");
  const [chatMessages, setChatMessages] = useState<
    { sender: "player" | "character"; text: string }[]
  >([
    {
      sender: "character",
      text: "Здравствуй. О чём ты хочешь поговорить со мной наедине?",
    },
  ]);
  const [isTyping, setIsTyping] = useState(false);

  // Edit traits modal
  const [isEditingTraits, setIsEditingTraits] = useState(false);
  const [editTraitsList, setEditTraitsList] = useState<string[]>([]);
  const [editTemperament, setEditTemperament] = useState<CharacterTemperament>("сангвиник");
  const [editHabits, setEditHabits] = useState("");
  const [editSpeechStyle, setEditSpeechStyle] = useState("");
  const [editOrigin, setEditOrigin] = useState("");
  const [editCurrentStatus, setEditCurrentStatus] = useState("");
  const [editMerits, setEditMerits] = useState("");
  const [editAbilities, setEditAbilities] = useState("");
  const [newTraitInput, setNewTraitInput] = useState("");
  const [isEnrichingCanon, setIsEnrichingCanon] = useState(false);

  // Photo Analysis State
  const [photoBase64, setPhotoBase64] = useState<string | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [isAnalyzingPhoto, setIsAnalyzingPhoto] = useState(false);
  const [analyzedProfile, setAnalyzedProfile] = useState<any>(null);

  // Open edit modal for selected character
  const handleOpenEdit = (char: Character) => {
    setEditTraitsList(char.traits ? [...char.traits] : ["Преданный", "Смелый"]);
    setEditTemperament(char.temperament || "сангвиник");
    setEditHabits(char.habits ? char.habits.join(", ") : "");
    setEditSpeechStyle(char.speechStyle || "");
    setEditOrigin(char.origin || "");
    setEditCurrentStatus(char.currentStatus || "");
    setEditMerits(char.merits ? char.merits.join(", ") : "");
    setEditAbilities(char.abilities ? char.abilities.join(", ") : "");
    setIsEditingTraits(true);
    sound.playClick();
  };

  const handleSaveEditedTraits = () => {
    if (!selectedChar || !onUpdateCharacter) return;

    const updated: Character = {
      ...selectedChar,
      traits: editTraitsList,
      temperament: editTemperament,
      habits: editHabits
        ? editHabits.split(",").map((s) => s.trim()).filter(Boolean)
        : selectedChar.habits,
      speechStyle: editSpeechStyle.trim() || selectedChar.speechStyle,
      origin: editOrigin.trim() || undefined,
      currentStatus: editCurrentStatus.trim() || undefined,
      merits: editMerits
        ? editMerits.split(",").map((s) => s.trim()).filter(Boolean)
        : selectedChar.merits,
      abilities: editAbilities
        ? editAbilities.split(",").map((s) => s.trim()).filter(Boolean)
        : selectedChar.abilities,
    };

    onUpdateCharacter(updated);
    setSelectedChar(updated);
    setIsEditingTraits(false);
    sound.playAction("affinity");
  };

  const handleDeepEnrichFromCanon = async (char: Character) => {
    setIsEnrichingCanon(true);
    try {
      const res = await safeFetchJson<any>("/api/characters/deep-enrich", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(customApiKey ? { "x-custom-api-key": customApiKey } : {}),
        },
        body: JSON.stringify({
          characterName: char.name,
          role: char.role,
          universe: currentStory?.genre || "Мировой канон",
          currentStory: currentStory?.title || "Эпическая сага",
          currentBio: char.bio,
          customKey: customApiKey,
        }),
      });

      if (res.ok && res.data) {
        const data = res.data;
        const updated: Character = {
          ...char,
          origin: data.origin || char.origin,
          abilities: data.abilities || char.abilities,
          merits: data.merits || char.merits,
          currentStatus: data.currentStatus || char.currentStatus,
          temperament: data.temperament || char.temperament,
          traits: data.traits || char.traits,
          habits: data.habits || char.habits,
          speechStyle: data.speechStyle || char.speechStyle,
          secret: data.secret || char.secret,
          fandomArchetypeNotes: data.fandomArchetypeNotes || char.fandomArchetypeNotes,
          bio: data.bio || char.bio,
        };
        if (onUpdateCharacter) {
          onUpdateCharacter(updated);
        }
        setSelectedChar(updated);
        sound.playAction("affinity");
      }
    } catch (err) {
      console.error("Deep enrich failed:", err);
    } finally {
      setIsEnrichingCanon(false);
    }
  };

  const handleToggleLockTraits = (char: Character) => {
    if (!onUpdateCharacter) return;
    const updated: Character = {
      ...char,
      isLockedTraits: !char.isLockedTraits,
    };
    onUpdateCharacter(updated);
    setSelectedChar(updated);
    sound.playClick();
  };

  const handleSendChat = (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim() || !selectedChar || isTyping) return;

    const userText = chatInput.trim();
    setChatMessages((prev) => [...prev, { sender: "player", text: userText }]);
    setChatInput("");
    setIsTyping(true);
    sound.playClick();

    setTimeout(() => {
      let reply = "";
      const lower = userText.toLowerCase();

      if (lower.includes("кто ты") || lower.includes("расскажи о себе")) {
        reply = `Я — ${selectedChar.name}, ${selectedChar.role}. ${selectedChar.bio}`;
      } else if (lower.includes("люблю") || lower.includes("нравишься") || lower.includes("чувства")) {
        reply = `«${selectedChar.name} на мгновение отводит взгляд, смущённо улыбаясь» — Твои слова... они значат для меня больше, чем ты думаешь. Держись рядом со мной.`;
      } else if (lower.includes("план") || lower.includes("делать") || lower.includes("цель")) {
        reply = `Мы должны быть настороже. Каждое решение имеет цену, но если мы будем держаться вместе — пройдём сквозь любое испытание.`;
      } else {
        reply = `«${selectedChar.name} внимательно слушает вас» — Интересная мысль. Мой характер таков, что я привык доверять не словам, а поступкам. Посмотрим, куда приведёт наш путь.`;
      }

      setChatMessages((prev) => [...prev, { sender: "character", text: reply }]);
      setIsTyping(false);
      sound.playAction("affinity");
    }, 800);
  };

  // Photo upload and analysis
  const handlePhotoUpload = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const result = e.target?.result as string;
      setPhotoBase64(result);
      setPhotoPreview(result);
      triggerPhotoAnalysis(result, file.type);
    };
    reader.readAsDataURL(file);
  };

  const triggerPhotoAnalysis = async (base64String: string, mimeType: string) => {
    setIsAnalyzingPhoto(true);
    sound.playAction("magic");

    try {
      const res = await safeFetchJson<any>("/api/ai/analyze-photo", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(customApiKey ? { "x-custom-api-key": customApiKey } : {}),
        },
        body: JSON.stringify({
          imageBase64: base64String,
          mimeType: mimeType || "image/jpeg",
          genre: currentStory?.genre || "Фэнтези",
          customKey: customApiKey,
        }),
      });

      if (res.ok && res.data) {
        setAnalyzedProfile(res.data);
        sound.playAction("affinity");
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsAnalyzingPhoto(false);
    }
  };

  const handleAddAnalyzedCharacter = () => {
    if (!analyzedProfile || !onAddCharacter) return;

    const newChar: Character = {
      id: `char_${Date.now()}`,
      name: analyzedProfile.name || "Спутник",
      role: analyzedProfile.role || "Союзник",
      avatar: photoPreview || "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=400",
      bio: analyzedProfile.bio || analyzedProfile.appearanceDescription || "Новый союзник с уникальной историей.",
      affinity: 50,
      affinityTitle: "Знакомый",
      temperament: analyzedProfile.temperament || "сангвиник",
      traits: analyzedProfile.traits || ["Внимательный", "Преданный"],
      habits: analyzedProfile.habits || ["Наблюдает за обстановкой"],
      speechStyle: analyzedProfile.speechStyle || "Спокойный и уверенный",
      secret: analyzedProfile.secret,
      isLockedTraits: false,
    };

    onAddCharacter(newChar);
    setSelectedChar(newChar);
    setActiveTab("dossier");
    setAnalyzedProfile(null);
    setPhotoPreview(null);
    setPhotoBase64(null);
    sound.playAction("affinity");
  };

  return (
    <div className="w-full max-w-5xl mx-auto px-4 sm:px-6 py-6 sm:py-8 space-y-6 animate-fade-in">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-neutral-800">
        <div>
          <h2 className="font-cinzel text-xl sm:text-2xl font-bold text-neutral-100 flex items-center gap-2">
            <Users className="w-6 h-6 text-purple-400" />
            Кодекс Персонажей & Анализ Внешности ИИ
          </h2>
          <p className="text-xs sm:text-sm text-neutral-400">
            Живые спутники с уникальным темпераментом, привычками, анализом фото и свободной настройкой черт
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              sound.playClick();
              setActiveTab("photo_create");
            }}
            className="px-3 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-semibold flex items-center gap-1.5 shadow-md transition-all"
          >
            <Camera className="w-4 h-4" />
            Создать по фото (ИИ анализ)
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Left Column: Characters List */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-neutral-400">
              Список спутников ({characters.length})
            </h3>
          </div>

          <div className="space-y-2">
            {characters.map((char) => {
              const isSelected = selectedChar?.id === char.id;

              return (
                <div
                  key={char.id}
                  onClick={() => {
                    sound.playClick();
                    setSelectedChar(char);
                    setActiveTab("dossier");
                  }}
                  className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-all ${
                    isSelected
                      ? "bg-purple-950/60 border-purple-500 shadow-md shadow-purple-950/40"
                      : "bg-neutral-900/60 border-neutral-800 hover:bg-neutral-800/60"
                  }`}
                >
                  <img
                    src={char.avatar}
                    alt={char.name}
                    className="w-12 h-12 rounded-xl object-cover border border-neutral-700 shrink-0"
                    referrerPolicy="no-referrer"
                    onError={(e) => {
                      (e.target as HTMLElement).style.display = "none";
                    }}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-neutral-100 truncate">
                        {char.name}
                      </span>
                      <span className="text-[10px] text-purple-400 font-mono font-semibold flex items-center gap-0.5">
                        <Heart className="w-2.5 h-2.5 fill-purple-400" />
                        {char.affinity}%
                      </span>
                    </div>
                    <div className="text-[11px] text-neutral-400 truncate">
                      {char.role}
                    </div>
                    {char.temperament && (
                      <span className="inline-block mt-0.5 text-[9px] uppercase tracking-wider px-1.5 py-0.5 rounded bg-neutral-800 text-purple-300 font-medium">
                        {char.temperament}
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right 2 Columns: Details / Chat / Photo Creator */}
        <div className="md:col-span-2">
          {activeTab === "photo_create" ? (
            /* Tab: Create Character from Photo via AI Vision */
            <div className="p-5 rounded-2xl bg-neutral-900/70 border border-neutral-800 space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-neutral-800">
                <div className="flex items-center gap-2">
                  <div className="p-2 rounded-xl bg-purple-950 text-purple-400 border border-purple-800">
                    <Camera className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-cinzel text-sm font-bold text-neutral-100">
                      ИИ Анализ Внешности по Фото
                    </h3>
                    <p className="text-[11px] text-neutral-400">
                      Загрузите изображение персонажа, и Gemini определит его внешность, черты лица, одежду и темперамент!
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setActiveTab("dossier")}
                  className="text-xs text-neutral-400 hover:text-neutral-200"
                >
                  Отмена
                </button>
              </div>

              {/* Upload Drop Area */}
              <div className="border-2 border-dashed border-neutral-700 hover:border-purple-500 rounded-2xl p-6 text-center transition-colors bg-neutral-950/40">
                {photoPreview ? (
                  <div className="flex flex-col items-center gap-3">
                    <img
                      src={photoPreview}
                      alt="Preview"
                      className="w-36 h-36 rounded-2xl object-cover border-2 border-purple-500 shadow-xl"
                    />
                    <label className="cursor-pointer text-xs text-purple-400 hover:text-purple-300 underline">
                      Выбрать другое фото
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(e) => {
                          const f = e.target.files?.[0];
                          if (f) handlePhotoUpload(f);
                        }}
                      />
                    </label>
                  </div>
                ) : (
                  <label className="flex flex-col items-center gap-3 cursor-pointer">
                    <div className="p-3 rounded-full bg-neutral-800 text-purple-400">
                      <Upload className="w-6 h-6" />
                    </div>
                    <div className="space-y-1">
                      <span className="text-xs font-semibold text-neutral-200">
                        Нажмите или перетащите фото персонажа сюда
                      </span>
                      <p className="text-[11px] text-neutral-500">
                        PNG, JPG, WEBP до 10MB
                      </p>
                    </div>
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        if (f) handlePhotoUpload(f);
                      }}
                    />
                  </label>
                )}
              </div>

              {/* Analysis status / Results */}
              {isAnalyzingPhoto && (
                <div className="flex items-center justify-center gap-2.5 py-6 text-xs text-purple-300">
                  <Loader2 className="w-5 h-5 animate-spin text-purple-400" />
                  <span>ИИ сканирует черты лица, взгляд, одежду и настроение...</span>
                </div>
              )}

              {analyzedProfile && !isAnalyzingPhoto && (
                <div className="p-4 rounded-xl bg-neutral-950 border border-purple-900/60 space-y-3 animate-fade-in">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="text-sm font-bold text-neutral-100">
                        {analyzedProfile.name}
                      </h4>
                      <span className="text-xs text-purple-400 font-medium">
                        {analyzedProfile.role} • Темперамент: {analyzedProfile.temperament}
                      </span>
                    </div>
                    <button
                      onClick={handleAddAnalyzedCharacter}
                      className="px-3.5 py-1.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-semibold flex items-center gap-1.5 shadow-md"
                    >
                      <Check className="w-3.5 h-3.5" />
                      Добавить спутника
                    </button>
                  </div>

                  <div className="space-y-1">
                    <span className="text-[11px] font-semibold text-neutral-400">
                      Анализ внешности по фото:
                    </span>
                    <p className="text-xs text-neutral-300 leading-relaxed bg-neutral-900 p-2.5 rounded-lg border border-neutral-800">
                      {analyzedProfile.appearanceDescription}
                    </p>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="p-2 rounded-lg bg-neutral-900 border border-neutral-800">
                      <span className="text-[10px] text-neutral-400 block font-semibold">
                        Черты характера:
                      </span>
                      <span className="text-neutral-200">
                        {(analyzedProfile.traits || []).join(", ")}
                      </span>
                    </div>
                    <div className="p-2 rounded-lg bg-neutral-900 border border-neutral-800">
                      <span className="text-[10px] text-neutral-400 block font-semibold">
                        Привычки:
                      </span>
                      <span className="text-neutral-200">
                        {(analyzedProfile.habits || []).join("; ")}
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          ) : selectedChar ? (
            /* Dossier & Chat View */
            <div className="p-5 rounded-2xl bg-neutral-900/70 border border-neutral-800 space-y-5">
              {/* Profile Card Header */}
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-4 border-b border-neutral-800">
                <div className="flex items-center gap-4">
                  <img
                    src={selectedChar.avatar}
                    alt={selectedChar.name}
                    className="w-16 h-16 rounded-2xl object-cover border-2 border-purple-500/60 shadow-lg"
                    referrerPolicy="no-referrer"
                  />
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-cinzel text-base sm:text-lg font-bold text-neutral-100">
                        {selectedChar.name}
                      </h3>
                      {/* Lock Character Trait Toggle */}
                      <button
                        type="button"
                        onClick={() => handleToggleLockTraits(selectedChar)}
                        className={`p-1 rounded-md text-xs transition-colors ${
                          selectedChar.isLockedTraits
                            ? "bg-amber-950/80 text-amber-400 border border-amber-800/60"
                            : "bg-neutral-800 text-neutral-400 hover:text-neutral-200"
                        }`}
                        title={
                          selectedChar.isLockedTraits
                            ? "Характер зафиксирован (ИИ не изменит его случайно)"
                            : "Живой характер (может плавно эволюционировать)"
                        }
                      >
                        {selectedChar.isLockedTraits ? (
                          <Lock className="w-3.5 h-3.5" />
                        ) : (
                          <Unlock className="w-3.5 h-3.5" />
                        )}
                      </button>
                    </div>
                    <div className="text-xs text-purple-400 font-medium">
                      {selectedChar.role}
                    </div>
                    <div className="text-[11px] text-neutral-400 mt-0.5">
                      Доверие: {selectedChar.affinity}% ({selectedChar.affinityTitle || "Нейтрально"})
                    </div>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <button
                    onClick={() => handleDeepEnrichFromCanon(selectedChar)}
                    disabled={isEnrichingCanon}
                    className="px-3 py-1.5 rounded-xl bg-gradient-to-r from-amber-600 to-purple-600 hover:from-amber-500 hover:to-purple-500 text-white text-xs font-semibold flex items-center gap-1.5 transition-all shadow-md disabled:opacity-50"
                    title="Обогатить персонажа знаниями из мирового канона, фанфиков и обзоров"
                  >
                    {isEnrichingCanon ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        <span>Изучение канона...</span>
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-3.5 h-3.5 text-amber-200" />
                        <span>Обогатить из канона</span>
                      </>
                    )}
                  </button>
                  <button
                    onClick={() => handleOpenEdit(selectedChar)}
                    className="px-3 py-1.5 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-200 text-xs font-semibold flex items-center gap-1.5 transition-colors"
                  >
                    <Edit2 className="w-3.5 h-3.5 text-purple-400" />
                    Настроить черты
                  </button>
                  <button
                    onClick={() => setActiveTab(activeTab === "dossier" ? "chat" : "dossier")}
                    className="px-3 py-1.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-semibold flex items-center gap-1.5 transition-colors shadow-md"
                  >
                    <MessageSquare className="w-3.5 h-3.5" />
                    {activeTab === "dossier" ? "Поговорить" : "Досье"}
                  </button>
                </div>
              </div>

              {activeTab === "dossier" ? (
                <div className="space-y-4">
                  {/* Temperament & Trait Badges */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-neutral-300">
                        Темперамент и черты характера:
                      </span>
                      {selectedChar.temperament && (
                        <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-purple-950 border border-purple-800/80 text-purple-300">
                          {selectedChar.temperament}
                        </span>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {(selectedChar.traits || ["Внимательный", "Преданный"]).map(
                        (t, idx) => (
                          <span
                            key={idx}
                            className="text-xs px-2.5 py-1 rounded-lg bg-neutral-950 border border-neutral-800 text-neutral-200 font-medium"
                          >
                            {t}
                          </span>
                        )
                      )}
                    </div>
                  </div>

                  {/* Origin & Current Status */}
                  {(selectedChar.origin || selectedChar.currentStatus) && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {selectedChar.origin && (
                        <div className="p-3 rounded-xl bg-neutral-950/70 border border-neutral-800 space-y-1">
                          <span className="text-[11px] font-semibold text-neutral-400 flex items-center gap-1.5">
                            <Compass className="w-3.5 h-3.5 text-cyan-400" />
                            Место происхождения & Родина:
                          </span>
                          <p className="text-xs text-cyan-200 font-medium">
                            {selectedChar.origin}
                          </p>
                        </div>
                      )}
                      {selectedChar.currentStatus && (
                        <div className="p-3 rounded-xl bg-neutral-950/70 border border-neutral-800 space-y-1">
                          <span className="text-[11px] font-semibold text-neutral-400 flex items-center gap-1.5">
                            <Globe className="w-3.5 h-3.5 text-emerald-400" />
                            Текущее занятие & Деятельность:
                          </span>
                          <p className="text-xs text-emerald-200 font-medium">
                            {selectedChar.currentStatus}
                          </p>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Merits & Deeds */}
                  {selectedChar.merits && selectedChar.merits.length > 0 && (
                    <div className="space-y-1.5">
                      <span className="text-xs font-semibold text-neutral-300 flex items-center gap-1.5">
                        <Award className="w-3.5 h-3.5 text-amber-400" />
                        Заслуги, подвиги и боевая слава:
                      </span>
                      <div className="flex flex-wrap gap-1.5">
                        {selectedChar.merits.map((m, idx) => (
                          <span
                            key={idx}
                            className="text-xs px-2.5 py-1 rounded-lg bg-amber-950/50 border border-amber-800/60 text-amber-200 font-medium flex items-center gap-1"
                          >
                            <span>🏆</span>
                            <span>{m}</span>
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Abilities & Techniques */}
                  {selectedChar.abilities && selectedChar.abilities.length > 0 && (
                    <div className="space-y-1.5">
                      <span className="text-xs font-semibold text-neutral-300 flex items-center gap-1.5">
                        <Zap className="w-3.5 h-3.5 text-purple-400" />
                        Умения, техники и мастерство:
                      </span>
                      <div className="flex flex-wrap gap-1.5">
                        {selectedChar.abilities.map((ab, idx) => (
                          <span
                            key={idx}
                            className="text-xs px-2.5 py-1 rounded-lg bg-purple-950/50 border border-purple-800/60 text-purple-200 font-medium flex items-center gap-1"
                          >
                            <span>⚡</span>
                            <span>{ab}</span>
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Habits & Speech Style */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="p-3 rounded-xl bg-neutral-950/70 border border-neutral-800 space-y-1">
                      <span className="text-[11px] font-semibold text-neutral-400 block">
                        Привычки и манеры:
                      </span>
                      <p className="text-xs text-neutral-200">
                        {selectedChar.habits && selectedChar.habits.length > 0
                          ? selectedChar.habits.join("; ")
                          : "Особых привычек пока не замечено"}
                      </p>
                    </div>

                    <div className="p-3 rounded-xl bg-neutral-950/70 border border-neutral-800 space-y-1">
                      <span className="text-[11px] font-semibold text-neutral-400 block">
                        Стиль речи:
                      </span>
                      <p className="text-xs text-neutral-200">
                        {selectedChar.speechStyle || "Спокойный, вежливый"}
                      </p>
                    </div>
                  </div>

                  {/* Fandom & Canon Archetype Notes */}
                  {selectedChar.fandomArchetypeNotes && (
                    <div className="p-3 rounded-xl bg-purple-950/20 border border-purple-800/40 space-y-1">
                      <span className="text-[11px] font-semibold text-purple-300 flex items-center gap-1.5">
                        <Globe className="w-3.5 h-3.5 text-purple-400" />
                        Синтез мирового канона, фанфиков и обзоров:
                      </span>
                      <p className="text-xs text-neutral-300 leading-relaxed italic">
                        {selectedChar.fandomArchetypeNotes}
                      </p>
                    </div>
                  )}

                  {/* Bio */}
                  <div className="space-y-1">
                    <span className="text-xs font-semibold text-neutral-300">
                      Биография и известная предыстория:
                    </span>
                    <p className="text-xs text-neutral-300 leading-relaxed bg-neutral-950 p-3 rounded-xl border border-neutral-800/80">
                      {selectedChar.bio}
                    </p>
                  </div>
                </div>
              ) : (
                /* Chat view */
                <div className="space-y-3">
                  <div className="h-64 overflow-y-auto p-3 rounded-xl bg-neutral-950 border border-neutral-800 space-y-3">
                    {chatMessages.map((msg, i) => (
                      <div
                        key={i}
                        className={`flex ${
                          msg.sender === "player" ? "justify-end" : "justify-start"
                        }`}
                      >
                        <div
                          className={`max-w-[80%] p-2.5 rounded-xl text-xs leading-relaxed ${
                            msg.sender === "player"
                              ? "bg-purple-600 text-white"
                              : "bg-neutral-900 border border-neutral-800 text-neutral-200"
                          }`}
                        >
                          {msg.text}
                        </div>
                      </div>
                    ))}
                    {isTyping && (
                      <div className="flex justify-start">
                        <div className="p-2 rounded-xl bg-neutral-900 border border-neutral-800 text-[11px] text-neutral-400 flex items-center gap-1.5">
                          <Loader2 className="w-3 h-3 animate-spin text-purple-400" />
                          {selectedChar.name} обдумывает ответ...
                        </div>
                      </div>
                    )}
                  </div>

                  <form onSubmit={handleSendChat} className="flex gap-2">
                    <input
                      type="text"
                      value={chatInput}
                      onChange={(e) => setChatInput(e.target.value)}
                      placeholder={`Задать вопрос ${selectedChar.name}...`}
                      className="flex-1 px-3.5 py-2 rounded-xl bg-neutral-950 border border-neutral-800 text-xs text-neutral-100 placeholder-neutral-500 focus:outline-none focus:border-purple-500"
                    />
                    <button
                      type="submit"
                      disabled={isTyping || !chatInput.trim()}
                      className="px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white text-xs font-semibold flex items-center gap-1.5"
                    >
                      <Send className="w-3.5 h-3.5" />
                    </button>
                  </form>
                </div>
              )}
            </div>
          ) : (
            <div className="p-10 text-center text-neutral-500 text-xs">
              Выберите персонажа из списка слева
            </div>
          )}
        </div>
      </div>

      {/* Trait Customizer Modal */}
      {isEditingTraits && selectedChar && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/75 backdrop-blur-md animate-fade-in">
          <div className="relative w-full max-w-md p-5 rounded-2xl bg-neutral-900 border border-neutral-800 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-neutral-800">
              <h4 className="text-sm font-bold text-neutral-100 flex items-center gap-2">
                <Edit2 className="w-4 h-4 text-purple-400" />
                Настройка характера: {selectedChar.name}
              </h4>
              <button
                onClick={() => setIsEditingTraits(false)}
                className="text-neutral-400 hover:text-neutral-200"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Temperament Selection */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-neutral-300">
                Темперамент:
              </label>
              <div className="grid grid-cols-2 gap-2">
                {(["холерик", "сангвиник", "флегматик", "меланхолик"] as CharacterTemperament[]).map(
                  (temp) => (
                    <button
                      key={temp}
                      type="button"
                      onClick={() => setEditTemperament(temp)}
                      className={`p-2 rounded-xl border text-xs capitalize transition-all ${
                        editTemperament === temp
                          ? "bg-purple-950 border-purple-500 text-purple-200 font-semibold shadow-sm"
                          : "bg-neutral-950 border-neutral-800 text-neutral-400 hover:text-neutral-200"
                      }`}
                    >
                      {temp}
                    </button>
                  )
                )}
              </div>
            </div>

            {/* Traits list */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-neutral-300">
                Черты характера:
              </label>
              <div className="flex flex-wrap gap-1.5 mb-2">
                {editTraitsList.map((t, idx) => (
                  <span
                    key={idx}
                    className="text-xs px-2.5 py-1 rounded-lg bg-neutral-950 border border-neutral-800 text-neutral-200 flex items-center gap-1.5"
                  >
                    {t}
                    <button
                      type="button"
                      onClick={() =>
                        setEditTraitsList(editTraitsList.filter((_, i) => i !== idx))
                      }
                      className="text-neutral-500 hover:text-rose-400"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                ))}
              </div>

              <div className="flex gap-2">
                <input
                  type="text"
                  value={newTraitInput}
                  onChange={(e) => setNewTraitInput(e.target.value)}
                  placeholder="Добавить черту (например: Остроумный)"
                  className="flex-1 px-3 py-1.5 rounded-lg bg-neutral-950 border border-neutral-800 text-xs text-neutral-200 focus:outline-none focus:border-purple-500"
                />
                <button
                  type="button"
                  onClick={() => {
                    if (newTraitInput.trim()) {
                      setEditTraitsList([...editTraitsList, newTraitInput.trim()]);
                      setNewTraitInput("");
                    }
                  }}
                  className="px-3 py-1.5 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-xs text-neutral-200 font-semibold"
                >
                  <Plus className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* Origin & Current Status */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-neutral-300">
                  Место происхождения / Родина:
                </label>
                <input
                  type="text"
                  value={editOrigin}
                  onChange={(e) => setEditOrigin(e.target.value)}
                  placeholder="Королевство, планета, гильдия..."
                  className="w-full px-3 py-1.5 rounded-lg bg-neutral-950 border border-neutral-800 text-xs text-neutral-200 focus:outline-none focus:border-purple-500"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-neutral-300">
                  Текущее занятие / Роль:
                </label>
                <input
                  type="text"
                  value={editCurrentStatus}
                  onChange={(e) => setEditCurrentStatus(e.target.value)}
                  placeholder="Странствующий рыцарь, архимаг..."
                  className="w-full px-3 py-1.5 rounded-lg bg-neutral-950 border border-neutral-800 text-xs text-neutral-200 focus:outline-none focus:border-purple-500"
                />
              </div>
            </div>

            {/* Merits & Abilities */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-neutral-300">
                Заслуги и подвиги (через запятую):
              </label>
              <input
                type="text"
                value={editMerits}
                onChange={(e) => setEditMerits(e.target.value)}
                placeholder="Победил дракона, спас советников, орден чести"
                className="w-full px-3 py-1.5 rounded-lg bg-neutral-950 border border-neutral-800 text-xs text-neutral-200 focus:outline-none focus:border-purple-500"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-neutral-300">
                Умения и техники (через запятую):
              </label>
              <input
                type="text"
                value={editAbilities}
                onChange={(e) => setEditAbilities(e.target.value)}
                placeholder="Танец клинков, сокрушительный удар, телепатия"
                className="w-full px-3 py-1.5 rounded-lg bg-neutral-950 border border-neutral-800 text-xs text-neutral-200 focus:outline-none focus:border-purple-500"
              />
            </div>

            {/* Habits & Speech */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-neutral-300">
                Привычки (через запятую):
              </label>
              <input
                type="text"
                value={editHabits}
                onChange={(e) => setEditHabits(e.target.value)}
                placeholder="поправляет причёску, хмурится"
                className="w-full px-3 py-1.5 rounded-lg bg-neutral-950 border border-neutral-800 text-xs text-neutral-200 focus:outline-none focus:border-purple-500"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-neutral-300">
                Стиль речи:
              </label>
              <input
                type="text"
                value={editSpeechStyle}
                onChange={(e) => setEditSpeechStyle(e.target.value)}
                placeholder="Ироничный, сдержанный, говорит шёпотом"
                className="w-full px-3 py-1.5 rounded-lg bg-neutral-950 border border-neutral-800 text-xs text-neutral-200 focus:outline-none focus:border-purple-500"
              />
            </div>

            <div className="pt-2 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setIsEditingTraits(false)}
                className="px-3 py-1.5 rounded-xl border border-neutral-800 text-xs text-neutral-300 hover:bg-neutral-800"
              >
                Отмена
              </button>
              <button
                type="button"
                onClick={handleSaveEditedTraits}
                className="px-4 py-1.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-semibold shadow-md"
              >
                Сохранить
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
