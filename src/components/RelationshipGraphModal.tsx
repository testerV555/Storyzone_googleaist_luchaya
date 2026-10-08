import React, { useState } from "react";
import {
  X,
  Heart,
  Shield,
  Sparkles,
  Users2,
  Grid,
  Network,
  Lock,
  Unlock,
  MessageCircle,
  HelpCircle,
  Flame,
  Swords,
  Smile,
  Frown,
  ArrowRightLeft,
} from "lucide-react";
import { Character, CharacterRelationship } from "../types";
import { sound } from "../utils/audio";
import { safeFetchJson } from "../utils/safeApi";

interface RelationshipGraphModalProps {
  isOpen: boolean;
  onClose: () => void;
  characters: Character[];
  protagonistName?: string;
  karma?: number;
  customApiKey?: string;
  storyTitle?: string;
}

export const RelationshipGraphModal: React.FC<RelationshipGraphModalProps> = ({
  isOpen,
  onClose,
  characters,
  protagonistName = "Вы (Протагонист)",
  karma = 10,
  customApiKey,
  storyTitle = "История",
}) => {
  const [activeTab, setActiveTab] = useState<"graph" | "matrix">("graph");
  const [selectedChar, setSelectedChar] = useState<Character | null>(
    characters.length > 0 ? characters[0] : null
  );
  const [characterThought, setCharacterThought] = useState<string | null>(null);
  const [isLoadingThought, setIsLoadingThought] = useState(false);

  if (!isOpen) return null;

  // Helper to get affinity color styling
  const getAffinityDetails = (val: number) => {
    if (val >= 80) {
      return {
        label: "Глубокая преданность / Романтика",
        color: "text-emerald-400",
        stroke: "#10b981",
        bg: "bg-emerald-950/60 border-emerald-700/60",
        badge: "bg-emerald-900/60 text-emerald-200 border-emerald-700/40",
      };
    }
    if (val >= 60) {
      return {
        label: "Надёжный союзник & Друг",
        color: "text-cyan-400",
        stroke: "#06b6d4",
        bg: "bg-cyan-950/60 border-cyan-700/60",
        badge: "bg-cyan-900/60 text-cyan-200 border-cyan-700/40",
      };
    }
    if (val >= 40) {
      return {
        label: "Нейтралитет & Осторожность",
        color: "text-amber-400",
        stroke: "#f59e0b",
        bg: "bg-amber-950/60 border-amber-700/60",
        badge: "bg-amber-900/60 text-amber-200 border-amber-700/40",
      };
    }
    return {
      label: "Напряжение / Вражда",
      color: "text-rose-400",
      stroke: "#f43f5e",
      bg: "bg-rose-950/60 border-rose-700/60",
      badge: "bg-rose-900/60 text-rose-200 border-rose-700/40",
    };
  };

  // Generate synthetic interpersonal connections between companions if not specified
  const getInterpersonalRelationship = (
    c1: Character,
    c2: Character
  ): { label: string; type: string; color: string } => {
    const combinedAffinity = ((c1.affinity || 50) + (c2.affinity || 50)) / 2;
    if (combinedAffinity >= 75) {
      return { label: "Боевое братство", type: "friend", color: "text-emerald-400" };
    }
    if (c1.temperament === "холерик" && c2.temperament === "холерик") {
      return { label: "Острое соперничество", type: "rival", color: "text-rose-400" };
    }
    if (c1.temperament === "флегматик" || c2.temperament === "флегматик") {
      return { label: "Взаимное уважение", type: "ally", color: "text-cyan-400" };
    }
    return { label: "Нейтральный интерес", type: "neutral", color: "text-amber-400" };
  };

  // Ask AI about current thoughts of character
  const handleAskThoughts = async (char: Character) => {
    setIsLoadingThought(true);
    setCharacterThought(null);
    sound.playClick();

    try {
      const res = await safeFetchJson<any>("/api/story/muse", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          storyTitle,
          genre: "Интерактивная история",
          currentScene: `Протагонист смотрит на своего спутника по имени ${char.name} (${char.role}). Отношение спутника: ${char.affinity}%. Темперамент: ${char.temperament || "сбалансированный"}. Черты: ${(char.traits || []).join(", ")}. Привычки: ${(char.habits || []).join(", ")}.`,
          characters: [char],
          museType: "speech",
          customKey: customApiKey,
        }),
      });

      const data = res.data;
      if (data && data.suggestions && data.suggestions[0]) {
        setCharacterThought(
          `«${data.suggestions[0].text}»`
        );
      } else {
        setCharacterThought(
          `«Я внимательно слежу за каждым твоим решением. Пока наш путь оправдывает себя, я с тобой».`
        );
      }
    } catch {
      setCharacterThought(
        `«Ты ведёшь нас сквозь опасности. Я верю в твоё чутье, хотя порой твои шаги кажутся безрассудными».`
      );
    } finally {
      setIsLoadingThought(false);
    }
  };

  // SVG dimensions & node positioning
  const width = 600;
  const height = 440;
  const centerX = width / 2;
  const centerY = height / 2;
  const radius = 170;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/85 backdrop-blur-md animate-fade-in">
      <div className="relative w-full max-w-5xl bg-neutral-950 border border-neutral-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-neutral-800 bg-neutral-900/80">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-purple-950/80 border border-purple-800/60 flex items-center justify-center text-purple-400">
              <Network className="w-5 h-5" />
            </div>
            <div>
              <h2 className="font-cinzel text-lg font-bold text-neutral-100 flex items-center gap-2">
                Связи & Карта Отношений
                <span className="text-xs px-2 py-0.5 rounded-full bg-purple-950 border border-purple-800/60 text-purple-300 font-sans font-normal">
                  {characters.length} спутников
                </span>
              </h2>
              <p className="text-xs text-neutral-400">
                Динамическая визуализация симпатий, доверия и связей в отряде
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* View Mode Switcher */}
            <div className="flex items-center p-1 rounded-xl bg-neutral-950 border border-neutral-800 text-xs">
              <button
                id="tab-view-graph"
                onClick={() => {
                  sound.playClick();
                  setActiveTab("graph");
                }}
                className={`flex items-center gap-1.5 px-3 py-1 rounded-lg transition-all ${
                  activeTab === "graph"
                    ? "bg-purple-600 text-white font-semibold"
                    : "text-neutral-400 hover:text-neutral-200"
                }`}
              >
                <Network className="w-3.5 h-3.5" />
                <span>Граф связей</span>
              </button>
              <button
                id="tab-view-matrix"
                onClick={() => {
                  sound.playClick();
                  setActiveTab("matrix");
                }}
                className={`flex items-center gap-1.5 px-3 py-1 rounded-lg transition-all ${
                  activeTab === "matrix"
                    ? "bg-purple-600 text-white font-semibold"
                    : "text-neutral-400 hover:text-neutral-200"
                }`}
              >
                <Grid className="w-3.5 h-3.5" />
                <span>Сетка отношений</span>
              </button>
            </div>

            <button
              onClick={onClose}
              className="p-1.5 rounded-lg bg-neutral-900 hover:bg-neutral-800 text-neutral-400 hover:text-neutral-200 border border-neutral-800 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Modal Content */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Visual: Graph or Matrix (2 cols on large screen) */}
          <div className="lg:col-span-2 flex flex-col justify-center items-center bg-neutral-900/40 border border-neutral-800/80 rounded-2xl p-4 relative min-h-[380px] overflow-hidden">
            {activeTab === "graph" ? (
              <div className="w-full flex flex-col items-center justify-center">
                <svg
                  viewBox={`0 0 ${width} ${height}`}
                  className="w-full max-w-lg h-auto select-none"
                >
                  <defs>
                    <radialGradient id="protagonistGlow" cx="50%" cy="50%" r="50%">
                      <stop offset="0%" stopColor="#9333ea" stopOpacity="0.4" />
                      <stop offset="100%" stopColor="#9333ea" stopOpacity="0" />
                    </radialGradient>
                    <filter id="glowEffect" x="-20%" y="-20%" width="140%" height="140%">
                      <feGaussianBlur stdDeviation="3" result="blur" />
                      <feComposite in="SourceGraphic" in2="blur" operator="over" />
                    </filter>
                  </defs>

                  {/* Inter-companion connection lines */}
                  {characters.map((c1, i) => {
                    const angle1 = (i / characters.length) * 2 * Math.PI - Math.PI / 2;
                    const x1 = centerX + radius * Math.cos(angle1);
                    const y1 = centerY + radius * Math.sin(angle1);

                    return characters.slice(i + 1).map((c2, j) => {
                      const actualJ = i + 1 + j;
                      const angle2 = (actualJ / characters.length) * 2 * Math.PI - Math.PI / 2;
                      const x2 = centerX + radius * Math.cos(angle2);
                      const y2 = centerY + radius * Math.sin(angle2);

                      return (
                        <g key={`inter-${c1.id}-${c2.id}`}>
                          <line
                            x1={x1}
                            y1={y1}
                            x2={x2}
                            y2={y2}
                            stroke="#52525b"
                            strokeWidth="1.5"
                            strokeDasharray="4,4"
                            opacity="0.4"
                          />
                        </g>
                      );
                    });
                  })}

                  {/* Protagonist to Companion Lines */}
                  {characters.map((char, index) => {
                    const angle = (index / characters.length) * 2 * Math.PI - Math.PI / 2;
                    const charX = centerX + radius * Math.cos(angle);
                    const charY = centerY + radius * Math.sin(angle);
                    const aff = getAffinityDetails(char.affinity || 50);
                    const isSelected = selectedChar?.id === char.id;

                    return (
                      <g key={`line-${char.id}`}>
                        <line
                          x1={centerX}
                          y1={centerY}
                          x2={charX}
                          y2={charY}
                          stroke={aff.stroke}
                          strokeWidth={isSelected ? "3" : "2"}
                          strokeOpacity={isSelected ? "1" : "0.7"}
                          filter={isSelected ? "url(#glowEffect)" : undefined}
                        />
                        {/* Midpoint Affinity Badge */}
                        <circle
                          cx={(centerX + charX) / 2}
                          cy={(centerY + charY) / 2}
                          r="12"
                          fill="#18181b"
                          stroke={aff.stroke}
                          strokeWidth="1.5"
                        />
                        <text
                          x={(centerX + charX) / 2}
                          y={(centerY + charY) / 2 + 4}
                          textAnchor="middle"
                          fill="#ffffff"
                          fontSize="9"
                          fontWeight="bold"
                          fontFamily="monospace"
                        >
                          {char.affinity || 50}%
                        </text>
                      </g>
                    );
                  })}

                  {/* Protagonist Center Node */}
                  <g>
                    <circle
                      cx={centerX}
                      cy={centerY}
                      r="42"
                      fill="url(#protagonistGlow)"
                    />
                    <circle
                      cx={centerX}
                      cy={centerY}
                      r="28"
                      fill="#1e1b4b"
                      stroke="#818cf8"
                      strokeWidth="2.5"
                    />
                    <text
                      x={centerX}
                      y={centerY - 2}
                      textAnchor="middle"
                      fill="#e0e7ff"
                      fontSize="10"
                      fontWeight="bold"
                    >
                      ВЫ
                    </text>
                    <text
                      x={centerX}
                      y={centerY + 10}
                      textAnchor="middle"
                      fill="#a5b4fc"
                      fontSize="8"
                    >
                      Герой
                    </text>
                  </g>

                  {/* Companion Nodes */}
                  {characters.map((char, index) => {
                    const angle = (index / characters.length) * 2 * Math.PI - Math.PI / 2;
                    const charX = centerX + radius * Math.cos(angle);
                    const charY = centerY + radius * Math.sin(angle);
                    const aff = getAffinityDetails(char.affinity || 50);
                    const isSelected = selectedChar?.id === char.id;

                    return (
                      <g
                        key={`node-${char.id}`}
                        onClick={() => {
                          sound.playClick();
                          setSelectedChar(char);
                          setCharacterThought(null);
                        }}
                        className="cursor-pointer transition-transform hover:scale-105"
                      >
                        {/* Outer Glow Ring if selected */}
                        {isSelected && (
                          <circle
                            cx={charX}
                            cy={charY}
                            r="32"
                            fill="none"
                            stroke={aff.stroke}
                            strokeWidth="2"
                            strokeDasharray="3,3"
                            className="animate-spin-slow"
                          />
                        )}

                        {/* Node border with affinity color */}
                        <circle
                          cx={charX}
                          cy={charY}
                          r="25"
                          fill="#09090b"
                          stroke={aff.stroke}
                          strokeWidth={isSelected ? "3" : "2"}
                        />

                        {/* Avatar clipping */}
                        <clipPath id={`clip-${char.id}`}>
                          <circle cx={charX} cy={charY} r="22" />
                        </clipPath>
                        <image
                          href={char.avatar}
                          x={charX - 22}
                          y={charY - 22}
                          width="44"
                          height="44"
                          clipPath={`url(#clip-${char.id})`}
                          preserveAspectRatio="xMidYMid slice"
                        />

                        {/* Character Name Label */}
                        <rect
                          x={charX - 45}
                          y={charY + 28}
                          width="90"
                          height="18"
                          rx="9"
                          fill="#09090b"
                          stroke="#27272a"
                          strokeWidth="1"
                        />
                        <text
                          x={charX}
                          y={charY + 40}
                          textAnchor="middle"
                          fill="#f4f4f5"
                          fontSize="9"
                          fontWeight="600"
                        >
                          {char.name}
                        </text>
                      </g>
                    );
                  })}
                </svg>

                {/* Legend */}
                <div className="flex flex-wrap items-center justify-center gap-4 pt-2 border-t border-neutral-800/80 w-full text-[11px] text-neutral-400">
                  <span className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                    80-100% Преданность
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-cyan-500" />
                    60-79% Союзник
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-amber-500" />
                    40-59% Нейтралитет
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-rose-500" />
                    &lt;40% Вражда
                  </span>
                </div>
              </div>
            ) : (
              /* Relationship Matrix Table */
              <div className="w-full overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-neutral-800 text-neutral-400">
                      <th className="p-2 font-medium">Персонажи</th>
                      <th className="p-2 font-medium">К Герою (Вам)</th>
                      {characters.map((c) => (
                        <th key={c.id} className="p-2 font-medium truncate max-w-[100px]">
                          К {c.name}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {characters.map((c1) => {
                      const aff = getAffinityDetails(c1.affinity || 50);
                      return (
                        <tr
                          key={c1.id}
                          className="border-b border-neutral-800/60 hover:bg-neutral-800/30 transition-colors"
                        >
                          <td className="p-2.5 flex items-center gap-2">
                            <img
                              src={c1.avatar}
                              alt={c1.name}
                              className="w-6 h-6 rounded-full object-cover border border-neutral-700"
                            />
                            <span className="font-semibold text-neutral-200">{c1.name}</span>
                          </td>
                          <td className="p-2.5">
                            <span
                              className={`px-2 py-0.5 rounded-md text-[11px] font-medium border ${aff.badge}`}
                            >
                              {c1.affinity || 50}% • {aff.label.split("/")[0]}
                            </span>
                          </td>
                          {characters.map((c2) => {
                            if (c1.id === c2.id) {
                              return (
                                <td key={c2.id} className="p-2.5 text-neutral-600 font-mono">
                                  —
                                </td>
                              );
                            }
                            const inter = getInterpersonalRelationship(c1, c2);
                            return (
                              <td key={c2.id} className="p-2.5">
                                <span
                                  className={`text-[11px] font-medium ${inter.color} flex items-center gap-1`}
                                >
                                  <span>{inter.label}</span>
                                </span>
                              </td>
                            );
                          })}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Right Column: Detailed Selected Character Dossier */}
          <div className="bg-neutral-900/60 border border-neutral-800/80 rounded-2xl p-5 flex flex-col justify-between space-y-4">
            {selectedChar ? (
              <>
                <div className="space-y-4">
                  {/* Portrait & Title */}
                  <div className="flex items-center gap-3 pb-3 border-b border-neutral-800">
                    <img
                      src={selectedChar.avatar}
                      alt={selectedChar.name}
                      className="w-14 h-14 rounded-2xl object-cover border-2 border-purple-500/70 shadow-lg"
                    />
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-cinzel text-base font-bold text-neutral-100">
                          {selectedChar.name}
                        </h3>
                        {selectedChar.isLockedTraits ? (
                          <span title="Черты характера зафиксированы">
                            <Lock className="w-3.5 h-3.5 text-amber-400" />
                          </span>
                        ) : (
                          <span title="Характер динамически эволюционирует">
                            <Unlock className="w-3.5 h-3.5 text-emerald-400" />
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-purple-300">{selectedChar.role}</p>
                      {selectedChar.temperament && (
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-neutral-950 border border-neutral-800 text-neutral-400 capitalize">
                          Темперамент: {selectedChar.temperament}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Affinity Meter */}
                  <div>
                    <div className="flex items-center justify-between text-xs mb-1.5">
                      <span className="text-neutral-400 flex items-center gap-1">
                        <Heart className="w-3.5 h-3.5 text-pink-400 fill-pink-400" />
                        Симпатия к вам:
                      </span>
                      <span className="font-bold font-mono text-neutral-200">
                        {selectedChar.affinity || 50}%
                      </span>
                    </div>
                    <div className="w-full h-2.5 rounded-full bg-neutral-950 border border-neutral-800 overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-purple-600 via-pink-500 to-emerald-400 transition-all duration-500"
                        style={{ width: `${selectedChar.affinity || 50}%` }}
                      />
                    </div>
                    <div className="mt-1 text-[11px] font-medium text-emerald-300">
                      Статус: {getAffinityDetails(selectedChar.affinity || 50).label}
                    </div>
                  </div>

                  {/* Character Traits */}
                  <div>
                    <span className="text-xs text-neutral-400 font-semibold block mb-1.5">
                      Черты характера:
                    </span>
                    <div className="flex flex-wrap gap-1.5">
                      {(selectedChar.traits || ["Внимательный", "Преданный"]).map((t, idx) => (
                        <span
                          key={idx}
                          className="px-2 py-0.5 rounded-lg bg-purple-950/60 border border-purple-800/50 text-purple-200 text-xs"
                        >
                          {t}
                        </span>
                      ))}
                    </div>
                  </div>

                  {/* Habits */}
                  {selectedChar.habits && selectedChar.habits.length > 0 && (
                    <div>
                      <span className="text-xs text-neutral-400 font-semibold block mb-1">
                        Привычки спутника:
                      </span>
                      <ul className="text-xs text-neutral-300 space-y-1">
                        {selectedChar.habits.map((h, i) => (
                          <li key={i} className="flex items-center gap-1.5 text-neutral-300">
                            <span className="w-1.5 h-1.5 rounded-full bg-amber-400 shrink-0" />
                            <span>{h}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Speech style */}
                  {selectedChar.speechStyle && (
                    <div className="p-2.5 rounded-xl bg-neutral-950/80 border border-neutral-800 text-xs text-neutral-300">
                      <span className="text-[10px] uppercase text-neutral-500 font-bold block mb-0.5">
                        Манера речи
                      </span>
                      <p className="italic">{selectedChar.speechStyle}</p>
                    </div>
                  )}

                  {/* AI Mind Reading quote box */}
                  {characterThought && (
                    <div className="p-3 rounded-xl bg-purple-950/40 border border-purple-700/60 text-xs text-purple-200 animate-fade-in">
                      <div className="flex items-center gap-1.5 text-purple-400 font-semibold text-[11px] mb-1">
                        <MessageCircle className="w-3 h-3" />
                        Мысли о вас прямо сейчас:
                      </div>
                      <p className="italic font-story leading-relaxed">{characterThought}</p>
                    </div>
                  )}
                </div>

                {/* Action button to ask character thoughts */}
                <button
                  onClick={() => handleAskThoughts(selectedChar)}
                  disabled={isLoadingThought}
                  className="w-full py-2.5 px-3 rounded-xl bg-purple-900/60 hover:bg-purple-800/80 border border-purple-700/60 text-purple-200 text-xs font-semibold flex items-center justify-center gap-2 transition-all disabled:opacity-50"
                >
                  <Sparkles className={`w-3.5 h-3.5 ${isLoadingThought ? "animate-spin" : ""}`} />
                  <span>
                    {isLoadingThought ? "Считывание мыслей ИИ..." : "Узнать мысли персонажа о вас"}
                  </span>
                </button>
              </>
            ) : (
              <div className="text-center py-12 text-neutral-500 text-xs">
                Выберите персонажа на графе для подробного анализа связей
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
