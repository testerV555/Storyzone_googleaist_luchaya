import React, { useState } from "react";
import { StoryBranch, SceneHistoryItem } from "../types";
import { GitBranch, Plus, Play, Check, X, Clock, Trash2 } from "lucide-react";
import { sound } from "../utils/audio";

interface BranchManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
  branches: StoryBranch[];
  activeBranchId: string;
  currentStep: number;
  onForkBranch: (branchName: string, description: string) => void;
  onSwitchBranch: (branchId: string) => void;
}

export const BranchManagerModal: React.FC<BranchManagerModalProps> = ({
  isOpen,
  onClose,
  branches,
  activeBranchId,
  currentStep,
  onForkBranch,
  onSwitchBranch,
}) => {
  const [newBranchName, setNewBranchName] = useState("");
  const [newBranchDesc, setNewBranchDesc] = useState("");
  const [isCreating, setIsCreating] = useState(false);

  if (!isOpen) return null;

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newBranchName.trim()) return;

    onForkBranch(
      newBranchName.trim(),
      newBranchDesc.trim() || `Ответвление от шага #${currentStep}`
    );
    setNewBranchName("");
    setNewBranchDesc("");
    setIsCreating(false);
    sound.playAction("magic");
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/75 backdrop-blur-md animate-fade-in">
      <div className="relative w-full max-w-xl flex flex-col rounded-2xl bg-neutral-900 border border-neutral-800 shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-4 sm:p-5 border-b border-neutral-800 bg-neutral-950/60">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-emerald-950/60 border border-emerald-500/40 text-emerald-400">
              <GitBranch className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-cinzel text-base sm:text-lg font-bold text-neutral-100 flex items-center gap-2">
                Альтернативные Ветки Сюжета (What If?)
              </h3>
              <p className="text-xs text-neutral-400">
                Создавайте развилки в сюжете и переключайтесь между разными линиями судьбы
              </p>
            </div>
          </div>
          <button
            onClick={() => {
              sound.playClick();
              onClose();
            }}
            className="p-1.5 rounded-xl text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 sm:p-5 space-y-4 max-h-[70vh] overflow-y-auto">
          {/* Active Branch and List */}
          <div className="space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-neutral-300">
                Существующие временные линии ({branches.length + 1})
              </span>
              {!isCreating && (
                <button
                  type="button"
                  onClick={() => setIsCreating(true)}
                  className="px-2.5 py-1 rounded-lg bg-emerald-950/60 border border-emerald-700/60 text-emerald-300 hover:bg-emerald-900/60 text-xs font-semibold flex items-center gap-1 transition-colors"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Создать ветку от текущего шага
                </button>
              )}
            </div>

            {/* Main timeline */}
            <div
              className={`p-3.5 rounded-xl border flex items-center justify-between transition-all ${
                activeBranchId === "main"
                  ? "bg-purple-950/40 border-purple-500 shadow-md"
                  : "bg-neutral-950/60 border-neutral-800 hover:border-neutral-700"
              }`}
            >
              <div className="space-y-0.5">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-neutral-100">
                    Основная линия (Канон)
                  </span>
                  {activeBranchId === "main" && (
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-300 font-semibold">
                      Текущая
                    </span>
                  )}
                </div>
                <p className="text-[11px] text-neutral-400">
                  Первоначальный путь ваших решений
                </p>
              </div>

              {activeBranchId !== "main" && (
                <button
                  onClick={() => {
                    sound.playClick();
                    onSwitchBranch("main");
                    onClose();
                  }}
                  className="px-3 py-1.5 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-200 text-xs font-semibold flex items-center gap-1 transition-colors"
                >
                  <Play className="w-3 h-3" />
                  Переключить
                </button>
              )}
            </div>

            {/* Branches list */}
            {branches.map((b) => {
              const isActive = activeBranchId === b.id;

              return (
                <div
                  key={b.id}
                  className={`p-3.5 rounded-xl border flex items-center justify-between transition-all ${
                    isActive
                      ? "bg-emerald-950/40 border-emerald-500 shadow-md"
                      : "bg-neutral-950/60 border-neutral-800 hover:border-neutral-700"
                  }`}
                >
                  <div className="space-y-0.5 pr-2">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-neutral-100">
                        {b.name}
                      </span>
                      {isActive && (
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 font-semibold">
                          Активная
                        </span>
                      )}
                      <span className="text-[10px] text-neutral-500 font-mono">
                        (с шага #{b.forkedAtStep})
                      </span>
                    </div>
                    <p className="text-[11px] text-neutral-400">
                      {b.description}
                    </p>
                  </div>

                  {!isActive && (
                    <button
                      onClick={() => {
                        sound.playClick();
                        onSwitchBranch(b.id);
                        onClose();
                      }}
                      className="px-3 py-1.5 rounded-lg bg-emerald-950/80 border border-emerald-700/60 hover:bg-emerald-900/60 text-emerald-300 text-xs font-semibold flex items-center gap-1 transition-colors"
                    >
                      <Play className="w-3 h-3" />
                      Перейти
                    </button>
                  )}
                </div>
              );
            })}
          </div>

          {/* New branch form */}
          {isCreating && (
            <form
              onSubmit={handleCreate}
              className="p-4 rounded-xl bg-neutral-950 border border-emerald-800/60 space-y-3 animate-fade-in"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-emerald-400 flex items-center gap-1.5">
                  <GitBranch className="w-4 h-4" />
                  Новая ветвь от текущей точки (Шаг #{currentStep})
                </span>
                <button
                  type="button"
                  onClick={() => setIsCreating(false)}
                  className="text-neutral-500 hover:text-neutral-300 text-xs"
                >
                  Отмена
                </button>
              </div>

              <div className="space-y-1">
                <label className="text-[11px] text-neutral-400">Название ветви:</label>
                <input
                  type="text"
                  value={newBranchName}
                  onChange={(e) => setNewBranchName(e.target.value)}
                  placeholder="Например: 'Что если не доверять магу' или 'Тёмный путь'"
                  className="w-full px-3 py-2 rounded-lg bg-neutral-900 border border-neutral-800 text-xs text-neutral-200 focus:outline-none focus:border-emerald-500"
                  required
                />
              </div>

              <div className="space-y-1">
                <label className="text-[11px] text-neutral-400">Краткое описание гипотезы:</label>
                <input
                  type="text"
                  value={newBranchDesc}
                  onChange={(e) => setNewBranchDesc(e.target.value)}
                  placeholder="Например: 'Попытка решить вопрос силой вместо переговоров'"
                  className="w-full px-3 py-2 rounded-lg bg-neutral-900 border border-neutral-800 text-xs text-neutral-200 focus:outline-none focus:border-emerald-500"
                />
              </div>

              <button
                type="submit"
                className="w-full py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold flex items-center justify-center gap-1.5 shadow-md"
              >
                <Plus className="w-4 h-4" />
                Зафиксировать ветку и продолжить отсюда
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
