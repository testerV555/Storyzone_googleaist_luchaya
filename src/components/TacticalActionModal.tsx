import React, { useState, useEffect } from "react";
import {
  Swords,
  Shield,
  Zap,
  Flame,
  Sparkles,
  Lock,
  Unlock,
  KeyRound,
  RotateCcw,
  CheckCircle2,
  AlertTriangle,
  Play,
  X,
  Plus,
  Trash2,
  ChevronRight,
  FlameKindling,
  Crosshair,
} from "lucide-react";
import {
  TacticalStance,
  TacticalMove,
  TacticalComboChain,
} from "../types";
import { sound } from "../utils/audio";

interface TacticalActionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onExecuteCombo: (combo: TacticalComboChain) => void;
  currentScene: string;
  isExecuting?: boolean;
}

const STANCES: {
  id: TacticalStance;
  name: string;
  icon: string;
  description: string;
  styleBonus: string;
}[] = [
  {
    id: "shadow_duelist",
    name: "Теневой Дуэлянт",
    icon: "🗡️",
    description: "Ловкость, уколы в уязвимые точки, обманные финты и акробатические отскоки.",
    styleBonus: "+Стиль за комбо из уклонений и контратак",
  },
  {
    id: "berserk",
    name: "Яростный Берсерк",
    icon: "🪓",
    description: "Сокрушительный напор, таран сквозь защиту, подавление чистой физической силой.",
    styleBonus: "+Урон за прорыв обороны противника",
  },
  {
    id: "battle_mage",
    name: "Боевой Маг",
    icon: "🔮",
    description: "Стихийные вспышки, кинетические щиты, каскадные заклинания и руны.",
    styleBonus: "+Эффект контроля площади и подавление чарами",
  },
  {
    id: "street_brawler",
    name: "Уличный Боец",
    icon: "👊",
    description: "Грязные приёмы: песок в глаза, удары локтями, подсечки и использование окружения.",
    styleBonus: "+Шок противника и внезапная дезориентация",
  },
  {
    id: "tactical_ranger",
    name: "Тактический Рейнджер",
    icon: "🏹",
    description: "Дистанционный контроль, выстрел на опережение, перекаты и расстановка ловушек.",
    styleBonus: "+Точный критический выстрел из слепой зоны",
  },
  {
    id: "diplomat_gambit",
    name: "Психологический Гамбит",
    icon: "♟️",
    description: "Ошеломление словами, блеф, поиск скрытого страха врага и внезапный ультиматум.",
    styleBonus: "+Возможность бескровного подчинения или раскола врагов",
  },
];

const AVAILABLE_MOVES: TacticalMove[] = [
  // Initiation
  {
    id: "m_slide",
    name: "Стремительный подкат",
    category: "initiation",
    description: "Скольжение под ударом с выбиванием опорной ноги врага",
    icon: "⚡",
    staminaCost: 15,
    riskLevel: "medium",
  },
  {
    id: "m_sand",
    name: "Бросок песка / пыли в глаза",
    category: "feint",
    description: "Мгновенное ослепление противника подручной грязью или порошком",
    icon: "💨",
    staminaCost: 10,
    riskLevel: "low",
  },
  {
    id: "m_feint",
    name: "Ложный выпад и уход за спину",
    category: "feint",
    description: "Имитация лобовой атаки с резким рывком во фланг или за спину",
    icon: "🌀",
    staminaCost: 15,
    riskLevel: "low",
  },
  {
    id: "m_disarm",
    name: "Болевой захват и обезоруживание",
    category: "control",
    description: "Перехват кисти оппонента и выкручивание рукояти оружия",
    icon: "✋",
    staminaCost: 20,
    riskLevel: "medium",
  },
  {
    id: "m_kinetic_blast",
    name: "Кинетический импульс чар",
    category: "magic",
    description: "Концентрированный взрыв магии, отбрасывающий врага в стену",
    icon: "💥",
    staminaCost: 25,
    riskLevel: "medium",
  },
  {
    id: "m_env_kick",
    name: "Опрокидывание окружения",
    category: "item",
    description: "Пинок стола, бочки или сбивание тяжелой люстры на врагов",
    icon: "🪑",
    staminaCost: 15,
    riskLevel: "low",
  },
  {
    id: "m_nerve_strike",
    name: "Точечный удар в нервный узел",
    category: "control",
    description: "Точный укол/удар, парализующий ведущую руку противника",
    icon: "🎯",
    staminaCost: 20,
    riskLevel: "high",
  },
  {
    id: "m_finisher_strike",
    name: "Сокрушительный финишер",
    category: "finisher",
    description: "Решающий кинематографичный выпад, завершающий схватку",
    icon: "⚡",
    staminaCost: 35,
    riskLevel: "high",
  },
  {
    id: "m_bluff_demand",
    name: "Холодный ультиматум под дулом клинка",
    category: "control",
    description: "Приставленное к горлу лезвие и предложение сдаться без крови",
    icon: "🗡️",
    staminaCost: 10,
    riskLevel: "medium",
  },
];

export const TacticalActionModal: React.FC<TacticalActionModalProps> = ({
  isOpen,
  onClose,
  onExecuteCombo,
  currentScene,
  isExecuting = false,
}) => {
  const [activeTab, setActiveTab] = useState<"combo" | "lockpick" | "qte">("combo");
  const [selectedStance, setSelectedStance] = useState<TacticalStance>("shadow_duelist");
  const [comboMoves, setComboMoves] = useState<TacticalMove[]>([
    AVAILABLE_MOVES[0],
    AVAILABLE_MOVES[1],
    AVAILABLE_MOVES[7],
  ]);
  const [customGoal, setCustomGoal] = useState("");

  // Minigame: Lockpick / Rune tumblers
  const [tumblerPins, setTumblerPins] = useState([
    { targetAngle: 45, currentAngle: 0, unlocked: false },
    { targetAngle: 120, currentAngle: 0, unlocked: false },
    { targetAngle: 210, currentAngle: 0, unlocked: false },
  ]);
  const [activePinIndex, setActivePinIndex] = useState(0);
  const [isLockpickSolved, setIsLockpickSolved] = useState(false);

  // Minigame: QTE
  const [qteTimer, setQteTimer] = useState(100);
  const [qteActive, setQteActive] = useState(false);
  const [qteSuccess, setQteSuccess] = useState<boolean | null>(null);
  const [qteKeyTarget, setQteKeyTarget] = useState<string>("⚔️");

  if (!isOpen) return null;

  // Style Rank Calculator
  const calculateStyleRank = (): "B" | "A" | "S" | "SSS" => {
    const moveCount = comboMoves.length;
    const categories = new Set(comboMoves.map((m) => m.category)).size;
    if (moveCount >= 4 && categories >= 3) return "SSS";
    if (moveCount >= 3 && categories >= 2) return "S";
    if (moveCount >= 2) return "A";
    return "B";
  };

  const styleRank = calculateStyleRank();

  const handleAddMove = (move: TacticalMove) => {
    if (comboMoves.length >= 5) return;
    sound.playAction("click");
    setComboMoves([...comboMoves, move]);
  };

  const handleRemoveMove = (index: number) => {
    sound.playAction("click");
    setComboMoves(comboMoves.filter((_, i) => i !== index));
  };

  // Lockpick interaction
  const handleTurnPin = (angleDelta: number) => {
    if (isLockpickSolved) return;
    const nextPins = [...tumblerPins];
    const pin = nextPins[activePinIndex];
    pin.currentAngle = (pin.currentAngle + angleDelta + 360) % 360;

    // Check sweet spot within 15 degrees
    const diff = Math.abs(pin.currentAngle - pin.targetAngle);
    if (diff <= 15 || diff >= 345) {
      pin.unlocked = true;
      sound.playAction("item");
      if (activePinIndex < tumblerPins.length - 1) {
        setActivePinIndex(activePinIndex + 1);
      } else {
        setIsLockpickSolved(true);
        sound.playFanfare();
      }
    }
    setTumblerPins(nextPins);
  };

  // Start QTE
  const startQte = () => {
    setQteActive(true);
    setQteTimer(100);
    setQteSuccess(null);
    sound.playAction("magic");
    const icons = ["⚔️", "🛡️", "⚡", "🎯"];
    setQteKeyTarget(icons[Math.floor(Math.random() * icons.length)]);
  };

  // Submit action
  const handleExecute = () => {
    sound.playAction("combat");
    const stanceObj = STANCES.find((s) => s.id === selectedStance);
    const comboPayload: TacticalComboChain = {
      stance: selectedStance,
      stanceName: stanceObj?.name || "Боевая стойка",
      moves: comboMoves,
      targetDescription: customGoal.trim() || undefined,
      styleRank,
      minigameResult: isLockpickSolved
        ? {
            type: "lockpick",
            success: true,
            score: 100,
            details: "Замок/рунический механизм виртуозно взломан без шума",
          }
        : qteSuccess
        ? {
            type: "qte",
            success: true,
            score: 100,
            details: "Молниеносный маневр сработал идеально на рефлексах",
          }
        : undefined,
    };
    onExecuteCombo(comboPayload);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/85 backdrop-blur-md animate-fade-in">
      <div className="w-full max-w-4xl max-h-[92vh] flex flex-col rounded-3xl bg-neutral-900 border border-amber-500/40 shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="p-4 sm:p-5 bg-gradient-to-r from-amber-950/70 via-neutral-900 to-neutral-900 border-b border-amber-900/40 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400">
              <Swords className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base sm:text-lg font-bold text-neutral-100">
                  Тактический Конструктор & Комбо-Цепочки
                </h2>
                <span
                  className={`px-2 py-0.5 rounded-full text-xs font-black ${
                    styleRank === "SSS"
                      ? "bg-gradient-to-r from-amber-500 to-red-500 text-white shadow-md shadow-amber-500/40"
                      : styleRank === "S"
                      ? "bg-amber-500 text-neutral-950"
                      : "bg-neutral-800 text-neutral-300"
                  }`}
                >
                  Style Rank: {styleRank}
                </span>
              </div>
              <p className="text-xs text-neutral-400">
                Создайте собственную связку действий, выберите стиль боя или решите мини-игру
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
            onClick={() => {
              sound.playClick();
              setActiveTab("combo");
            }}
            className={`pb-2.5 font-semibold flex items-center gap-1.5 border-b-2 transition-all ${
              activeTab === "combo"
                ? "border-amber-500 text-amber-400"
                : "border-transparent text-neutral-400 hover:text-neutral-200"
            }`}
          >
            <Flame className="w-3.5 h-3.5" />
            Боевая Цепочка (Комбо)
          </button>

          <button
            onClick={() => {
              sound.playClick();
              setActiveTab("lockpick");
            }}
            className={`pb-2.5 font-semibold flex items-center gap-1.5 border-b-2 transition-all ${
              activeTab === "lockpick"
                ? "border-amber-500 text-amber-400"
                : "border-transparent text-neutral-400 hover:text-neutral-200"
            }`}
          >
            <Lock className="w-3.5 h-3.5" />
            Мини-игра: Взлом Замка & Рун
            {isLockpickSolved && <CheckCircle2 className="w-3 h-3 text-emerald-400 ml-1" />}
          </button>

          <button
            onClick={() => {
              sound.playClick();
              setActiveTab("qte");
            }}
            className={`pb-2.5 font-semibold flex items-center gap-1.5 border-b-2 transition-all ${
              activeTab === "qte"
                ? "border-amber-500 text-amber-400"
                : "border-transparent text-neutral-400 hover:text-neutral-200"
            }`}
          >
            <Zap className="w-3.5 h-3.5" />
            Адреналиновый QTE-Рывок
            {qteSuccess && <CheckCircle2 className="w-3 h-3 text-emerald-400 ml-1" />}
          </button>
        </div>

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6">
          {/* TAB 1: COMBO CHAIN BUILDER */}
          {activeTab === "combo" && (
            <div className="space-y-6">
              {/* 1. Stance Chooser */}
              <div className="space-y-2.5">
                <label className="text-xs font-bold text-neutral-300 flex items-center gap-2">
                  <Shield className="w-4 h-4 text-amber-400" />
                  Выберите Боевую Стойку & Стиль:
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
                  {STANCES.map((s) => {
                    const isSelected = selectedStance === s.id;
                    return (
                      <button
                        key={s.id}
                        type="button"
                        onClick={() => {
                          sound.playClick();
                          setSelectedStance(s.id);
                        }}
                        className={`p-3 rounded-2xl border text-left transition-all ${
                          isSelected
                            ? "bg-amber-950/60 border-amber-500 text-neutral-100 shadow-md shadow-amber-950/50 ring-1 ring-amber-500/50"
                            : "bg-neutral-950/50 border-neutral-800 text-neutral-400 hover:border-neutral-700 hover:text-neutral-200"
                        }`}
                      >
                        <div className="flex items-center gap-2 text-sm font-bold text-neutral-200">
                          <span className="text-base">{s.icon}</span>
                          <span>{s.name}</span>
                        </div>
                        <p className="text-[11px] text-neutral-400 mt-1 leading-snug">
                          {s.description}
                        </p>
                        <div className="text-[10px] text-amber-400/90 font-medium mt-1.5">
                          {s.styleBonus}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* 2. Active Combo Sequence Strip */}
              <div className="p-4 rounded-2xl bg-neutral-950/80 border border-neutral-800 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-neutral-200 flex items-center gap-1.5">
                    <FlameKindling className="w-4 h-4 text-amber-400" />
                    Последовательность приёмов (Комбо-цепочка):
                  </span>
                  <span className="text-xs text-neutral-500">
                    {comboMoves.length}/5 шагов
                  </span>
                </div>

                {comboMoves.length === 0 ? (
                  <div className="p-6 text-center text-xs text-neutral-500 border border-dashed border-neutral-800 rounded-xl">
                    Нажмите на приёмы ниже, чтобы выстроить кинематографичную связку!
                  </div>
                ) : (
                  <div className="flex flex-wrap items-center gap-2">
                    {comboMoves.map((move, idx) => (
                      <div
                        key={`${move.id}_${idx}`}
                        className="flex items-center gap-1.5 pl-3 pr-2 py-1.5 rounded-xl bg-gradient-to-r from-amber-950/60 to-neutral-900 border border-amber-600/40 text-neutral-200 text-xs shadow-sm animate-fade-in"
                      >
                        <span className="font-mono text-amber-400 font-bold">
                          #{idx + 1}
                        </span>
                        <span>{move.icon}</span>
                        <span className="font-medium">{move.name}</span>
                        <button
                          type="button"
                          onClick={() => handleRemoveMove(idx)}
                          className="p-1 hover:text-red-400 text-neutral-500 transition-colors ml-1"
                          title="Удалить приём"
                        >
                          <X className="w-3 h-3" />
                        </button>
                        {idx < comboMoves.length - 1 && (
                          <ChevronRight className="w-3 h-3 text-neutral-600 ml-1" />
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* 3. Available Tactical Moves Pool */}
              <div className="space-y-2.5">
                <label className="text-xs font-bold text-neutral-300">
                  Доступные приёмы & манёвры:
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5">
                  {AVAILABLE_MOVES.map((move) => {
                    const isAdded = comboMoves.some((m) => m.id === move.id);
                    return (
                      <button
                        key={move.id}
                        type="button"
                        onClick={() => handleAddMove(move)}
                        disabled={comboMoves.length >= 5}
                        className={`p-3 rounded-2xl border text-left flex flex-col justify-between transition-all ${
                          isAdded
                            ? "bg-neutral-900/90 border-amber-500/40 text-neutral-200"
                            : "bg-neutral-950/50 border-neutral-800 text-neutral-300 hover:border-neutral-700 hover:bg-neutral-900/60"
                        } disabled:opacity-50`}
                      >
                        <div>
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-1.5 text-xs font-bold text-neutral-100">
                              <span>{move.icon}</span>
                              <span>{move.name}</span>
                            </div>
                            <span
                              className={`text-[9px] px-1.5 py-0.5 rounded font-mono ${
                                move.riskLevel === "high"
                                  ? "bg-red-950 text-red-300"
                                  : move.riskLevel === "medium"
                                  ? "bg-amber-950 text-amber-300"
                                  : "bg-emerald-950 text-emerald-300"
                              }`}
                            >
                              {move.riskLevel === "high"
                                ? "Высокий риск"
                                : move.riskLevel === "medium"
                                ? "Баланс"
                                : "Надёжно"}
                            </span>
                          </div>
                          <p className="text-[11px] text-neutral-400 mt-1 leading-snug">
                            {move.description}
                          </p>
                        </div>

                        <div className="flex items-center justify-between pt-2 mt-2 border-t border-neutral-900 text-[10px] text-neutral-500">
                          <span>Затраты: {move.staminaCost} энергии</span>
                          <span className="text-amber-400 font-semibold flex items-center gap-0.5">
                            <Plus className="w-3 h-3" /> Добавить
                          </span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* 4. Target / Special Intent */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-neutral-300">
                  Особая цель комбо (по желанию):
                </label>
                <input
                  type="text"
                  placeholder="Например: 'Захватить главаря живым', 'Разбить маску колдуна', 'Выбить ключ из рук стража'..."
                  value={customGoal}
                  onChange={(e) => setCustomGoal(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-neutral-950 border border-neutral-800 text-xs text-neutral-200 focus:outline-none focus:border-amber-500"
                />
              </div>
            </div>
          )}

          {/* TAB 2: INTERACTIVE LOCKPICK & RUNE MINIGAME */}
          {activeTab === "lockpick" && (
            <div className="p-6 rounded-2xl bg-neutral-950/70 border border-neutral-800 text-center space-y-5">
              <div className="max-w-md mx-auto space-y-2">
                <div className="w-12 h-12 mx-auto rounded-2xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400">
                  {isLockpickSolved ? (
                    <Unlock className="w-6 h-6 text-emerald-400" />
                  ) : (
                    <KeyRound className="w-6 h-6" />
                  )}
                </div>
                <h3 className="text-sm font-bold text-neutral-100">
                  {isLockpickSolved
                    ? "Замок взломан! Руны совпали!"
                    : "Интерактивный взлом механизма / Расшифровка рун"}
                </h3>
                <p className="text-xs text-neutral-400 leading-relaxed">
                  Поворачивайте отмычку (штифты), чтобы поймать нужный угол щелчка. Успешный взлом будет включён в следующий ход с бонусом скрытности!
                </p>
              </div>

              {/* Tumblers visualizer */}
              <div className="flex items-center justify-center gap-4 py-4">
                {tumblerPins.map((pin, index) => (
                  <div
                    key={index}
                    className={`flex flex-col items-center gap-2 p-4 rounded-2xl border transition-all ${
                      index === activePinIndex && !isLockpickSolved
                        ? "bg-amber-950/40 border-amber-500 ring-2 ring-amber-500/20"
                        : pin.unlocked
                        ? "bg-emerald-950/30 border-emerald-500/50"
                        : "bg-neutral-900 border-neutral-800 opacity-60"
                    }`}
                  >
                    <span className="text-[11px] font-mono text-neutral-400">
                      Штифт #{index + 1}
                    </span>
                    <div
                      className="w-16 h-16 rounded-full border-2 border-dashed border-amber-400/60 flex items-center justify-center transition-transform duration-200"
                      style={{ transform: `rotate(${pin.currentAngle}deg)` }}
                    >
                      <div className="w-2 h-6 bg-amber-400 rounded-full" />
                    </div>
                    <span className="text-xs font-bold font-mono text-neutral-200">
                      {pin.unlocked ? (
                        <span className="text-emerald-400 flex items-center gap-1">
                          <CheckCircle2 className="w-3.5 h-3.5" /> Открыто
                        </span>
                      ) : (
                        `${pin.currentAngle}°`
                      )}
                    </span>
                  </div>
                ))}
              </div>

              {/* Rotation controls */}
              {!isLockpickSolved && (
                <div className="flex items-center justify-center gap-3">
                  <button
                    type="button"
                    onClick={() => handleTurnPin(-15)}
                    className="px-4 py-2 rounded-xl bg-neutral-900 hover:bg-neutral-800 border border-neutral-700 text-xs font-semibold text-neutral-200"
                  >
                    ↺ Повернуть -15°
                  </button>
                  <button
                    type="button"
                    onClick={() => handleTurnPin(15)}
                    className="px-4 py-2 rounded-xl bg-neutral-900 hover:bg-neutral-800 border border-neutral-700 text-xs font-semibold text-neutral-200"
                  >
                    ↻ Повернуть +15°
                  </button>
                </div>
              )}
            </div>
          )}

          {/* TAB 3: QTE ADRENALINE BURST */}
          {activeTab === "qte" && (
            <div className="p-6 rounded-2xl bg-neutral-950/70 border border-neutral-800 text-center space-y-4">
              <div className="max-w-md mx-auto space-y-2">
                <Zap className="w-8 h-8 mx-auto text-amber-400 animate-pulse" />
                <h3 className="text-sm font-bold text-neutral-100">
                  Адреналиновый Рефлекс (QTE)
                </h3>
                <p className="text-xs text-neutral-400">
                  Проверьте реакцию в критический момент схватки. Нажмите на цель, пока полоса адреналина не иссякла!
                </p>
              </div>

              {!qteActive && qteSuccess === null && (
                <button
                  type="button"
                  onClick={startQte}
                  className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-amber-600 to-red-600 hover:from-amber-500 hover:to-red-500 text-white font-bold text-xs shadow-lg shadow-amber-950/50"
                >
                  Начать проверку реакции
                </button>
              )}

              {qteActive && (
                <div className="space-y-4 max-w-xs mx-auto animate-scale-in">
                  <button
                    type="button"
                    onClick={() => {
                      setQteActive(false);
                      setQteSuccess(true);
                      sound.playFanfare();
                    }}
                    className="w-24 h-24 rounded-3xl bg-amber-500 hover:bg-amber-400 text-neutral-950 text-4xl font-black shadow-xl shadow-amber-500/50 mx-auto flex items-center justify-center active:scale-90 transition-transform cursor-pointer"
                  >
                    {qteKeyTarget}
                  </button>
                  <p className="text-xs font-semibold text-amber-300">
                    ЖМИ НА ЦЕЛЬ БЫСТРЕЕ!
                  </p>
                </div>
              )}

              {qteSuccess && (
                <div className="p-3 rounded-xl bg-emerald-950/50 border border-emerald-500/50 text-emerald-300 text-xs font-semibold max-w-sm mx-auto flex items-center justify-center gap-2">
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Молниеносный рефлекс! Бонус к внезапности добавлен.</span>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer with Execution */}
        <div className="p-4 sm:p-5 bg-neutral-950 border-t border-neutral-800 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="text-xs text-neutral-400">
            ИИ литературно опишет каждое звено вашей связки в следующем фрагменте!
          </div>

          <div className="flex items-center gap-3 w-full sm:w-auto">
            <button
              type="button"
              onClick={onClose}
              className="w-full sm:w-auto px-4 py-2.5 rounded-xl bg-neutral-900 hover:bg-neutral-800 text-neutral-300 text-xs font-semibold"
            >
              Отмена
            </button>

            <button
              type="button"
              disabled={isExecuting || comboMoves.length === 0}
              onClick={handleExecute}
              className="w-full sm:w-auto px-6 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 via-orange-500 to-red-500 hover:from-amber-400 hover:to-red-400 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-lg shadow-amber-950/50 disabled:opacity-50 transition-all"
            >
              <Flame className="w-4 h-4" />
              <span>Провести комбинацию ({comboMoves.length} приёма)</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
