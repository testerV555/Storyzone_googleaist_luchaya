import React from "react";
import { SaveSlot, ActiveGameState } from "../types";
import {
  Save,
  Play,
  Trash2,
  Download,
  Upload,
  Clock,
  Heart,
  Zap,
  Coins,
  Shield,
} from "lucide-react";
import { sound } from "../utils/audio";

interface SaveLoadModalProps {
  saves: SaveSlot[];
  onLoadSave: (save: SaveSlot) => void;
  onSaveToSlot: (slotId: string) => void;
  onDeleteSave: (slotId: string) => void;
  hasActiveGame: boolean;
  onImportSaves: (jsonString: string) => void;
}

export const SaveLoadModal: React.FC<SaveLoadModalProps> = ({
  saves,
  onLoadSave,
  onSaveToSlot,
  onDeleteSave,
  hasActiveGame,
  onImportSaves,
}) => {
  const handleExport = () => {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(saves, null, 2));
    const downloadAnchor = document.createElement("a");
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute("download", `storyzone_saves_${new Date().toISOString().slice(0, 10)}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      if (content) {
        onImportSaves(content);
      }
    };
    reader.readAsText(file);
  };

  const SLOTS = ["slot_1", "slot_2", "slot_3", "slot_4", "slot_auto"];

  return (
    <div className="w-full max-w-4xl mx-auto px-4 sm:px-6 py-6 sm:py-8 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-neutral-800">
        <div>
          <h2 className="font-cinzel text-xl sm:text-2xl font-bold text-neutral-100 flex items-center gap-2">
            <Save className="w-6 h-6 text-purple-400" />
            Хранилище Сохранений StoryZone
          </h2>
          <p className="text-xs sm:text-sm text-neutral-400">
            Сохраняйте ключевые моменты сюжета, возвращайтесь к развилкам или делитесь прогрессом
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleExport}
            disabled={saves.length === 0}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-neutral-900 hover:bg-neutral-800 border border-neutral-800 text-neutral-300 text-xs font-medium disabled:opacity-50 transition-colors"
            title="Экспортировать сохранения в файл JSON"
          >
            <Download className="w-3.5 h-3.5" />
            Экспорт
          </button>

          <label className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-neutral-900 hover:bg-neutral-800 border border-neutral-800 text-neutral-300 text-xs font-medium cursor-pointer transition-colors">
            <Upload className="w-3.5 h-3.5" />
            Импорт
            <input
              type="file"
              accept=".json"
              onChange={handleFileUpload}
              className="hidden"
            />
          </label>
        </div>
      </div>

      {/* Slots List */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {SLOTS.map((slotId, index) => {
          const save = saves.find((s) => s.id === slotId);
          const isAuto = slotId === "slot_auto";
          const slotTitle = isAuto ? "Автосохранение" : `Слот сохранения #${index + 1}`;

          return (
            <div
              key={slotId}
              className="p-4 rounded-2xl bg-neutral-900/60 border border-neutral-800/80 hover:border-purple-800/50 flex flex-col justify-between space-y-3 transition-all"
            >
              <div className="flex items-center justify-between pb-2 border-b border-neutral-800/70 text-xs">
                <span className="font-bold text-purple-300 flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-purple-400" />
                  {slotTitle}
                </span>

                {save ? (
                  <span className="text-[11px] text-neutral-500 font-mono-code">
                    {new Date(save.timestamp).toLocaleString("ru-RU")}
                  </span>
                ) : (
                  <span className="text-[11px] text-neutral-600 italic">Свободно</span>
                )}
              </div>

              {save ? (
                <div className="space-y-2 flex-1">
                  <div className="flex items-start gap-3">
                    <img
                      src={save.coverImage}
                      alt={save.storyTitle}
                      className="w-16 h-16 rounded-xl object-cover border border-neutral-800 shrink-0"
                    />
                    <div className="space-y-1 min-w-0">
                      <h4 className="font-cinzel text-sm font-bold text-neutral-100 truncate">
                        {save.storyTitle}
                      </h4>
                      <div className="text-[11px] text-purple-400 font-medium">
                        Ход #{save.currentStep} • {save.storyGenre}
                      </div>
                      <div className="flex items-center gap-3 text-[11px] font-mono-code text-neutral-400 pt-0.5">
                        <span className="flex items-center gap-1 text-rose-400">
                          <Heart className="w-3 h-3 fill-rose-500" /> {save.playerStats.hp}
                        </span>
                        <span className="flex items-center gap-1 text-amber-400">
                          <Zap className="w-3 h-3 fill-amber-500" /> {save.playerStats.energy}
                        </span>
                        <span className="flex items-center gap-1 text-yellow-300">
                          <Coins className="w-3 h-3" /> {save.playerStats.gold}
                        </span>
                      </div>
                    </div>
                  </div>

                  <p className="text-xs text-neutral-400 font-story line-clamp-2 italic pt-1">
                    "{save.sceneText}"
                  </p>
                </div>
              ) : (
                <div className="py-6 text-center text-xs text-neutral-500">
                  Пустой слот для сохранения
                </div>
              )}

              {/* Slot Actions */}
              <div className="pt-2 border-t border-neutral-800 flex items-center justify-between gap-2">
                {save && (
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => {
                        sound.playChoice();
                        onLoadSave(save);
                      }}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-semibold shadow-md shadow-purple-900/40"
                    >
                      <Play className="w-3 h-3 fill-current" />
                      Загрузить
                    </button>

                    <button
                      onClick={() => {
                        if (confirm("Удалить это сохранение?")) {
                          sound.playClick();
                          onDeleteSave(save.id);
                        }
                      }}
                      className="p-1.5 rounded-xl bg-neutral-950 hover:bg-neutral-800 text-neutral-500 hover:text-rose-400"
                      title="Удалить слот"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}

                {hasActiveGame && !isAuto && (
                  <button
                    onClick={() => {
                      sound.playChoice();
                      onSaveToSlot(slotId);
                    }}
                    className="ml-auto flex items-center gap-1 px-3 py-1.5 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-200 text-xs font-medium"
                  >
                    <Save className="w-3.5 h-3.5 text-emerald-400" />
                    {save ? "Перезаписать" : "Сохранить сюда"}
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
