import React, { useState, useRef } from "react";
import {
  X,
  Plus,
  Upload,
  Image as ImageIcon,
  Volume2,
  VolumeX,
  Film,
  FileText,
  Play,
  Square,
  Mic,
  MicOff,
  Check,
  Sparkles,
  Trash2,
  Edit3,
  User,
  Sliders,
  ExternalLink,
  Loader2,
  Camera,
  Maximize2,
  Download,
  Share2,
  BookOpen,
} from "lucide-react";
import {
  ActiveGameState,
  Character,
  MediaAttachment,
  AttachmentCategory,
  LorebookEntry,
} from "../types";
import { sound } from "../utils/audio";
import { safeFetchJson } from "../utils/safeApi";

interface MediaAttachmentModalProps {
  isOpen: boolean;
  onClose: () => void;
  gameState: ActiveGameState;
  customApiKey?: string;
  onAddAttachment: (attachment: MediaAttachment) => void;
  onRemoveAttachment: (id: string) => void;
  onInjectSceneText: (text: string) => void;
  onExecuteAction: (actionText: string) => void;
  onUpdateCharacter?: (character: Character) => void;
  onAddLorebookEntry?: (entry: LorebookEntry) => void;
}

export const MediaAttachmentModal: React.FC<MediaAttachmentModalProps> = ({
  isOpen,
  onClose,
  gameState,
  customApiKey,
  onAddAttachment,
  onRemoveAttachment,
  onInjectSceneText,
  onExecuteAction,
  onUpdateCharacter,
  onAddLorebookEntry,
}) => {
  const [activeTab, setActiveTab] = useState<"all" | "photo" | "audio" | "video" | "text_doc">("all");
  const [selectedAttachment, setSelectedAttachment] = useState<MediaAttachment | null>(null);

  // Upload/Add Form State
  const [isUploading, setIsUploading] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<any>(null);

  // Audio Recording State
  const [isRecording, setIsRecording] = useState(false);
  const [recordedAudioUrl, setRecordedAudioUrl] = useState<string | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  // Playback state
  const [playingAudioId, setPlayingAudioId] = useState<string | null>(null);
  const [selectedCharacterId, setSelectedCharacterId] = useState<string>(
    gameState.characters[0]?.id || ""
  );

  // Text file manual entry / paste
  const [manualTextTitle, setManualTextTitle] = useState("");
  const [manualTextContent, setManualTextContent] = useState("");
  const [isDragOver, setIsDragOver] = useState(false);
  const [isSpeakingVoice, setIsSpeakingVoice] = useState(false);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  if (!isOpen) return null;

  const attachments: MediaAttachment[] = gameState.attachedMedia || [];
  const filteredAttachments =
    activeTab === "all"
      ? attachments
      : attachments.filter((a) => a.category === activeTab);

  // Demo presets for 1-click testing of all scenarios
  const DEMO_PRESETS: MediaAttachment[] = [
    {
      id: "demo_pose_warrior",
      name: "Боевая_стойка_рыцаря.jpg",
      category: "photo",
      fileType: "image/jpeg",
      size: 245000,
      dataUrl: "https://images.unsplash.com/photo-1579783902614-a3fb3927b675?w=800",
      usageTarget: "character_pose",
      analysisSummary: "Визуальный референс боевой позы: тяжелые латы, обе руки сжимают полуторный меч, защитная стойка.",
      timestamp: Date.now() - 3600000,
    },
    {
      id: "demo_portrait_sorceress",
      name: "Портрет_Внешность_Чародейки.jpg",
      category: "photo",
      fileType: "image/jpeg",
      size: 312000,
      dataUrl: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=800",
      usageTarget: "character_appearance",
      analysisSummary: "Референс внешности: серебристые волосы, сапфировый взгляд, мантия с руническими символами.",
      timestamp: Date.now() - 3500000,
    },
    {
      id: "demo_voice_mentor",
      name: "Голос_Наставника_Баритон.mp3",
      category: "audio",
      fileType: "audio/mp3",
      size: 512000,
      usageTarget: "character_voice",
      analysisSummary: "Аудиореференс тембра: глубокий спокойный баритон, размеренный темп, внушающий доверие.",
      timestamp: Date.now() - 3400000,
    },
    {
      id: "demo_voice_rogue",
      name: "Голос_Разбойницы_Альт.mp3",
      category: "audio",
      fileType: "audio/mp3",
      size: 420000,
      usageTarget: "character_voice",
      analysisSummary: "Аудиореференс тембра: звонкий насмешливый альт, быстрый темп с лёгкой хрипотцой.",
      timestamp: Date.now() - 3300000,
    },
    {
      id: "demo_script_fountain",
      name: "Сценарий_Эпизод_Встреча.fountain",
      category: "text_doc",
      fileType: "text/plain",
      size: 1450,
      textPreview: `ИНТ. ТАВЕРНА «ПЛЯШУЩИЙ ВОЛК» - ВЕЧЕР\n\nТрещит очаг. Тяжёлый дубовый стол дрожит от удара кружки.\n\nРОЛАНД\n(вполголоса, глядя на дверь)\nОни уже здесь. Не оборачивайся.\n\nЭЛИС\n(усмехаясь, поправляет кинжал)\nПусть попробуют сделать первый шаг.\n\nДверь с грохотом распахивается настежь. В проёме вырастают три силуэта в чёрных плащах.`,
      usageTarget: "story_script",
      analysisSummary: "Сценарный формат .fountain: сцена столкновения с диалогом и ремарками.",
      timestamp: Date.now() - 3200000,
    },
    {
      id: "demo_lore_inquisition",
      name: "Досье_Орден_Пепла.md",
      category: "text_doc",
      fileType: "text/markdown",
      size: 1980,
      textPreview: `# Орден Серебряного Пепла\n\n**Основание:** Третья Эпоха Затмения.\n**Кредо:** «Сжечь скверну до корней, дабы ростки правды пробились вновь».\n\n### Структура и знаки отличия:\n- **Инквизиторы Клинка:** Носят тяжёлые латы из звёздного чугуна.\n- **Инквизиторы Слова:** Владеют искусством ментального подчинения.\n\n### Слабости ордена:\nНетерпимы к любым проявлениям древней крови, что делает их фанатичными и уязвимыми для ловушек.`,
      usageTarget: "lorebook",
      analysisSummary: "Материал для Лорбука: полное досье на орден, слабости и иерархия.",
      timestamp: Date.now() - 3100000,
    },
    {
      id: "demo_stats_sword",
      name: "Параметры_Клинок_Бури.json",
      category: "text_doc",
      fileType: "application/json",
      size: 820,
      textPreview: `{\n  "itemName": "Клинок Бури",\n  "type": "weapon",\n  "rarity": "legendary",\n  "stats": {\n    "damage": 85,\n    "speed": 1.4,\n    "lightningDamage": 35\n  },\n  "specialEffect": "При критическом ударе вызывает цепную молнию"\n}`,
      usageTarget: "scene_detail",
      analysisSummary: "Формат JSON: характеристики легендарного клинка и особые свойства.",
      timestamp: Date.now() - 3000000,
    },
    {
      id: "demo_video_action",
      name: "Раскадровка_Дуэль_на_мосту.mp4",
      category: "video",
      fileType: "video/mp4",
      size: 1240000,
      usageTarget: "scene_detail",
      analysisSummary: "Видеораскадровка: кинематографическая дуэль на узком каменном мосту с динамичной сменой планов.",
      timestamp: Date.now() - 2900000,
    },
  ];

  const handleLoadDemoPresets = () => {
    sound.playFanfare();
    DEMO_PRESETS.forEach((preset) => {
      onAddAttachment(preset);
    });
    setSelectedAttachment(DEMO_PRESETS[0]);
  };

  // Handle local file selection
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    sound.playClick();
    setIsUploading(true);

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      let category: AttachmentCategory = "photo";
      if (file.type.startsWith("image/")) category = "photo";
      else if (file.type.startsWith("audio/")) category = "audio";
      else if (file.type.startsWith("video/")) category = "video";
      else category = "text_doc";

      const reader = new FileReader();

      if (category === "text_doc") {
        reader.onload = async (event) => {
          const text = (event.target?.result as string) || "";
          const newAtt: MediaAttachment = {
            id: `att_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
            name: file.name,
            category: "text_doc",
            fileType: file.type || "text/plain",
            size: file.size,
            textPreview: text.slice(0, 10000),
            timestamp: Date.now(),
          };
          onAddAttachment(newAtt);
          setSelectedAttachment(newAtt);
          triggerAiAnalysis(newAtt, text);
        };
        reader.readAsText(file);
      } else {
        reader.onload = async (event) => {
          const dataUrl = event.target?.result as string;
          const newAtt: MediaAttachment = {
            id: `att_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
            name: file.name,
            category,
            fileType: file.type || "application/octet-stream",
            size: file.size,
            dataUrl,
            timestamp: Date.now(),
          };
          onAddAttachment(newAtt);
          setSelectedAttachment(newAtt);
          triggerAiAnalysis(newAtt, "");
        };
        reader.readAsDataURL(file);
      }
    }

    setIsUploading(false);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  // Microphone recording
  const startRecording = async () => {
    try {
      sound.playClick();
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: "audio/webm" });
        const reader = new FileReader();
        reader.onloadend = () => {
          const base64data = reader.result as string;
          setRecordedAudioUrl(base64data);

          const charName = gameState.characters.find((c) => c.id === selectedCharacterId)?.name || "Герой";
          const newAtt: MediaAttachment = {
            id: `att_rec_${Date.now()}`,
            name: `Запись голоса: ${charName}.webm`,
            category: "audio",
            fileType: "audio/webm",
            size: audioBlob.size,
            dataUrl: base64data,
            assignedCharacterId: selectedCharacterId,
            usageTarget: "character_voice",
            timestamp: Date.now(),
          };
          onAddAttachment(newAtt);
          setSelectedAttachment(newAtt);
          triggerAiAnalysis(newAtt, "");
        };
        reader.readAsDataURL(audioBlob);
        stream.getTracks().forEach((track) => track.stop());
      };

      mediaRecorder.start();
      setIsRecording(true);
    } catch (err) {
      console.warn("Microphone access denied or unsupported:", err);
      alert("Не удалось получить доступ к микрофону. Проверьте разрешения в браузере.");
    }
  };

  const stopRecording = () => {
    sound.playClick();
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  // Trigger AI Analysis of Attachment
  const triggerAiAnalysis = async (attachment: MediaAttachment, textContent: string = "") => {
    setIsAnalyzing(true);
    setAnalysisResult(null);

    try {
      const char = gameState.characters.find((c) => c.id === (attachment.assignedCharacterId || selectedCharacterId));
      const res = await safeFetchJson<any>("/api/media/process-files", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(customApiKey ? { "x-custom-api-key": customApiKey } : {}),
        },
        body: JSON.stringify({
          fileName: attachment.name,
          fileType: attachment.fileType,
          category: attachment.category,
          fileBase64: attachment.dataUrl || undefined,
          textContent: textContent || attachment.textPreview || undefined,
          sceneContext: gameState.currentScene,
          universeName: gameState.universeSetting?.universeName || gameState.story.genre,
          characterName: char?.name,
          usageTarget: attachment.usageTarget || "scene_detail",
          customKey: customApiKey,
        }),
      });

      if (res.ok && res.data) {
        sound.playFanfare();
        setAnalysisResult(res.data);
      }
    } catch (e) {
      console.warn("Media analysis error:", e);
    } finally {
      setIsAnalyzing(false);
    }
  };

  // Play audio attachment
  const handleTogglePlayAudio = (att: MediaAttachment) => {
    sound.playClick();
    if (playingAudioId === att.id) {
      sound.stopAudioUrl();
      setPlayingAudioId(null);
    } else if (att.dataUrl) {
      sound.playAudioUrl(att.dataUrl, () => {
        setPlayingAudioId(null);
      });
      setPlayingAudioId(att.id);
    }
  };

  // Assign attachment as character voice
  const handleAssignAsCharacterVoice = (att: MediaAttachment, charId: string) => {
    if (!onUpdateCharacter) return;
    const char = gameState.characters.find((c) => c.id === charId);
    if (!char) return;

    sound.playChoice();
    const updated: Character = {
      ...char,
      voiceSampleUrl: att.dataUrl,
      voiceTimbre: analysisResult?.voiceDescriptors?.timbre || char.voiceTimbre || "Характерный голос",
      voicePitch: analysisResult?.voiceDescriptors?.pitch ?? char.voicePitch ?? 1.0,
      voiceRate: analysisResult?.voiceDescriptors?.rate ?? char.voiceRate ?? 1.0,
    };
    onUpdateCharacter(updated);
    alert(`Голос для персонажа «${char.name}» успешно назначен из файла «${att.name}»! Теперь его реплики будут звучать с этим тембром.`);
  };

  // Assign photo as character appearance or pose
  const handleAssignAsCharacterPhoto = (att: MediaAttachment, charId: string, asPose: boolean = false) => {
    if (!onUpdateCharacter || !att.dataUrl) return;
    const char = gameState.characters.find((c) => c.id === charId);
    if (!char) return;

    sound.playChoice();
    const photos = char.appearancePhotos ? [...char.appearancePhotos] : [];
    if (!photos.includes(att.dataUrl)) {
      photos.push(att.dataUrl);
    }

    const updated: Character = {
      ...char,
      avatar: asPose ? char.avatar : att.dataUrl,
      poseReferenceUrl: asPose ? att.dataUrl : char.poseReferenceUrl,
      poseDescription: analysisResult?.poseDescription || char.poseDescription,
      appearancePhotos: photos,
    };
    onUpdateCharacter(updated);
    alert(
      asPose
        ? `Поза для персонажа «${char.name}» установлена!`
        : `Внешность и аватар «${char.name}» обновлены!`
    );
  };

  // Add manual text file
  const handleAddManualText = () => {
    if (!manualTextTitle.trim() || !manualTextContent.trim()) return;
    sound.playChoice();

    const newAtt: MediaAttachment = {
      id: `att_text_${Date.now()}`,
      name: `${manualTextTitle.trim()}.txt`,
      category: "text_doc",
      fileType: "text/plain",
      size: manualTextContent.length,
      textPreview: manualTextContent.trim(),
      timestamp: Date.now(),
    };
    onAddAttachment(newAtt);
    setSelectedAttachment(newAtt);
    triggerAiAnalysis(newAtt, manualTextContent.trim());
    setManualTextTitle("");
    setManualTextContent("");
  };

  // Test character voice via Speech Synthesis TTS
  const handleTestCharacterVoiceTTS = (charId: string) => {
    const char = gameState.characters.find((c) => c.id === charId);
    if (!char) return;
    sound.playClick();
    setIsSpeakingVoice(true);

    const pitch = analysisResult?.voiceDescriptors?.pitch ?? char.voicePitch ?? 1.0;
    const rate = analysisResult?.voiceDescriptors?.rate ?? char.voiceRate ?? 1.0;
    const samplePhrase = `Приветствую. Моё имя — ${char.name}. Теперь ты слышишь звучание моего голоса в этой повести.`;

    sound.speakCharacter(
      samplePhrase,
      { voicePitch: pitch, voiceRate: rate, voiceSampleUrl: selectedAttachment?.category === "audio" ? selectedAttachment.dataUrl : undefined },
      () => {
        setIsSpeakingVoice(false);
      }
    );
  };

  // Assign audio as Scene Background Music / OST
  const handleAssignAsSceneMusic = (att: MediaAttachment) => {
    if (!att.dataUrl) return;
    sound.playChoice();
    sound.playAudioUrl(att.dataUrl);
    alert(`Музыкальный трек «${att.name}» запущен в качестве фоновой музыки сцены!`);
  };

  // Add Lorebook entry from attachment or AI analysis candidate
  const handleAddLorebookFromAttachment = (att: MediaAttachment) => {
    if (!onAddLorebookEntry) return;
    sound.playChoice();
    const title = analysisResult?.lorebookCandidate?.title || att.name.replace(/\.[^/.]+$/, "");
    const desc =
      analysisResult?.lorebookCandidate?.description ||
      att.textPreview ||
      analysisResult?.analysisSummary ||
      "Сюжетный материал из прикрепленного файла.";

    const entry: LorebookEntry = {
      id: `lore_att_${Date.now()}`,
      title,
      category: "правило_мира",
      description: desc,
    };
    onAddLorebookEntry(entry);
    alert(`Материал «${title}» успешно занесён в Лорбук мира!`);
  };

  // Drag & drop file handler
  const handleDropFiles = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    const files = e.dataTransfer.files;
    if (!files || files.length === 0) return;

    sound.playClick();
    setIsUploading(true);

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      let category: AttachmentCategory = "photo";
      if (file.type.startsWith("image/")) category = "photo";
      else if (file.type.startsWith("audio/")) category = "audio";
      else if (file.type.startsWith("video/")) category = "video";
      else category = "text_doc";

      const reader = new FileReader();
      if (category === "text_doc") {
        reader.onload = async (event) => {
          const text = (event.target?.result as string) || "";
          const newAtt: MediaAttachment = {
            id: `att_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
            name: file.name,
            category: "text_doc",
            fileType: file.type || "text/plain",
            size: file.size,
            textPreview: text.slice(0, 10000),
            timestamp: Date.now(),
          };
          onAddAttachment(newAtt);
          setSelectedAttachment(newAtt);
          triggerAiAnalysis(newAtt, text);
        };
        reader.readAsText(file);
      } else {
        reader.onload = async (event) => {
          const dataUrl = event.target?.result as string;
          const newAtt: MediaAttachment = {
            id: `att_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
            name: file.name,
            category,
            fileType: file.type || "application/octet-stream",
            size: file.size,
            dataUrl,
            timestamp: Date.now(),
          };
          onAddAttachment(newAtt);
          setSelectedAttachment(newAtt);
          triggerAiAnalysis(newAtt, "");
        };
        reader.readAsDataURL(file);
      }
    }
    setIsUploading(false);
  };

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        setIsDragOver(true);
      }}
      onDragLeave={() => setIsDragOver(false)}
      onDrop={handleDropFiles}
      className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/80 backdrop-blur-md animate-fade-in text-neutral-100"
    >
      <div className={`relative w-full max-w-4xl bg-neutral-900 border rounded-3xl shadow-2xl flex flex-col overflow-hidden max-h-[92vh] transition-all ${isDragOver ? "border-purple-500 ring-2 ring-purple-500/50" : "border-neutral-800"}`}>
        {isDragOver && (
          <div className="absolute inset-0 z-50 bg-purple-950/90 backdrop-blur-sm flex flex-col items-center justify-center pointer-events-none space-y-2 border-2 border-dashed border-purple-400 m-2 rounded-2xl">
            <Upload className="w-12 h-12 text-purple-300 animate-bounce" />
            <span className="text-sm font-bold text-white">Перетащите файлы сюда для мгновенного прикрепления</span>
            <span className="text-xs text-purple-200">Фото, видео, аудиозаписи, сценарии .fountain, лор .md, статы .json</span>
          </div>
        )}

        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-neutral-800 bg-neutral-950/80 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-gradient-to-br from-purple-600 via-indigo-600 to-pink-600 text-white shadow-lg shadow-purple-900/30">
              <Plus className="w-5 h-5" />
            </div>
            <div>
              <h2 className="font-cinzel text-base sm:text-lg font-bold text-neutral-100 flex items-center gap-2">
                Медиатека & Прикрепление Файлов Любых Форматов
              </h2>
              <p className="text-xs text-neutral-400">
                Фото поз и внешности, аудио голоса персонажей, видео раскадровки, сценарии и текст
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

        {/* Action Toolbar: Add files, Record voice, Demo samples */}
        <div className="p-3 bg-neutral-950/60 border-b border-neutral-800/80 flex flex-wrap items-center justify-between gap-2">
          {/* Upload Buttons */}
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => fileInputRef.current?.click()}
              className="px-3.5 py-1.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold flex items-center gap-1.5 shadow-md shadow-purple-900/30 transition-all hover:scale-105"
            >
              <Upload className="w-3.5 h-3.5" />
              <span>Загрузить файлы (+)</span>
            </button>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept="image/*,audio/*,video/*,.txt,.md,.json,.fountain,.docx,.pdf,.csv"
              onChange={handleFileChange}
              className="hidden"
            />

            {/* Voice Recorder */}
            {isRecording ? (
              <button
                onClick={stopRecording}
                className="px-3.5 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold flex items-center gap-1.5 animate-pulse shadow-md shadow-rose-900/40"
              >
                <Square className="w-3.5 h-3.5 fill-white" />
                <span>Остановить запись</span>
              </button>
            ) : (
              <button
                onClick={startRecording}
                className="px-3.5 py-1.5 rounded-xl bg-neutral-850 hover:bg-neutral-800 border border-neutral-750 text-neutral-200 text-xs font-semibold flex items-center gap-1.5 transition-all"
                title="Записать образец голоса персонажа через микрофон прямо в браузере"
              >
                <Mic className="w-3.5 h-3.5 text-rose-400" />
                <span>Записать голос персонажа</span>
              </button>
            )}

            {/* Load Demo Presets Button */}
            <button
              onClick={handleLoadDemoPresets}
              className="px-3 py-1.5 rounded-xl bg-gradient-to-r from-amber-600 to-purple-600 hover:from-amber-500 hover:to-purple-500 text-white text-xs font-bold flex items-center gap-1.5 shadow-md transition-all hover:scale-105"
              title="Загрузить готовые образцы: позы воина, голос наставника, сценарий .fountain, досье .md, статы .json"
            >
              <Sparkles className="w-3.5 h-3.5 text-amber-200" />
              <span>Демо-образцы (+)</span>
            </button>
          </div>

          {/* Category Tabs */}
          <div className="flex items-center gap-1 text-xs">
            {(["all", "photo", "audio", "video", "text_doc"] as const).map((cat) => (
              <button
                key={cat}
                onClick={() => {
                  sound.playClick();
                  setActiveTab(cat);
                }}
                className={`px-2.5 py-1 rounded-lg font-medium transition-colors ${
                  activeTab === cat
                    ? "bg-purple-950 text-purple-200 border border-purple-800"
                    : "text-neutral-400 hover:text-neutral-200"
                }`}
              >
                {cat === "all"
                  ? `Все (${attachments.length})`
                  : cat === "photo"
                  ? "Фото / Позы"
                  : cat === "audio"
                  ? "Аудио / Голос"
                  : cat === "video"
                  ? "Видео"
                  : "Тексты / Сценарии"}
              </button>
            ))}
          </div>
        </div>

        {/* Content Layout: Left List, Right Inspector */}
        <div className="flex-1 grid grid-cols-1 md:grid-cols-12 overflow-hidden">
          {/* Left: Files List */}
          <div className="md:col-span-5 p-3 sm:p-4 border-r border-neutral-800 overflow-y-auto space-y-2.5 max-h-[50vh] md:max-h-none">
            {filteredAttachments.length === 0 ? (
              <div className="p-6 text-center rounded-2xl bg-neutral-950/40 border border-dashed border-neutral-800 text-neutral-500 space-y-2">
                <Upload className="w-8 h-8 mx-auto text-neutral-600 stroke-1" />
                <p className="text-xs font-medium">Нет прикрепленных файлов в этой категории.</p>
                <p className="text-[11px] text-neutral-600">
                  Нажмите кнопку «Загрузить файлы (+)» или запишите голос через микрофон.
                </p>
              </div>
            ) : (
              filteredAttachments.map((att) => {
                const isSelected = selectedAttachment?.id === att.id;
                return (
                  <div
                    key={att.id}
                    onClick={() => {
                      sound.playClick();
                      setSelectedAttachment(att);
                      if (!analysisResult) triggerAiAnalysis(att);
                    }}
                    className={`p-3 rounded-2xl border cursor-pointer transition-all flex items-center justify-between gap-3 ${
                      isSelected
                        ? "bg-purple-950/70 border-purple-600 text-white shadow-md shadow-purple-950/30"
                        : "bg-neutral-950/50 border-neutral-800 text-neutral-300 hover:bg-neutral-900"
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      {/* Thumbnail / Icon */}
                      <div className="w-10 h-10 rounded-xl bg-neutral-900 border border-neutral-800 flex items-center justify-center shrink-0 overflow-hidden">
                        {att.category === "photo" && att.dataUrl ? (
                          <img src={att.dataUrl} alt="" className="w-full h-full object-cover" />
                        ) : att.category === "audio" ? (
                          <Volume2 className="w-5 h-5 text-amber-400" />
                        ) : att.category === "video" ? (
                          <Film className="w-5 h-5 text-purple-400" />
                        ) : (
                          <FileText className="w-5 h-5 text-cyan-400" />
                        )}
                      </div>

                      <div className="min-w-0">
                        <span className="font-bold text-xs truncate block text-neutral-200">
                          {att.name}
                        </span>
                        <span className="text-[10px] text-neutral-500 block truncate font-mono">
                          {att.category.toUpperCase()} • {(att.size / 1024).toFixed(1)} KB
                        </span>
                      </div>
                    </div>

                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        sound.playClick();
                        onRemoveAttachment(att.id);
                        if (selectedAttachment?.id === att.id) setSelectedAttachment(null);
                      }}
                      className="p-1 rounded-lg text-neutral-500 hover:text-rose-400 hover:bg-rose-950/40 transition-colors"
                      title="Удалить файл"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                );
              })
            )}

            {/* Quick manual text box */}
            <div className="p-3 rounded-2xl bg-neutral-950/60 border border-neutral-800/80 space-y-2 mt-4">
              <span className="text-[11px] font-bold text-neutral-400 block">
                Добавить текст / сценарий / заметку вручную:
              </span>
              <input
                type="text"
                value={manualTextTitle}
                onChange={(e) => setManualTextTitle(e.target.value)}
                placeholder="Название (например: Предыстория цитадели)"
                className="w-full bg-neutral-900 border border-neutral-800 rounded-xl px-2.5 py-1 text-xs text-neutral-200 focus:outline-none focus:border-purple-600"
              />
              <textarea
                value={manualTextContent}
                onChange={(e) => setManualTextContent(e.target.value)}
                rows={2}
                placeholder="Текст описания, квента, черты или диалог..."
                className="w-full bg-neutral-900 border border-neutral-800 rounded-xl p-2 text-xs text-neutral-200 focus:outline-none focus:border-purple-600"
              />
              <button
                onClick={handleAddManualText}
                disabled={!manualTextTitle.trim() || !manualTextContent.trim()}
                className="w-full py-1.5 rounded-xl bg-neutral-800 hover:bg-neutral-750 disabled:opacity-40 text-neutral-200 text-xs font-semibold flex items-center justify-center gap-1 transition-colors"
              >
                <Plus className="w-3 h-3 text-purple-400" />
                <span>Добавить текстовый файл</span>
              </button>
            </div>
          </div>

          {/* Right: Selected File Inspector & Actions */}
          <div className="md:col-span-7 p-4 sm:p-5 overflow-y-auto space-y-4">
            {selectedAttachment ? (
              <div className="space-y-4 animate-fade-in">
                {/* Media Preview Player */}
                <div className="p-3.5 rounded-2xl bg-neutral-950 border border-neutral-800 space-y-3">
                  <div className="flex items-center justify-between border-b border-neutral-850 pb-2">
                    <span className="font-bold text-sm text-neutral-100 flex items-center gap-2">
                      {selectedAttachment.category === "photo" && <ImageIcon className="w-4 h-4 text-purple-400" />}
                      {selectedAttachment.category === "audio" && <Volume2 className="w-4 h-4 text-amber-400" />}
                      {selectedAttachment.category === "video" && <Film className="w-4 h-4 text-rose-400" />}
                      {selectedAttachment.category === "text_doc" && <FileText className="w-4 h-4 text-cyan-400" />}
                      {selectedAttachment.name}
                    </span>
                    <span className="text-[10px] text-neutral-500 font-mono">
                      {new Date(selectedAttachment.timestamp).toLocaleTimeString()}
                    </span>
                  </div>

                  {/* Photo Display */}
                  {selectedAttachment.category === "photo" && selectedAttachment.dataUrl && (
                    <div className="relative rounded-xl overflow-hidden max-h-[320px] bg-neutral-900 flex items-center justify-center border border-neutral-850">
                      <img
                        src={selectedAttachment.dataUrl}
                        alt="Photo Preview"
                        className="w-full h-full object-contain max-h-[320px]"
                      />
                    </div>
                  )}

                  {/* Audio Player */}
                  {selectedAttachment.category === "audio" && selectedAttachment.dataUrl && (
                    <div className="p-3 rounded-xl bg-neutral-900 border border-neutral-800 flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2">
                        <Volume2 className="w-5 h-5 text-amber-400" />
                        <div>
                          <span className="text-xs font-bold text-neutral-200 block">
                            Аудиофайл / Голосовой сэмпл
                          </span>
                          <span className="text-[10px] text-neutral-500">
                            Воспроизведение загруженной записи
                          </span>
                        </div>
                      </div>

                      <button
                        onClick={() => handleTogglePlayAudio(selectedAttachment)}
                        className={`px-3.5 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-md ${
                          playingAudioId === selectedAttachment.id
                            ? "bg-rose-600 text-white"
                            : "bg-amber-600 hover:bg-amber-500 text-white"
                        }`}
                      >
                        {playingAudioId === selectedAttachment.id ? (
                          <>
                            <Square className="w-3.5 h-3.5 fill-white" />
                            <span>Стоп</span>
                          </>
                        ) : (
                          <>
                            <Play className="w-3.5 h-3.5 fill-white" />
                            <span>Слушать голос</span>
                          </>
                        )}
                      </button>
                    </div>
                  )}

                  {/* Video Player */}
                  {selectedAttachment.category === "video" && selectedAttachment.dataUrl && (
                    <div className="rounded-xl overflow-hidden bg-black border border-neutral-850 max-h-[280px]">
                      <video
                        src={selectedAttachment.dataUrl}
                        controls
                        className="w-full max-h-[280px] object-contain"
                      />
                    </div>
                  )}

                  {/* Text Document Viewer */}
                  {selectedAttachment.category === "text_doc" && (
                    <div className="p-3 rounded-xl bg-neutral-900 border border-neutral-800 font-mono text-xs text-neutral-300 max-h-[240px] overflow-y-auto whitespace-pre-wrap leading-relaxed">
                      {selectedAttachment.textPreview || "Текст документа пуст."}
                    </div>
                  )}
                </div>

                {/* Character Assignment & Universal Actions */}
                <div className="p-3.5 rounded-2xl bg-neutral-950/80 border border-neutral-800 space-y-3">
                  <span className="text-xs font-bold text-neutral-300 block">
                    Привязать этот файл к персонажу или главе:
                  </span>

                  <div className="flex flex-wrap items-center gap-2">
                    <select
                      value={selectedCharacterId}
                      onChange={(e) => setSelectedCharacterId(e.target.value)}
                      className="bg-neutral-900 border border-neutral-800 rounded-xl px-3 py-1.5 text-xs text-neutral-200 focus:outline-none"
                    >
                      {gameState.characters.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name} ({c.role})
                        </option>
                      ))}
                    </select>

                    {/* Photo Actions */}
                    {selectedAttachment.category === "photo" && (
                      <>
                        <button
                          onClick={() => handleAssignAsCharacterPhoto(selectedAttachment, selectedCharacterId, false)}
                          className="px-3 py-1.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-semibold flex items-center gap-1 transition-colors"
                        >
                          <User className="w-3 h-3" />
                          <span>Назначить внешностью</span>
                        </button>
                        <button
                          onClick={() => handleAssignAsCharacterPhoto(selectedAttachment, selectedCharacterId, true)}
                          className="px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold flex items-center gap-1 transition-colors"
                        >
                          <Camera className="w-3 h-3" />
                          <span>Назначить позой в сцене</span>
                        </button>
                      </>
                    )}

                    {/* Audio Actions */}
                    {selectedAttachment.category === "audio" && (
                      <div className="flex flex-wrap items-center gap-2">
                        <button
                          onClick={() => handleAssignAsCharacterVoice(selectedAttachment, selectedCharacterId)}
                          className="px-3 py-1.5 rounded-xl bg-amber-600 hover:bg-amber-500 text-white text-xs font-semibold flex items-center gap-1 transition-colors"
                        >
                          <Volume2 className="w-3 h-3" />
                          <span>Сделать голосом персонажа</span>
                        </button>
                        <button
                          onClick={() => handleTestCharacterVoiceTTS(selectedCharacterId)}
                          disabled={isSpeakingVoice}
                          className="px-3 py-1.5 rounded-xl bg-neutral-800 hover:bg-neutral-750 text-amber-200 border border-amber-800/60 text-xs font-semibold flex items-center gap-1 transition-colors"
                          title="Прослушать, как персонаж произносит тестовую реплику с этим тембром"
                        >
                          <Play className="w-3 h-3 fill-amber-200" />
                          <span>{isSpeakingVoice ? "Говорит..." : "Тест голоса (TTS)"}</span>
                        </button>
                        {selectedAttachment.dataUrl && (
                          <button
                            onClick={() => handleAssignAsSceneMusic(selectedAttachment)}
                            className="px-3 py-1.5 rounded-xl bg-purple-800 hover:bg-purple-700 text-purple-100 text-xs font-semibold flex items-center gap-1 transition-colors"
                            title="Сделать треком локации или фоновой музыкой сцены"
                          >
                            <span>🎵 Саундтрек сцены</span>
                          </button>
                        )}
                      </div>
                    )}

                    {/* Text Document Actions */}
                    {selectedAttachment.category === "text_doc" && (
                      <div className="flex flex-wrap items-center gap-2">
                        {onAddLorebookEntry && (
                          <button
                            onClick={() => handleAddLorebookFromAttachment(selectedAttachment)}
                            className="px-3 py-1.5 rounded-xl bg-cyan-700 hover:bg-cyan-600 text-white text-xs font-semibold flex items-center gap-1 transition-colors"
                            title="Внести знания и факты из документа в Лорбук мира"
                          >
                            <BookOpen className="w-3 h-3" />
                            <span>Внести в Лорбук</span>
                          </button>
                        )}
                        <button
                          onClick={() => {
                            if (selectedAttachment.textPreview) {
                              onInjectSceneText(selectedAttachment.textPreview.slice(0, 1000));
                              sound.playAction("magic");
                              alert("Фрагмент документа добавлен в текст текущей главы!");
                            }
                          }}
                          className="px-3 py-1.5 rounded-xl bg-amber-700 hover:bg-amber-600 text-white text-xs font-semibold flex items-center gap-1 transition-colors"
                          title="Вставить фрагмент текста документа в повесть"
                        >
                          <Edit3 className="w-3 h-3" />
                          <span>Вставить в главу</span>
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                {/* AI Analysis and Narrative Injection Card */}
                <div className="p-4 rounded-2xl bg-neutral-950 border border-purple-900/50 space-y-3">
                  <div className="flex items-center justify-between border-b border-neutral-850 pb-2">
                    <span className="text-xs font-bold text-purple-300 flex items-center gap-1.5">
                      <Sparkles className="w-4 h-4 text-purple-400" />
                      ИИ-Анализ & Сценарное применение файла:
                    </span>
                    <button
                      onClick={() => triggerAiAnalysis(selectedAttachment)}
                      disabled={isAnalyzing}
                      className="px-2.5 py-1 rounded-lg bg-neutral-900 hover:bg-neutral-800 text-[11px] text-purple-300 font-semibold flex items-center gap-1"
                    >
                      {isAnalyzing ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />}
                      <span>Переанализировать</span>
                    </button>
                  </div>

                  {isAnalyzing ? (
                    <div className="p-4 text-center text-xs text-neutral-400 flex items-center justify-center gap-2">
                      <Loader2 className="w-4 h-4 animate-spin text-purple-400" />
                      <span>ИИ анализирует детали изображения, аудиозаписи или текста...</span>
                    </div>
                  ) : analysisResult ? (
                    <div className="space-y-2.5 text-xs">
                      <p className="text-neutral-300 font-medium">
                        {analysisResult.analysisSummary}
                      </p>

                      {analysisResult.poseDescription && (
                        <div className="p-2.5 rounded-xl bg-neutral-900 border border-neutral-850 text-[11px]">
                          <span className="text-purple-300 font-bold block mb-0.5">Описанная поза / ракурс:</span>
                          <span className="text-neutral-300">{analysisResult.poseDescription}</span>
                        </div>
                      )}

                      {analysisResult.voiceDescriptors && (
                        <div className="p-2.5 rounded-xl bg-neutral-900 border border-neutral-850 text-[11px]">
                          <span className="text-amber-300 font-bold block mb-0.5">Голосовые характеристики:</span>
                          <span className="text-neutral-300">
                            Тембр: {analysisResult.voiceDescriptors.timbre} | Высота: {analysisResult.voiceDescriptors.pitch}x | Скорость: {analysisResult.voiceDescriptors.rate}x
                          </span>
                        </div>
                      )}

                      {/* Lorebook Candidate Card */}
                      {analysisResult.lorebookCandidate && onAddLorebookEntry && (
                        <div className="p-3 rounded-xl bg-cyan-950/40 border border-cyan-800/60 space-y-1.5">
                          <span className="text-[11px] font-bold text-cyan-300 block">
                            Кандидат для добавления в Лорбук: «{analysisResult.lorebookCandidate.title}»
                          </span>
                          <p className="text-[11px] text-cyan-100/90 leading-relaxed">
                            {analysisResult.lorebookCandidate.description}
                          </p>
                          <div className="flex justify-end pt-1">
                            <button
                              onClick={() => {
                                handleAddLorebookFromAttachment(selectedAttachment);
                              }}
                              className="px-3 py-1 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-bold flex items-center gap-1 shadow-md"
                            >
                              <BookOpen className="w-3 h-3" />
                              <span>Внести в базу знаний</span>
                            </button>
                          </div>
                        </div>
                      )}

                      {/* Ready-to-inject literary narrative */}
                      {analysisResult.narrativeParagraph && (
                        <div className="p-3 rounded-xl bg-neutral-900/90 border border-amber-800/60 space-y-2">
                          <span className="text-[11px] font-bold text-amber-300 block">
                            Готовый художественный абзац для вставки в главу:
                          </span>
                          <p className="text-neutral-200 italic leading-relaxed text-[11px]">
                            «{analysisResult.narrativeParagraph}»
                          </p>
                          <div className="flex justify-end gap-2 pt-1">
                            <button
                              onClick={() => {
                                sound.playAction("magic");
                                onInjectSceneText(analysisResult.narrativeParagraph);
                                alert("Абзац успешно внедрен в текст главы!");
                              }}
                              className="px-3 py-1 rounded-lg bg-amber-600 hover:bg-amber-500 text-white text-xs font-bold flex items-center gap-1 shadow-md"
                            >
                              <Edit3 className="w-3 h-3" />
                              <span>Вставить в главу</span>
                            </button>
                            {analysisResult.suggestedAction && (
                              <button
                                onClick={() => {
                                  sound.playClick();
                                  onExecuteAction(analysisResult.suggestedAction);
                                  onClose();
                                }}
                                className="px-3 py-1 rounded-lg bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold flex items-center gap-1 shadow-md"
                              >
                                <span>Сделать ходом</span>
                              </button>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  ) : (
                    <p className="text-[11px] text-neutral-500 italic">
                      Нажмите «Переанализировать», чтобы ИИ описал позу, голос или сюжетные детали этого файла.
                    </p>
                  )}
                </div>
              </div>
            ) : (
              <div className="h-full flex flex-col items-center justify-center p-8 text-center text-neutral-500 space-y-2">
                <Plus className="w-10 h-10 text-neutral-700 stroke-1" />
                <h3 className="text-sm font-bold text-neutral-400">Выберите файл слева или загрузите новый</h3>
                <p className="text-xs text-neutral-600 max-w-sm">
                  Поддерживаются фото поз и сцен, аудиозаписи голосов, видео раскадровок, а также тексты любого размера и формата.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
