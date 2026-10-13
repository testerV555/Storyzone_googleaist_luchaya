import React, { useState, useEffect } from "react";
import {
  X,
  User,
  LogIn,
  UserPlus,
  Cloud,
  Check,
  AlertCircle,
  Smartphone,
  Laptop,
  Tablet,
  RefreshCw,
  LogOut,
  ShieldCheck,
  Sparkles,
  Copy,
  Key,
  Database,
  ArrowRight,
  Clock,
  Layers,
  Heart,
} from "lucide-react";
import { UserAccountProfile, AccountDataSnapshot, ActiveGameState, SaveSlot, Story } from "../types";
import { sound } from "../utils/audio";
import { safeFetchJson } from "../utils/safeApi";

interface AccountModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: UserAccountProfile | null;
  onUserLogin: (user: UserAccountProfile, snapshot: AccountDataSnapshot) => void;
  onUserLogout: () => void;
  onForceSync: () => Promise<boolean>;
  currentGameState: ActiveGameState | null;
  currentSaves: SaveSlot[];
  customStories: Story[];
  autoSyncEnabled: boolean;
  onToggleAutoSync: (enabled: boolean) => void;
  isSyncing: boolean;
  lastSyncedAt: number | null;
}

export const AccountModal: React.FC<AccountModalProps> = ({
  isOpen,
  onClose,
  currentUser,
  onUserLogin,
  onUserLogout,
  onForceSync,
  currentGameState,
  currentSaves,
  customStories,
  autoSyncEnabled,
  onToggleAutoSync,
  isSyncing,
  lastSyncedAt,
}) => {
  const [mode, setMode] = useState<"login" | "register" | "profile">(
    currentUser ? "profile" : "register"
  );

  // Form states
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [pinCodeInput, setPinCodeInput] = useState("");
  const [usePinLogin, setUsePinLogin] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [copiedPin, setCopiedPin] = useState(false);

  useEffect(() => {
    if (currentUser) {
      setMode("profile");
    } else {
      setMode("register");
    }
    setErrorMsg(null);
    setSuccessMsg(null);
  }, [currentUser, isOpen]);

  if (!isOpen) return null;

  // Build current snapshot payload for immediate sync
  const buildCurrentSnapshot = (): AccountDataSnapshot => {
    return {
      activeGameState: currentGameState,
      saves: currentSaves,
      customStories: customStories,
      syncedAt: Date.now(),
      stepCount: currentGameState?.stepCount || 1,
      storyTitle: currentGameState?.story?.title || "Повесть",
    };
  };

  // 1. Handle Registration
  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password.trim()) {
      setErrorMsg("Заполните email и пароль.");
      return;
    }
    if (password.length < 4) {
      setErrorMsg("Пароль должен содержать не менее 4 символов.");
      return;
    }

    setIsSubmitting(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      const snapshot = buildCurrentSnapshot();
      const res = await safeFetchJson<any>("/api/account/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: username.trim() || email.split("@")[0],
          email: email.trim().toLowerCase(),
          password: password.trim(),
          initialSnapshot: snapshot,
          deviceName: navigator.userAgent.includes("Mobile") ? "Смартфон" : "Компьютер / ПК",
        }),
      });

      if (!res.ok || !res.data?.success) {
        setErrorMsg(res.data?.error || res.error || "Ошибка регистрации");
        setIsSubmitting(false);
        return;
      }

      sound.playAction("magic");
      setSuccessMsg("Аккаунт успешно создан! Все ваши истории и главы сохранены в облаке.");
      onUserLogin(res.data.user, res.data.snapshot);
      setMode("profile");
    } catch (err: any) {
      setErrorMsg(err?.message || "Ошибка связи с сервером");
    } finally {
      setIsSubmitting(false);
    }
  };

  // 2. Handle Login
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      const bodyPayload = usePinLogin
        ? {
            pinCode: pinCodeInput.trim().toUpperCase(),
            deviceName: navigator.userAgent.includes("Mobile") ? "Смартфон" : "Компьютер / ПК",
          }
        : {
            emailOrPin: email.trim().toLowerCase(),
            password: password.trim(),
            deviceName: navigator.userAgent.includes("Mobile") ? "Смартфон" : "Компьютер / ПК",
          };

      const res = await safeFetchJson<any>("/api/account/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(bodyPayload),
      });

      if (!res.ok || !res.data?.success) {
        setErrorMsg(res.data?.error || res.error || "Ошибка входа в аккаунт");
        setIsSubmitting(false);
        return;
      }

      sound.playAction("magic");
      setSuccessMsg(res.data.message || "Успешный вход! Все данные синхронизированы.");
      onUserLogin(res.data.user, res.data.snapshot);
      setMode("profile");
    } catch (err: any) {
      setErrorMsg(err?.message || "Ошибка связи с сервером");
    } finally {
      setIsSubmitting(false);
    }
  };

  // 3. Handle Manual Sync Trigger
  const handleManualSync = async () => {
    sound.playClick();
    setIsSubmitting(true);
    setErrorMsg(null);
    const ok = await onForceSync();
    setIsSubmitting(false);
    if (ok) {
      sound.playAction("magic");
      setSuccessMsg("Все данные синхронизированы с облаком на всех устройствах!");
      setTimeout(() => setSuccessMsg(null), 3500);
    } else {
      setErrorMsg("Не удалось выполнить синхронизацию. Попробуйте позже.");
    }
  };

  const copyPin = () => {
    if (!currentUser?.pinCode) return;
    navigator.clipboard.writeText(currentUser.pinCode);
    setCopiedPin(true);
    sound.playClick();
    setTimeout(() => setCopiedPin(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-md animate-fade-in">
      <div className="relative w-full max-w-xl rounded-2xl bg-gradient-to-b from-neutral-900 via-neutral-925 to-neutral-950 border border-purple-900/50 shadow-2xl shadow-purple-950/40 flex flex-col max-h-[92vh] overflow-hidden text-neutral-100">
        {/* Header Ribbon */}
        <div className="p-4 sm:p-5 border-b border-purple-900/30 flex items-center justify-between bg-neutral-950/60">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-gradient-to-tr from-purple-600 to-indigo-600 text-white shadow-md shadow-purple-900/40">
              <Cloud className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-cinzel text-base sm:text-lg font-bold text-neutral-100 flex items-center gap-2">
                Учётная запись StoryZone
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-purple-950 text-purple-300 font-mono border border-purple-800">
                  Cloud Sync
                </span>
              </h3>
              <p className="text-xs text-neutral-400">
                Сквозная синхронизация всех историй, глав, соавтора и сохранений (ПК, смартфоны, планшеты)
              </p>
            </div>
          </div>

          <button
            onClick={() => {
              sound.playClick();
              onClose();
            }}
            className="p-1.5 rounded-xl text-neutral-400 hover:text-white hover:bg-neutral-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab switchers if not logged in */}
        {!currentUser && (
          <div className="flex border-b border-neutral-800 bg-neutral-950/40 p-1">
            <button
              onClick={() => {
                sound.playClick();
                setMode("register");
                setErrorMsg(null);
              }}
              className={`flex-1 py-2 rounded-xl text-xs sm:text-sm font-semibold flex items-center justify-center gap-1.5 transition-all ${
                mode === "register"
                  ? "bg-purple-600 text-white shadow-md shadow-purple-950/50"
                  : "text-neutral-400 hover:text-neutral-200"
              }`}
            >
              <UserPlus className="w-4 h-4" />
              <span>Регистрация нового аккаунта</span>
            </button>
            <button
              onClick={() => {
                sound.playClick();
                setMode("login");
                setErrorMsg(null);
              }}
              className={`flex-1 py-2 rounded-xl text-xs sm:text-sm font-semibold flex items-center justify-center gap-1.5 transition-all ${
                mode === "login"
                  ? "bg-purple-600 text-white shadow-md shadow-purple-950/50"
                  : "text-neutral-400 hover:text-neutral-200"
              }`}
            >
              <LogIn className="w-4 h-4" />
              <span>Вход в аккаунт</span>
            </button>
          </div>
        )}

        {/* Messages */}
        {errorMsg && (
          <div className="mx-4 mt-3 p-3 rounded-xl bg-rose-950/70 border border-rose-800/80 text-rose-200 text-xs flex items-center gap-2 animate-fade-in">
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
            <span>{errorMsg}</span>
          </div>
        )}
        {successMsg && (
          <div className="mx-4 mt-3 p-3 rounded-xl bg-emerald-950/70 border border-emerald-800/80 text-emerald-200 text-xs flex items-center gap-2 animate-fade-in">
            <Check className="w-4 h-4 shrink-0 text-emerald-400" />
            <span>{successMsg}</span>
          </div>
        )}

        {/* Modal Body */}
        <div className="p-4 sm:p-5 overflow-y-auto space-y-4 flex-1">
          {/* PROFILE VIEW (LOGGED IN) */}
          {currentUser && mode === "profile" && (
            <div className="space-y-4">
              {/* Account Card */}
              <div className="p-4 rounded-2xl bg-neutral-950/80 border border-purple-900/40 relative overflow-hidden">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-purple-600 via-indigo-600 to-amber-500 p-0.5 flex items-center justify-center shadow-lg shadow-purple-950/60">
                      <div className="w-full h-full bg-neutral-900 rounded-[14px] flex items-center justify-center font-bold text-lg text-purple-300">
                        {currentUser.username.slice(0, 1).toUpperCase()}
                      </div>
                    </div>
                    <div>
                      <h4 className="font-bold text-base text-neutral-100 flex items-center gap-2">
                        {currentUser.username}
                        <span className="flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-emerald-950/90 text-emerald-400 border border-emerald-700 font-mono">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                          Синхронизировано
                        </span>
                      </h4>
                      <p className="text-xs text-neutral-400 font-mono">{currentUser.email}</p>
                    </div>
                  </div>

                  <button
                    onClick={() => {
                      sound.playClick();
                      onUserLogout();
                    }}
                    className="p-2 rounded-xl text-neutral-400 hover:text-rose-300 hover:bg-neutral-800 text-xs font-semibold flex items-center gap-1.5 transition-colors"
                    title="Выйти из этой учётной записи"
                  >
                    <LogOut className="w-4 h-4" />
                    <span className="hidden sm:inline">Выйти</span>
                  </button>
                </div>

                {/* Mobile Quick PIN Badge */}
                <div className="mt-4 p-3 rounded-xl bg-purple-950/40 border border-purple-800/40 flex items-center justify-between gap-2">
                  <div className="space-y-0.5">
                    <span className="text-[11px] text-purple-300 font-semibold block">
                      Быстрый PIN-код для входа с телефона и планшета:
                    </span>
                    <span className="text-xs text-neutral-400 block">
                      Просто введите этот код на смартфоне, чтобы мгновенно загрузить эту же сессию
                    </span>
                  </div>

                  <button
                    onClick={copyPin}
                    className="px-3 py-1.5 rounded-lg bg-purple-600 hover:bg-purple-500 text-white font-mono font-bold text-sm flex items-center gap-1.5 shadow-md transition-all active:scale-95"
                    title="Скопировать код"
                  >
                    <span>{currentUser.pinCode}</span>
                    {copiedPin ? <Check className="w-3.5 h-3.5 text-emerald-300" /> : <Copy className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>

              {/* Sync Dashboard & Stats */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                <div className="p-3 rounded-xl bg-neutral-950/60 border border-neutral-800 text-center space-y-1">
                  <span className="text-[10px] text-neutral-400 uppercase tracking-wider block">Шаг истории</span>
                  <span className="font-bold text-base text-purple-300 font-mono">
                    #{currentGameState?.stepCount || 1}
                  </span>
                </div>
                <div className="p-3 rounded-xl bg-neutral-950/60 border border-neutral-800 text-center space-y-1">
                  <span className="text-[10px] text-neutral-400 uppercase tracking-wider block">Сохранения</span>
                  <span className="font-bold text-base text-amber-300 font-mono">
                    {currentSaves.length} слотов
                  </span>
                </div>
                <div className="p-3 rounded-xl bg-neutral-950/60 border border-neutral-800 text-center space-y-1">
                  <span className="text-[10px] text-neutral-400 uppercase tracking-wider block">Договорённости</span>
                  <span className="font-bold text-base text-emerald-300 font-mono">
                    {(currentGameState?.coAuthorAgreements || []).length} фактов
                  </span>
                </div>
                <div className="p-3 rounded-xl bg-neutral-950/60 border border-neutral-800 text-center space-y-1">
                  <span className="text-[10px] text-neutral-400 uppercase tracking-wider block">Устройства</span>
                  <span className="font-bold text-base text-cyan-300 font-mono">
                    {currentUser.devices?.length || 1}
                  </span>
                </div>
              </div>

              {/* Auto Sync Toggle & Sync Button */}
              <div className="p-4 rounded-xl bg-neutral-950/90 border border-neutral-800 space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <div className="space-y-0.5">
                    <div className="text-xs font-semibold text-neutral-200 flex items-center gap-1.5">
                      <ShieldCheck className="w-4 h-4 text-emerald-400" />
                      Мгновенная фоновая синхронизация прогресса
                    </div>
                    <p className="text-[11px] text-neutral-400">
                      Автоматически отправляет каждый новый сюжетный шаг, главу и ответ соавтора в облако
                    </p>
                  </div>

                  <button
                    onClick={() => {
                      sound.playClick();
                      onToggleAutoSync(!autoSyncEnabled);
                    }}
                    className={`w-11 h-6 rounded-full transition-colors relative shrink-0 ${
                      autoSyncEnabled ? "bg-emerald-600" : "bg-neutral-800"
                    }`}
                  >
                    <div
                      className={`w-4 h-4 rounded-full bg-white absolute top-1 transition-transform ${
                        autoSyncEnabled ? "left-6" : "left-1"
                      }`}
                    />
                  </button>
                </div>

                <div className="pt-2 border-t border-neutral-800/80 flex items-center justify-between gap-2">
                  <div className="text-[11px] text-neutral-400 flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5 text-neutral-500" />
                    <span>
                      Последняя синхронизация:{" "}
                      {lastSyncedAt
                        ? new Date(lastSyncedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })
                        : "Только что"}
                    </span>
                  </div>

                  <button
                    onClick={handleManualSync}
                    disabled={isSubmitting || isSyncing}
                    className="px-3.5 py-1.5 rounded-xl bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white text-xs font-bold flex items-center gap-1.5 shadow-md transition-all active:scale-95"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${isSyncing || isSubmitting ? "animate-spin" : ""}`} />
                    <span>{isSyncing || isSubmitting ? "Синхронизация..." : "Синхронизировать сейчас"}</span>
                  </button>
                </div>
              </div>

              {/* Cross Device Support Instructions */}
              <div className="p-3.5 rounded-xl bg-purple-950/20 border border-purple-900/30 text-xs text-neutral-300 space-y-2">
                <span className="font-semibold text-purple-300 flex items-center gap-1.5">
                  <Sparkles className="w-4 h-4 text-amber-400" />
                  Как играть на телефоне или планшете:
                </span>
                <ol className="list-decimal list-inside space-y-1 text-[11px] text-neutral-400">
                  <li>Откройте сайт StoryZone на смартфоне или планшете</li>
                  <li>Нажмите на иконку <strong>Облако</strong> вверху и выберите <strong>«Вход по PIN-коду»</strong></li>
                  <li>Введите ваш PIN <strong>{currentUser.pinCode}</strong> (или email и пароль)</li>
                  <li>История, персонажи, инвентарь и главы загрузятся сразу же в том же моменте!</li>
                </ol>
              </div>
            </div>
          )}

          {/* REGISTER FORM */}
          {!currentUser && mode === "register" && (
            <form onSubmit={handleRegister} className="space-y-3.5">
              <div className="space-y-1">
                <label className="text-xs font-medium text-neutral-300 flex items-center gap-1.5">
                  <User className="w-3.5 h-3.5 text-purple-400" />
                  Имя автора (Никнейм)
                </label>
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="Например: Мастер Сюжетов"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-neutral-950 border border-neutral-800 focus:border-purple-500 focus:ring-1 focus:ring-purple-500 text-xs sm:text-sm text-neutral-100 placeholder-neutral-600 outline-none transition-colors"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-medium text-neutral-300 flex items-center gap-1.5">
                  <Cloud className="w-3.5 h-3.5 text-indigo-400" />
                  Электронная почта (Email) *
                </label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="yourname@gmail.com"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-neutral-950 border border-neutral-800 focus:border-purple-500 focus:ring-1 focus:ring-purple-500 text-xs sm:text-sm text-neutral-100 placeholder-neutral-600 outline-none transition-colors"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-medium text-neutral-300 flex items-center gap-1.5">
                  <Key className="w-3.5 h-3.5 text-amber-400" />
                  Пароль *
                </label>
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Минимум 4 символа"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-neutral-950 border border-neutral-800 focus:border-purple-500 focus:ring-1 focus:ring-purple-500 text-xs sm:text-sm text-neutral-100 placeholder-neutral-600 outline-none transition-colors"
                />
              </div>

              <div className="p-3 rounded-xl bg-neutral-950 border border-neutral-850 text-xs text-neutral-400 space-y-1">
                <div className="flex items-center gap-1.5 text-emerald-300 font-semibold text-[11px]">
                  <Check className="w-3.5 h-3.5" />
                  Мгновенная миграция данных
                </div>
                <p className="text-[11px]">
                  Все текущие истории, главы, договоренности соавтора и слоты сохранений автоматически перенесутся в ваш новый аккаунт и станут доступны с любого телефона или ноутбука.
                </p>
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full py-3 rounded-xl bg-gradient-to-r from-purple-600 via-indigo-600 to-purple-600 hover:from-purple-500 hover:to-indigo-500 text-white font-bold text-xs sm:text-sm shadow-xl shadow-purple-950/50 flex items-center justify-center gap-2 transition-all active:scale-[0.98] disabled:opacity-50"
              >
                {isSubmitting ? (
                  <RefreshCw className="w-4 h-4 animate-spin" />
                ) : (
                  <UserPlus className="w-4 h-4" />
                )}
                <span>Создать аккаунт и синхронизировать всё</span>
              </button>
            </form>
          )}

          {/* LOGIN FORM */}
          {!currentUser && mode === "login" && (
            <form onSubmit={handleLogin} className="space-y-3.5">
              <div className="flex items-center justify-end">
                <button
                  type="button"
                  onClick={() => {
                    sound.playClick();
                    setUsePinLogin(!usePinLogin);
                  }}
                  className="text-xs text-purple-400 hover:text-purple-300 underline font-medium"
                >
                  {usePinLogin ? "← Войти по Email и паролю" : "Войти по быстрому PIN-коду (для телефонов) →"}
                </button>
              </div>

              {usePinLogin ? (
                <div className="space-y-1">
                  <label className="text-xs font-medium text-neutral-300 flex items-center gap-1.5">
                    <Smartphone className="w-3.5 h-3.5 text-cyan-400" />
                    6-значный PIN-код синхронизации (например SZ-8392)
                  </label>
                  <input
                    type="text"
                    required
                    value={pinCodeInput}
                    onChange={(e) => setPinCodeInput(e.target.value.toUpperCase())}
                    placeholder="SZ-XXXX"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-neutral-950 border border-neutral-800 focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 text-sm font-mono tracking-wider text-cyan-300 placeholder-neutral-600 outline-none uppercase transition-colors"
                  />
                  <p className="text-[10px] text-neutral-500">
                    PIN-код указан в профиле вашей учетной записи на основном компьютере или устройстве.
                  </p>
                </div>
              ) : (
                <>
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-neutral-300 flex items-center gap-1.5">
                      <Cloud className="w-3.5 h-3.5 text-indigo-400" />
                      Email или логин *
                    </label>
                    <input
                      type="text"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="yourname@gmail.com"
                      className="w-full px-3.5 py-2.5 rounded-xl bg-neutral-950 border border-neutral-800 focus:border-purple-500 focus:ring-1 focus:ring-purple-500 text-xs sm:text-sm text-neutral-100 placeholder-neutral-600 outline-none transition-colors"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-medium text-neutral-300 flex items-center gap-1.5">
                      <Key className="w-3.5 h-3.5 text-amber-400" />
                      Пароль *
                    </label>
                    <input
                      type="password"
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Введите пароль"
                      className="w-full px-3.5 py-2.5 rounded-xl bg-neutral-950 border border-neutral-800 focus:border-purple-500 focus:ring-1 focus:ring-purple-500 text-xs sm:text-sm text-neutral-100 placeholder-neutral-600 outline-none transition-colors"
                    />
                  </div>
                </>
              )}

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full py-3 rounded-xl bg-gradient-to-r from-purple-600 via-indigo-600 to-purple-600 hover:from-purple-500 hover:to-indigo-500 text-white font-bold text-xs sm:text-sm shadow-xl shadow-purple-950/50 flex items-center justify-center gap-2 transition-all active:scale-[0.98] disabled:opacity-50"
              >
                {isSubmitting ? (
                  <RefreshCw className="w-4 h-4 animate-spin" />
                ) : (
                  <LogIn className="w-4 h-4" />
                )}
                <span>Войти и загрузить весь прогресс</span>
              </button>
            </form>
          )}
        </div>

        {/* Footer */}
        <div className="p-3 sm:p-4 border-t border-purple-900/20 bg-neutral-950/80 flex items-center justify-between text-[11px] text-neutral-400">
          <div className="flex items-center gap-2">
            <Laptop className="w-3.5 h-3.5 text-purple-400" />
            <Smartphone className="w-3.5 h-3.5 text-indigo-400" />
            <Tablet className="w-3.5 h-3.5 text-cyan-400" />
            <span>Кроссплатформенный доступ 24/7</span>
          </div>

          <button
            onClick={() => {
              sound.playClick();
              onClose();
            }}
            className="px-3 py-1 rounded-lg bg-neutral-900 hover:bg-neutral-800 text-neutral-300 hover:text-white transition-colors"
          >
            Закрыть
          </button>
        </div>
      </div>
    </div>
  );
};
