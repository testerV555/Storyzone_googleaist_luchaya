import React, { useState } from "react";
import {
  Bookmark,
  Plus,
  Trash2,
  X,
  ShieldCheck,
  Sparkles,
  Info,
  Check,
  Search,
  Filter,
} from "lucide-react";
import { CoAuthorAgreement } from "../types";
import { sound } from "../utils/audio";

interface AgreementsLogModalProps {
  isOpen: boolean;
  onClose: () => void;
  agreements: CoAuthorAgreement[];
  onAddAgreement: (agreement: CoAuthorAgreement) => void;
  onRemoveAgreement: (id: string) => void;
}

export const AgreementsLogModal: React.FC<AgreementsLogModalProps> = ({
  isOpen,
  onClose,
  agreements = [],
  onAddAgreement,
  onRemoveAgreement,
}) => {
  const [newTitle, setNewTitle] = useState("");
  const [newContent, setNewContent] = useState("");
  const [newCategory, setNewCategory] = useState<
    "plot_rule" | "character_trait" | "world_fact" | "style_note"
  >("plot_rule");
  const [selectedFilter, setSelectedFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");

  if (!isOpen) return null;

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim() || !newContent.trim()) return;

    sound.playChoice();
    const item: CoAuthorAgreement = {
      id: `agree_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      title: newTitle.trim(),
      content: newContent.trim(),
      category: newCategory,
      timestamp: Date.now(),
    };

    onAddAgreement(item);
    setNewTitle("");
    setNewContent("");
  };

  const filteredAgreements = agreements.filter((item) => {
    const matchesFilter =
      selectedFilter === "all" || item.category === selectedFilter;
    const matchesQuery =
      !searchQuery.trim() ||
      item.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.content.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesFilter && matchesQuery;
  });

  const getCategoryBadge = (cat?: string) => {
    switch (cat) {
      case "character_trait":
        return {
          label: "Персонаж",
          classes: "bg-rose-950/80 text-rose-300 border-rose-800/60",
        };
      case "world_fact":
        return {
          label: "Факт мира",
          classes: "bg-cyan-950/80 text-cyan-300 border-cyan-800/60",
        };
      case "style_note":
        return {
          label: "Стиль",
          classes: "bg-purple-950/80 text-purple-300 border-purple-800/60",
        };
      default:
        return {
          label: "Сюжетное правило",
          classes: "bg-amber-950/80 text-amber-300 border-amber-800/60",
        };
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-md animate-fade-in">
      <div
        className="w-full max-w-2xl bg-neutral-900 border border-amber-900/60 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] animate-scale-up"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-neutral-800 bg-neutral-950/80 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-amber-500/10 border border-amber-500/40 text-amber-400">
              <Bookmark className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-cinzel text-sm sm:text-base font-bold text-amber-300">
                  Согласованные детали (Agreements Log)
                </h3>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-950 border border-amber-700/60 text-amber-300 font-mono">
                  {agreements.length} в каноне
                </span>
              </div>
              <p className="text-[11px] text-neutral-400">
                Непреложные факты сюжета, которые ИИ обязан помнить и строго соблюдать навсегда
              </p>
            </div>
          </div>

          <button
            onClick={() => {
              sound.playClick();
              onClose();
            }}
            className="p-1.5 rounded-lg text-neutral-400 hover:text-white hover:bg-neutral-800 transition-colors"
            title="Закрыть"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Informational Canon Guarantee Banner */}
        <div className="px-4 py-2.5 bg-amber-950/30 border-b border-amber-900/30 flex items-start gap-2.5 text-[11px] text-amber-200/90 leading-relaxed">
          <ShieldCheck className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
          <span>
            <strong>Закон канона:</strong> ИИ получает эти факты в системном промпте при каждом вызове API. Он не вправе отменять, искажать или забывать их. <em>Единственное исключение:</em> если в тексте главы не произойдет прямого сюжетного действия игрока, меняющего этот факт.
          </span>
        </div>

        {/* Content Area */}
        <div className="p-4 sm:p-5 overflow-y-auto space-y-4 flex-1">
          {/* Quick Add Form */}
          <form
            onSubmit={handleCreate}
            className="p-4 rounded-xl bg-neutral-950/80 border border-neutral-800 space-y-3 shadow-inner"
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-neutral-200 flex items-center gap-1.5">
                <Plus className="w-3.5 h-3.5 text-amber-400" />
                Зафиксировать новый факт сюжета:
              </span>
              <span className="text-[10px] text-neutral-500 font-mono">
                Внедряется во все промпты
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <input
                type="text"
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                placeholder="Заголовок (напр. «Клятва Кая»)"
                className="sm:col-span-2 bg-neutral-900 border border-neutral-700/80 rounded-lg px-3 py-2 text-xs text-neutral-100 placeholder-neutral-500 focus:outline-none focus:border-amber-500"
              />

              <select
                value={newCategory}
                onChange={(e) => setNewCategory(e.target.value as any)}
                className="bg-neutral-900 border border-neutral-700/80 rounded-lg px-2.5 py-2 text-xs text-neutral-200 focus:outline-none focus:border-amber-500"
              >
                <option value="plot_rule">Сюжетное правило</option>
                <option value="character_trait">Черта персонажа</option>
                <option value="world_fact">Факт мира</option>
                <option value="style_note">Стиль повести</option>
              </select>
            </div>

            <textarea
              rows={2}
              value={newContent}
              onChange={(e) => setNewContent(e.target.value)}
              placeholder="Подробное описание детали, которое ИИ обязан помнить и строго соблюдать..."
              className="w-full bg-neutral-900 border border-neutral-700/80 rounded-lg p-2.5 text-xs text-neutral-100 placeholder-neutral-500 focus:outline-none focus:border-amber-500 resize-none"
            />

            <div className="flex items-center justify-between pt-1">
              <span className="text-[10px] text-neutral-400">
                Заполните заголовок и суть факта
              </span>

              <button
                type="submit"
                disabled={!newTitle.trim() || !newContent.trim()}
                className="px-3.5 py-1.5 rounded-lg bg-gradient-to-r from-amber-600 to-amber-500 hover:from-amber-500 hover:to-amber-400 disabled:opacity-40 disabled:cursor-not-allowed text-white text-xs font-bold transition-all flex items-center gap-1.5 shadow-md shadow-amber-950/40"
              >
                <Check className="w-3.5 h-3.5" />
                <span>Внести в канон навсегда</span>
              </button>
            </div>
          </form>

          {/* Filter & Search Bar */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-2 pt-1">
            <div className="relative w-full sm:w-60">
              <Search className="w-3.5 h-3.5 text-neutral-500 absolute left-2.5 top-2.5" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Поиск по деталям..."
                className="w-full bg-neutral-950 border border-neutral-800 rounded-lg pl-8 pr-3 py-1.5 text-xs text-neutral-200 placeholder-neutral-500 focus:outline-none focus:border-amber-500"
              />
            </div>

            <div className="flex items-center gap-1 w-full sm:w-auto overflow-x-auto pb-1 sm:pb-0">
              {[
                { id: "all", label: "Все" },
                { id: "plot_rule", label: "Сюжет" },
                { id: "character_trait", label: "Персонаж" },
                { id: "world_fact", label: "Мир" },
                { id: "style_note", label: "Стиль" },
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => {
                    sound.playClick();
                    setSelectedFilter(tab.id);
                  }}
                  className={`px-2 py-1 rounded-lg text-[11px] font-semibold whitespace-nowrap transition-colors ${
                    selectedFilter === tab.id
                      ? "bg-amber-600 text-white"
                      : "bg-neutral-950 text-neutral-400 hover:text-white border border-neutral-800"
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          {/* List of Logged Agreements */}
          <div className="space-y-2.5 min-h-[160px]">
            {filteredAgreements.length === 0 ? (
              <div className="text-center py-10 px-4 rounded-xl bg-neutral-950/50 border border-neutral-800/80 text-neutral-400 space-y-2">
                <Bookmark className="w-8 h-8 mx-auto text-neutral-600 opacity-60" />
                <h4 className="text-xs font-semibold text-neutral-300">
                  {agreements.length === 0
                    ? "Согласованных деталей пока нет"
                    : "По выбранному фильтру ничего не найдено"}
                </h4>
                <p className="text-[11px] text-neutral-500 max-w-sm mx-auto">
                  {agreements.length === 0
                    ? "Введите ключевой факт сюжета выше, и ИИ будет строго опираться на него во всех главах и диалогах."
                    : "Попробуйте изменить запрос поиска или сбросить категорию."}
                </p>
              </div>
            ) : (
              filteredAgreements.map((ag) => {
                const badge = getCategoryBadge(ag.category);
                return (
                  <div
                    key={ag.id}
                    className="p-3.5 rounded-xl bg-neutral-950/90 border border-neutral-800 hover:border-amber-900/60 space-y-2 transition-all shadow-sm group"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <span
                          className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded-md border ${badge.classes} shrink-0`}
                        >
                          {badge.label}
                        </span>
                        <h4 className="font-bold text-xs text-neutral-100 truncate">
                          {ag.title}
                        </h4>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <span className="text-[10px] text-neutral-500 font-mono hidden sm:inline">
                          {new Date(ag.timestamp).toLocaleDateString()}
                        </span>
                        <button
                          type="button"
                          onClick={() => {
                            sound.playClick();
                            onRemoveAgreement(ag.id);
                          }}
                          className="text-neutral-500 hover:text-rose-400 p-1 rounded-lg hover:bg-neutral-900 transition-colors"
                          title="Удалить из канона"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    <p className="text-xs text-neutral-200 leading-relaxed pl-2 border-l-2 border-amber-600/60 whitespace-pre-wrap">
                      {ag.content}
                    </p>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="p-3.5 sm:p-4 border-t border-neutral-800 bg-neutral-950/80 flex items-center justify-between gap-2">
          <div className="text-[11px] text-neutral-500 flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-amber-400" />
            <span>Синхронизируется с облаком и сохранениями игры</span>
          </div>

          <button
            onClick={() => {
              sound.playClick();
              onClose();
            }}
            className="px-4 py-2 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-xs font-semibold text-neutral-200 transition-colors"
          >
            Закрыть
          </button>
        </div>
      </div>
    </div>
  );
};
