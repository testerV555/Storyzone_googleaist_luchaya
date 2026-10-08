import React from "react";
import {
  ActiveGameState,
  ReaderTheme,
  NarrativeStyle,
  GenerationLength,
  Character,
  UniverseSetting,
  LorebookEntry,
} from "../types";
import { StoryAiChatView } from "./StoryAiChatView";
import { X, Bot } from "lucide-react";
import { sound } from "../utils/audio";

interface StoryAiChatDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  gameState: ActiveGameState;
  readerTheme: ReaderTheme;
  customApiKey?: string;
  aiSystemPrompt?: string;
  aiPromptDirective?: string;
  universeSetting?: UniverseSetting;
  onExecuteAction: (actionLabel: string) => void;
  onUpdateNarrativeStyle: (style: NarrativeStyle) => void;
  onUpdateGenerationLength: (length: GenerationLength) => void;
  onUpdateGenre: (genre: string) => void;
  onAddCharacter: (character: Character) => void;
  onUpdateCharacter: (character: Character) => void;
  onInjectSceneText: (newText: string) => void;
  onUpdatePromptDirective: (directive: string) => void;
  onUpdateUniverseSetting?: (newSetting: UniverseSetting) => void;
  onAddLorebookEntry?: (entry: LorebookEntry) => void;
  onOpenUniverseModal?: () => void;
}

export const StoryAiChatDrawer: React.FC<StoryAiChatDrawerProps> = ({
  isOpen,
  onClose,
  gameState,
  readerTheme,
  customApiKey,
  aiSystemPrompt,
  aiPromptDirective,
  universeSetting,
  onExecuteAction,
  onUpdateNarrativeStyle,
  onUpdateGenerationLength,
  onUpdateGenre,
  onAddCharacter,
  onUpdateCharacter,
  onInjectSceneText,
  onUpdatePromptDirective,
  onUpdateUniverseSetting,
  onAddLorebookEntry,
  onOpenUniverseModal,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/70 backdrop-blur-sm animate-fade-in">
      <div className="relative w-full max-w-2xl h-full bg-neutral-900 border-l border-neutral-800 shadow-2xl flex flex-col overflow-hidden animate-slide-left">
        <div className="p-3 sm:p-4 border-b border-neutral-800 bg-neutral-950/80 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-purple-950 border border-purple-800/80 text-purple-300">
              <Bot className="w-4 h-4" />
            </div>
            <span className="font-cinzel text-xs sm:text-sm font-bold text-neutral-100">
              Панель ИИ-Соавтора книги
            </span>
          </div>

          <button
            onClick={() => {
              sound.playClick();
              onClose();
            }}
            className="p-1.5 rounded-lg text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 overflow-hidden p-2 sm:p-4">
          <StoryAiChatView
            gameState={gameState}
            readerTheme={readerTheme}
            customApiKey={customApiKey}
            aiSystemPrompt={aiSystemPrompt}
            aiPromptDirective={aiPromptDirective}
            universeSetting={universeSetting}
            onBackToStory={onClose}
            onExecuteAction={onExecuteAction}
            onUpdateNarrativeStyle={onUpdateNarrativeStyle}
            onUpdateGenerationLength={onUpdateGenerationLength}
            onUpdateGenre={onUpdateGenre}
            onAddCharacter={onAddCharacter}
            onUpdateCharacter={onUpdateCharacter}
            onInjectSceneText={onInjectSceneText}
            onUpdatePromptDirective={onUpdatePromptDirective}
            onUpdateUniverseSetting={onUpdateUniverseSetting}
            onAddLorebookEntry={onAddLorebookEntry}
            onOpenUniverseModal={onOpenUniverseModal}
          />
        </div>
      </div>
    </div>
  );
};
