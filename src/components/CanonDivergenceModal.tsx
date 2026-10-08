import React, { useState } from "react";
import {
  GitFork,
  Sparkles,
  UserPlus,
  History,
  Zap,
  Flame,
  X,
  Loader2,
  AlertCircle,
  HelpCircle,
  Wand2,
  Shield,
  MessageSquare,
} from "lucide-react";
import {
  DivergencePayload,
  DivergenceType,
  SceneHistoryItem,
  CharacterTemperament,
} from "../types";
import { sound } from "../utils/audio";

interface CanonDivergenceModalProps {
  isOpen: boolean;
  onClose: () => void;
  history: SceneHistoryItem[];
  currentScene: string;
  onApplyDivergence: (payload: DivergencePayload) => Promise<void>;
  isApplying?: boolean;
}

const QUICK_TWISTS = [
  {
    title: "Внезапная природная или магическая катастрофа",
    desc: "Земля содрогается, свод пещеры рушится или начинается аномальный шторм, меняющий поле боя.",
    type: "inject_event" as DivergenceType,
  },
  {
    title: "Раскрытие двойного шпиона",
    desc: "Один из ключевых участников сцены внезапно показывает тайный жетон или признаётся в предательстве.",
    type: "inject_event" as DivergenceType,
  },
  {
    title: "Появление общего древнего врага",
    desc: "Перед противоборствующими сторонами возникает общая чудовищная угроза, заставляющая объединиться.",
    type: "inject_event" as DivergenceType,
  },
  {
    title: "Внезапное подкрепление или спасение",
    desc: "В критический момент из ниоткуда прибывает союзный отряд или легендарный воин.",
    type: "inject_event" as DivergenceType,
  },
];

const PRESET_CHARACTERS = [
  {
    name: "Геральт из Ривии",
    fandom: "Ведьмак",
    role: "Охотник на чудовищ / Союзник",
    temperament: "флегматик" as CharacterTemperament,
    traits: ["Циничный", "Опытный", "Честный"],
    speech: "Хриплый, лаконичный, с сухим юмором",
    avatar: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=400",
  },
  {
    name: "Лилит, торговка запретными артефактами",
    fandom: "Оригинальный персонаж",
    role: "Загадочная торговка / Нейтрал",
    temperament: "сангвиник" as CharacterTemperament,
    traits: ["Азартная", "Уклончивая", "Хитрая"],
    speech: "Мелодичный, вкрадчивый, шепчущий",
    avatar: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=400",
  },
  {
    name: "Леви Аккерман",
    fandom: "Атака Титанов",
    role: "Капитан спецотряда / Внезапный союзник",
    temperament: "меланхолик" as CharacterTemperament,
    traits: ["Хладнокровный", "Бескомпромиссный", "Гений боя"],
    speech: "Резкий, немногословный, леденящий",
    avatar: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=400",
  },
];

export const CanonDivergenceModal: React.FC<CanonDivergenceModalProps> = ({
  isOpen,
  onClose,
  history,
  currentScene,
  onApplyDivergence,
  isApplying = false,
}) => {
  const [divergenceType, setDivergenceType] = useState<DivergenceType>("inject_event");

  // Mode 1: Event Twist
  const [eventTitle, setEventTitle] = useState("");
  const [eventDescription, setEventDescription] = useState("");

  // Mode 2: Inject Character
  const [charName, setCharName] = useState("");
  const [charUniverse, setCharUniverse] = useState("");
  const [charRole, setCharRole] = useState("Неожиданный союзник");
  const [charTemperament, setCharTemperament] = useState<CharacterTemperament>("сангвиник");
  const [charTraits, setCharTraits] = useState("Решительный, Загадочный");
  const [charSpeech, setCharSpeech] = useState("Уверенный и выразительный");
  const [charEntrance, setCharEntrance] = useState("");

  // Mode 3: Retcon History (What If)
  const [selectedHistoryStep, setSelectedHistoryStep] = useState<number>(
    history.length > 1 ? history[history.length - 2].stepNumber : 1
  );
  const [alternativeChoiceText, setAlternativeChoiceText] = useState("");

  if (!isOpen) return null;

  const handleApplyPresetTwist = (twist: (typeof QUICK_TWISTS)[0]) => {
    sound.playClick();
    setEventTitle(twist.title);
    setEventDescription(twist.desc);
  };

  const handleApplyPresetCharacter = (preset: (typeof PRESET_CHARACTERS)[0]) => {
    sound.playClick();
    setCharName(preset.name);
    setCharUniverse(preset.fandom);
    setCharRole(preset.role);
    setCharTemperament(preset.temperament);
    setCharTraits(preset.traits.join(", "));
    setCharSpeech(preset.speech);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    sound.playAction("magic");

    let payload: DivergencePayload;

    if (divergenceType === "inject_event") {
      if (!eventTitle.trim()) return;
      payload = {
        type: "inject_event",
        title: eventTitle.trim(),
        description: eventDescription.trim() || eventTitle.trim(),
      };
    } else if (divergenceType === "inject_character") {
      if (!charName.trim()) return;
      payload = {
        type: "inject_character",
        title: `Появление персонажа: ${charName}`,
        description: charEntrance.trim() || `В сцену неожиданно вмешивается ${charName} (${charUniverse || "из другого мира"}).`,
        characterData: {
          name: charName.trim(),
          fandomUniverse: charUniverse.trim() || undefined,
          role: charRole.trim() || "Спутник",
          temperament: charTemperament,
          traits: charTraits.split(",").map((t) => t.trim()).filter(Boolean),
          habits: ["Оценивает обстановку новым взглядом"],
          speechStyle: charSpeech.trim(),
          bio: `${charRole}. Прибыл из ${charUniverse || "далёких земель"}.`,
          initialAffinity: 50,
        },
      };
    } else {
      // Retcon History
      payload = {
        type: "retcon_history",
        title: `Развилка времени: Шаг #${selectedHistoryStep}`,
        description: `Альтернативный исход: ${alternativeChoiceText}`,
        retconTargetStep: selectedHistoryStep,
        alternativeChoice: alternativeChoiceText,
      };
    }

    await onApplyDivergence(payload);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/85 backdrop-blur-md animate-fade-in">
      <div className="w-full max-w-3xl max-h-[92vh] flex flex-col rounded-3xl bg-neutral-900 border border-purple-500/40 shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="p-4 sm:p-5 bg-gradient-to-r from-purple-950/70 via-neutral-900 to-neutral-900 border-b border-purple-900/40 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-purple-500/20 border border-purple-500/40 flex items-center justify-center text-purple-400">
              <GitFork className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-neutral-100 flex items-center gap-2">
                Вклинить событие & Изменить канон
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-purple-900/70 border border-purple-700/60 text-purple-300 font-normal">
                  Эффект бабочки
                </span>
              </h2>
              <p className="text-xs text-neutral-400">
                Внесите неожиданный сюжетный поворот, добавьте героя из любой вселенной или перепишите развилку
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

        {/* Tab Navigation */}
        <div className="flex items-center gap-2 px-4 sm:px-6 pt-3 bg-neutral-950/40 border-b border-neutral-800 text-xs">
          <button
            type="button"
            onClick={() => {
              sound.playClick();
              setDivergenceType("inject_event");
            }}
            className={`pb-2.5 font-semibold flex items-center gap-1.5 border-b-2 transition-all ${
              divergenceType === "inject_event"
                ? "border-purple-500 text-purple-400"
                : "border-transparent text-neutral-400 hover:text-neutral-200"
            }`}
          >
            <Zap className="w-3.5 h-3.5" />
            Вклинить неожиданное событие
          </button>

          <button
            type="button"
            onClick={() => {
              sound.playClick();
              setDivergenceType("inject_character");
            }}
            className={`pb-2.5 font-semibold flex items-center gap-1.5 border-b-2 transition-all ${
              divergenceType === "inject_character"
                ? "border-purple-500 text-purple-400"
                : "border-transparent text-neutral-400 hover:text-neutral-200"
            }`}
          >
            <UserPlus className="w-3.5 h-3.5" />
            Ввести нового персонажа
          </button>

          <button
            type="button"
            onClick={() => {
              sound.playClick();
              setDivergenceType("retcon_history");
            }}
            className={`pb-2.5 font-semibold flex items-center gap-1.5 border-b-2 transition-all ${
              divergenceType === "retcon_history"
                ? "border-purple-500 text-purple-400"
                : "border-transparent text-neutral-400 hover:text-neutral-200"
            }`}
          >
            <History className="w-3.5 h-3.5" />
            Переписать развилку («Что если...»)
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-5">
          {/* MODE 1: INJECT EVENT */}
          {divergenceType === "inject_event" && (
            <div className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-neutral-300">
                  Название поворота / события:
                </label>
                <input
                  type="text"
                  required
                  placeholder="Например: 'Внезапная засада наёмников', 'Магический всплеск открыл портал'..."
                  value={eventTitle}
                  onChange={(e) => setEventTitle(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-neutral-950 border border-neutral-800 text-xs sm:text-sm text-neutral-200 focus:outline-none focus:border-purple-500"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-neutral-300">
                  Что именно происходит и как меняется ситуация:
                </label>
                <textarea
                  rows={3}
                  placeholder="Опишите детали: 'С потолка срывается горящая балка, перегораживая выход. Из пролома выходят трое мечников в масках...'"
                  value={eventDescription}
                  onChange={(e) => setEventDescription(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-neutral-950 border border-neutral-800 text-xs sm:text-sm text-neutral-200 focus:outline-none focus:border-purple-500"
                />
              </div>

              {/* Quick Inspiration Pills */}
              <div className="space-y-2 pt-2">
                <span className="text-[11px] font-semibold text-neutral-400">
                  Быстрые идеи для твиста:
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {QUICK_TWISTS.map((twist, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => handleApplyPresetTwist(twist)}
                      className="p-2.5 rounded-xl bg-neutral-950/60 border border-neutral-800 hover:border-purple-700/60 text-left transition-all group"
                    >
                      <div className="text-xs font-semibold text-purple-300 group-hover:text-purple-200">
                        {twist.title}
                      </div>
                      <div className="text-[10px] text-neutral-500 line-clamp-2 mt-0.5">
                        {twist.desc}
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* MODE 2: INJECT CHARACTER */}
          {divergenceType === "inject_character" && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-neutral-300">
                    Имя персонажа:
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Геральт, Тони Старк, Дазай Осаму..."
                    value={charName}
                    onChange={(e) => setCharName(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-neutral-950 border border-neutral-800 text-xs text-neutral-200 focus:outline-none focus:border-purple-500"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-neutral-300">
                    Вселенная / Фандом:
                  </label>
                  <input
                    type="text"
                    placeholder="Ведьмак, Marvel, Бродячие псы, или свой герой..."
                    value={charUniverse}
                    onChange={(e) => setCharUniverse(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-neutral-950 border border-neutral-800 text-xs text-neutral-200 focus:outline-none focus:border-purple-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-neutral-300">
                    Роль в текущей сцене:
                  </label>
                  <input
                    type="text"
                    placeholder="Спаситель, Загадочный торговец, Соперник..."
                    value={charRole}
                    onChange={(e) => setCharRole(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-neutral-950 border border-neutral-800 text-xs text-neutral-200 focus:outline-none focus:border-purple-500"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-neutral-300">
                    Темперамент:
                  </label>
                  <select
                    value={charTemperament}
                    onChange={(e) => setCharTemperament(e.target.value as CharacterTemperament)}
                    className="w-full px-3 py-2 rounded-xl bg-neutral-950 border border-neutral-800 text-xs text-neutral-200 focus:outline-none focus:border-purple-500"
                  >
                    <option value="сангвиник">Сангвиник (общительный, харизматичный)</option>
                    <option value="холерик">Холерик (импульсивный, яростный)</option>
                    <option value="флегматик">Флегматик (хладнокровный, невозмутимый)</option>
                    <option value="меланхолик">Меланхолик (глубокий, осторожный)</option>
                  </select>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-neutral-300">
                  Как персонаж появляется в сцене:
                </label>
                <textarea
                  rows={2}
                  placeholder="Например: 'Раздаётся звон разбитого стекла — сквозь витраж влетает воин с серебряным мечом, разрубая атакующего врага...' "
                  value={charEntrance}
                  onChange={(e) => setCharEntrance(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-neutral-950 border border-neutral-800 text-xs text-neutral-200 focus:outline-none focus:border-purple-500"
                />
              </div>

              {/* Ready Preset Heroes */}
              <div className="space-y-2 pt-2 border-t border-neutral-800">
                <span className="text-[11px] font-semibold text-neutral-400">
                  Популярные герои для быстрого внедрения:
                </span>
                <div className="flex flex-wrap gap-2">
                  {PRESET_CHARACTERS.map((preset, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => handleApplyPresetCharacter(preset)}
                      className="px-3 py-1.5 rounded-xl bg-neutral-950/80 border border-neutral-800 hover:border-purple-600 text-xs text-neutral-300 hover:text-white transition-all flex items-center gap-1.5"
                    >
                      <Sparkles className="w-3 h-3 text-purple-400" />
                      <span>{preset.name}</span>
                      <span className="text-[10px] text-neutral-500">({preset.fandom})</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* MODE 3: RETCON HISTORY (WHAT IF) */}
          {divergenceType === "retcon_history" && (
            <div className="space-y-4">
              <div className="p-3.5 rounded-xl bg-purple-950/30 border border-purple-800/40 text-xs text-neutral-300 space-y-1">
                <div className="font-bold text-purple-300 flex items-center gap-1.5">
                  <History className="w-4 h-4" />
                  Эффект бабочки: перепишите прошлый выбор
                </div>
                <p className="text-neutral-400 text-[11px]">
                  Выберите момент из хроники прошлых глав и укажите другое решение. ИИ пересчитает ветку событий и создаст параллельную реальность!
                </p>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-neutral-300">
                  Выберите шаг хроники для развилки:
                </label>
                <select
                  value={selectedHistoryStep}
                  onChange={(e) => setSelectedHistoryStep(parseInt(e.target.value, 10))}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-neutral-950 border border-neutral-800 text-xs text-neutral-200 focus:outline-none focus:border-purple-500 font-mono"
                >
                  {history.map((h) => (
                    <option key={h.id} value={h.stepNumber}>
                      Шаг #{h.stepNumber}: {h.action}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-neutral-300">
                  Что должно было произойти вместо этого?
                </label>
                <textarea
                  rows={3}
                  required
                  placeholder="Например: 'Вместо того чтобы соглашаться на сделку, я выхватил кинжал и перерезал верёвки пленника', или 'Мы не заходили в таверну, а обошли её по лесной тропе'..."
                  value={alternativeChoiceText}
                  onChange={(e) => setAlternativeChoiceText(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-neutral-950 border border-neutral-800 text-xs sm:text-sm text-neutral-200 focus:outline-none focus:border-purple-500"
                />
              </div>
            </div>
          )}

          {/* Submit Buttons */}
          <div className="pt-4 border-t border-neutral-800 flex flex-col sm:flex-row items-center justify-between gap-3">
            <span className="text-[11px] text-neutral-500">
              {divergenceType === "inject_character"
                ? "Персонаж появится в сцене и будет добавлен в список спутников"
                : "Сюжет плавно изогнётся с учётом нового поворота"}
            </span>

            <div className="flex items-center gap-3 w-full sm:w-auto">
              <button
                type="button"
                onClick={onClose}
                className="w-full sm:w-auto px-4 py-2.5 rounded-xl bg-neutral-900 hover:bg-neutral-800 text-neutral-300 text-xs font-semibold"
              >
                Отмена
              </button>

              <button
                type="submit"
                disabled={isApplying}
                className="w-full sm:w-auto px-6 py-2.5 rounded-xl bg-gradient-to-r from-purple-600 via-indigo-600 to-cyan-600 hover:from-purple-500 hover:to-cyan-500 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-lg shadow-purple-950/50 disabled:opacity-50 transition-all"
              >
                {isApplying ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>ИИ меняет реальность...</span>
                  </>
                ) : (
                  <>
                    <Wand2 className="w-4 h-4" />
                    <span>Вклинить и продолжить сюжет</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
