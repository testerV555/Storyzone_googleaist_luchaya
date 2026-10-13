import React, { useState, useEffect } from "react";
import {
  X,
  Cloud,
  CloudUpload,
  CloudDownload,
  Smartphone,
  Laptop,
  QrCode,
  Copy,
  Check,
  RefreshCw,
  Clock,
  ShieldCheck,
  Sparkles,
  ExternalLink,
  BookOpen,
  Share2,
} from "lucide-react";
import { ActiveGameState, SaveSlot, StoryChatMessage } from "../types";
import { sound } from "../utils/audio";
import { safeFetchJson } from "../utils/safeApi";

interface CloudSyncModalProps {
  isOpen: boolean;
  onClose: () => void;
  gameState: ActiveGameState | null;
  saves: SaveSlot[];
  onLoadSyncedGameState: (newState: ActiveGameState, saves?: SaveSlot[], chatHistory?: StoryChatMessage[]) => void;
}

export const CloudSyncModal: React.FC<CloudSyncModalProps> = ({
  isOpen,
  onClose,
  gameState,
  saves,
  onLoadSyncedGameState,
}) => {
  const [activeTab, setActiveTab] = useState<"save" | "load" | "qr">("save");
  const [accountEmail, setAccountEmail] = useState(() => {
    return localStorage.getItem("storyzone_cloud_account") || "www.vayvay006@gmail.com";
  });
  const [syncCodeInput, setSyncCodeInput] = useState("");
  const [shortCode, setShortCode] = useState<string | null>(() => {
    return localStorage.getItem("storyzone_cloud_shortcode") || null;
  });
  const [isSyncing, setIsSyncing] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{ text: string; type: "success" | "error" } | null>(null);
  const [copiedCode, setCopiedCode] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [cloudStories, setCloudStories] = useState<any[]>([]);

  useEffect(() => {
    if (isOpen) {
      fetchCloudStories();
    }
  }, [isOpen, accountEmail]);

  if (!isOpen) return null;

  // Retrieve co-author chat messages
  const getFullChatHistory = (): StoryChatMessage[] => {
    if (!gameState) return [];
    if (gameState.chatHistory && gameState.chatHistory.length > 0) {
      return gameState.chatHistory;
    }
    try {
      const saved = localStorage.getItem(`storyzone_chat_${gameState.story.id}`);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch (e) {}
    return [];
  };

  const fetchCloudStories = async () => {
    if (!accountEmail.trim()) return;
    try {
      const res = await safeFetchJson<any>(`/api/cloud-sync/list?accountKey=${encodeURIComponent(accountEmail.trim())}`);
      if (res.ok && res.data) {
        if (Array.isArray(res.data.stories)) {
          setCloudStories(res.data.stories);
        }
        if (res.data.shortCode) {
          setShortCode(res.data.shortCode);
        }
      }
    } catch (e) {
      console.warn("Failed to fetch cloud stories:", e);
    }
  };

  // 1. Upload & Sync to Cloud
  const handleUploadToCloud = async () => {
    if (!gameState) {
      setStatusMessage({ text: "Нет активной истории для сохранения.", type: "error" });
      return;
    }
    const emailToUse = accountEmail.trim() || "www.vayvay006@gmail.com";
    setIsSyncing(true);
    setStatusMessage(null);
    sound.playClick();

    try {
      localStorage.setItem("storyzone_cloud_account", emailToUse);
      const chatMessages = getFullChatHistory();

      const res = await safeFetchJson<any>("/api/cloud-sync/save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          accountKey: emailToUse,
          storyId: gameState.story.id,
          storyTitle: gameState.story.title,
          storyGenre: gameState.story.genre,
          gameState: {
            ...gameState,
            chatHistory: chatMessages,
          },
          saves,
          chatHistory: chatMessages,
          deviceType: navigator.userAgent.includes("Mobi") ? "Mobile Phone" : "Desktop Computer",
        }),
      });

      if (res.ok && res.data) {
        sound.playFanfare();
        setShortCode(res.data.shortCode);
        localStorage.setItem("storyzone_cloud_shortcode", res.data.shortCode);
        setStatusMessage({
          text: `Успешно сохранено в облаке! Код синхронизации для телефона: ${res.data.shortCode}`,
          type: "success",
        });
        fetchCloudStories();
      } else {
        throw new Error(res.data?.error || "Ошибка сохранения");
      }
    } catch (err: any) {
      sound.playAction("click");
      setStatusMessage({
        text: err.message || "Не удалось сохранить в облако. Проверьте сеть.",
        type: "error",
      });
    } finally {
      setIsSyncing(false);
    }
  };

  // 2. Download from Cloud into active session
  const handleDownloadFromCloud = async (codeOrKey?: string, storyId?: string) => {
    const key = (codeOrKey || syncCodeInput || accountEmail).trim();
    if (!key) {
      setStatusMessage({ text: "Введите email или 6-значный код синхронизации.", type: "error" });
      return;
    }

    setIsSyncing(true);
    setStatusMessage(null);
    sound.playClick();

    try {
      const isShortCode = key.toUpperCase().startsWith("SZ-") || key.length <= 8;
      const param = isShortCode ? `shortCode=${encodeURIComponent(key)}` : `accountKey=${encodeURIComponent(key)}`;
      const storyParam = storyId ? `&storyId=${encodeURIComponent(storyId)}` : "";

      const res = await safeFetchJson<any>(`/api/cloud-sync/load?${param}${storyParam}`);

      if (res.ok && res.data?.storyPayload) {
        const payload = res.data.storyPayload;
        sound.playFanfare();

        // Restore chat messages to localStorage
        if (payload.chatHistory && Array.isArray(payload.chatHistory)) {
          try {
            localStorage.setItem(`storyzone_chat_${payload.storyId}`, JSON.stringify(payload.chatHistory));
          } catch (e) {}
        }

        // Apply loaded game state to root app
        onLoadSyncedGameState(payload.gameState, payload.saves, payload.chatHistory);

        setStatusMessage({
          text: `История «${payload.storyTitle}» (глава ${payload.gameState.stepCount}) и все обсуждения соавтора успешно перенесены на это устройство!`,
          type: "success",
        });

        setTimeout(() => {
          onClose();
        }, 1800);
      } else {
        throw new Error(res.data?.message || "Аккаунт или код не найден.");
      }
    } catch (err: any) {
      sound.playAction("click");
      setStatusMessage({
        text: err.message || "Ошибка загрузки из облака. Проверьте код.",
        type: "error",
      });
    } finally {
      setIsSyncing(false);
    }
  };

  const handleCopyCode = () => {
    const code = shortCode || "SZ-7429";
    navigator.clipboard.writeText(code);
    setCopiedCode(true);
    sound.playClick();
    setTimeout(() => setCopiedCode(false), 2000);
  };

  const mobileTransferUrl = typeof window !== "undefined"
    ? `${window.location.origin}?syncCode=${shortCode || "SZ-DEFAULT"}`
    : "";

  const handleCopyLink = () => {
    navigator.clipboard.writeText(mobileTransferUrl);
    setCopiedLink(true);
    sound.playClick();
    setTimeout(() => setCopiedLink(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-md animate-fade-in">
      <div className="relative w-full max-w-2xl bg-neutral-900 border border-neutral-800 rounded-3xl shadow-2xl flex flex-col overflow-hidden max-h-[90vh]">
        {/* Modal Header */}
        <div className="p-4 sm:p-5 border-b border-neutral-800 bg-neutral-950/80 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-gradient-to-br from-purple-600 to-indigo-700 text-white shadow-md shadow-purple-900/40">
              <Cloud className="w-5 h-5" />
            </div>
            <div>
              <h2 className="font-cinzel text-base sm:text-lg font-bold text-neutral-100 flex items-center gap-2">
                Облачная Синхронизация & Перенос
              </h2>
              <p className="text-xs text-neutral-400">
                Сохраняйте историю и продолжайте чтение на телефоне, планшете или другом ПК
              </p>
            </div>
          </div>

          <button
            onClick={() => {
              sound.playClick();
              onClose();
            }}
            className="p-2 rounded-xl text-neutral-400 hover:text-white hover:bg-neutral-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Selector */}
        <div className="p-3 bg-neutral-950/40 border-b border-neutral-800/80 flex items-center justify-center gap-2">
          <button
            onClick={() => setActiveTab("save")}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all ${
              activeTab === "save"
                ? "bg-purple-600 text-white shadow-md"
                : "text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800/60"
            }`}
          >
            <CloudUpload className="w-3.5 h-3.5" />
            <span>Сохранить в облако</span>
          </button>

          <button
            onClick={() => setActiveTab("load")}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all ${
              activeTab === "load"
                ? "bg-purple-600 text-white shadow-md"
                : "text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800/60"
            }`}
          >
            <CloudDownload className="w-3.5 h-3.5" />
            <span>Войти & Загрузить</span>
          </button>

          <button
            onClick={() => setActiveTab("qr")}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all ${
              activeTab === "qr"
                ? "bg-purple-600 text-white shadow-md"
                : "text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800/60"
            }`}
          >
            <Smartphone className="w-3.5 h-3.5" />
            <span>Код & Телефон</span>
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-5 text-neutral-200 text-xs sm:text-sm">
          {/* Status Message Alert */}
          {statusMessage && (
            <div
              className={`p-3 rounded-2xl flex items-center gap-2 text-xs font-medium ${
                statusMessage.type === "success"
                  ? "bg-emerald-950/80 text-emerald-300 border border-emerald-800/70"
                  : "bg-rose-950/80 text-rose-300 border border-rose-800/70"
              }`}
            >
              <Sparkles className="w-4 h-4 shrink-0" />
              <span>{statusMessage.text}</span>
            </div>
          )}

          {activeTab === "save" && (
            <div className="space-y-4">
              <div className="p-4 rounded-2xl bg-neutral-950/60 border border-neutral-800/80 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-neutral-100 flex items-center gap-1.5">
                    <Laptop className="w-4 h-4 text-purple-400" />
                    Текущая история для сохранения:
                  </span>
                  <span className="text-[11px] px-2 py-0.5 rounded-full bg-purple-950 text-purple-300 border border-purple-800">
                    Глава {gameState?.stepCount || 1}
                  </span>
                </div>

                <p className="text-xs text-neutral-300 font-serif line-clamp-2">
                  «{gameState?.story.title || "История"}» — {gameState?.currentScene.slice(0, 160)}...
                </p>

                <div className="flex flex-wrap items-center gap-2 text-[11px] text-neutral-400">
                  <span>Обсуждений соавтора: {getFullChatHistory().length}</span>
                  <span>•</span>
                  <span>Слотов сохранений: {saves.length}</span>
                  <span>•</span>
                  <span>Спутников: {gameState?.characters.length || 0}</span>
                </div>
              </div>

              {/* Account Email Field */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-neutral-300">
                  Аккаунт (Email или логин для синхронизации):
                </label>
                <input
                  type="email"
                  value={accountEmail}
                  onChange={(e) => setAccountEmail(e.target.value)}
                  placeholder="vayvay006@gmail.com"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-neutral-950 border border-neutral-800 focus:border-purple-600 focus:outline-none text-xs sm:text-sm text-neutral-100 placeholder-neutral-500"
                />
                <span className="text-[11px] text-neutral-500">
                  Все ваши главы, статы, спутники и переписка с соавтором привязываются к этому аккаунту.
                </span>
              </div>

              {/* Upload Action Button */}
              <button
                onClick={handleUploadToCloud}
                disabled={isSyncing || !gameState}
                className="w-full py-3 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-bold text-xs sm:text-sm shadow-lg shadow-purple-900/30 flex items-center justify-center gap-2 transition-all disabled:opacity-50"
              >
                {isSyncing ? (
                  <RefreshCw className="w-4 h-4 animate-spin" />
                ) : (
                  <CloudUpload className="w-4 h-4" />
                )}
                <span>Сохранить в облако для телефона и других устройств</span>
              </button>

              {shortCode && (
                <div className="p-3.5 rounded-2xl bg-purple-950/40 border border-purple-800/50 flex items-center justify-between gap-3">
                  <div>
                    <div className="text-[11px] text-purple-300 font-semibold">Ваш короткий код для телефона:</div>
                    <div className="font-mono text-base font-bold text-white tracking-widest">{shortCode}</div>
                  </div>
                  <button
                    onClick={handleCopyCode}
                    className="px-3 py-1.5 rounded-xl bg-purple-900 hover:bg-purple-800 text-purple-200 text-xs font-semibold flex items-center gap-1.5 transition-colors"
                  >
                    {copiedCode ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copiedCode ? "Скопирован!" : "Копировать"}</span>
                  </button>
                </div>
              )}
            </div>
          )}

          {activeTab === "load" && (
            <div className="space-y-4">
              <div className="p-3.5 rounded-2xl bg-neutral-950/60 border border-neutral-800/80 space-y-2">
                <div className="text-xs font-semibold text-neutral-200">
                  Введите код синхронизации (например, <span className="text-purple-400 font-mono">SZ-9284</span>) или ваш Email:
                </div>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={syncCodeInput}
                    onChange={(e) => setSyncCodeInput(e.target.value)}
                    placeholder="SZ-XXXX или email..."
                    className="flex-1 px-3.5 py-2.5 rounded-xl bg-neutral-950 border border-neutral-800 focus:border-purple-600 focus:outline-none text-xs sm:text-sm text-neutral-100 placeholder-neutral-500 font-mono uppercase"
                  />
                  <button
                    onClick={() => handleDownloadFromCloud(syncCodeInput)}
                    disabled={isSyncing || !syncCodeInput.trim()}
                    className="px-4 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs shadow-md transition-all disabled:opacity-50 flex items-center gap-1.5"
                  >
                    {isSyncing ? <RefreshCw className="w-4 h-4 animate-spin" /> : <CloudDownload className="w-4 h-4" />}
                    <span>Перенести</span>
                  </button>
                </div>
              </div>

              {/* Cloud Stories List for Account */}
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs font-semibold text-neutral-300">
                  <span>Истории в вашем облаке ({cloudStories.length}):</span>
                  <button
                    onClick={fetchCloudStories}
                    className="text-[11px] text-purple-400 hover:underline flex items-center gap-1"
                  >
                    <RefreshCw className="w-3 h-3" />
                    Обновить список
                  </button>
                </div>

                {cloudStories.length === 0 ? (
                  <div className="p-4 rounded-xl bg-neutral-950 border border-neutral-800 text-center text-xs text-neutral-500">
                    В облаке этого аккаунта пока нет сохраненных историй. Нажмите «Сохранить в облако» в первой вкладке.
                  </div>
                ) : (
                  <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                    {cloudStories.map((story) => (
                      <div
                        key={story.storyId}
                        className="p-3 rounded-xl bg-neutral-950 hover:bg-neutral-900 border border-neutral-800/80 flex items-center justify-between gap-3 transition-colors"
                      >
                        <div>
                          <div className="font-semibold text-xs text-neutral-100">
                            {story.storyTitle}
                          </div>
                          <div className="text-[11px] text-neutral-400 flex items-center gap-2 mt-0.5">
                            <span>Глава {story.stepCount}</span>
                            <span>•</span>
                            <span>{story.storyGenre}</span>
                            <span>•</span>
                            <span>{new Date(story.syncedAt).toLocaleDateString("ru-RU")}</span>
                          </div>
                        </div>

                        <button
                          onClick={() => handleDownloadFromCloud(accountEmail, story.storyId)}
                          disabled={isSyncing}
                          className="px-3 py-1.5 rounded-lg bg-purple-950 hover:bg-purple-900 text-purple-200 border border-purple-800/80 text-xs font-medium flex items-center gap-1 transition-colors"
                        >
                          <CloudDownload className="w-3.5 h-3.5" />
                          <span>Загрузить</span>
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === "qr" && (
            <div className="space-y-4 text-center">
              <div className="p-6 rounded-2xl bg-neutral-950 border border-neutral-800 flex flex-col items-center justify-center space-y-3">
                <div className="p-3 rounded-2xl bg-white shadow-xl">
                  {/* SVG QR Code Simulation */}
                  <div className="w-36 h-36 flex flex-col items-center justify-center bg-neutral-900 rounded-lg p-2 text-white">
                    <QrCode className="w-24 h-24 text-purple-400" />
                    <span className="font-mono text-[10px] text-neutral-300 mt-1">{shortCode || "SZ-7429"}</span>
                  </div>
                </div>

                <div className="space-y-1">
                  <div className="font-bold text-sm text-neutral-100">
                    Код быстрого ввода на телефоне:
                  </div>
                  <div className="font-mono text-2xl font-black text-purple-400 tracking-wider">
                    {shortCode || "SZ-7429"}
                  </div>
                </div>

                <p className="text-xs text-neutral-400 max-w-sm">
                  Откройте StoryZone на телефоне, нажмите «Синхронизация» → «Войти & Загрузить» и введите этот 6-значный код.
                </p>

                <div className="flex items-center gap-2 pt-2">
                  <button
                    onClick={handleCopyCode}
                    className="px-3.5 py-1.5 rounded-xl bg-neutral-900 hover:bg-neutral-800 border border-neutral-800 text-neutral-200 text-xs font-semibold flex items-center gap-1.5 transition-colors"
                  >
                    {copiedCode ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>Копировать код</span>
                  </button>

                  <button
                    onClick={handleCopyLink}
                    className="px-3.5 py-1.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-semibold flex items-center gap-1.5 transition-colors shadow-md shadow-purple-900/30"
                  >
                    {copiedLink ? <Check className="w-3.5 h-3.5" /> : <Share2 className="w-3.5 h-3.5" />}
                    <span>{copiedLink ? "Ссылка скопирована!" : "Скопировать ссылку для телефона"}</span>
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-3 sm:p-4 border-t border-neutral-800 bg-neutral-950/80 flex items-center justify-between text-xs text-neutral-400">
          <div className="flex items-center gap-1.5">
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            <span>Данные шифруются и сохраняются на облачном сервере StoryZone</span>
          </div>

          <button
            onClick={() => {
              sound.playClick();
              onClose();
            }}
            className="px-4 py-1.5 rounded-xl bg-neutral-900 hover:bg-neutral-800 text-neutral-300 hover:text-white transition-colors"
          >
            Закрыть
          </button>
        </div>
      </div>
    </div>
  );
};
