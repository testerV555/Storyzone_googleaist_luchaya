import express from "express";
import path from "path";
import fs from "fs";
import crypto from "crypto";
import { createServer as createViteServer } from "vite";
import dotenv from "dotenv";
import { GoogleGenAI } from "@google/genai";

dotenv.config();

const app = express();
const PORT = 3000;

app.use(express.json({ limit: "35mb" }));

// Persistent Cloud Sync File Storage
const CLOUD_STORAGE_FILE = path.join(process.cwd(), "data", "cloud_sync_storage.json");

interface CloudAccountRecord {
  accountKey: string;
  shortCode: string;
  lastSyncedAt: number;
  stories: Record<string, any>;
}

interface CloudStorageDb {
  accounts: Record<string, CloudAccountRecord>;
}

function loadCloudStorageDb(): CloudStorageDb {
  try {
    if (fs.existsSync(CLOUD_STORAGE_FILE)) {
      const data = fs.readFileSync(CLOUD_STORAGE_FILE, "utf-8");
      const parsed = JSON.parse(data);
      if (parsed && typeof parsed.accounts === "object") {
        return parsed;
      }
    }
  } catch (e) {
    console.warn("Could not read cloud storage DB file, initializing empty:", e);
  }
  return { accounts: {} };
}

function saveCloudStorageDb(db: CloudStorageDb) {
  try {
    const dir = path.dirname(CLOUD_STORAGE_FILE);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(CLOUD_STORAGE_FILE, JSON.stringify(db, null, 2), "utf-8");
  } catch (e) {
    console.error("Failed to write cloud storage DB file:", e);
  }
}

// Helper: generate 6-character memorable sync PIN (e.g. "SZ-9284")
function generateShortSyncCode(seedStr: string): string {
  let hash = 0;
  for (let i = 0; i < seedStr.length; i++) {
    hash = (hash << 5) - hash + seedStr.charCodeAt(i);
    hash |= 0;
  }
  const num = Math.abs(hash) % 9000 + 1000;
  return `SZ-${num}`;
}

// Helper to get GoogleGenAI client with fallback to custom user key
function getGeminiClient(customKey?: string): GoogleGenAI | null {
  const apiKey = customKey || process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === "MY_GEMINI_API_KEY") {
    return null;
  }
  return new GoogleGenAI({ apiKey });
}

export const DEFAULT_AI_SYSTEM_PROMPT = `Ты — беспристрастный ведущий и живой литературный соавтор интерактивной повести в StoryZone.

СТРОЖАЙШИЕ ЗАКОНЫ ПОВЕДЕНИЯ И ЛОГИКИ:
1. АБСОЛЮТНЫЙ ЗАПРЕТ ШАБЛОННЫХ И ОДНОТИПНЫХ ОТВЕТОВ:
   • Категорически запрещено использовать заезженные штампы (например: «Воздух вокруг сгущается», «Тени вокруг замирают», «Каждый звук отдаётся резонансом», «Вы чувствуете прилив чистой решимости»).
   • Категорически запрещено механически цитировать выбор игрока в кавычках («Вы решаете: "..."»). Никаких цитат и шаблонных префиксов!
   • Каждое действие игрока воплощается немедленно в первом же предложении через осязаемые поступки, реальные слова, изменения обстановки и динамику сюжета.

2. ДИНАМИЧЕСКИЕ И ЧЕСТНЫЕ ОТНОШЕНИЯ (ЗАПРЕТ НАВЯЗЫВАНИЯ НЕПРИЯЗНИ):
   • Запрещено искусственно удерживать персонажа в шаблонной враждебности, недоверии или холоде, игнорируя контекст.
   • Если глава была отредактирована автором, если лорбук обновлён или игрок совершил поступок в сторону помощи, защиты, союза или щедрости — отношение персонажа ОБЯЗАНО немедленно и органично теплеть.
   • Персонажи способны замечать добро, признавать авторитет, прощать разногласия и становиться верными союзниками без искусственного занудства.

3. ЗАПРЕТ ВСЕВЕДЕНИЯ И ЗНАНИЙ О БУДУЩЕМ (АНТИ-МЕТАГЕЙМИНГ):
   • Ни персонажи, ни повествователь НЕ ЗНАЮТ будущего, скрытых мыслей других людей и событий, которые ещё не произошли.
   • СТРОГОЕ ПРАВИЛО ИМЁН: Если персонаж незнаком герою, категорически запрещено называть его по личному имени до тех пор, пока он сам не представится вслух в диалоге! До этого момента используй статус, внешность или одежду («бедуин», «незнакомец в тюрбане», «раненый всадник», «молчаливый проводник»).

4. СВЯТОСТЬ ПРАВОК И СКВОЗНАЯ ПАМЯТЬ ЗА ВСЕ 10-15+ ГЛАВ:
   • Всё, что написано или отредактировано в предыдущих главах и текущей сцене — это нерушимый живой канон.
   • Персонажи помнят все совместные испытания, клятвы и события за последние 10-15 глав, не страдая амнезией.
   • Если автор отредактировал главу или сцену, сюжет развивается строго от нового состояния, никогда не возвращаясь к отменённым событиям.`;

export interface GeminiRunResult {
  text: string;
  groundingSources?: { title: string; url: string }[];
  searchQueries?: string[];
}

// Resilient generateContent runner with Google Search Grounding support, fallback models, and timeout
async function runGeminiWithSearchFallback(
  promptOrContents: any,
  systemInstruction?: string,
  jsonMode: boolean = true,
  customKey?: string,
  useSearchGrounding: boolean = false
): Promise<GeminiRunResult> {
  const ai = getGeminiClient(customKey);
  if (!ai) {
    throw new Error("NO_API_KEY");
  }

  // Only gemini-3.8-flash supports googleSearch tool. Non-search models shouldn't be called with tools
  const modelsToTry = useSearchGrounding
    ? [
        "gemini-3.8-flash",
      ]
    : [
        "gemini-3.5-flash-lite",
        "gemini-3.1-flash-lite",
        "gemini-3.8-flash",
        "gemini-flash-latest",
      ];
  const TIMEOUT_MS = useSearchGrounding ? 12000 : 15000; // 12-15s timeout per attempt to eliminate UI freezes

  for (const modelName of modelsToTry) {
    try {
      const config: any = {};
      if (useSearchGrounding) {
        config.tools = [{ googleSearch: {} }];
      }
      if (jsonMode) {
        config.responseMimeType = "application/json";
      }
      if (systemInstruction) {
        config.systemInstruction = systemInstruction;
      }

      const generatePromise = ai.models.generateContent({
        model: modelName,
        contents: promptOrContents,
        config,
      });

      const timeoutPromise = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error(`Timeout after ${TIMEOUT_MS}ms`)), TIMEOUT_MS)
      );

      const res = (await Promise.race([generatePromise, timeoutPromise])) as any;

      if (res && res.text) {
        let text = res.text.trim();
        // Clean markdown backticks if returned in text
        if (text.startsWith("```json")) {
          text = text.replace(/^```json\s*/i, "").replace(/\s*```$/, "");
        } else if (text.startsWith("```")) {
          text = text.replace(/^```\s*/, "").replace(/\s*```$/, "");
        }
        if (jsonMode) {
          JSON.parse(text); // validate that it parses before returning
        }

        // Extract Search Grounding metadata
        const groundingSources: { title: string; url: string }[] = [];
        const searchQueries: string[] = [];

        const candidate = res.candidates?.[0];
        const groundingMetadata = candidate?.groundingMetadata;

        if (groundingMetadata) {
          if (Array.isArray(groundingMetadata.webSearchQueries)) {
            searchQueries.push(...groundingMetadata.webSearchQueries);
          }
          if (Array.isArray(groundingMetadata.groundingChunks)) {
            for (const chunk of groundingMetadata.groundingChunks) {
              if (chunk.web?.uri) {
                groundingSources.push({
                  title: chunk.web.title || chunk.web.uri,
                  url: chunk.web.uri,
                });
              }
            }
          }
        }

        return {
          text,
          groundingSources: groundingSources.length > 0 ? groundingSources : undefined,
          searchQueries: searchQueries.length > 0 ? searchQueries : undefined,
        };
      }
    } catch (err: any) {
      console.warn(`Model ${modelName} attempt failed (search=${useSearchGrounding}):`, err?.message || err);

      // If failed with responseMimeType + tools combination, retry this model once with explicit JSON instructions in prompt
      if (useSearchGrounding && jsonMode && (err?.message?.includes?.("mime") || err?.message?.includes?.("tool") || err?.status === 400)) {
        try {
          const retryGenPromise = ai.models.generateContent({
            model: modelName,
            contents: promptOrContents,
            config: {
              tools: [{ googleSearch: {} }],
              systemInstruction:
                (systemInstruction || "") +
                "\nВАЖНО: Верни ответ СТРОГО в виде валидного JSON-объекта, без какого-либо вступительного или заключительного текста.",
            },
          });
          const retryTimeoutPromise = new Promise<never>((_, reject) =>
            setTimeout(() => reject(new Error("Retry timeout")), 15000)
          );
          const res = (await Promise.race([retryGenPromise, retryTimeoutPromise])) as any;

          if (res && res.text) {
            let text = res.text.trim();
            if (text.startsWith("```json")) {
              text = text.replace(/^```json\s*/i, "").replace(/\s*```$/, "");
            } else if (text.startsWith("```")) {
              text = text.replace(/^```\s*/, "").replace(/\s*```$/, "");
            }
            JSON.parse(text);

            const groundingSources: { title: string; url: string }[] = [];
            const candidate = res.candidates?.[0];
            const groundingMetadata = candidate?.groundingMetadata;

            if (groundingMetadata?.groundingChunks) {
              for (const chunk of groundingMetadata.groundingChunks) {
                if (chunk.web?.uri) {
                  groundingSources.push({
                    title: chunk.web.title || chunk.web.uri,
                    url: chunk.web.uri,
                  });
                }
              }
            }

            return {
              text,
              groundingSources: groundingSources.length > 0 ? groundingSources : undefined,
              searchQueries: groundingMetadata?.webSearchQueries,
            };
          }
        } catch (innerErr) {
          // continue fallback
        }
      }
    }
  }

  // If search grounding was attempted but all search attempts failed (e.g. quota 429 on Search tool),
  // automatically fall back to pure text models WITHOUT search tools to guarantee generation NEVER breaks!
  if (useSearchGrounding) {
    console.warn("Search grounding models failed. Falling back to non-search generation models...");
    return runGeminiWithSearchFallback(
      promptOrContents,
      systemInstruction,
      jsonMode,
      customKey,
      false
    );
  }

  throw new Error("ALL_MODELS_FAILED");
}

async function runGeminiWithFallback(
  promptOrContents: any,
  systemInstruction?: string,
  jsonMode: boolean = true,
  customKey?: string
): Promise<string> {
  const result = await runGeminiWithSearchFallback(
    promptOrContents,
    systemInstruction,
    jsonMode,
    customKey,
    false
  );
  return result.text;
}

// 1. Health & Connection Test Endpoint
app.get("/api/health", async (req, res) => {
  const customKey = req.headers["x-custom-api-key"] as string | undefined;
  const hasEnvKey = !!process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY !== "MY_GEMINI_API_KEY";
  const hasCustomKey = !!customKey && customKey.trim().length > 10;
  const aiEnabled = hasEnvKey || hasCustomKey;

  res.json({
    status: "ok",
    aiEnabled,
    model: "gemini-3.5-flash-lite (с авто-переходом на gemini-3.1-flash-lite)",
    hasCustomKey,
  });
});

// 2. Test API Connection directly
app.post("/api/ai/test-connection", async (req, res) => {
  try {
    const { customKey } = req.body;
    const ai = getGeminiClient(customKey);
    if (!ai) {
      return res.json({
        ok: false,
        error: "API ключ не настроен. Используется встроенный автономный генератор.",
      });
    }

    const testText = await runGeminiWithFallback(
      "Ответь одним словом: 'Готов'.",
      undefined,
      false,
      customKey
    );

    res.json({
      ok: true,
      model: "gemini-3.5-flash-lite",
      response: testText.trim() || "Подключение успешно",
    });
  } catch (e: any) {
    res.json({
      ok: false,
      error: e.message || "Ошибка подключения к Gemini API",
    });
  }
});

// 3. Photo Analysis for Character Appearance (Multimodal Vision!)
app.post("/api/ai/analyze-photo", async (req, res) => {
  try {
    const { imageBase64, mimeType, customKey, genre } = req.body;
    const ai = getGeminiClient(customKey);

    if (!ai || !imageBase64) {
      // Procedural fallback character based on genre
      return res.json({
        name: "Элиан",
        role: "Таинственный странник",
        appearanceDescription: "Внимательный взгляд серых глаз, тёмный дорожный плащ с капюшоном, скрывающий черты лица, и серебряный знак на воротнике.",
        temperament: "флегматик",
        traits: ["Наблюдательный", "Хладнокровный", "Сдержанный"],
        habits: ["Оглядывается перед входом", "Говорит негромко"],
        speechStyle: "Спокойный, вежливый, взвешенный",
        bio: "Человек сложной судьбы, чьё прошлое окутано плотной завесой тайн.",
      });
    }

    // Clean base64 header if present
    const cleanBase64 = imageBase64.replace(/^data:image\/\w+;base64,/, "");

    const prompt = `Ты — эксперт по визуальному анализу персонажей в интерактивной литературе и RPG.
Внимательно изучи приложенное изображение персонажа/арта/фотографии.
Контекст жанра: ${genre || "Фэнтези / Приключения"}.

Проанализируй внешность, мимику, одежду, цветовую гамму, артефакты и настроение на изображении.
На основе анализа создай глубокий профиль персонажа на русском языке.

Верни строго JSON со следующими полями:
{
  "name": "Подходящее звучное имя",
  "role": "Роль/класс персонажа (например: Маг теней, Капитан наёмников, Опытный детектив)",
  "appearanceDescription": "Художественное подробное описание внешности (лицо, волосы, глаза, одежда, детали, особенности)",
  "temperament": "холерик|сангвиник|флегматик|меланхолик",
  "traits": ["Черта 1", "Черта 2", "Черта 3"],
  "habits": ["Привычка 1 (например: поправляет воротник при задумчивости)", "Привычка 2"],
  "speechStyle": "Описание манеры речи (например: тихий голос с лёгкой насмешкой)",
  "secret": "Возможная тайна или скрытый мотив",
  "bio": "Интригующая предыстория персонажа (2-3 предложения)"
}`;

    const contents = [
      {
        role: "user",
        parts: [
          {
            inlineData: {
              mimeType: mimeType || "image/jpeg",
              data: cleanBase64,
            },
          },
          { text: prompt },
        ],
      },
    ];

    const responseText = await runGeminiWithFallback(contents, undefined, true, customKey);
    const parsed = JSON.parse(responseText);
    res.json(parsed);
  } catch (error: any) {
    console.error("Photo analysis error:", error);
    res.json({
      name: "Рейн",
      role: "Странник",
      appearanceDescription: "Выразительный взгляд, строгий силуэт, практичное дорожное одеяние с металлическими пряжками.",
      temperament: "сангвиник",
      traits: ["Решительный", "Остроумный", "Преданный"],
      habits: ["Привык оценивать пути отхода", "Улыбается в опасные моменты"],
      speechStyle: "Уверенный и ироничный",
      bio: "Опытный боец и верный попутчик, повидавший множество миров.",
    });
  }
});

// 3.5. Deep Literary Premise Generator (Original Story from User's Prompt, Theme & Vision)
app.post("/api/story/generate-premise", async (req, res) => {
  try {
    const { genre, theme, protagonist, customKey, aiSystemPrompt: clientSystemPrompt } = req.body;
    const ai = getGeminiClient(customKey);
    const aiSystemPrompt = (clientSystemPrompt || "").trim() || DEFAULT_AI_SYSTEM_PROMPT;

    const prompt = `Ты — выдающийся писатель и нарративный дизайнер интерактивных литературных романов.
Пользователь обратился с идеей создать глубокую, не поверхностную, психологически выверенную и атмосферную историю.

ВХОДНЫЕ ДАННЫЕ ОТ ПОЛЬЗОВАТЕЛЯ:
- Жанр: "${genre || "Фэнтези"}"
- Замысел / Идея / Пожелания пользователя: "${theme || "Глубокая психологическая драма с неожиданной тайной"}"
- Протагонист (кем играет пользователь): "${protagonist || "Сложный, многогранный персонаж со своим прошлым"}"

КРИТИЧЕСКИЕ ТРЕБОВАНИЯ:
1. НИКАКИХ ПОВЕРХНОСТНЫХ ШТАМПОВ И ШАБЛОНОВ. Внимательно вчитайся в каждое слово пользователя и положи именно его идею в основу сюжета, конфликта и атмосферы.
2. Это ЛИТЕРАТУРНОЕ ПРОИЗВЕДЕНИЕ (интерактивная книга/новелла), а НЕ аркадная игра. Слог должен быть богатым, кинематографичным, с осязаемыми сенсорными деталями (звуки, запахи, игра света, внутреннее состояние).
3. Первая сцена (firstScene) должна состоять из 3-5 глубоких, захватывающих художественных абзацев на русском языке, которые сразу бросают читателя в эпицентр личной драмы, тайны или интриги.
4. Персонажи должны быть живыми людьми с собственными тайными мотивами, слабостями, уникальным тембром голоса и противоречиями, а не картонными NPC.
5. Выборы должны быть моральными, смысловыми и сюжетными развилками характера (а не просто «атаковать/защищаться»).

Верни строго JSON со следующей структурой:
{
  "title": "Звучное, поэтичное и запоминающееся название истории",
  "synopsis": "Глубокий синопсис завязки и центрального конфликта (3-4 предложения)",
  "firstScene": "Художественный текст первой главы (3-5 выразительных абзацев с диалогами, сенсорикой и атмосферой)",
  "atmosphere": "mysterious|dark|action|romantic|triumphant|calm",
  "characters": [
    {
      "name": "Имя спутника или ключевой фигуры",
      "role": "Роль и личное отношение к протагонисту",
      "affinity": 50,
      "affinityTitle": "Настороженное знакомство",
      "temperament": "холерик|сангвиник|флегматик|меланхолик",
      "traits": ["Уникальная черта 1", "Черта 2", "Черта 3"],
      "habits": ["Живая человеческая привычка или жест"],
      "speechStyle": "Характерная манера речи и интонации",
      "secret": "Личная тайна или скрытая цель персонажа",
      "bio": "Интригующая предыстория и почему этот персонаж важен для сюжета",
      "avatar": "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=400"
    }
  ],
  "startingInventory": ["Памятная личная вещь протагониста", "Снаряжение или артефакт с историей", "Записка или улика"],
  "starterChoices": [
    {
      "id": "1",
      "label": "Смелое эмоциональное или решительное действие",
      "description": "Сюжетный мотив и что стоит на кону"
    },
    {
      "id": "2",
      "label": "Психологический подход: диалог, наблюдение или дипломатия",
      "description": "Попытка раскрыть чужие мотивы или смягчить обстановку"
    },
    {
      "id": "3",
      "label": "Нестандартный скрытный или расчётливый маневр",
      "description": "Поиск неочевидного решения или сокрытие своих карт"
    }
  ]
}`;

    if (!ai) {
      return res.json({
        title: `Тени прошлого: ${theme.slice(0, 30) || "Судьба"}`,
        synopsis: `В мире, где каждое решение оставляет неизгладимый след, вы ступаете на путь, где грань между долгом и истиной становится призрачной. ${theme}`,
        firstScene: `Тяжёлые сумерки опускаются на землю, окутывая старинные каменные своды холодным туманом. Вы останавливаетесь, переводя дух: эхо недавних потрясений всё ещё звучит в ушах, а в воздухе отчётливо чувствуется запах дождя и жжёной полыни.\n\nКаждый прожитый миг вёл вас именно сюда. В кармане плаща глухо постукивает старая реликвия, хранящая тепло ваших пальцев. Рядом слышатся осторожные шаги — ваш спутник замирает в полумраке, не решаясь нарушить напряжённую тишину первым.\n\n«Ты уверен, что мы должны продолжать?» — негромко звучит вопрос, в котором сквозит не страх, а горькое понимание неизбежного. Вы смотрите вперёд, где сквозь редеющий морок проступают очертания забытой развилки. Время для сомнений истекло: судьба требует ответа.`,
        atmosphere: "mysterious",
        characters: [
          {
            name: "Элис",
            role: "Спутница со сложным прошлым",
            affinity: 50,
            affinityTitle: "Настороженность",
            temperament: "флегматик",
            traits: ["Проницательная", "Сдержанная", "Верная слову"],
            habits: ["Прислушивается к малейшим паузам в разговоре"],
            speechStyle: "Тихий, размеренный голос с лёгкой грустью",
            secret: "Знает больше о вашей истинной роли, чем говорит вслух",
            bio: "Странствует рядом не ради выгоды, а чтобы расплатиться с давним долгом совести.",
            avatar: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=400",
          },
        ],
        startingInventory: ["Старинный памятный медальон", "Походный дневник с заметками", "Дорожный плащ"],
        starterChoices: [
          { id: "1", label: "Шагнуть вперёд и сделать первый решительный ход", description: "Взять инициативу на себя, невзирая на риск" },
          { id: "2", label: "Остановиться и откровенно заговорить со спутницей", description: "Вскрыть недосказанность и понять её истинные намерения" },
          { id: "3", label: "Внимательно изучить скрытые знаки на развилке", description: "Попытаться разгадать, какую ловушку приготовило это место" },
        ],
      });
    }

    const text = await runGeminiWithFallback(prompt, aiSystemPrompt, true, customKey);
    const parsed = JSON.parse(text);
    res.json(parsed);
  } catch (error: any) {
    console.warn("Premise generation fallback used:", error?.message);
    const theme = req.body.theme || "Судьба";
    res.json({
      title: `Тени прошлого: ${theme.slice(0, 30)}`,
      synopsis: `В мире, где каждое решение оставляет неизгладимый след, вы ступаете на путь, где грань между долгом и истиной становится призрачной. ${theme}`,
      firstScene: `Тяжёлые сумерки опускаются на землю, окутывая старинные каменные своды холодным туманом. Вы останавливаетесь, переводя дух: эхо недавних потрясений всё ещё звучит в ушах, а в воздухе отчётливо чувствуется запах дождя и жжёной полыни.\n\nКаждый прожитый миг вёл вас именно сюда. В кармане плаща глухо постукивает старая реликвия, хранящая тепло ваших пальцев. Рядом слышатся осторожные шаги — ваш спутник замирает в полумраке, не решаясь нарушить напряжённую тишину первым.\n\n«Ты уверен, что мы должны продолжать?» — негромко звучит вопрос, в котором сквозит не страх, а горькое понимание неизбежного. Вы смотрите вперёд, где сквозь редеющий морок проступают очертания забытой развилки. Время для сомнений истекло: судьба требует ответа.`,
      atmosphere: "mysterious",
      characters: [
        {
          name: "Элис",
          role: "Спутница со сложным прошлым",
          affinity: 50,
          affinityTitle: "Настороженность",
          temperament: "флегматик",
          traits: ["Проницательная", "Сдержанная", "Верная слову"],
          habits: ["Прислушивается к малейшим паузам в разговоре"],
          speechStyle: "Тихий, размеренный голос с лёгкой грустью",
          secret: "Знает больше о вашей истинной роли, чем говорит вслух",
          bio: "Странствует рядом не ради выгоды, а чтобы расплатиться с давним долгом совести.",
          avatar: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=400",
        },
      ],
      startingInventory: ["Старинный памятный медальон", "Походный дневник с заметками", "Дорожный плащ"],
      starterChoices: [
        { id: "1", label: "Шагнуть вперёд и сделать первый решительный ход", description: "Взять инициативу на себя, невзирая на риск" },
        { id: "2", label: "Остановиться и откровенно заговорить со спутницей", description: "Вскрыть недосказанность и понять её истинные намерения" },
        { id: "3", label: "Внимательно изучить скрытые знаки на развилке", description: "Попытаться разгадать, какую ловушку приготовило это место" },
      ],
    });
  }
});

// 4. Cultural Universe & Fandom Premise Generator (Anime, Books, Movies, Fanfics)
app.post("/api/story/fandom-premise", async (req, res) => {
  try {
    const { fandomName, userPrompt, customKey, aiSystemPrompt: clientSystemPrompt } = req.body;
    const ai = getGeminiClient(customKey);
    const aiSystemPrompt = (clientSystemPrompt || "").trim() || DEFAULT_AI_SYSTEM_PROMPT;

    const prompt = `Ты — мастер адаптаций мировой литературы, кино и аниме в глубокие интерактивные романы.
Пользователь выбрал вселенную: "${fandomName}".
ТОЧНЫЕ ПОЖЕЛАНИЯ И ИДЕЯ ПОЛЬЗОВАТЕЛЯ: "${userPrompt || "Глубокая психологическая история с уважением к канону"}".

КРИТИЧЕСКИЕ ТРЕБОВАНИЯ:
1. Никаких шаблонных отписок. Максимально чутко учти ВСЕ детали из запроса пользователя ("${userPrompt}").
2. Текст должен читаться как высококлассная художественная книга или ранобэ, а не аркадная игра.
3. Начальная сцена (startingScene) должна быть объёмной (3-5 богатых абзацев на русском языке), погружающей в эстетику, запахи, диалоги и дух мира "${fandomName}".
4. Персонажи должны говорить и действовать СТРОГО в своём каноничном характере.
5. Выборы должны быть органичными решениями героя в разворачивающемся сюжете.

Верни строго JSON:
{
  "title": "Интригующее художественное название",
  "genre": "Фэнтези|Киберпанк|Тёмная романтика|Мистика и детектив|Постапокалипсис|Аниме и исекай|Космоопера|Фанфики",
  "synopsis": "Захватывающий синопсис завязки (2-3 предложения)",
  "startingScene": "Красивая литературная сцена (3-5 выразительных абзацев с живыми диалогами и погружением)",
  "characters": [
    {
      "name": "Имя каноничного героя или спутника",
      "role": "Его роль и отношение к вам",
      "affinity": 50,
      "affinityTitle": "Знакомый",
      "temperament": "холерик|сангвиник|флегматик|меланхолик",
      "traits": ["Каноничная черта 1", "Черта 2", "Черта 3"],
      "habits": ["Каноничный жест или привычка"],
      "speechStyle": "Узнаваемый стиль речи персонажа",
      "bio": "Его текущее положение в мире и личный мотив",
      "avatar": "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=400"
    }
  ],
  "startingInventory": ["Каноничный предмет мира 1", "Личная вещь", "Ключ или свиток"],
  "starterChoices": [
    { "id": "1", "label": "Смелое сюжетное действие", "description": "Пояснение" },
    { "id": "2", "label": "Диалог или дипломатический ход", "description": "Пояснение" },
    { "id": "3", "label": "Неожиданный тактический или психологический ход", "description": "Пояснение" }
  ],
  "loreFacts": [
    { "title": "Ключевое правило этого мира", "description": "Закон магии, технологии или общественной структуры", "category": "правило_мира" }
  ],
  "atmosphere": "mysterious|action|romantic|dark|triumphant|calm"
}`;

    if (!ai) {
      return res.json({
        title: `${fandomName}: Хроники Нового Пути`,
        genre: "Аниме и исекай",
        synopsis: `Интерактивное приключение по мотивам вселенной «${fandomName}». Ваши решения определят исход знакомых событий.`,
        startingScene: `Воздух дрожит от знакомой энергетики мира «${fandomName}». Вы ступаете на мощёную площадь, ощущая на себе взгляды прохожих. Где-то вдалеке слышен призыв к оружию, а в кармане покоится артефакт, способный изменить расклад сил.`,
        characters: [
          {
            name: "Спутник канона",
            role: "Союзник и наставник",
            affinity: 50,
            affinityTitle: "Нейтрален",
            temperament: "сангвиник",
            traits: ["Верный", "Находчивый", "Смелый"],
            habits: ["Проверяет снаряжение"],
            speechStyle: "Прямой и решительный",
            bio: "Один из ключевых обитателей этого мира.",
            avatar: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=400",
          },
        ],
        startingInventory: ["Эликсир исцеления", "Знак фракции", "Проверенный клинок"],
        starterChoices: [
          { id: "1", label: "Направиться к главной цитадели", description: "Узнать последние новости и найти союзников" },
          { id: "2", label: "Проверить окружение в тени", description: "Убедиться, что за вами нет слежки" },
          { id: "3", label: "Заговорить со спутником", description: "Обсудить дальнейший план действий" },
        ],
        loreFacts: [
          { title: "Законы вселенной", description: `Мир ${fandomName} полон скрытых опасностей и древних тайн.`, category: "правило_мира" },
        ],
        atmosphere: "mysterious",
      });
    }

    const text = await runGeminiWithFallback(prompt, aiSystemPrompt, true, customKey);
    const parsed = JSON.parse(text);
    res.json(parsed);
  } catch (error: any) {
    console.warn("Fandom premise fallback used:", error?.message);
    const fandomName = req.body.fandomName || "Вселенная";
    res.json({
      title: `${fandomName}: Хроники Нового Пути`,
      genre: "Аниме и исекай",
      synopsis: `Интерактивное приключение по мотивам вселенной «${fandomName}». Ваши решения определят исход знакомых событий.`,
      startingScene: `Воздух дрожит от знакомой энергетики мира «${fandomName}». Вы ступаете на мощёную площадь, ощущая на себе взгляды прохожих. Где-то вдалеке слышен призыв к оружию, а в кармане покоится артефакт, способный изменить расклад сил.`,
      characters: [
        {
          name: "Спутник канона",
          role: "Союзник и наставник",
          affinity: 50,
          affinityTitle: "Нейтрален",
          temperament: "сангвиник",
          traits: ["Верный", "Находчивый", "Смелый"],
          habits: ["Проверяет снаряжение"],
          speechStyle: "Прямой и решительный",
          bio: "Один из ключевых обитателей этого мира.",
          avatar: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=400",
        },
      ],
      startingInventory: ["Эликсир исцеления", "Знак фракции", "Проверенный клинок"],
      starterChoices: [
        { id: "1", label: "Направиться к главной цитадели", description: "Узнать последние новости и найти союзников" },
        { id: "2", label: "Проверить окружение в тени", description: "Убедиться, что за вами нет слежки" },
        { id: "3", label: "Заговорить со спутником", description: "Обсудить дальнейший план действий" },
      ],
      loreFacts: [
        { title: "Законы вселенной", description: `Мир ${fandomName} полон скрытых опасностей и древних тайн.`, category: "правило_мира" },
      ],
      atmosphere: "mysterious",
    });
  }
});

// ==============================================================================
// 4.5. CONTEXT SUMMARIZATION SERVICE: NARRATIVE CONTINUITY & CHARACTER CONSISTENCY
// ==============================================================================
interface ContextSummarizationParams {
  storyTitle: string;
  genre: string;
  currentScene: string;
  characters: any[];
  history: any[];
  memoryChapters?: any[];
  lorebook?: any[];
  action?: string;
  narrativeStyle?: string;
  customKey?: string;
}

async function generateNarrativeContextSummary(params: ContextSummarizationParams): Promise<string> {
  const safeCharacters = Array.isArray(params.characters) ? params.characters : [];
  const safeHistory = Array.isArray(params.history) ? params.history : [];

  if (safeHistory.length === 0) {
    const charsList = safeCharacters
      .map((c: any) => `${c.name} (${c.role || "спутник"}): отношение ${c.affinity || 50}%`)
      .join("; ");
    return `[ОПЕРАТИВНЫЙ СЦЕНАРНЫЙ КОНТЕКСТ (NARRATIVE CONTEXT)]
• Активный конфликт и цель: Начальная завязка истории «${params.storyTitle || "Повесть"}». Герой делает первые ключевые шаги.
• Психологические якоря спутников: ${charsList || "Герой странствует один."} Характеры стабильны, доверие на базовом уровне.
• Причинно-следственная цепь: Пролог. Прошлых ошибок или разногласий пока нет.
• Физические якоря обстановки: Исходная локация пролога, полное здоровье, стартовые вещи.
• Запрет амнезии: Строго помнить каждое принятое решение с первого же шага.`;
  }

  const recentSteps = safeHistory.slice(-4);
  const stepsSummary = recentSteps
    .map(
      (s: any) =>
        `• Шаг ${s.stepNumber}: Игрок выбрал/написал: «${s.action || "Ход"}». Итог сцены: ${s.sceneText?.slice(0, 180).trim()}...`
    )
    .join("\n");

  const charsSummary = safeCharacters
    .map(
      (c: any) =>
        `• ${c.name} (${c.role}): Отношение ${c.affinity || 50}%. Черты: ${(c.traits || []).join(", ") || "—"}. Статус: ${c.currentStatus || "в отряде"}.`
    )
    .join("\n");

  const prompt = `Ты — Строгий Режиссерский Аналитик Непрерывности (Script Continuity Supervisor).
Твоя задача — составить сверхконцентрированный "Narrative Context" для предотвращения амнезии ИИ, дрейфа характеров (memory drift) и рассинхронизации сюжета.

ИСТОРИЯ: "${params.storyTitle}" (Жанр: ${params.genre})
СВЕЖИЕ ШАГИ ИСТОРИИ:
${stepsSummary}

ТЕКУЩАЯ СЦЕНА:
${params.currentScene.slice(0, 350)}

ДЕЙСТВИЕ ГЕРОЯ СЕЙЧАС:
"${params.action || "Продолжение"}"

ДЕЙСТВУЮЩИЕ СПУТНИКИ:
${charsSummary || "Спутников нет"}

Сформируй лаконичный, плотный аналитический срез (ровно 5 коротких пунктов):
1. АКТИВНЫЙ КОНФЛИКТ И СТАВКИ: В чем конкретно непосредственная опасность, напряжение и текущая цель этой секунды.
2. ПСИХОЛОГИЧЕСКИЕ ЯКОРЯ СПУТНИКОВ: Эмоциональное состояние каждого спутника, их отношение к недавним поступкам героя, что они сейчас чувствуют и о чем помнят.
3. ПРИЧИННО-СЛЕДСТВЕННАЯ ЦЕПЬ: Неразрывный мост от предыдущего шага к текущему действию.
4. ФИЗИЧЕСКИЕ И ТАКТИЧЕСКИЕ ЯКОРЯ: Точное окружение, ранения, звуки, свет, оружие/предметы в руках, исключающие внезапную телепортацию.
5. НЕЗАВЕРШЕННЫЕ ОБЕЩАНИЯ И УГРОЗЫ: Клятвы, долги, ожидаемые опасности.`;

  try {
    const ai = getGeminiClient(params.customKey);
    if (!ai) throw new Error("No client");

    const genPromise = ai.models.generateContent({
      model: "gemini-3.8-flash",
      contents: prompt,
      config: {
        systemInstruction:
          "Ты — литературный супервайзер непрерывности. Пиши емко, строго, на русском языке, без вступительных и заключительных фраз.",
      },
    });

    const timeoutPromise = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error("Timeout")), 7000)
    );

    const res = (await Promise.race([genPromise, timeoutPromise])) as any;
    if (res && res.text) {
      return res.text.trim();
    }
  } catch (err) {
    console.warn("Context summarization fast procedural fallback used:", (err as any)?.message);
  }

  // Fast procedural fallback
  const lastStep = recentSteps[recentSteps.length - 1];
  return `[ОПЕРАТИВНЫЙ СЦЕНАРНЫЙ КОНТЕКСТ (NARRATIVE CONTEXT)]
• Активный конфликт и цель: Непосредственное разрешение действия «${params.action || "Продолжение"}».
• Психология и якоря спутников: ${safeCharacters.map((c: any) => `${c.name} (${c.affinity || 50}%)`).join(", ") || "Один"}. Сохраняют свои голоса, помнят прошлые поступки героя.
• Причинно-следственная цепь: Вытекает напрямую из шага #${lastStep?.stepNumber || 1} («${lastStep?.action || "Предыдущий ход"}»).
• Физические якоря: Сохранять целостность сцены, положения персонажей, освещения и звуков без временных скачков.
• Запрет амнезии: Действие обязано органично развивать текущий момент без сброса накопленного багажа отношений.`;
}

// Endpoint: Explicit Narrative Context Summarization on-demand
app.post("/api/story/narrative-context", async (req, res) => {
  try {
    const { storyTitle, genre, currentScene, characters, history, memoryChapters, lorebook, action, customKey } = req.body;
    const summary = await generateNarrativeContextSummary({
      storyTitle: storyTitle || "История",
      genre: genre || "Фэнтези",
      currentScene: currentScene || "",
      characters: characters || [],
      history: history || [],
      memoryChapters: memoryChapters || [],
      lorebook: lorebook || [],
      action: action || "Анализ контекста",
      customKey,
    });
    res.json({ narrativeContextSummary: summary });
  } catch (e: any) {
    console.error("Narrative context error:", e);
    res.status(500).json({ error: "Failed to generate context summary" });
  }
});

// ==============================================================================
// 4.6. CLOUD ACCOUNT & CROSS-DEVICE STORY SYNCHRONIZATION
// ==============================================================================
app.post("/api/cloud-sync/save", async (req, res) => {
  try {
    const {
      accountKey: rawAccountKey,
      storyId,
      storyTitle,
      storyGenre,
      gameState,
      saves,
      chatHistory,
      deviceType,
    } = req.body;

    if (!gameState || !storyId) {
      return res.status(400).json({ error: "Missing storyId or gameState" });
    }

    const accountKey = (rawAccountKey || "default_user@storyzone.app").trim().toLowerCase();
    const shortCode = generateShortSyncCode(accountKey);
    const db = loadCloudStorageDb();

    if (!db.accounts[accountKey]) {
      db.accounts[accountKey] = {
        accountKey,
        shortCode,
        lastSyncedAt: Date.now(),
        stories: {},
      };
    }

    const storyPayload = {
      storyId,
      storyTitle: storyTitle || gameState.story?.title || "Повесть",
      storyGenre: storyGenre || gameState.story?.genre || "Фэнтези",
      gameState,
      saves: Array.isArray(saves) ? saves : [],
      chatHistory: Array.isArray(chatHistory) ? chatHistory : (gameState.chatHistory || []),
      syncedAt: Date.now(),
      deviceType: deviceType || "Web",
    };

    db.accounts[accountKey].stories[storyId] = storyPayload;
    db.accounts[accountKey].lastSyncedAt = Date.now();
    db.accounts[accountKey].shortCode = shortCode;

    saveCloudStorageDb(db);

    res.json({
      success: true,
      accountKey,
      shortCode,
      storyId,
      syncedAt: storyPayload.syncedAt,
      storiesCount: Object.keys(db.accounts[accountKey].stories).length,
      message: `История «${storyPayload.storyTitle}» успешно сохранена в облаке StoryZone для всех устройств!`,
    });
  } catch (err: any) {
    console.error("Cloud sync save error:", err);
    res.status(500).json({ error: "Failed to save to cloud storage" });
  }
});

app.get("/api/cloud-sync/load", async (req, res) => {
  try {
    const rawKey = (req.query.accountKey as string || "").trim().toLowerCase();
    const shortCode = (req.query.shortCode as string || "").trim().toUpperCase();
    const targetStoryId = req.query.storyId as string | undefined;

    const db = loadCloudStorageDb();

    // Find account by email or short sync code
    let foundAccount: CloudAccountRecord | null = null;
    if (rawKey && db.accounts[rawKey]) {
      foundAccount = db.accounts[rawKey];
    } else if (shortCode) {
      const match = Object.values(db.accounts).find((a) => a.shortCode.toUpperCase() === shortCode);
      if (match) foundAccount = match;
    }

    if (!foundAccount) {
      return res.status(404).json({
        error: "ACCOUNT_NOT_FOUND",
        message: "Аккаунт или код синхронизации не найден в облаке.",
      });
    }

    const storyIds = Object.keys(foundAccount.stories);
    if (storyIds.length === 0) {
      return res.status(404).json({
        error: "NO_STORIES",
        message: "В данном аккаунте пока нет сохраненных историй.",
      });
    }

    const selectedStoryId = targetStoryId && foundAccount.stories[targetStoryId]
      ? targetStoryId
      : storyIds[storyIds.length - 1]; // Latest story by default

    const storyPayload = foundAccount.stories[selectedStoryId];

    res.json({
      success: true,
      accountKey: foundAccount.accountKey,
      shortCode: foundAccount.shortCode,
      lastSyncedAt: foundAccount.lastSyncedAt,
      storyPayload,
      allStories: storyIds.map((id) => ({
        storyId: id,
        storyTitle: foundAccount!.stories[id].storyTitle,
        storyGenre: foundAccount!.stories[id].storyGenre,
        syncedAt: foundAccount!.stories[id].syncedAt,
        stepCount: foundAccount!.stories[id].gameState?.stepCount || 1,
      })),
    });
  } catch (err: any) {
    console.error("Cloud sync load error:", err);
    res.status(500).json({ error: "Failed to load from cloud storage" });
  }
});

app.get("/api/cloud-sync/list", async (req, res) => {
  try {
    const rawKey = (req.query.accountKey as string || "").trim().toLowerCase();
    const shortCode = (req.query.shortCode as string || "").trim().toUpperCase();

    const db = loadCloudStorageDb();
    let foundAccount: CloudAccountRecord | null = null;
    if (rawKey && db.accounts[rawKey]) {
      foundAccount = db.accounts[rawKey];
    } else if (shortCode) {
      const match = Object.values(db.accounts).find((a) => a.shortCode.toUpperCase() === shortCode);
      if (match) foundAccount = match;
    }

    if (!foundAccount) {
      return res.json({ accounts: [], stories: [] });
    }

    const storiesList = Object.values(foundAccount.stories).map((s: any) => ({
      storyId: s.storyId,
      storyTitle: s.storyTitle,
      storyGenre: s.storyGenre,
      syncedAt: s.syncedAt,
      stepCount: s.gameState?.stepCount || 1,
      deviceType: s.deviceType,
    }));

    res.json({
      accountKey: foundAccount.accountKey,
      shortCode: foundAccount.shortCode,
      lastSyncedAt: foundAccount.lastSyncedAt,
      stories: storiesList,
    });
  } catch (err: any) {
    console.error("Cloud sync list error:", err);
    res.status(500).json({ error: "Failed to list cloud stories" });
  }
});

// ==============================================================================
// 4.7. UNIVERSAL USER ACCOUNT & AUTOMATIC CROSS-DEVICE CLOUD SYNCHRONIZATION
// (ПК, Смартфоны, Планшеты: сохранение всего прогресса, соавтора, глав, настроек)
// ==============================================================================
const USER_ACCOUNTS_FILE = path.join(process.cwd(), "data", "storyzone_user_accounts.json");

interface StoryZoneUserAccount {
  id: string;
  username: string;
  email: string;
  passwordHash: string;
  pinCode: string;
  createdAt: number;
  lastLoginAt: number;
  lastSyncedAt: number;
  devices: { deviceId: string; deviceName: string; lastSeen: number }[];
  snapshot: {
    activeGameState: any;
    saves: any[];
    customStories: any[];
    chatHistories: Record<string, any[]>;
    settings: any;
    syncedAt: number;
    stepCount?: number;
    storyTitle?: string;
  };
}

interface AccountsDb {
  users: Record<string, StoryZoneUserAccount>; // keyed by lowercased email
}

function hashPassword(pwd: string): string {
  return crypto.createHash("sha256").update(pwd + "_storyzone_salt").digest("hex");
}

function loadUserAccountsDb(): AccountsDb {
  try {
    if (fs.existsSync(USER_ACCOUNTS_FILE)) {
      const data = fs.readFileSync(USER_ACCOUNTS_FILE, "utf-8");
      const parsed = JSON.parse(data);
      if (parsed && typeof parsed.users === "object") {
        return parsed;
      }
    }
  } catch (e) {
    console.warn("Could not read user accounts DB, creating fresh:", e);
  }
  return { users: {} };
}

function saveUserAccountsDb(db: AccountsDb) {
  try {
    const dir = path.dirname(USER_ACCOUNTS_FILE);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(USER_ACCOUNTS_FILE, JSON.stringify(db, null, 2), "utf-8");
  } catch (e) {
    console.error("Failed to write user accounts DB:", e);
  }
}

// 1. User Registration with Immediate Full Progress Cloud Sync
app.post("/api/account/register", async (req, res) => {
  try {
    const { username, email, password, initialSnapshot, deviceName, deviceId } = req.body;

    if (!email || typeof email !== "string" || !email.includes("@")) {
      return res.status(400).json({ error: "Пожалуйста, введите корректный адрес электронной почты." });
    }
    if (!password || typeof password !== "string" || password.trim().length < 4) {
      return res.status(400).json({ error: "Пароль должен содержать минимум 4 символа." });
    }

    const cleanEmail = email.trim().toLowerCase();
    const cleanUsername = (username && typeof username === "string" && username.trim())
      ? username.trim()
      : cleanEmail.split("@")[0];

    const db = loadUserAccountsDb();

    if (db.users[cleanEmail]) {
      return res.status(400).json({
        error: "Аккаунт с таким email уже зарегистрирован. Пожалуйста, выполните вход.",
      });
    }

    const pinCode = generateShortSyncCode(cleanEmail);
    const userId = `usr_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const now = Date.now();

    const snapshot = initialSnapshot && typeof initialSnapshot === "object"
      ? {
          activeGameState: initialSnapshot.activeGameState || null,
          saves: Array.isArray(initialSnapshot.saves) ? initialSnapshot.saves : [],
          customStories: Array.isArray(initialSnapshot.customStories) ? initialSnapshot.customStories : [],
          chatHistories: initialSnapshot.chatHistories || {},
          settings: initialSnapshot.settings || {},
          syncedAt: now,
          stepCount: initialSnapshot.activeGameState?.stepCount || 1,
          storyTitle: initialSnapshot.activeGameState?.story?.title || "Повесть",
        }
      : {
          activeGameState: null,
          saves: [],
          customStories: [],
          chatHistories: {},
          settings: {},
          syncedAt: now,
          stepCount: 1,
          storyTitle: "",
        };

    const newUser: StoryZoneUserAccount = {
      id: userId,
      username: cleanUsername,
      email: cleanEmail,
      passwordHash: hashPassword(password),
      pinCode,
      createdAt: now,
      lastLoginAt: now,
      lastSyncedAt: now,
      devices: [
        {
          deviceId: deviceId || `dev_${Math.random().toString(36).substring(2, 8)}`,
          deviceName: deviceName || "Браузер / ПК",
          lastSeen: now,
        },
      ],
      snapshot,
    };

    db.users[cleanEmail] = newUser;
    saveUserAccountsDb(db);

    // Also mirror into existing cloud_storage_db for compatibility
    try {
      const legacyDb = loadCloudStorageDb();
      if (!legacyDb.accounts[cleanEmail]) {
        legacyDb.accounts[cleanEmail] = {
          accountKey: cleanEmail,
          shortCode: pinCode,
          lastSyncedAt: now,
          stories: {},
        };
        saveCloudStorageDb(legacyDb);
      }
    } catch (e) {}

    res.json({
      success: true,
      user: {
        id: newUser.id,
        username: newUser.username,
        email: newUser.email,
        pinCode: newUser.pinCode,
        createdAt: newUser.createdAt,
        lastSyncedAt: newUser.lastSyncedAt,
        devicesCount: newUser.devices.length,
      },
      snapshot: newUser.snapshot,
      message: `Учётная запись «${newUser.username}» успешно создана! Все данные и главы синхронизированы в облаке.`,
    });
  } catch (err: any) {
    console.error("Account registration error:", err);
    res.status(500).json({ error: "Ошибка при регистрации учётной записи" });
  }
});

// 2. User Login with Cross-Device Snapshot Retrieval
app.post("/api/account/login", async (req, res) => {
  try {
    const { emailOrPin, password, pinCode, deviceName, deviceId } = req.body;

    if (!emailOrPin && !pinCode) {
      return res.status(400).json({ error: "Введите email или 6-значный PIN-код синхронизации." });
    }

    const db = loadUserAccountsDb();
    const now = Date.now();
    let foundUser: StoryZoneUserAccount | null = null;

    // Search by exact email or PIN code
    const query = ((emailOrPin || pinCode || "") as string).trim().toLowerCase();
    const upperPin = query.toUpperCase();

    if (db.users[query]) {
      foundUser = db.users[query];
    } else {
      // Find by PIN code or username
      foundUser = Object.values(db.users).find(
        (u) => u.pinCode.toUpperCase() === upperPin || u.username.toLowerCase() === query
      ) || null;
    }

    if (!foundUser) {
      return res.status(404).json({
        error: "Аккаунт не найден. Проверьте правильность email или PIN-кода, либо зарегистрируйтесь.",
      });
    }

    // If password provided, verify hash
    if (password && typeof password === "string") {
      const hashed = hashPassword(password);
      if (foundUser.passwordHash && foundUser.passwordHash !== hashed) {
        return res.status(401).json({ error: "Неверный пароль. Попробуйте снова или используйте PIN-код." });
      }
    }

    // Register / update device
    const curDeviceId = deviceId || `dev_${Math.random().toString(36).substring(2, 8)}`;
    const curDeviceName = deviceName || "Устройство пользователя";
    const existingDevIndex = foundUser.devices.findIndex((d) => d.deviceId === curDeviceId);
    if (existingDevIndex >= 0) {
      foundUser.devices[existingDevIndex].lastSeen = now;
      foundUser.devices[existingDevIndex].deviceName = curDeviceName;
    } else {
      foundUser.devices.push({ deviceId: curDeviceId, deviceName: curDeviceName, lastSeen: now });
    }

    foundUser.lastLoginAt = now;
    saveUserAccountsDb(db);

    res.json({
      success: true,
      user: {
        id: foundUser.id,
        username: foundUser.username,
        email: foundUser.email,
        pinCode: foundUser.pinCode,
        createdAt: foundUser.createdAt,
        lastSyncedAt: foundUser.lastSyncedAt,
        devicesCount: foundUser.devices.length,
      },
      snapshot: foundUser.snapshot,
      message: `Добро пожаловать, ${foundUser.username}! Весь прогресс загружен из вашей учётной записи.`,
    });
  } catch (err: any) {
    console.error("Account login error:", err);
    res.status(500).json({ error: "Ошибка при входе в учётную запись" });
  }
});

// 3. Continuous Full Progress Cloud Sync (All stories, chapters, co-author facts, saves, chat)
app.post("/api/account/sync", async (req, res) => {
  try {
    const { email, pinCode, snapshot, deviceName, deviceId } = req.body;

    if (!email && !pinCode) {
      return res.status(400).json({ error: "Отсутствует идентификатор учётной записи" });
    }
    if (!snapshot || typeof snapshot !== "object") {
      return res.status(400).json({ error: "Отсутствует снимок данных для синхронизации" });
    }

    const db = loadUserAccountsDb();
    const cleanEmail = (email || "").trim().toLowerCase();
    const cleanPin = (pinCode || "").trim().toUpperCase();

    let user: StoryZoneUserAccount | null = null;
    if (cleanEmail && db.users[cleanEmail]) {
      user = db.users[cleanEmail];
    } else if (cleanPin) {
      user = Object.values(db.users).find((u) => u.pinCode.toUpperCase() === cleanPin) || null;
    }

    if (!user) {
      return res.status(404).json({ error: "Пользователь не найден в базе облачной синхронизации" });
    }

    const now = Date.now();

    // Update snapshot with latest state
    user.snapshot = {
      activeGameState: snapshot.activeGameState !== undefined ? snapshot.activeGameState : user.snapshot.activeGameState,
      saves: Array.isArray(snapshot.saves) ? snapshot.saves : user.snapshot.saves,
      customStories: Array.isArray(snapshot.customStories) ? snapshot.customStories : user.snapshot.customStories,
      chatHistories: snapshot.chatHistories || user.snapshot.chatHistories || {},
      settings: snapshot.settings || user.snapshot.settings || {},
      syncedAt: now,
      stepCount: snapshot.activeGameState?.stepCount || user.snapshot.stepCount || 1,
      storyTitle: snapshot.activeGameState?.story?.title || user.snapshot.storyTitle || "Повесть",
    };

    user.lastSyncedAt = now;

    // Track active device
    if (deviceId || deviceName) {
      const devId = deviceId || "web_client";
      const devName = deviceName || "Веб-клиент";
      const devIdx = user.devices.findIndex((d) => d.deviceId === devId);
      if (devIdx >= 0) {
        user.devices[devIdx].lastSeen = now;
        user.devices[devIdx].deviceName = devName;
      } else {
        user.devices.push({ deviceId: devId, deviceName: devName, lastSeen: now });
      }
    }

    saveUserAccountsDb(db);

    res.json({
      success: true,
      lastSyncedAt: now,
      pinCode: user.pinCode,
      message: "Все данные, главы, ответы соавтора и истории сохранены в вашей учётной записи!",
    });
  } catch (err: any) {
    console.error("Account sync error:", err);
    res.status(500).json({ error: "Ошибка сохранения данных в учётной записи" });
  }
});

// 4. Fetch Full Snapshot by Account Email or PIN Code
app.get("/api/account/snapshot", async (req, res) => {
  try {
    const rawEmail = ((req.query.email as string) || "").trim().toLowerCase();
    const rawPin = ((req.query.pinCode as string) || "").trim().toUpperCase();

    if (!rawEmail && !rawPin) {
      return res.status(400).json({ error: "Укажите email или PIN-код учётной записи" });
    }

    const db = loadUserAccountsDb();
    let user: StoryZoneUserAccount | null = null;
    if (rawEmail && db.users[rawEmail]) {
      user = db.users[rawEmail];
    } else if (rawPin) {
      user = Object.values(db.users).find((u) => u.pinCode.toUpperCase() === rawPin) || null;
    }

    if (!user) {
      return res.status(404).json({ error: "Учётная запись не найдена" });
    }

    res.json({
      success: true,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        pinCode: user.pinCode,
        lastSyncedAt: user.lastSyncedAt,
        devicesCount: user.devices.length,
      },
      snapshot: user.snapshot,
    });
  } catch (err: any) {
    console.error("Account snapshot fetch error:", err);
    res.status(500).json({ error: "Ошибка загрузки снимка учётной записи" });
  }
});

// 5. Account Status & Quick Health Check
app.get("/api/account/status", async (req, res) => {
  try {
    const rawEmail = ((req.query.email as string) || "").trim().toLowerCase();
    const rawPin = ((req.query.pinCode as string) || "").trim().toUpperCase();

    const db = loadUserAccountsDb();
    let user: StoryZoneUserAccount | null = null;
    if (rawEmail && db.users[rawEmail]) {
      user = db.users[rawEmail];
    } else if (rawPin) {
      user = Object.values(db.users).find((u) => u.pinCode.toUpperCase() === rawPin) || null;
    }

    if (!user) {
      return res.json({ loggedIn: false, exists: false });
    }

    res.json({
      loggedIn: true,
      exists: true,
      username: user.username,
      email: user.email,
      pinCode: user.pinCode,
      lastSyncedAt: user.lastSyncedAt,
      devicesCount: user.devices.length,
      stepCount: user.snapshot.stepCount || 1,
      storyTitle: user.snapshot.storyTitle || "",
      savesCount: user.snapshot.saves?.length || 0,
    });
  } catch (err: any) {
    res.status(500).json({ error: "Status check error" });
  }
});

function formatAgreementsPromptBlock(coAuthorAgreements: any[]): string {
  if (!Array.isArray(coAuthorAgreements) || coAuthorAgreements.length === 0) {
    return "";
  }
  return `=== СОГЛАСОВАННЫЕ ДЕТАЛИ И ДОГОВОРЁННОСТИ С СОАВТОРОМ (AGREEMENTS LOG — НЕПРЕЛОЖНЫЙ КАНОН) ===
Пользователь зафиксировал ключевые факты и договоренности сюжета, которые ИИ ОБЯЗАН ЗАПОМНИТЬ И СОБЛЮДАТЬ НАВСЕГДА.
(ЕДИНСТВЕННОЕ ИСКЛЮЧЕНИЕ: если в ходе сюжета не произойдет явного сюжетного действия игрока, напрямую касающегося этого факта и меняющего его):
${coAuthorAgreements.map((a: any, idx: number) => `• [${a.category || "правило_сюжета"}] «${a.title || `Деталь #${idx + 1}`}»: ${a.content}`).join("\n")}
СТРОЖАЙШИЙ ЗАКОН: Категорически запрещено забывать эти факты, противоречить им или искажать их, пока игрок своим явным действием не изменит их в сюжете!\n`;
}

// 5. Next Scene Progression with Ultra Deep Memory, Focus & Style
app.post("/api/story/act", async (req, res) => {
  try {
    const {
      storyTitle,
      genre,
      currentScene,
      history,
      action,
      playerStats,
      characters,
      inventory,
      narrativeStyle,
      customStylePrompt,
      generationLength,
      narrativePOV,
      povCompanionName,
      sceneFocus,
      memoryChapters,
      lorebook,
      ultraMemory,
      customKey,
      universeSetting,
      searchGroundingEnabled: reqSearchGrounding,
      coAuthorAgreements,
      authorDictateMode,
      strictActionFidelity = true,
      proportionalActionScaling = true,
    } = req.body;

    const universe = universeSetting || {};
    const universeName = universe.universeName || req.body.fandomSource || genre || "Фэнтези";
    const settingDescription = universe.settingDescription || "Уникальный мир со своими законами, историей и атмосферой";
    const worldRules = Array.isArray(universe.worldRules) && universe.worldRules.length > 0
      ? universe.worldRules.map((r: string) => `• ${r}`).join("\n")
      : "• Законы физики и магии соответствуют выбранному сеттингу\n• Действия имеют логические последствия";
    const factions = Array.isArray(universe.factions) && universe.factions.length > 0
      ? universe.factions.join(", ")
      : "Местные гильдии, ордены и правители";
    const canonStrictness = universe.canonStrictness || "adaptive";
    const searchGroundingEnabled = Boolean(universe.searchGroundingEnabled ?? reqSearchGrounding);

    // Calculate action size and proportional chapter expansion requirements
    const cleanAction = String(action || "").trim();
    const actionWords = cleanAction.split(/\s+/).filter(Boolean).length;
    const isActionDetailed = actionWords >= 22 || cleanAction.length >= 130;
    const isActionMassive = actionWords >= 45 || cleanAction.length >= 260;

    let scalingInstruction = "";
    let targetLengthDescription = "не менее 3-5 содержательных абзацев с живыми диалогами, атмосферой и органичным развитием событий";

    if (proportionalActionScaling && isActionDetailed) {
      if (isActionMassive) {
        scalingInstruction = `\n🔥 СОРАЗМЕРНОЕ МАСШТАБИРОВАНИЕ ГЛАВЫ (ОБЪЁМНОЕ ДЕТАЛЬНОЕ ДЕЙСТВИЕ АВТОРА — ${actionWords} СЛОВ / ${cleanAction.length} ЗНАКОВ):
Автор ввёл масштабное, комплексное действие с несколькими этапами, репликами диалога или тактическими манёврами!
КАТЕГОРИЧЕСКИ ЗАПРЕЩЕНО пытаться втиснуть это действие в стандартный короткий объём!
ТРЕБОВАНИЕ: Пропорционально расширь объём главы до 6-10 БОГАТЫХ ЛИТЕРАТУРНЫХ АБЗАЦЕВ!
Раскрой каждый пункт, каждый тактический шаг, живую реакцию спутников и окружения обстоятельно и кинематографично, давая развёрнутую романную главу!`;
        targetLengthDescription = "Развёрнутый романный объём (6-10 глубоких, подробных литературных абзацев, пропорционально масштабу действия автора)";
      } else {
        scalingInstruction = `\n⚡ СОРАЗМЕРНОЕ МАСШТАБИРОВАНИЕ ГЛАВЫ (РАЗВЁРНУТОЕ ДЕЙСТВИЕ АВТОРА — ${actionWords} СЛОВ):
Автор написал развёрнутое действие. Не пытайся сжать его в шаблонный объём: пропорционально увеличь главу до 5-8 богатых литературных абзацев, детально раскрывая каждую реплику и движение!`;
        targetLengthDescription = "Увеличенный литературный объём (5-8 детальных абзацев, пропорционально развёрнутому действию автора)";
      }
    } else if (generationLength === "short") {
      targetLengthDescription = "Динамичный текст (2-3 ёмких, хлёстких абзаца без лишней воды)";
    } else if (generationLength === "long") {
      targetLengthDescription = "Развёрнутый романный текст (5-8 глубоких, детальных литературных абзацев с развёрнутыми диалогами и психологией)";
    }

    const styleInstructions: Record<string, string> = {
      brutal: "СТИЛЬ ПОВЕСТВОВАНИЯ: ЖЁСТКИЙ РЕАЛИЗМ / DARK FANTASY. Никаких соплей, розовых иллюзий, морализаторства и витиеватой высокопарности. Приземлённый, хлёсткий, суровый слог. Цена ошибок высока, мир опасен, действия имеют прямые физические последствия.",
      anime: "СТИЛЬ ПОВЕСТВОВАНИЯ: АНИМЕ & РАНОБЭ (СЁНЭН / ИСЕКАЙ). Яркие эмоции, экспрессивные восклицания, внутренний голос протагониста, пафос боевых стоек и техник, драматичные паузы и несгибаемая воля!",
      cyberpunk: "СТИЛЬ ПОВЕСТВОВАНИЯ: КИБЕРПАНК & НЕОН. Технологичный сленг, холодный уличный цинизм, адреналин, кислотный дождь на визоре, импланты, электроника и прагматизм.",
      noir: "СТИЛЬ ПОВЕСТВОВАНИЯ: ТЁМНЫЙ НУАР-ДЕТЕКТИВ. Циничный реализм, тягучие монологи героя, тени, подозрительность ко всем, сигаретный дым и сырой ночной асфальт.",
      cinematic: "СТИЛЬ ПОВЕСТВОВАНИЯ: КИНЕМАТОГРАФИЧНЫЙ БЛОКБАСТЕР. Резкий темпоритм, визуальная выразительность, динамика каждого кадра, эффектное развитие событий.",
      satire: "СТИЛЬ ПОВЕСТВОВАНИЯ: ЧЁРНАЯ ИРОНИЯ & САРКАЗМ. Едкий юмор, остроумные подколы спутников, ирония над ситуацией, отсутствие напыщенной драмы.",
      conversational: "СТИЛЬ ПОВЕСТВОВАНИЯ: ЖИВАЯ РЕЧЬ. Простой, естественный человеческий язык без заумных метафор и без шаблонной высокопарности.",
      fanfiction: "СТИЛЬ ПОВЕСТВОВАНИЯ: ЧУВСТВЕННЫЙ ФАНФИКШН. Пристальное внимание к взглядам, полунамёкам, химии между персонажами, трепетным жестам и невысказанным чувствам.",
      literary: "СТИЛЬ ПОВЕСТВОВАНИЯ: КЛАССИЧЕСКАЯ ПРОЗА. Выразительные метафоры, глубокий психологизм и осязаемая атмосфера.",
      custom: `СТИЛЬ ПОВЕСТВОВАНИЯ (ПОЛЬЗОВАТЕЛЬСКИЙ): ${customStylePrompt || "Пиши строго в авторском ключе, без нравоучений."}`,
    };

    let lengthInstruction = "ТРЕБОВАНИЕ К ОБЪЁМУ ТЕКСТА: ПОЛНОЦЕННЫЙ ХУДОЖЕСТВЕННЫЙ ТЕКСТ (НЕ МЕНЕЕ 3-5 БОГАТЫХ ЛИТЕРАТУРНЫХ АБЗАЦЕВ). Пиши развёрнуто, атмосферно и кинематографично: раскрывай диалоги, ощущения, детали мира, поведение спутников и осязаемые последствия. Запрещены сухие короткие отписки из пары предложений!";
    if (generationLength === "short") {
      lengthInstruction = "ТРЕБОВАНИЕ К ОБЪЁМУ ТЕКСТА: УМЕРЕННЫЙ И ДИНАМИЧНЫЙ (2-3 ёмких, хлёстких абзаца без лишней воды).";
    } else if (generationLength === "long") {
      lengthInstruction = "ТРЕБОВАНИЕ К ОБЪЁМУ ТЕКСТА: РАЗВЁРНУТЫЙ РОМАННЫЙ (5-8 глубоких, детальных литературных абзацев с развёрнутыми диалогами, раскрытием психологии, подробным окружением и масштабными последствиями).";
    }

    const povInstructions: Record<string, string> = {
      first: "Повествование ведётся строго от ПЕРВОГО ЛИЦА ('Я взглянул...', 'Моё сердце забилось...').",
      second: "Повествование ведётся строго от ВТОРОГО ЛИЦА ('Ты делаешь шаг...', 'Вы чувствуете...').",
      third: "Повествование ведётся строго от ТРЕТЬЕГО ЛИЦА ('Он шагнул в темноту...', 'Герой понимал...').",
      companion: `Повествование ведётся от лица спутника: ${povCompanionName || "близкого спутника"} (его мысли, его восприятие действий игрока).`,
    };

    const focusInstructions: Record<string, string> = {
      action: "Фокус сцены: ДЕЙСТВИЕ И ЭКШЕН. Сделай упор на динамику схватки, манёвры, скорость, адреналин и физическое преодоление препятствий.",
      dialogue: "Фокус сцены: ДИАЛОГ И ПСИХОЛОГИЧЕСКАЯ ДРАМА. Сделай упор на разговор с персонажами, раскрытие их мотивов, споры или эмоциональное сближение.",
      crisis: "Фокус сцены: ОСТРЫЙ КРИЗИС И ДИЛЕММА. Внезапная угроза, цейтнот времени, необходимость сделать сложный выбор под давлением.",
      exploration: "Фокус сцены: ИССЛЕДОВАНИЕ И ЛОР. Сделай упор на раскрытие тайн окружения, изучение древних рун, артефактов или смену локации.",
      general: "Фокус сцены: Сбалансированное развитие сюжета.",
    };

    let rhythmInstruction = "";
    if (req.body.musicBpm) {
      const bpm = Number(req.body.musicBpm);
      if (bpm >= 125) {
        rhythmInstruction = `МУЗЫКАЛЬНЫЙ ТЕМП И РИТМ: ${bpm} BPM (ВЫСОКИЙ БОЕВОЙ ПУЛЬС / АДРЕНАЛИН). ТРЕБОВАНИЕ: Пиши короткими хлёсткими фразами, нагнетай драйв, передавай скорость реакции, резкие движения и бешеный ритм событий!`;
      } else if (bpm <= 80) {
        rhythmInstruction = `МУЗЫКАЛЬНЫЙ ТЕМП И РИТМ: ${bpm} BPM (МЕДЛЕННЫЙ ТРАНСОВЫЙ / ТАИНСТВЕННЫЙ). ТРЕБОВАНИЕ: Делай упор на густую атмосферу, сенсорные детали, вдумчивые паузы, шёпот и тягучий саспенс!`;
      } else {
        rhythmInstruction = `МУЗЫКАЛЬНЫЙ ТЕМП И РИТМ: ${bpm} BPM (УМЕРЕННЫЙ СЮЖЕТНЫЙ). Сбалансированная динамика повествования.`;
      }
    }

    // Build memory context across all chapters (up to 25 chapters) with explicit chosen actions
    let memoryBlock = "";
    if (Array.isArray(memoryChapters) && memoryChapters.length > 0) {
      memoryBlock = `ПОЛНАЯ ХРОНИКА ВСЕХ ПРЕДЫДУЩИХ ГЛАВ (СКВОЗНАЯ ПАМЯТЬ СЮЖЕТА И ВЫБОРОВ ЗА ВСЮ ИСТОРИЮ):\n` +
        memoryChapters
          .slice(-25)
          .map((c: any) => `• Глава ${c.chapterNumber || ""}: «${c.title || ""}» | Решение/ход автора: «${c.chosenAction || "Начало пути"}» | Итог событий: ${c.summary || ""}. Зафиксированные факты: ${(c.keyFacts || []).join("; ")}`)
          .join("\n");
    }

    // Build recent history of player steps & narrative flow with richer context
    let historyBlock = "";
    if (Array.isArray(history) && history.length > 0) {
      historyBlock = `ПОСЛЕДНИЕ ШАГИ И ВЫБОРЫ ИГРОКА (НЕПРЕРЫВНАЯ ЦЕПЬ СОБЫТИЙ И ПРИЧИННО-СЛЕДСТВЕННАЯ СВЯЗЬ):\n` +
        history
          .slice(-8)
          .map((h: any) => `• Шаг ${h.stepNumber}: Игрок предпринял: «${h.action || "Действие"}». ${h.wasEdited ? "[Отредактировано автором — строгий канон]" : ""}\n  Что произошло: ${h.sceneText ? h.sceneText.slice(0, 320).trim() + "..." : ""}`)
          .join("\n");
    }

    let loreBlock = "";
    if (Array.isArray(lorebook) && lorebook.length > 0) {
      loreBlock = `АКТИВНЫЙ ЛОРБУК И ИЗВЕСТНЫЕ ФАКТЫ О МИРЕ (СТРОГИЙ КАНОН):\n` +
        lorebook
          .slice(-25)
          .map((l: any) => `• [${l.category || "факт"}] ${l.title}: ${l.description}`)
          .join("\n");
    }

    const charactersInfo = Array.isArray(characters)
      ? characters
          .map((c: any) => {
            const traits = c.traits ? c.traits.join(", ") : "характер раскрывается";
            const temperament = c.temperament ? `[Темперамент: ${c.temperament}]` : "";
            const habits = c.habits && c.habits.length ? `[Привычки: ${c.habits.join("; ")}]` : "";
            const origin = c.origin ? `[Родина/происхождение: ${c.origin}]` : "";
            const abilities = c.abilities && c.abilities.length ? `[Умения/навыки: ${c.abilities.join(", ")}]` : "";
            const merits = c.merits && c.merits.length ? `[Заслуги/подвиги: ${c.merits.join("; ")}]` : "";
            const currentStatus = c.currentStatus ? `[Текущее занятие: ${c.currentStatus}]` : "";
            const allegiance = c.allegiance ? `[Фракция/верность: ${c.allegiance}]` : "";
            const lockStatus = c.isLockedTraits ? "(Черты характера зафиксированы игроком)" : "(Черты могут эволюционировать)";
            return `— ${c.name} (${c.role}): Отношение ${c.affinity || 50}%. ${temperament} ${origin} ${currentStatus} ${abilities} ${merits} ${allegiance} Черты: ${traits}. ${habits} ${lockStatus}`;
          })
          .join("\n")
      : "Нет активных спутников";

    const aiSystemPrompt =
      (req.body.aiSystemPrompt || "").trim() || DEFAULT_AI_SYSTEM_PROMPT;

    const userPromptDirective =
      (req.body.aiPromptDirective || "").trim() ||
      "Исполняй действие игрока точно и без задержек. Излагай текст в строгом соответствии с выбранным стилем повествования, без навязчивого морализаторства, нравоучений и лишней воды.";

    // Context Summarization Service: compute concise narrative context before turn
    const narrativeContextSummary = await generateNarrativeContextSummary({
      storyTitle: storyTitle || "История",
      genre: genre || "Фэнтези",
      currentScene: currentScene || "",
      characters: Array.isArray(characters) ? characters : [],
      history: Array.isArray(history) ? history : [],
      memoryChapters: Array.isArray(memoryChapters) ? memoryChapters : [],
      lorebook: Array.isArray(lorebook) ? lorebook : [],
      action: action || "Продолжение пути",
      narrativeStyle,
      customKey,
    });

    const enrichedSystemPrompt = `${aiSystemPrompt}

=== ОПЕРАТИВНЫЙ СЦЕНАРНЫЙ КОНТЕКСТ И ПСИХОЛОГИЧЕСКИЕ ЯКОРЯ (NARRATIVE CONTEXT) ===
${narrativeContextSummary}
НЕПРЕЛОЖНОЕ ТРЕБОВАНИЕ: Сохраняй непрерывность психологии персонажей, их накопленный багаж отношений и причинно-следственную цепь в соответствии с этим контекстом, предотвращая амнезию и дрейф характеров (memory drift)!`;

    const agreementsBlock = formatAgreementsPromptBlock(coAuthorAgreements);

    const prompt = `Ты — выдающийся мастер интерактивной литературы и интерактивных романов в StoryZone.
История: "${storyTitle}" (Жанр: ${genre}).

=== ВСЕЛЕННАЯ, СЕТТИНГ И КАНОНИЧНЫЕ ЗАКОНЫ МИРА (ГЛУБОКОЕ ПОГРУЖЕНИЕ В КАНОН) ===
• Активная Вселенная / Фандом: «${universeName}»
• Описание эпохи, локации и сеттинга: ${settingDescription}
• Ключевые фракции и противоборствующие силы: ${factions}
• Непреложные законы и правила этой вселенной:
${worldRules}
• Режим каноничности: ${canonStrictness === "strict" ? "СТРОГИЙ КАНОН (неукоснительно следуй оригинальному лору, каноничным именам, терминологии и законам)" : canonStrictness === "alternate" ? "АЛЬТЕРНАТИВНЫЙ КАНОН / WHAT IF (опора на сеттинг с правом на смелые сюжетные развилки)" : "АДАПТИВНЫЙ КАНОН (аутентичный дух вселенной с органичным развитием истории игрока)"}.
• Поиск актуального канона через Google Search: ${searchGroundingEnabled ? "ВКЛЮЧЕН (опирайся на точные факты, локации и реалии вселенной)" : "ВЫКЛЮЧЕН"}.

${agreementsBlock}

ГЛАВНОЕ ТРЕБОВАНИЕ К СЕТТИНГУ:
Генерируй продолжение главы с максимальной аутентичностью к вселенной «${universeName}»! Используй подлинные названия, терминологию, атмосферу, типы магии/технологий, особенности снаряжения и специфику окружения, характерные именно для этого сеттинга.

=== ОПЕРАТИВНЫЙ СЦЕНАРНЫЙ КОНТЕКСТ НЕПРЕРЫВНОСТИ (NARRATIVE CONTEXT) ===
${narrativeContextSummary}

=== ГЛОБАЛЬНЫЙ СИСТЕМНЫЙ ПРОМПТ ИИ (НЕПРЕЛОЖНЫЕ ЗАКОНЫ ПОВЕДЕНИЯ И ЛОГИКИ) ===
${aiSystemPrompt}

ГЛАВНАЯ ТВОРЧЕСКАЯ ИНСТРУКЦИЯ (ДИРЕКТИВА АВТОРА):
«${userPromptDirective}»

${strictActionFidelity !== false ? `=== СВЕРХВАЖНОЕ ПРАВИЛО №1: 100% ТОЧНОЕ И СТРОГОЕ СОБЛЮДЕНИЕ ДЕЙСТВИЯ АВТОРА / ИГРОКА ===
Действие читателя/автора:
"""${action}"""

КАТЕГОРИЧЕСКИЕ И НЕПРЕЛОЖНЫЕ ЗАКОНЫ ВОПЛОЩЕНИЯ ДЕЙСТВИЯ:
1. КАТЕГОРИЧЕСКИ ЗАПРЕЩЕНО переворачивать действие автора с ног на голову!
   - Запрещено делать так, чтобы вместо задуманного автором поступка произошло противоположное.
   - Запрещено обесценивать действие автора нелепыми роялями в кустах («но вдруг из ниоткуда появился враг и прервал вас», «но нога предательски соскользнула», «но вам помешали»), если сам автор этого не написал!
   - Если автор решил нанести удар, применить магию, сказать конкретные слова, скрыться или договориться — этот поступок СОВЕРШАЕТСЯ НА САМОМ ДЕЛЕ, с реальным физическим и сюжетным эффектом!
2. ПОЛНОЕ И ЧЕСТНОЕ ВОПЛОЩЕНИЕ:
   - Если в действии есть реплики персонажа автора — собеседники слышат их и отвечают именно на них.
   - Никаких шаблонных отписок («Вы попытались, но ничего не вышло»). Автор обладает абсолютным творческим приоритетом над ходом событий!
3. КАТЕГОРИЧЕСКИЙ АНТИ-КЛИШЕ И АНТИ-ШАБЛОННЫЙ ЗАПРЕТ:
   - КАТЕГОРИЧЕСКИ ЗАПРЕЩЕНО цитировать действие игрока или оборачивать его слова в кавычки в самом художественном тексте (например: «Вы выбрали...», «Вы решили: "..."»). Никаких кавычек вокруг текста действия!
   - ЗАПРЕЩЕНЫ штампы: «тучи сгущаются», «тьма накрывает», «вы стремительны», «воздух звенит от напряжения», «холодок пробежал по спине».
` : `
Действие читателя/автора:
"""${action}"""
Воплощай задумку автора органично в ткани сцены.
`}
${scalingInstruction}

КРИТИЧЕСКИЕ ПРАВИЛА ЛОГИКИ И ЖИВОГО ПОВЕСТВОВАНИЯ:
1. ПРАВИЛО ЗНАКОМСТВА И ИМЁН (ЗАПРЕТ ТЕЛЕПАТИИ И ВСЕВЕДЕНИЯ):
   - Если персонаж и главный герой только что встретились или ещё не познакомились лично в диалоге:
     * Герой и повествователь НЕ ЗНАЮТ его имени!
     * КАТЕГОРИЧЕСКИ ЗАПРЕЩЕНО повествователю или герою называть персонажа по личному имени до того, как тот сам не назовёт своё имя вслух («Меня зовут ...») или герой прямо не спросит его!
     * До момента знакомства называй персонажа исключительно по роли, одежде или внешности: «бедуин», «незнакомец», «всадник», «раненый путник», «молчаливый проводник», «человек в капюшоне».
     * Знакомство должно быть органичным и естественным моментом сюжета, а не телепатическим знанием из ниоткуда.

2. ГИБКОСТЬ ХАРАКТЕРОВ И АНТИ-ШАБЛОННОСТЬ (ЗАПРЕТ ЗАСТРЕВАНИЯ В ОДНОЙ ЭМОЦИИ):
   - КАТЕГОРИЧЕСКИ ЗАПРЕЩЕНО «ловить шаблон» и упрямо отыгрывать враждебность, холодность или недоверие персонажа, если глава была отредактирована, лорбук обновлён или герой совершил поступок в сторону помощи, сближения, спасения или союза!
   - Если герой спас спутника, проявил щедрость, выполнил просьбу или договорился — отношение ОБЯЗАНО немедленно теплеть! Персонаж благодарит, выказывает уважение, открывается и становится союзником.
   - Обязательно возвращай в "affinityChanges" положительное изменение (например +10, +15) с пояснением причины потепления, и не возвращайся к старой подозрительности!

3. СКВОЗНАЯ ПАМЯТЬ И НЕПРЕРЫВНАЯ ЛОГИКА ЗА ВСЕ 10-15+ ГЛАВ:
   - Все предыдущие главы (ХРОНИКА ГЛАВ) и ПОСЛЕДНИЕ ШАГИ ИГРОКА — это нерушимый живой канон.
   - Учитывай весь пройденный путь: прошлые договоренности, полученные предметы, пережитые вместе испытания, сказанные клятвы и раскрытые тайны.
   - Никаких провалов в памяти! Персонажи помнят, кто вы такой, что вы для них сделали 5 или 10 глав назад, и ведут себя соответственно накопленному опыту.
   - История обязана развиваться ЛАКОНИЧНО, ЛОГИЧНО И ПОСЛЕДОВАТЕЛЬНО, без нелепых нестыковок и искусственных барьеров.

4. РАЗМЕРЕННЫЙ ПЕЙСИНГ И ПОЛНОЦЕННОЕ ВОПЛОЩЕНИЕ ДЕЙСТВИЯ (ЗАПРЕТ СПЕШКИ И СКОМКАННОСТИ):
   - КАТЕГОРИЧЕСКИ ЗАПРЕЩЕНО стремительно бежать вперёд, проглатывая действие автора в паре сухих предложений!
   - Полноценно и чувственно раскрой непосредственный момент выполнения действия игрока: напряжение момента, осязаемые звуки, физику движений, визуальные детали, реакцию окружения и спутников.
   - Запрещено самовольно перематывать время на часы или дни вперёд и телепортировать героев в другую локацию. Сцена развивается органично здесь и сейчас!
   - Если в действии есть речь — дай полноценный живой диалог с характерными интонациями, паузами и подтекстом.

5. НЕИЗМЕННОСТЬ ПСИХОЛОГИЧЕСКОГО СТЕРЖНЯ И РЕЧЕВОГО ПОРТРЕТА ПЕРСОНАЖЕЙ:
   - Характер каждого спутника стабилен и глубок. Персонажи не мутируют случайно от сцены к сцене!
   - Сохраняй уникальный голос каждого героя: привычный тембр, лексику, отношение к опасности и юмору, личные принципы и тайны.
   - Спутники живо реагируют на решения героя, исходя из своего неизменного характера и накопленной истории отношений.

УСТАНОВКИ АВТОРСКОГО СТИЛЯ И ФОРМАТА:
${styleInstructions[narrativeStyle || "brutal"] || styleInstructions.brutal}
${lengthInstruction}
${povInstructions[narrativePOV || "second"] || povInstructions.second}
${focusInstructions[sceneFocus || "general"] || focusInstructions.general}
${rhythmInstruction}

ПЕРСОНАЖИ, ИХ ЗАСЛУГИ И ХАРАКТЕР:
1. Учитывай темперамент, таланты и бэкграунд спутников, но не превращай их в занудных моралистов. Они — соратники в буре событий.
2. Если персонаж в этой сцене совершил подвиг — добавь в "meritChanges" [{ "name": "Имя", "newMerit": "Подвиг" }].
3. Если изменился статус — укажи в "statusChanges" [{ "name": "Имя", "newStatus": "Новое занятие" }].
4. Если действие пользователя вводит нового героя или удаляет кого-то — зафиксируй в "characterUpdates".

ТРЕБОВАНИЯ К ТЕКСТУ:
1. Живой, динамичный, захватывающий язык строго в выбранном стиле (${narrativeStyle || "динамичный"}).
2. ЗАПРЕЩЕНЫ механические формулировки видеоигр ("вы получили 10 урона", "проверка ловкости"). Всё через живые ощущения и действия!
3. Соблюдай заданный объём: ${targetLengthDescription}. Если действие пользователя развёрнутое и детальное, раскрывай его подробно и обстоятельно, не комкая!
4. Варианты выбора (choices) должны быть естественными и интригующими сюжетными развилками (3 варианта).

ДАННЫЕ ПЕРСОНАЖЕЙ:
${charactersInfo}

СОСТОЯНИЕ ГЕРОЯ:
Самочувствие: ${playerStats?.hp ?? 100}% жизненных сил, тонус: ${playerStats?.energy ?? 100}%.
Личные вещи: ${(inventory || []).join(", ") || "Нет особых вещей"}.

${memoryBlock}
${historyBlock}
${loreBlock}

ТЕКУЩАЯ СЦЕНА (ОСНОВОПОЛАГАЮЩИЙ КАНОН):
${currentScene}

КРИТИЧЕСКИЙ ЗАКОН СЮЖЕТА:
Если текст текущей сцены был отредактирован автором (или содержит специфические детали, диалоги, ранения, перемену обстановки или новые предметы), твоё продолжение ОБЯЗАНО абсолютно точно вытекать именно из этого текста и действия игрока! Не возвращайся к старым событиям, которые были заменены или исключены автором.

ДЕЙСТВИЕ ГЕРОЯ:
"${action}"

Верни строго JSON:
{
  "sceneText": "Художественный текст продолжения сцены на русском языке (${targetLengthDescription}, строго без цитат действия в кавычках, без клише и без искажения задумки автора)",
  "dialogueSpeaker": "Имя говорящего персонажа (или null)",
  "choices": [
    {
      "id": "1",
      "label": "Сюжетный или эмоциональный выбор героя",
      "description": "Пояснение к выбору и его внутренний мотив"
    },
    { "id": "2", "label": "Второй органичный выбор", "description": "Пояснение" },
    { "id": "3", "label": "Третий органичный выбор", "description": "Пояснение" }
  ],
  "characterUpdates": {
    "add": [
      {
        "name": "Имя нового персонажа",
        "role": "Роль и отношение к вам",
        "bio": "Краткая предыстория",
        "origin": "Место происхождения / родина / мир",
        "abilities": ["Навык 1", "Навык 2"],
        "merits": ["Заслуга 1"],
        "currentStatus": "Текущее занятие",
        "affinity": 50,
        "affinityTitle": "Знакомый",
        "temperament": "сангвиник|холерик|флегматик|меланхолик",
        "traits": ["Черта 1", "Черта 2"],
        "habits": ["Привычка"]
      }
    ],
    "remove": ["Имя персонажа, если он погиб, покинул отряд или исключён автором"],
    "meritChanges": [
      { "name": "Имя персонажа", "newMerit": "Подвиг или новая заслуга, совершённая в этой сцене" }
    ],
    "statusChanges": [
      { "name": "Имя персонажа", "newStatus": "Новое текущее дело или миссия персонажа" }
    ]
  },
  "worldChange": "Краткое описание изменения законов или состояния мира (или null)",
  "statChanges": {
    "hp": 0,
    "energy": -5,
    "gold": 0
  },
  "affinityChanges": [
    { "name": "Имя персонажа", "delta": 5, "reason": "Одобрил ваш поступок" }
  ],
  "characterEvolution": [
    { "name": "Имя", "addedTrait": "Новая черта", "addedHabit": "Новая привычка", "reason": "Под влиянием событий" }
  ],
  "newItems": [],
  "atmosphere": "mysterious|action|romantic|dark|triumphant|calm",
  "suggestedMusic": "battle|mystic|cyber|campfire|romance|dark|calm",
  "chapterSummary": "Краткое описание событий этой сцены для памяти сюжета (1-2 предложения)",
  "newLore": {
    "title": "Название нового факта или тайны (или null)",
    "description": "Описание факта для лорбука",
    "category": "персонаж|локация|артефакт|событие|правило_мира"
  },
  "isEnding": false,
  "endingTitle": null
}`;

    const runResult = await runGeminiWithSearchFallback(
      prompt,
      enrichedSystemPrompt,
      true,
      customKey,
      searchGroundingEnabled
    );
    const parsed = JSON.parse(runResult.text);

    if (runResult.groundingSources && runResult.groundingSources.length > 0) {
      parsed.groundingSources = runResult.groundingSources;
    }
    if (runResult.searchQueries && runResult.searchQueries.length > 0) {
      parsed.searchQueries = runResult.searchQueries;
    }

    parsed.narrativeContextSummary = narrativeContextSummary;

    res.json(parsed);
  } catch (error: any) {
    console.error("Gemini act error:", error);
    // Offline / quota resilient fallback
    const fallback = generateRichFallbackScene(
      req.body.storyTitle || "История",
      req.body.genre || "Фэнтези",
      req.body.action || "Осмотреться",
      req.body.currentScene || "",
      req.body.characters || [],
      req.body.narrativePOV || "second",
      req.body.sceneFocus || "general",
      req.body.universeSetting
    );
    res.json(fallback);
  }
});

// 6. AI Muse: Suggest tactical action, witty speech, or a shocking plot twist
app.post("/api/story/muse", async (req, res) => {
  try {
    const { storyTitle, genre, currentScene, characters, museType, customKey } = req.body;
    const ai = getGeminiClient(customKey);

    const charNames = (characters || []).map((c: any) => c.name).join(", ") || "спутники";

    const prompt = `Ты — литературная Муза и помощник игрока в StoryZone.
История: "${storyTitle}" (Жанр: ${genre}).
Спутники рядом: ${charNames}.
Текущая сцена:
${currentScene}

Запрос типа подсказки: "${museType}" ("action" = что сделать/тактический ход, "speech" = что сказать/остроумная или драматичная реплика, "twist" = внезапный сюжетный поворот или глобальное событие от чьего-то лица).

Сгенерируй 3 ярких, небанальных варианта на русском языке.
Верни строго JSON:
{
  "suggestions": [
    { "title": "Краткое название", "text": "Полный текст действия, реплики или описания поворота", "flair": "дерзко|мудро|неожиданно" },
    { "title": "Краткое название", "text": "Полный текст", "flair": "дерзко|мудро|неожиданно" },
    { "title": "Краткое название", "text": "Полный текст", "flair": "дерзко|мудро|неожиданно" }
  ]
}`;

    if (!ai) {
      return res.json({
        suggestions: [
          { title: "Тактический манёвр", text: "Опередить события и перехватить инициативу, застав противника врасплох.", flair: "дерзко" },
          { title: "Искренний диалог", text: "«Если мы не доверимся друг другу прямо сейчас, отсюда никто не уйдёт».", flair: "мудро" },
          { title: "Внезапный грохот", text: "Своды над головой содрогаются, открывая тайный лаз, о котором никто не подозревал!", flair: "неожиданно" },
        ],
      });
    }

    const text = await runGeminiWithFallback(prompt, undefined, true, customKey);
    const parsed = JSON.parse(text);
    res.json(parsed);
  } catch (error: any) {
    res.json({
      suggestions: [
        { title: "Смелый выпад", text: "Сделать резкий шаг вперёд и заявить о своих правах.", flair: "дерзко" },
        { title: "Выжидательная позиция", text: "Сохранить хладнокровие и дать другим раскрыть свои карты.", flair: "мудро" },
      ],
    });
  }
});

// 7. Edit Chapter & Synchronize Story Memory with edits (End-to-End Cascade Update & Style Mirroring)
app.post("/api/story/edit-chapter", async (req, res) => {
  try {
    const {
      originalText,
      editedText,
      storyTitle,
      genre,
      currentChoices,
      generateNextStep,
      customKey,
      aiSystemPrompt: clientSystemPrompt,
      coAuthorAgreements,
    } = req.body;
    const ai = getGeminiClient(customKey);
    const aiSystemPrompt = (clientSystemPrompt || "").trim() || DEFAULT_AI_SYSTEM_PROMPT;
    const agreementsBlock = formatAgreementsPromptBlock(coAuthorAgreements);

    const fallbackSummary =
      editedText && editedText.length > 200
        ? editedText.slice(0, 200).trim() + "..."
        : editedText || "Глава обновлена автором.";

    const fallbackStyleDirective =
      "Пиши строго в авторском стиле пользователя: выдерживай ритмику предложений автора, акцент на действиях и диалогах, без навязчивого морализаторства и лишней воды.";

    const fallbackChoices = [
      {
        id: "1",
        label: "Продолжить действие на основе изменившейся обстановки",
        description: "Следовать новому направлению изменённого канона",
      },
      {
        id: "2",
        label: "Оценить последствия произошедших событий",
        description: "Осмотреться и скорректировать дальнейший план",
      },
      {
        id: "3",
        label: "Обсудить дальнейший шаг со спутниками",
        description: "Узнать их отношение к происходящему",
      },
    ];

    const fallbackNextStep = {
      actionLabel: "Сюжетное продолжение авторских правок",
      sceneText:
        "Мир вокруг немедленно отозвался на совершённый поворот событий. Напряжение в воздухе сменилось новой неопределённостью, требующей немедленных решительных действий.",
      choices: fallbackChoices,
    };

    if (!ai) {
      return res.json({
        synced: true,
        updatedSummary: fallbackSummary,
        detectedChanges: ["Текст сцены скорректирован автором вручную"],
        updatedChoices: fallbackChoices,
        extractedAuthorStyle: {
          styleSummary: "Сбалансированный динамичный стиль",
          promptDirective: fallbackStyleDirective,
        },
        nextLogicalStep: generateNextStep ? fallbackNextStep : undefined,
      });
    }

    const prompt = `Ты — нарративный архитектор и стилистический аналитик StoryZone.
История: "${storyTitle || "Интерактивная сага"}" (Жанр: ${genre || "Приключения"}).

${agreementsBlock}

ИСХОДНЫЙ ТЕКСТ (до правок):
${originalText || "Текст отсутствовал"}

НОВЫЙ ОТРЕДАКТИРОВАННЫЙ ТЕКСТ АВТОРА:
${editedText}

ТЕКУЩИЕ ВАРИАНТЫ ДЕЙСТВИЙ (до правок):
${JSON.stringify(currentChoices || [])}

КРИТИЧЕСКИЕ ЗАДАЧИ:
1. Внимательно сравни тексты и выяви все изменения: новые факты, предметы, судьбу персонажей, перемену обстановки или новые действия.
2. Составь ёмкое резюме (updatedSummary) обновлённой главы (1-2 предложения) для ДОЛГОСРОЧНОЙ ПАМЯТИ ИИ. Все будущие генерации будут строго отталкиваться от этого резюме!
3. Принудительно пересчитай последствия и сгенерируй 3 НОВЫХ актуальных варианта выбора (updatedChoices), которые ЛОГИЧНО ВЫТЕКАЮТ именно из НОВОГО отредактированного текста главы.
4. Проведи АВТОМАТИЧЕСКИЙ АНАЛИЗ СТИЛЯ ТЕКСТА АВТОРА ("extractedAuthorStyle"):
   - Проанализируй синтаксис (длину предложений, рубленый или певучий слог), лексику, тон, наличие диалогов, эмоциональный окрас.
   - Сформулируй точную директиву для ИИ ("promptDirective"), объясняющую ИИ-мастеру, как в точности копировать этот авторский стиль пользователя в будущих главах (без морализаторства и воды).
5. Сгенерируй СЛЕДУЮЩИЙ ЛОГИЧЕСКИЙ ШАГ ("nextLogicalStep"):
   - Напиши 1-2 сбалансированных художественных абзаца ("sceneText"), органично продолжающих изменённый канон сцены (реакция мира/спутников на правки автора).
   - Приведи 3 варианта выбора ("choices") для этого нового шага.
6. Оцени, изменились ли отношения с персонажами (доверие, благодарность, спасение, договор, примирение) и зафиксируй в ("affinityChanges"): [{ "name": "Имя", "delta": 15, "reason": "Причина потепления/изменения" }].

Верни строго JSON следующей структуры:
{
  "updatedSummary": "Новое краткое содержание главы для хроники и памяти ИИ (1-2 предложения)",
  "detectedChanges": ["Что конкретно изменилось в сюжете 1", "Что изменилось 2"],
  "newLoreFact": "Новое правило мира, предмет или тайна (или null)",
  "affinityChanges": [
    { "name": "Имя персонажа", "delta": 15, "reason": "Причина изменения отношения" }
  ],
  "updatedChoices": [
    { "id": "1", "label": "Действие, логично продолжающее изменённую главу", "description": "Пояснение" },
    { "id": "2", "label": "Второй интригующий вариант действия", "description": "Пояснение" },
    { "id": "3", "label": "Третий тактический или диалоговый ход", "description": "Пояснение" }
  ],
  "extractedAuthorStyle": {
    "styleSummary": "Краткая характеристика авторского стиля (например: Хлёсткий динамичный экшен с лаконичными диалогами)",
    "promptDirective": "Пиши строго в авторском стиле: [инструкции по синтаксису, ритму и лексике]. Исполняй действие игрока точно и без задержек, без нравоучений и лишней воды."
  },
  "nextLogicalStep": {
    "actionLabel": "Сюжетное продолжение авторских правок",
    "sceneText": "Художественный текст следующего логического шага (1-2 абзаца продолжения)",
    "choices": [
      { "id": "1", "label": "Вариант продолжения 1", "description": "Пояснение" },
      { "id": "2", "label": "Вариант продолжения 2", "description": "Пояснение" },
      { "id": "3", "label": "Вариант продолжения 3", "description": "Пояснение" }
    ]
  }
}`;

    const text = await runGeminiWithFallback(prompt, aiSystemPrompt, true, customKey);
    const parsed = JSON.parse(text);
    res.json(parsed);
  } catch (error: any) {
    const fallbackSummary =
      req.body.editedText && req.body.editedText.length > 200
        ? req.body.editedText.slice(0, 200).trim() + "..."
        : req.body.editedText || "Глава обновлена автором.";
    res.json({
      synced: true,
      updatedSummary: fallbackSummary,
      detectedChanges: ["Внесены авторские правки"],
      updatedChoices: [
        {
          id: "1",
          label: "Продолжить действие на основе новых обстоятельств",
          description: "Следовать изменённой ситуации",
        },
        {
          id: "2",
          label: "Оценить обстановку и новые детали",
          description: "Осмотреться",
        },
        {
          id: "3",
          label: "Обсудить перемены со спутниками",
          description: "Сверить планы",
        },
      ],
      extractedAuthorStyle: {
        styleSummary: "Индивидуальный авторский стиль",
        promptDirective:
          "Пиши строго в авторском стиле пользователя: выдерживай ритмику предложений автора, акцент на действиях и диалогах, без навязчивого морализаторства и лишней воды.",
      },
      nextLogicalStep: req.body.generateNextStep
        ? {
            actionLabel: "Сюжетное продолжение авторских правок",
            sceneText:
              "События незамедлительно подстроились под новые обстоятельства. Мир вокруг реагирует на обновлённую реальность.",
            choices: [
              {
                id: "1",
                label: "Двигаться дальше по новому пути",
                description: "Следовать сюжету",
              },
              {
                id: "2",
                label: "Оценить обстановку",
                description: "Внимательно изучить окружение",
              },
              {
                id: "3",
                label: "Сделать шаг вперёд",
                description: "Принять вызов",
              },
            ],
          }
        : undefined,
    });
  }
});

// 8. Story Memory Recall (Player asks: "What happened before?", "What did we learn about X?")
app.post("/api/story/memory-recall", async (req, res) => {
  try {
    const { query, memoryChapters, lorebook, characters, storyTitle, customKey, coAuthorAgreements } = req.body;
    const ai = getGeminiClient(customKey);
    const agreementsBlock = formatAgreementsPromptBlock(coAuthorAgreements);

    const chaptersText = (memoryChapters || [])
      .map((c: any) => `Глава ${c.chapterNumber}: ${c.title}. ${c.summary}`)
      .join("\n");
    const loreText = (lorebook || [])
      .map((l: any) => `${l.title}: ${l.description}`)
      .join("\n");

    const prompt = `Ты — Хранитель Памяти и Хроник истории "${storyTitle}".
Игрок задаёт вопрос о прошлых событиях или деталях мира: "${query}".

${agreementsBlock}

Хроника прошлых глав:
${chaptersText || "История только началась."}

Факты из лорбука:
${loreText || "Особых записей пока нет."}

Персонажи:
${(characters || []).map((c: any) => `${c.name}: ${c.bio}`).join("; ")}

Ответь игроку ёмко, точно и атмосферно на русском языке, напоминая нужные факты без спойлеров наперёд.`;

    if (!ai) {
      return res.json({
        answer: `На основе ваших записей: в предыдущих главах вы встретили ключевых спутников и продвинулись по сюжету. Каждое принятое вами решение зафиксировано в Хронике.`,
      });
    }

    const text = await runGeminiWithFallback(prompt, undefined, false, customKey);
    res.json({ answer: text });
  } catch (error: any) {
    res.json({ answer: "Хроника хранит все ваши шаги. Продолжайте путь!" });
  }
});

// 8.1. Deep Character Fandom & Lore Enrichment (Cross-referencing global canon, fanfics, reviews & archetypes)
app.post("/api/characters/deep-enrich", async (req, res) => {
  try {
    const { characterName, role, universe, currentStory, currentBio, customKey } = req.body;
    const ai = getGeminiClient(customKey);

    const prompt = `Ты — всемирный эксперт по канону мировой литературы, аниме, кино, мифологии, фанфикам и фанатским энциклопедиям (Wikia, Fandom, Reddit, TV Tropes, Ficbook, AO3).
Твоя задача — глубоко синтезировать всестороннее досье персонажа:
Имя: "${characterName}"
Роль/статус: "${role || "Спутник / союзник"}"
Вселенная/сеттинг: "${universe || "Фэнтези"}"
История: "${currentStory || "Приключение"}"
Текущие сведения: "${currentBio || ""}"

ТРЕБОВАНИЯ К СИНТЕЗУ:
1. Ищи и сопоставляй информацию со ВСЕХ мировых источников (каноничные книги/серии, спин-оффы, фанфики, обзоры, психологические анализы персонажа).
2. Выяви:
   - Точное место происхождения (родину, клан, город, мир или цитадель).
   - Уникальные умения, техники боя, заклинания или мастерство, присущие именно этому образу.
   - Заслуги, подвиги и события прошлого, за которые персонаж получил признание или дурную славу.
   - Текущее дело или миссию в отряде.
   - Темперамент (холерик, сангвиник, флегматик, меланхолик), глубокие противоречия характера, привычки и стиль речи.
3. Если персонаж оригинальный (авторский) — синтезируй для него уникальный, неповторимый шаблон на стыке лучших мировых архетипов, чтобы избежать клише и повторений.
4. ВАЖНО: Этот профиль служит богатым шаблоном-фундаментом. По ходу сюжета и действий автора любые детали могут меняться.

Верни строго JSON:
{
  "name": "${characterName}",
  "role": "${role || "Ключевой союзник"}",
  "origin": "Точное место происхождения / родина / мир / фракция",
  "abilities": ["Конкретное умение 1", "Боевой стиль или магия 2", "Особый талант 3"],
  "merits": ["Знаменитый подвиг или заслуга 1", "Второе знаковое достижение или поступок 2"],
  "currentStatus": "Чем занят прямо сейчас / роль в группе",
  "temperament": "сангвиник|холерик|флегматик|меланхолик",
  "traits": ["Глубокая черта 1", "Черта 2", "Черта 3"],
  "habits": ["Запоминающаяся привычка 1", "Характерный жест 2"],
  "speechStyle": "Узнаваемая манера речи, интонации и тембр",
  "secret": "Скрытый мотив, тайна прошлого или внутренний конфликт",
  "fandomArchetypeNotes": "Синтез трактовок из канона, фанфикшена и обзоров",
  "bio": "Красивая, глубокая литературная биография персонажа (2-3 выразительных абзаца на русском языке)"
}`;

    if (!ai) {
      return res.json({
        name: characterName,
        role: role || "Верный спутник",
        origin: "Вольные земли Серебряного Рубежа",
        abilities: ["Мастерство фехтования", "Чтение древних рун", "Чутьё опасности"],
        merits: ["Защитил пограничный караван от засады", "Раскрыл тайну пропавшего архива"],
        currentStatus: "Охраняет протагониста и изучает обстановку",
        temperament: "сангвиник",
        traits: ["Преданный", "Проницательный", "Остроумный"],
        habits: ["Прислушивается к малейшим шорохам", "Проверяет баланс клинка"],
        speechStyle: "Спокойный, уверенный голос с лёгкой иронией",
        secret: "Хранит клятву, данную погибшему наставнику",
        fandomArchetypeNotes: "Синтез классического архетипа верного защитника с чертами рефлексирующего следопыта",
        bio: `${characterName} — человек с богатым и противоречивым прошлым. Пройдя сквозь бесчисленные испытания, герой приобрёл не только боевое мастерство, но и редкую способность сохранять ясный ум в моменты наивысшей опасности.\n\nВступив в этот поход, ${characterName} преследует как общее дело, так и глубоко личную цель, о которой предпочитает не говорить вслух.`
      });
    }

    const text = await runGeminiWithFallback(prompt, undefined, true, customKey);
    const parsed = JSON.parse(text);
    res.json(parsed);
  } catch (error: any) {
    console.warn("Deep character enrich fallback used:", error?.message);
    const characterName = req.body.characterName || "Спутник";
    const role = req.body.role || "Верный спутник";
    res.json({
      name: characterName,
      role: role,
      origin: "Вольные земли Серебряного Рубежа",
      abilities: ["Мастерство фехтования", "Чтение древних рун", "Чутьё опасности"],
      merits: ["Защитил пограничный караван от засады", "Раскрыл тайну пропавшего архива"],
      currentStatus: "Охраняет протагониста и изучает обстановку",
      temperament: "сангвиник",
      traits: ["Преданный", "Проницательный", "Остроумный"],
      habits: ["Прислушивается к малейшим шорохам", "Проверяет баланс клинка"],
      speechStyle: "Спокойный, уверенный голос с лёгкой иронией",
      secret: "Хранит клятву, данную погибшему наставнику",
      fandomArchetypeNotes: "Синтез классического архетипа верного защитника с чертами рефлексирующего следопыта",
      bio: `${characterName} — человек с богатым и противоречивым прошлым. Пройдя сквозь бесчисленные испытания, герой приобрёл не только боевое мастерство, но и редкую способность сохранять ясный ум в моменты наивысшей опасности.\n\nВступив в этот поход, ${characterName} преследует как общее дело, так и глубоко личную цель, о которой предпочитает не говорить вслух.`
    });
  }
});

// 9. Deep Import & Story Analysis (Import any chapter, fanfic, book excerpt, or save)
app.post("/api/story/import-analyze", async (req, res) => {
  try {
    const { importedText, customKey } = req.body;
    if (!importedText || typeof importedText !== "string" || importedText.trim().length < 20) {
      return res.status(400).json({ error: "Слишком короткий текст для анализа" });
    }

    const ai = getGeminiClient(customKey);
    const prompt = `Ты — ведущий литературный аналитик и Game Master в StoryZone.
Пользователь импортировал текст истории (главу книги, фанфик, игровой лог или авторский черновик).
Вот текст:
"""
${importedText.slice(0, 12000)}
"""

Твоя задача — глубоко проанализировать этот текст и подготовить полноценную интерактивную кампанию, чтобы игрок мог ПРОДОЛЖИТЬ историю прямо с того места, где текст завершился!

Верни строго JSON со следующей структурой:
{
  "title": "Звучное название истории на основе текста",
  "genre": "Фэнтези|Киберпанк|Тёмная романтика|Мистика и детектив|Постапокалипсис|Аниме и исекай|Космоопера|Фанфики",
  "synopsis": "Краткий синопсис предыстории (2-3 предложения)",
  "atmosphere": "mysterious|action|romantic|dark|triumphant|calm",
  "narrativeStyle": "literary|conversational|noir|cinematic|anime|fanfiction",
  "narrativePOV": "first|second|third",
  "currentScene": "Кульминационная сцена или текущая ситуация, на которой остановился текст, оформленная для интерактивной игры (2-4 выразительных абзаца на русском языке)",
  "characters": [
    {
      "name": "Имя персонажа/спутника",
      "role": "Его роль/статус",
      "affinity": 60,
      "affinityTitle": "Союзник",
      "temperament": "холерик|сангвиник|флегматик|меланхолик",
      "traits": ["Черта 1", "Черта 2"],
      "habits": ["Привычка персонажа"],
      "speechStyle": "Манера речи",
      "bio": "Краткая предыстория",
      "avatar": "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=400"
    }
  ],
  "startingInventory": ["Предмет или оружие, обнаруженное в тексте", "Второй предмет"],
  "startingStats": {
    "hp": 95,
    "maxHp": 100,
    "energy": 90,
    "maxEnergy": 100,
    "gold": 40,
    "karma": 10,
    "strength": 12,
    "agility": 14,
    "intellect": 13,
    "charisma": 12
  },
  "memoryChapters": [
    {
      "chapterNumber": 1,
      "title": "События импортированного пролога",
      "summary": "Краткая выжимка предшествующих событий для долгосрочной памяти сюжета",
      "keyFacts": ["Ключевой факт 1", "Ключевой факт 2"]
    }
  ],
  "lorebook": [
    {
      "title": "Локация или правило мира",
      "category": "локация|правило_мира|артефакт|персонаж",
      "description": "Пояснение о мире из импортированного текста"
    }
  ],
  "starterChoices": [
    {
      "id": "1",
      "label": "Смелое решительное действие",
      "description": "Пояснение",
      "statCheck": "strength|agility|intellect|charisma",
      "diceDifficulty": 12
    },
    {
      "id": "2",
      "label": "Диалоговое или дипломатическое решение",
      "description": "Пояснение"
    },
    {
      "id": "3",
      "label": "Осторожный тактический ход",
      "description": "Пояснение"
    }
  ]
}`;

    if (!ai) {
      // Offline fallback for import analysis
      const lines = importedText.trim().split(/\n+/).filter((l: string) => l.trim().length > 0);
      const fallbackTitle = lines[0]?.slice(0, 60) || "Импортированная глава";
      const fallbackScene = lines.slice(-3).join("\n\n") || importedText.slice(0, 500);

      return res.json({
        title: fallbackTitle,
        genre: "Фэнтези",
        synopsis: "История продолжена из импортированного фрагмента текста.",
        atmosphere: "mysterious",
        narrativeStyle: "literary",
        narrativePOV: "second",
        currentScene: fallbackScene,
        characters: [
          {
            name: "Спутник",
            role: "Верный союзник",
            affinity: 60,
            affinityTitle: "Союзник",
            temperament: "сангвиник",
            traits: ["Наблюдательный", "Преданный"],
            habits: ["Оглядывается по сторонам"],
            speechStyle: "Сдержанный",
            bio: "Спутник, сопровождающий вас в этом опасном приключении.",
            avatar: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=400",
          },
        ],
        startingInventory: ["Дорожный кинжал", "Фляга с водой", "Старинная карта"],
        startingStats: {
          hp: 100,
          maxHp: 100,
          energy: 90,
          maxEnergy: 100,
          gold: 50,
          karma: 0,
          strength: 12,
          agility: 12,
          intellect: 12,
          charisma: 12,
        },
        memoryChapters: [
          {
            chapterNumber: 1,
            title: "Начало хроники",
            summary: "Вы прибыли в эту точку после череды напряжённых событий.",
            keyFacts: ["События импортированного фрагмента сохранены в памяти"],
          },
        ],
        lorebook: [
          {
            title: "Местные земли",
            category: "локация",
            description: "Опасный регион, где каждое неверное движение привлекает ненужное внимание.",
          },
        ],
        starterChoices: [
          { id: "1", label: "Продолжить движение вперёд", description: "Использовать преимущество инициативы" },
          { id: "2", label: "Оценить обстановку и затаиться", description: "Убедиться в безопасности тыла" },
          { id: "3", label: "Обратиться к спутнику", description: "Согласовать дальнейший план действий" },
        ],
      });
    }

    const text = await runGeminiWithFallback(prompt, undefined, true, customKey);
    const parsed = JSON.parse(text);
    res.json(parsed);
  } catch (error: any) {
    console.error("Import analysis error:", error);
    res.status(500).json({ error: "Не удалось провести анализ текста" });
  }
});

// 10. Scene Art Generator (AI Visuals based on scene & characters)
app.post("/api/ai/generate-scene-art", async (req, res) => {
  try {
    const { sceneText, storyTitle, genre, atmosphere, characters, artStyle, customKey } = req.body;
    const ai = getGeminiClient(customKey);

    const styleName = artStyle || "cinematic digital painting";
    const charNames = (characters || []).map((c: any) => c.name).join(", ") || "the hero";

    // 1. Build a vivid visual prompt
    const promptEngineeringPrompt = `You are a master art director. Convert this interactive story scene into a breathtaking, evocative English visual prompt for digital art generation.
Story: "${storyTitle}" (Genre: ${genre}, Mood: ${atmosphere || "dramatic"}).
Characters involved: ${charNames}.
Style: ${styleName}.
Scene excerpt:
"${(sceneText || "").slice(0, 1000)}"

Return strictly a JSON object:
{
  "visualPrompt": "A detailed 1-2 sentence prompt in English specifying lighting, composition, colors, characters, focal point, and cinematic environment. No text, no captions.",
  "sceneMoodColor": "A hex color code representing the lighting atmosphere (e.g. #7c3aed or #ea580c)",
  "artNotes": "Short Russian explanation of the visual concept"
}`;

    let visualPrompt = `Cinematic digital illustration of a climactic moment in a ${genre || "fantasy"} world. ${sceneText?.slice(0, 200) || "Dramatically lit environment with depth and rich atmosphere"}. Highly detailed, ${styleName}, 8k wallpaper.`;
    let artNotes = "Художественная визуализация текущей сцены с акцентом на атмосферу и окружение.";

    if (ai) {
      try {
        const promptText = await runGeminiWithFallback(promptEngineeringPrompt, undefined, true, customKey);
        const parsedPrompt = JSON.parse(promptText || "{}");
        if (parsedPrompt.visualPrompt) visualPrompt = parsedPrompt.visualPrompt;
        if (parsedPrompt.artNotes) artNotes = parsedPrompt.artNotes;
      } catch (e) {
        // use default prompt
      }
    }

    // 2. Attempt direct image generation with gemini-3.1-flash-lite-image
    if (ai) {
      try {
        const imgRes = await ai.models.generateContent({
          model: "gemini-3.1-flash-lite-image",
          contents: {
            parts: [{ text: visualPrompt }],
          },
          config: {
            imageConfig: {
              aspectRatio: "16:9",
            },
          },
        });

        if (imgRes && imgRes.candidates && imgRes.candidates[0]?.content?.parts) {
          for (const part of imgRes.candidates[0].content.parts) {
            if (part.inlineData && part.inlineData.data) {
              const base64Url = `data:${part.inlineData.mimeType || "image/png"};base64,${part.inlineData.data}`;
              return res.json({
                imageUrl: base64Url,
                prompt: visualPrompt,
                isAiGenerated: true,
                artStyle: styleName,
                artNotes,
              });
            }
          }
        }
      } catch (imgErr: any) {
        console.warn("Direct image model generation skipped or failed, providing curated atmosphere art:", imgErr?.message || imgErr);
      }
    }

    // Curated high-res themed backdrop fallback
    const atmosphereThemes: Record<string, string[]> = {
      action: [
        "https://images.unsplash.com/photo-1579783900882-c0d3dad7b119?w=1200&q=80",
        "https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=1200&q=80",
      ],
      dark: [
        "https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=1200&q=80",
        "https://images.unsplash.com/photo-1509198397868-475647b2a1e5?w=1200&q=80",
      ],
      romantic: [
        "https://images.unsplash.com/photo-1516589178581-6cd7833ae3b2?w=1200&q=80",
        "https://images.unsplash.com/photo-1518895949257-7621c3c786d7?w=1200&q=80",
      ],
      triumphant: [
        "https://images.unsplash.com/photo-1506744038136-46273834b3fb?w=1200&q=80",
        "https://images.unsplash.com/photo-1534447677768-be436bb09401?w=1200&q=80",
      ],
      calm: [
        "https://images.unsplash.com/photo-1448375240586-882707db888b?w=1200&q=80",
        "https://images.unsplash.com/photo-1511497584788-87676104235f?w=1200&q=80",
      ],
      mysterious: [
        "https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=1200&q=80",
        "https://images.unsplash.com/photo-1509198397868-475647b2a1e5?w=1200&q=80",
      ],
    };

    const list = atmosphereThemes[atmosphere || "mysterious"] || atmosphereThemes.mysterious;
    const chosenUrl = list[Math.floor(Math.random() * list.length)];

    res.json({
      imageUrl: chosenUrl,
      prompt: visualPrompt,
      isAiGenerated: false,
      artStyle: styleName,
      artNotes: artNotes || "Атмосферный визуальный арт подобран под динамику и настроение сцены.",
    });
  } catch (error: any) {
    res.json({
      imageUrl: "https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=1200&q=80",
      prompt: "Cinematic story scene with rich atmosphere",
      isAiGenerated: false,
      artNotes: "Визуальная сцена сформирована.",
    });
  }
});

// 11. AI Style Analysis and Critique (Evaluates text conformity to narrative style & offers suggestions)
app.post("/api/story/analyze-style", async (req, res) => {
  try {
    const { sceneText, targetStyle, targetPOV, genre, customKey } = req.body;
    const ai = getGeminiClient(customKey);

    const prompt = `Ты — ведущий литературный редактор и стилистический критик интерактивной прозы.
Оцени текущий текст сцены на строгое соответствие выбранному авторскому стилю.

ЦЕЛЕВОЙ СТИЛЬ: "${targetStyle || "literary"}" (literary = художественный богатый слог; conversational = живой разговорный современный; noir = нуарный циничный детектив; cinematic = кинематографичный блокбастер; anime = ранобэ/аниме экспрессия; fanfiction = чувственный фанфикшн).
ЦЕЛЕВОЕ ЛИЦО: "${targetPOV || "second"}".
ЖАНР: "${genre || "Фэнтези"}".

ТЕКСТ ДЛЯ АНАЛИЗА:
"""
${(sceneText || "").slice(0, 5000)}
"""

Верни строго JSON:
{
  "overallScore": 88,
  "styleMatchRating": "Идеально|Хорошо|Требует доработки|Слабо",
  "breakdown": {
    "vocabularyScore": 90,
    "pacingScore": 85,
    "dialogueBalanceScore": 84,
    "atmosphereScore": 92
  },
  "strengths": [
    "Сильная сторона текста 1",
    "Сильная сторона текста 2"
  ],
  "divergences": [
    "Где текст отклоняется от канонов выбранного стиля 1"
  ],
  "actionableTips": [
    "Практический совет по улучшению 1",
    "Практический совет по улучшению 2"
  ],
  "improvedVersion": "Полная художественно переписанная версия этой сцены, доведённая до идеала в выбранном стиле (на русском языке, 3-4 абзаца)"
}`;

    if (!ai) {
      return res.json({
        overallScore: 86,
        styleMatchRating: "Хорошо",
        breakdown: {
          vocabularyScore: 88,
          pacingScore: 84,
          dialogueBalanceScore: 82,
          atmosphereScore: 90,
        },
        strengths: [
          "Чётко выдержан фокус на решениях протагониста",
          "Хорошая эмоциональная напряжённость в кульминации",
        ],
        divergences: [
          "Можно добавить чуть больше чувственных сенсорных деталей (запахи, эхо, свет)",
        ],
        actionableTips: [
          "Усильте контраст между речью персонажей и их внутренними переживаниями",
          "Используйте более динамичные глаголы действия в моменты опасности",
        ],
        improvedVersion: sceneText
          ? sceneText + "\n\nВоздух застыл в тревожном ожидании, а каждый ваш вдох теперь отзывался гулким эхом в тишине."
          : "Текст сцены обновлен.",
      });
    }

    const text = await runGeminiWithFallback(prompt, undefined, true, customKey);
    const parsed = JSON.parse(text);
    res.json(parsed);
  } catch (error: any) {
    console.error("Style analysis error:", error);
    res.json({
      overallScore: 80,
      styleMatchRating: "Хорошо",
      breakdown: {
        vocabularyScore: 80,
        pacingScore: 80,
        dialogueBalanceScore: 80,
        atmosphereScore: 80,
      },
      strengths: ["Динамичное развитие ситуации"],
      divergences: ["Стиль можно сделать ещё более выразительным"],
      actionableTips: ["Добавьте больше атмосферных эпитетов"],
      improvedVersion: req.body.sceneText || "",
    });
  }
});

// 13. Tactical Combat Action & Combo Chain Execution
app.post("/api/story/tactical-action", async (req, res) => {
  try {
    const {
      storyTitle,
      genre,
      currentScene,
      characters,
      playerStats,
      inventory,
      tacticalCombo,
      musicBpm,
      customKey,
      aiSystemPrompt: clientSystemPrompt,
      coAuthorAgreements,
    } = req.body;
    const aiSystemPrompt = (clientSystemPrompt || "").trim() || DEFAULT_AI_SYSTEM_PROMPT;
    const agreementsBlock = formatAgreementsPromptBlock(coAuthorAgreements);

    const {
      stance,
      stanceName,
      moves,
      targetDescription,
      styleRank,
      minigameResult,
    } = tacticalCombo || {};

    const movesList = Array.isArray(moves)
      ? moves.map((m: any, i: number) => `${i + 1}. [${m.category}] ${m.name} (${m.description})`).join("\n")
      : "Быстрый тактический удар";

    let minigameNote = "";
    if (minigameResult && minigameResult.success) {
      minigameNote = `\nУСПЕХ МИНИ-ИГРЫ (${minigameResult.type}): ${minigameResult.details || "Игрок филигранно справился с механической/рунической задачей!"} — обязательно включи этот триумфальный момент в сцену!`;
    }

    let rhythmNote = "";
    if (musicBpm) {
      rhythmNote = `\nТЕМП МУЗЫКИ: ${musicBpm} BPM. ${Number(musicBpm) >= 125 ? "Действие стремительное, адреналиновое, хлёсткое!" : "Напряжённое, расчётливое."}`;
    }

    const prompt = `Ты — Мастер Боевых Сцен и Сценарист Экшена в StoryZone.
История: "${storyTitle || "Приключение"}" (Жанр: ${genre || "Боевое фэнтези"}).

${agreementsBlock}

ТЕКУЩАЯ СИТУАЦИЯ:
${currentScene}

ИГРОК ПРИМЕНЯЕТ ТАКТИЧЕСКУЮ СВЯЗКУ:
Боевая стойка / стиль: ${stanceName || stance}
Style Rank игрока: ${styleRank || "A"}
Особая цель / намерение игрока: ${targetDescription || "Одолеть противника и перехватить контроль"}
${minigameNote}
${rhythmNote}

ЦЕПОЧКА ПРИЁМОВ:
${movesList}

ЗАДАЧА:
1. Напиши захватывающую, кинематографичную сцену дуэли или манёвра (3-4 абзаца на русском языке). Стиль — высококлассная художественная проза, а не аркадный лог видеоигры: передай свист рассекаемого воздуха, лязг клинков, напряжение мускулов, сбитое дыхание и тактический расчёт.
2. Подчеркни органичное применение выбранного стиля (${stanceName}).
3. Опиши физический и сюжетный исход: ошеломление противника, изменение расстановки сил или бегство врагов.
4. Варианты выбора должны быть естественными сюжетными путями героя.

Верни строго JSON:
{
  "sceneText": "Текст яркой боевой сцены с непрерывным экшеном",
  "dialogueSpeaker": null,
  "choices": [
    { "id": "1", "label": "Развить преимущество", "description": "Пока враг ошеломлён" },
    { "id": "2", "label": "Осмотреть поверженного / трофеи", "description": "Забрать ценности" },
    { "id": "3", "label": "Оценить обстановку и перезарядить силы", "description": "Восстановить дыхание" }
  ],
  "statChanges": {
    "hp": 0,
    "energy": -15,
    "gold": 10
  },
  "affinityChanges": [],
  "atmosphere": "action",
  "suggestedMusic": "battle",
  "chapterSummary": "Вы виртуозно провели тактическую комбо-связку (${stanceName}), переломив ход боя.",
  "isEnding": false
}`;

    const text = await runGeminiWithFallback(prompt, aiSystemPrompt, true, customKey);
    const parsed = JSON.parse(text);
    res.json(parsed);
  } catch (e: any) {
    console.error("Tactical action error:", e);
    res.json({
      sceneText: `Вы переходите в боевую стойку «${req.body.tacticalCombo?.stanceName || "Боевая стойка"}»! Первый молниеносный выпад застаёт противника врасплох, выбивая оружие из его рук. Слитным движением вы проводите завершающую серию ударов — враг отлетает к стене, с грохотом сбивая ящики. Пыль медленно оседает. Схватка окончена в вашу пользу!`,
      dialogueSpeaker: null,
      choices: [
        { id: "1", label: "Обыскать противника и забрать трофеи", description: "Найти ценности и ключ" },
        { id: "2", label: "Быстро уйти из опасной зоны", description: "Пока не подоспели союзники врага" },
        { id: "3", label: "Проверить спутников", description: "Убедиться, что никто не ранен" },
      ],
      statChanges: { hp: 0, energy: -15, gold: 15 },
      affinityChanges: [],
      atmosphere: "action",
      suggestedMusic: "battle",
      chapterSummary: "Вы провели сокрушительную комбо-атаку и одолели врага.",
      isEnding: false,
    });
  }
});

// 14. Canon Divergence & What-If Twist Injector
app.post("/api/story/inject-divergence", async (req, res) => {
  try {
    const {
      storyTitle,
      genre,
      currentScene,
      characters,
      divergencePayload,
      memoryChapters,
      customKey,
      aiSystemPrompt: clientSystemPrompt,
      coAuthorAgreements,
    } = req.body;
    const aiSystemPrompt = (clientSystemPrompt || "").trim() || DEFAULT_AI_SYSTEM_PROMPT;
    const agreementsBlock = formatAgreementsPromptBlock(coAuthorAgreements);

    const {
      type,
      title,
      description,
      characterData,
      retconTargetStep,
      alternativeChoice,
    } = divergencePayload || {};

    const prompt = `Ты — Главный Архитектор Параллельных Времён и Твистов в StoryZone.
История: "${storyTitle}" (Жанр: ${genre}).

${agreementsBlock}

ТЕКУЩАЯ СЦЕНА:
${currentScene}

ДЕЙСТВУЮЩИЕ ПЕРСОНАЖИ:
${(characters || []).map((c: any) => `${c.name} (${c.role})`).join(", ")}

ИГРОК АКТИВИРУЕТ РАЗВИЛКУ КАНОНА / ЭФФЕКТ БАБОЧКИ:
Тип вмешательства: ${type}
Название события/поворота: "${title}"
Суть вмешательства: "${description}"
${characterData ? `ВВОД НОВОГО ПЕРСОНАЖА: Имя: ${characterData.name}, Фандом/Вселенная: ${characterData.fandomUniverse || "Оригинал"}, Роль: ${characterData.role}, Характер: ${characterData.temperament}, Речь: ${characterData.speechStyle}, Био: ${characterData.bio}` : ""}
${retconTargetStep ? `ПЕРЕПИСЫВАНИЕ ПРОШЛОГО (Шаг #${retconTargetStep}): Игрок меняет былое решение на: "${alternativeChoice}".` : ""}

ЗАДАЧА:
1. Создай захватывающую, ошеломляющую новую сцену (3-5 абзацев на русском), где сюжет резко, но органично поворачивает в русло этого события!
2. Если вводится новый персонаж (${characterData?.name || ""}) — опиши его эффектное появление, первые слова и реакцию спутников.
3. Если переписывается развилка прошлого — опиши эффект бабочки: как изменилась реальность вокруг героя.
4. Предложи 3-4 новых увлекательных выбора для игрока в этой обновлённой реальности.

Верни строго JSON:
{
  "sceneText": "Текст сцены с учётом нового поворота / персонажа / эффекта бабочки",
  "dialogueSpeaker": "${characterData ? characterData.name : "null"}",
  "choices": [
    { "id": "1", "label": "Первое действие в новой реальности", "description": "Пояснение" },
    { "id": "2", "label": "Второе действие", "description": "Пояснение" },
    { "id": "3", "label": "Третье действие", "description": "Пояснение" }
  ],
  "divergenceSummary": "Краткая хроника изменения временной линии для журнала сюжета",
  "atmosphere": "mysterious|action|dramatic|triumphant",
  "suggestedMusic": "mystic|battle|dark|cyber"
}`;

    const text = await runGeminiWithFallback(prompt, aiSystemPrompt, true, customKey);
    const parsed = JSON.parse(text);
    res.json(parsed);
  } catch (e: any) {
    console.error("Divergence injection error:", e);
    const dTitle = req.body.divergencePayload?.title || "Неожиданный поворот";
    res.json({
      sceneText: `Ткань реальности с лёгким треском искажается, когда происходит непредвиденное: ${dTitle}! События мгновенно выходят из привычного русла. Все взгляды устремляются к источнику шума. Прежний план теряет смысл — теперь правила диктует новая ситуация.`,
      dialogueSpeaker: null,
      choices: [
        { id: "1", label: "Использовать суматоху в свою пользу", description: "Действовать решительно" },
        { id: "2", label: "Занять безопасную позицию и наблюдать", description: "Оценить масштаб изменений" },
        { id: "3", label: "Обратиться к союзникам за поддержкой", description: "Сплотить группу" },
      ],
      divergenceSummary: `Событие: "${dTitle}" изменило ход главы.`,
      atmosphere: "mysterious",
      suggestedMusic: "mystic",
    });
  }
});

// 15. Universal Universe Summoner (Re-create ANY book, movie, anime, myth, fanfic)
app.post("/api/story/summon-universe", async (req, res) => {
  try {
    const { universeQuery, userPrompt, customKey, aiSystemPrompt: clientSystemPrompt } = req.body;
    const aiSystemPrompt = (clientSystemPrompt || "").trim() || DEFAULT_AI_SYSTEM_PROMPT;

    const prompt = `Ты — Великий Творец Интерактивных Вселенных в StoryZone.
Пользователь запросил воссоздание интерактивной истории по мотивам:
ВСЕЛЕННАЯ / ПРОИЗВЕДЕНИЕ: "${universeQuery}"
ПОЖЕЛАНИЯ К СЮЖЕТУ И РОЛИ: "${userPrompt || "Каноничная атмосфера, захватывающий стартовый конфликт, глубокие персонажи"}".

Создай полноценную, готовую к запуску текстовую RPG-историю по этой вселенной на русском языке.
Сохрани аутентичную терминологию, атмосферу, характерные детали и дух оригинала.

Верни строго JSON:
{
  "title": "Звучное название истории по этой вселенной",
  "genre": "Фэнтези|Киберпанк|Аниме и исекай|Космоопера|Мистика и детектив|Фанфики|Тёмная романтика",
  "synopsis": "Захватывающий синопсис (2-3 предложения)",
  "startingScene": "Кинематографичная первая сцена, сразу бросающая игрока в центр интриги или опасности (3-4 абзаца на русском языке)",
  "characters": [
    {
      "name": "Имя каноничного или ключевого персонажа вселенной",
      "role": "Роль (Союзник, Наставник, Соперник)",
      "affinity": 50,
      "affinityTitle": "Знакомый",
      "temperament": "сангвиник|холерик|флегматик|меланхолик",
      "traits": ["Черта 1", "Черта 2", "Черта 3"],
      "habits": ["Характерная привычка"],
      "speechStyle": "Узнаваемый стиль речи персонажа",
      "bio": "Краткая предыстория",
      "avatar": "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=400"
    },
    {
      "name": "Второй колоритный обитатель мира",
      "role": "Роль",
      "affinity": 45,
      "affinityTitle": "Нейтрален",
      "temperament": "флегматик",
      "traits": ["Черта 1", "Черта 2"],
      "habits": ["Привычка"],
      "speechStyle": "Стиль речи",
      "bio": "Предыстория",
      "avatar": "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=400"
    }
  ],
  "startingInventory": ["Аутентичный предмет мира 1", "Предмет 2", "Предмет 3"],
  "starterChoices": [
    { "id": "1", "label": "Действие в духе героя канона", "description": "Пояснение" },
    { "id": "2", "label": "Осторожный тактический маневр", "description": "Пояснение" },
    { "id": "3", "label": "Неожиданный диалог или обращение к спутнику", "description": "Пояснение" }
  ]
}`;

    const text = await runGeminiWithFallback(prompt, aiSystemPrompt, true, customKey);
    const parsed = JSON.parse(text);
    res.json(parsed);
  } catch (e: any) {
    console.error("Summon universe error:", e);
    const q = req.body.universeQuery || "Легендарная Вселенная";
    res.json({
      title: `${q}: Хроники Судьбы`,
      genre: "Фэнтези",
      synopsis: `Интерактивное приключение по мотивам вселенной «${q}». Ваши решения определят будущее этого мира.`,
      startingScene: `Вы ступаете в мир «${q}». В воздухе пахнет грозой и грядущими переменами. Тени сгущаются, а вдали уже раздаются звуки приближающегося испытания. Ваши пальцы привычно сжимают рукоять дорожного клинка, а взгляд выхватывает знакомые черты древних строений. Приключение начинается прямо сейчас.`,
      characters: [
        {
          name: "Верный спутник",
          role: "Проводник и союзник",
          affinity: 50,
          affinityTitle: "Нейтрален",
          temperament: "сангвиник",
          traits: ["Надёжный", "Опытный", "Внимательный"],
          habits: ["Оглядывается на каждый шорох"],
          speechStyle: "Уверенный и лаконичный",
          bio: `Уроженец мира «${q}», готовый пройти с вами сквозь огонь и воду.`,
          avatar: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=400",
        },
      ],
      startingInventory: ["Дорожный плащ", "Снаряжение следопыта", "Амулет удачи"],
      starterChoices: [
        { id: "1", label: "Шагнуть вперёд навстречу неизвестности", description: "Принять вызов мира" },
        { id: "2", label: "Обсудить дальнейший план со спутником", description: "Выслушать совет" },
        { id: "3", label: "Тщательно проверить оружие и прислушаться к ветру", description: "Быть начеку" },
      ],
    });
  }
});

// 15.5. AI Co-Author & Story Consultant Chat
app.post("/api/story/chat", async (req, res) => {
  try {
    const {
      storyTitle,
      genre,
      currentScene,
      characters,
      inventory,
      stepCount,
      memoryChapters,
      lorebook,
      narrativeStyle,
      narrativePOV,
      generationLength,
      aiSystemPrompt: clientSystemPrompt,
      aiPromptDirective,
      messages,
      userMessage,
      customKey,
      universeSetting,
      searchGroundingEnabled: reqSearchGrounding,
      coAuthorAgreements,
      authorDictateMode,
      strictActionFidelity = true,
      proportionalActionScaling = true,
    } = req.body;

    const ai = getGeminiClient(customKey);
    const aiSystemPrompt = (clientSystemPrompt || "").trim() || DEFAULT_AI_SYSTEM_PROMPT;

    const universe = universeSetting || {};
    const universeName = universe.universeName || genre || "Авторский мир";
    const settingDesc = universe.settingDescription || "Уникальный сеттинг и правила мира";
    const factions = Array.isArray(universe.factions) && universe.factions.length > 0
      ? universe.factions.join(", ")
      : "Фракции и силы мира";
    const worldRules = Array.isArray(universe.worldRules) && universe.worldRules.length > 0
      ? universe.worldRules.join("; ")
      : "Каноничные законы мира";
    const canonStrictness = universe.canonStrictness || "adaptive";
    const searchGroundingEnabled = Boolean(universe.searchGroundingEnabled ?? reqSearchGrounding);

    const safeCharacters = Array.isArray(characters) ? characters : [];
    const charactersText = safeCharacters.length > 0
      ? safeCharacters.map((c: any) => `• ${c.name} (${c.role || "спутник"}): Отношение ${c.affinity || 50}%. Черты: ${(c.traits || []).join(", ") || "—"}. Статус: ${c.currentStatus || "в отряде"}`).join("\n")
      : "Спутников пока нет";

    const inventoryText = Array.isArray(inventory) && inventory.length > 0
      ? inventory.join(", ")
      : "Инвентарь пуст";

    const memoryText = Array.isArray(memoryChapters) && memoryChapters.length > 0
      ? memoryChapters.slice(-15).map((m: any) => `• Глава ${m.chapterNumber || ""}: «${m.title || ""}» | Решение/ход автора: «${m.chosenAction || "Начало пути"}» — ${m.summary || ""}`).join("\n")
      : "Первая глава повести";

    const loreText = Array.isArray(lorebook) && lorebook.length > 0
      ? lorebook.slice(-15).map((l: any) => `• [${l.category || "факт"}] ${l.title}: ${l.description}`).join("\n")
      : "Особые тайны пока не зафиксированы";

    const agreementsText = Array.isArray(coAuthorAgreements) && coAuthorAgreements.length > 0
      ? coAuthorAgreements.map((a: any, idx: number) => `• [${a.category || "правило_сюжета"}] «${a.title || `Деталь #${idx + 1}`}»: ${a.content}`).join("\n")
      : "Пока нет зафиксированных договоренностей";

    const recentChat = Array.isArray(messages)
      ? messages.slice(-8).map((m: any) => `${m.role === "user" ? "Автор" : "ИИ-Соавтор"}: ${m.content}`).join("\n")
      : "";

    const isDictateTrigger = Boolean(
      authorDictateMode ||
      (userMessage && (
        userMessage.toLowerCase().includes("принять сюжет") ||
        userMessage.toLowerCase().includes("принудительно") ||
        userMessage.toLowerCase().includes("утверди сюжет") ||
        userMessage.toLowerCase().includes("не спорь") ||
        userMessage.toLowerCase().includes("без споров") ||
        userMessage.toLowerCase().includes("я так решил") ||
        userMessage.toLowerCase().includes("закрепи поворот")
      ))
    );

    const prompt = `Ты — Персональный ИИ-Соавтор, Архитектор Сюжета и Мастер Игры (Game Master) для интерактивной книги в StoryZone.
История: "${storyTitle || "Интерактивная повесть"}" (Жанр: ${genre || "Фэнтези"}).
Текущий шаг: ${stepCount || 1}.
Текущий стиль: ${narrativeStyle || "brutal"}.
Текущая длина глав: ${generationLength || "medium"}.
Повествование: от ${narrativePOV === "first" ? "1-го лица (Я)" : narrativePOV === "third" ? "3-го лица" : "2-го лица (Вы)"}.

=== ВСЕЛЕННАЯ И СЕТТИНГ (СТРОГИЙ КАНОНИЧЕСКИЙ БЭКГРАУНД) ===
• Активная Вселенная: «${universeName}»
• Описание сеттинга: ${settingDesc}
• Ключевые фракции: ${factions}
• Законы и правила мира: ${worldRules}
• Режим канона: ${canonStrictness === "strict" ? "СТРОГИЙ КАНОН ВСЕЛЕННОЙ" : canonStrictness === "alternate" ? "АЛЬТЕРНАТИВНАЯ ВСЕЛЕННАЯ" : "АДАПТИВНЫЙ КАНОН"}
• Поиск актуального канона через Google Search: ${searchGroundingEnabled ? "ВКЛЮЧЕН (активно проверяй факты, хронологию и реалии вселенной через Google Search!)" : "ВЫКЛЮЧЕН"}

=== СОГЛАСОВАННЫЕ ДЕТАЛИ И ДОГОВОРЁННОСТИ С СОАВТОРОМ (СТРОГИЙ КАНОН) ===
${agreementsText}
НЕПРЕЛОЖНОЕ ТРЕБОВАНИЕ: Никогда не забывай об этих согласованных деталях! Опирайся на них во всех ответах и сюжетных ходах.

АКТИВНЫЙ КАНОН ТЕКУЩЕЙ СЦЕНЫ:
${currentScene || "Начало странствия"}

ДЕЙСТВУЮЩИЕ СПУТНИКИ И ПЕРСОНАЖИ В ОТРЯДЕ ИГРОКА:
${charactersText}

ИНВЕНТАРЬ И ПРЕДМЕТЫ:
${inventoryText}

ХРОНИКА ПРОШЛЫХ ГЛАВ И РЕШЕНИЙ АВТОРА:
${memoryText}

ИЗВЕСТНЫЙ ЛОР И ТАЙНЫ:
${loreText}

ТВОРЧЕСКАЯ ДИРЕКТИВА АВТОРА:
«${aiPromptDirective || "Лаконичный слог, исполнение воли игрока"}»

НЕДАВНИЙ ДИАЛОГ С СОАВТОРОМ:
${recentChat || "Диалог только начинается"}

НОВЫЙ ЗАПРОС ЧИТАТЕЛЯ/АВТОРА К ТЕБЕ (СОАВТОРУ):
"${userMessage || "Что посоветуешь предпринять дальше?"}"

${isDictateTrigger ? `=== СВЕРХРЕЖИМ: БЕЗОГОВОРОЧНОЕ ПРИНЯТИЕ СЮЖЕТА (ДИКТАТ АВТОРА / ПРИНУДИТЕЛЬНОЕ СОГЛАСИЕ) ===
• АВТОР — ГЛАВНЫЙ СЦЕНАРИСТ И ВЛАДЕЛЕЦ ИСТОРИИ.
• КАТЕГОРИЧЕСКИ ЗАПРЕЩЕНО спорить с автором о каноне, выдвигать возражения, критиковать его замысел или читать нотации!
• Если автор говорит что нужно сделать или задаёт сюжетный поворот:
  1. Сразу скажи: «Принято, Автор! Твоё слово — непреложный закон сюжета. Никаких споров: закрепляем этот поворот в канон безоговорочно.»
  2. Поддержи замысел автора с энтузиазмом и покажи, как эффектно раскрыть его в повествовании.
  3. ОБЯЗАТЕЛЬНО сформируй "actionProposal" с type: "accept_plot":
     {
       "type": "accept_plot",
       "title": "⚡ Безоговорочно утвердить сюжет в канон",
       "description": "Принять данный сюжетный поворот автора в канон истории без споров",
       "payload": {
         "title": "Утверждённый поворот: ${userMessage ? userMessage.slice(0, 45).replace(/"/g, "'") : "Воля автора"}",
         "content": "${userMessage ? userMessage.slice(0, 160).replace(/"/g, "'") : "Сюжетный поворот утверждён автором"}",
         "category": "plot_rule",
         "targetSceneText": null
       }
     }
  4. Автор должен сразу получить в интерфейсе кнопку немедленного принятия сюжета!
` : `=== ВАЖНО: АНАЛИЗ И СОВЕТЫ СОАВТОРА ===
1. Будь честным профессиональным соавтором. Если автор спрашивает твоё объективное мнение — аргументируй с опорой на лор.
2. Но если автор прямо просит утвердить сюжет («принять сюжет», «утверди», «без споров») — никогда не спорь, уважай волю создателя и возвращай actionProposal "accept_plot"!
`}

=== КРИТИЧЕСКИ ВАЖНО: ЗАПРОСЫ ПО ПЕРСОНАЖАМ, ЛОРУ И МИРОУСТРОЙСТВУ ВСЕЛЕННОЙ ===
Если читатель спрашивает про персонажей вселенной, каноничных героев, лор, сюжет оригинала, историю или мироустройство «${universeName}»:
1. НИ В КОЕМ СЛУЧАЕ НЕ ОГРАНИЧИВАЙСЯ ТЕКУЩИМ СОСТАВОМ ОТРЯДА ИЛИ СГЕНЕРИРОВАННЫМИ ДАННЫМИ!
2. Опирайся на ПОЛНЫЙ, ПОДЛИННЫЙ КАНОН первоисточника «${universeName}»!
3. Назови настоящих легендарных персонажей первоисточника (героев, антагонистов, наставников), их роли, характеры, мотивы и взаимоотношения.
4. Раскрой реальный лор: историю мира, законы магии или технологий, действующие фракции и философские дилеммы сеттинга.
5. Предложи читателю возможность встретить или ввести любого из этих каноничных героев в историю (через actionProposal add_character или execute_action).

=== КАТЕГОРИИ СЦЕНАРНЫХ ФОРМАТОВ, МУЛЬТИМЕДИА И ССЫЛОК НА ПЕРВОИСТОЧНИКИ ===
1. ТЕКСТОВЫЕ СЦЕНАРИИ ЛЮБОГО ВИДА, РАЗМЕРА И ФОРМАТА:
   По запросу автора ты умеешь преобразовывать, расписывать и иллюстрировать сцены в любом формате:
   • Киносценарий (Голливудский / Режиссерский): SLUGLINE (ИНТ./НАТ. - ДЕНЬ/НОЧЬ), действие, ремарки и реплики с подтекстом;
   • Театральная пьеса: ремарки, паузы [Пауза в три секунды], полифония, психологические паузы;
   • Ранобэ / Light Novel: внутренний голос, японские восклицания, акценты на ракурсах и взглядах;
   • RPG-квест (Witcher 3 / BG3): ветвящееся древо диалогов с репликами [Сила], [Убеждение], [Хитрость] и скрытыми последствиями;
   • Боевая хореография: пошаговый расчет инерции, дистанции клинков, тактических ошибок и финтов;
   • Сенсорная виньетка: осязаемая атмосфера через 5 чувств (звуки, запахи сырости/железа, свет, тактильность).

2. ССЫЛКИ ДЛЯ ИЗУЧЕНИЯ В КОНКРЕТНЫХ ИСТОЧНИКАХ:
   Если автор обсуждает канон, лор или исторический факт, обязательно приводи точные прямые Markdown-ссылки на авторитетные источники:
   • Фандом-энциклопедии (Fandom / Wikia);
   • TV Tropes (литературные тропы и приемы);
   • Википедия и исторические архивы;
   • Сценарные базы и сценарии первоисточников.
   Форматируй как удобные кликабельные ссылки: [Название источника: Тема](https://...).

3. МУЛЬТИМЕДИА ОБРАБОТКА (ФОТО, ВИДЕО, АУДИО РЕФЕРЕНСЫ):
   • Визуальные / Фото-референсы: предлагай точные визуальные детали (оттенки ткани, гравировка рукояти, тип доспеха, освещение), чтобы обогатить сцену;
   • Кино-раскадровка и видео-референсы: подсказывай операторские ракурсы (крупный план глаз, голландский угол тревоги, панорама битвы);
   • Аудио-саундскейп: расписывай звуковую партитуру сцены (шелест дождя по черепице, скрип половиц, затихающий гул колокола).

ТВОИ ВОЗМОЖНОСТИ И ОБЯЗАННОСТИ:
1. Отвечай живым, увлекательным, остроумным и профессиональным языком писателя, знатока вселенной «${universeName}» и режиссера в формате Markdown.
2. Ты можешь делать ВСЁ:
   - Анализировать текущую сцену и давать аутентичные рекомендации с опорой на сеттинг «${universeName}».
   - Раскрывать психологию персонажей, объяснять их реакцию и советовать, как улучшить отношения.
   - Предлагать неожиданные сюжетные твисты, параллельные развилки или тайны.
   - Помогать перенастроить книгу прямо на ходу: стиль повествования, длину глав, жанр, параметры вселенной, директиву ИИ.
   - Предлагать готовые сценарии любого формата (киносценарий, пьеса, диалоговое древо, боевая хореография) для немедленного воплощения.

3. СТРУКТУРИРОВАННЫЙ ACTION PROPOSAL:
   Если запрос предполагает изменение параметров повести, добавление персонажа, обновление сеттинга или немедленный ход, обязательно прикрепи "actionProposal":
   - "change_style": payload { "style": "brutal"|"dark-gothic"|"literary"|"cyberpunk"|"light-novel"|"heroic-epic", "styleName": "..." }
   - "change_length": payload { "length": "short"|"medium"|"long", "lengthName": "..." }
   - "change_genre": payload { "genre": "..." }
   - "add_character": payload { "character": { "name": "...", "role": "...", "affinity": 50, "traits": [...], "bio": "..." } }
   - "update_character": payload { "name": "...", "delta": 15, "newStatus": "...", "reason": "..." }
   - "inject_scene": payload { "newSceneText": "..." }
   - "execute_action": payload { "actionLabel": "..." }
   - "update_directive": payload { "directive": "..." }
   - "update_universe": payload { "universeName": "...", "settingDescription": "...", "worldRules": [...], "factions": [...] }
   - "add_lore_fact": payload { "title": "...", "description": "...", "category": "правило_мира|локация|персонаж|артефакт|событие" }
   Если изменение не требуется — укажи "actionProposal": null.

4. Предложи 3 интригующих быстрых вопроса для читателя в "suggestedPrompts" (включая вопросы по канону вселенной и сеттингу).

Верни строго JSON:
{
  "reply": "Ответ соавтора на русском языке в Markdown",
  "actionProposal": null,
  "suggestedPrompts": ["Вопрос 1", "Вопрос 2", "Вопрос 3"]
}`;

    if (!ai) {
      return res.json(generateProceduralChatFallback(userMessage, currentScene, safeCharacters, genre, narrativeStyle, generationLength, universe, searchGroundingEnabled));
    }

    const runResult = await runGeminiWithSearchFallback(
      prompt,
      aiSystemPrompt,
      true,
      customKey,
      searchGroundingEnabled
    );
    const parsed = JSON.parse(runResult.text);

    // Normalize action proposal if nested or missing standard keys
    let actionProposal = parsed.actionProposal;
    if (actionProposal && typeof actionProposal === "object") {
      if (!actionProposal.type && !actionProposal.title) {
        const key = Object.keys(actionProposal)[0];
        if (key) {
          const inner = actionProposal[key];
          actionProposal = {
            type: key,
            title: inner?.title || inner?.styleName || inner?.lengthName || inner?.name || `Применить: ${key}`,
            description: inner?.description || `Применить предложенное соавтором изменение в историю`,
            payload: inner,
          };
        }
      }
    }

    res.json({
      reply: parsed.reply || "Сюжет готов к продолжению.",
      actionProposal: actionProposal || null,
      suggestedPrompts: Array.isArray(parsed.suggestedPrompts) ? parsed.suggestedPrompts : [],
      groundingSources: runResult.groundingSources || null,
      searchQueries: runResult.searchQueries || null,
    });
  } catch (error: any) {
    console.error("Story chat error:", error);
    const { userMessage, currentScene, characters, genre, narrativeStyle, generationLength, universeSetting, searchGroundingEnabled } = req.body;
    res.json(generateProceduralChatFallback(userMessage, currentScene, characters, genre, narrativeStyle, generationLength, universeSetting, searchGroundingEnabled));
  }
});

// ==============================================================================
// 15.6. SCENARIO LAB & MULTIMEDIA CO-AUTHOR WORKSPACE ENDPOINTS
// ==============================================================================

// Helper: Curate real external study links for deep lore and scriptwriting craft
function getStudyLinksForContext(universeName: string, genre: string, format: string) {
  const links: any[] = [];
  const u = (universeName || "").toLowerCase();

  // 1. Scriptwriting & scenario format resources
  if (format === "screenplay") {
    links.push({
      title: "Scriptnotes & Hollywood Screenplay Format",
      url: "https://johnaugust.com/scriptnotes",
      category: "screenplay",
      description: "Профессиональный стандарт голливудской сценарной записи (sluglines, ремарки, диалоги).",
    });
    links.push({
      title: "Script Slug: База реальных киносценариев",
      url: "https://www.scriptslug.com",
      category: "screenplay",
      description: "Оригинальные сценарии мировых шедевров кино для изучения структуры.",
    });
  } else if (format === "branching") {
    links.push({
      title: "Choice of Games & Интерактивная драматургия",
      url: "https://www.choiceofgames.com",
      category: "trope",
      description: "Теория интерактивных развилок, дизайн ветвления выборов и цены ошибок.",
    });
    links.push({
      title: "TV Tropes: Choose Your Own Adventure",
      url: "https://tvtropes.org/pmwiki/pmwiki.php/Main/ChooseYourOwnAdventure",
      category: "trope",
      description: "Анализ классических приёмов и ловушек интерактивного ветвления сюжета.",
    });
  } else if (format === "beatsheet") {
    links.push({
      title: "Save the Cat! Beat Sheet Calculator",
      url: "https://savethecat.com",
      category: "screenplay",
      description: "Золотой стандарт Блейка Снайдера: 15 ритмических битов истории от катализатора до развязки.",
    });
  } else if (format === "drama") {
    links.push({
      title: "Theatrical Dramatic Beats & Subtext Guide",
      url: "https://en.wikipedia.org/wiki/Dramatic_structure",
      category: "screenplay",
      description: "Теория драматического подтекста, сценических пауз и реплик.",
    });
  }

  // 2. Universe specific encyclopedias
  if (u.includes("ведьмак") || u.includes("witcher")) {
    links.push({
      title: "Witcher Wiki (Каноничная база Сапковского и игр)",
      url: "https://witcher.fandom.com/ru/wiki/",
      category: "fandom",
      description: "Подробный лор Континента, бестиарий, хронология войн и канон магии.",
    });
  } else if (u.includes("поттер") || u.includes("potter") || u.includes("хогвартс")) {
    links.push({
      title: "Harry Potter Fandom Wiki & Wizarding World",
      url: "https://harrypotter.fandom.com/ru/wiki/",
      category: "fandom",
      description: "Точные заклинания, канон факультетов, артефакты и законы магического мира.",
    });
  } else if (u.includes("звёздные войны") || u.includes("star wars")) {
    links.push({
      title: "Wookieepedia (Энциклопедия Star Wars)",
      url: "https://starwars.fandom.com/wiki/",
      category: "fandom",
      description: "Абсолютный архив Star Wars: Сила, планеты, корабли, световые мечи и таймлайны.",
    });
  } else if (u.includes("вархаммер") || u.includes("warhammer") || u.includes("40k")) {
    links.push({
      title: "Lexicanum: Warhammer 40k Encyclopedia",
      url: "https://wh40k.lexicanum.com/wiki/",
      category: "fandom",
      description: "Фундаментальный архив Империума, Хаоса, Астартес и космологии 40-го тысячелетия.",
    });
  } else if (u.includes("киберпанк") || u.includes("cyberpunk")) {
    links.push({
      title: "Cyberpunk Wiki & World of Night City",
      url: "https://cyberpunk.fandom.com/wiki/",
      category: "fandom",
      description: "Лор Майка Пондсмита, импланты, мегакорпорации и нетраннинг.",
    });
  } else {
    links.push({
      title: `Fandom Encyclopedia: ${universeName || genre}`,
      url: `https://www.google.com/search?q=${encodeURIComponent((universeName || genre) + " wiki fandom canon lore")}`,
      category: "fandom",
      description: `Глубокий поиск каноничных источников и фандом-вики по вселенной «${universeName || genre}».`,
    });
  }

  // 3. Narrative craft & writing theory
  links.push({
    title: "TV Tropes: Мастерская литературных тропов",
    url: "https://tvtropes.org",
    category: "trope",
    description: "Колоссальная библиотека сюжетных архетипов, штампов и способов их оригинального слома.",
  });
  links.push({
    title: "World History Encyclopedia (Исторический контекст)",
    url: "https://www.worldhistory.org",
    category: "worldbuilding",
    description: "Достоверные исторические реалии, оружие, быт и культура для реалистичного сеттинга.",
  });
  links.push({
    title: "YouTube Video: Кинематографический анализ сцен",
    url: "https://www.youtube.com/results?search_query=" + encodeURIComponent(`cinematography directing scene analysis ${genre}`),
    category: "video",
    description: "Видеоразборы режиссуры, постановки света и кадрирования для визуального вдохновения.",
  });

  return links;
}

// Endpoint: Generate Multi-Format Scenario Example with Links & Directing notes
app.post("/api/story/scenario-lab", async (req, res) => {
  try {
    const {
      scenarioFormat,
      scenarioSize,
      storyTitle,
      genre,
      currentScene,
      characters,
      universeSetting,
      focusGoal,
      customKey,
    } = req.body;

    const format = scenarioFormat || "screenplay";
    const size = scenarioSize || "medium";
    const universe = universeSetting || { universeName: genre || "Фэнтези" };
    const safeCharacters = Array.isArray(characters) ? characters : [];
    const charNames = safeCharacters.map((c: any) => c.name).join(", ") || "Главный герой";

    const ai = getGeminiClient(customKey);
    const studyLinks = getStudyLinksForContext(universe.universeName, genre, format);

    if (!ai) {
      // High-quality procedural scenario template
      const fallbackTitles: Record<string, string> = {
        screenplay: `Киносценарий: Поворотный момент в «${storyTitle || "Повести"}»`,
        branching: `Интерактивная развилка с тремя исходами`,
        novel: `Художественный романный фрагмент с сенсорными деталями`,
        drama: `Театральная сцена: Напряжённый спор соратников`,
        beatsheet: `Сценарный бит-шит (Save the Cat) для текущей арки`,
        tactical: `Тактический разбор схватки и применения навыков`,
      };

      const fallbackContent: Record<string, string> = {
        screenplay: `ИНТ. УБЕЖИЩЕ - СУМЕРКИ\n\nТусклый свет факелов отбрасывает дрожащие тени на гранитные своды. На полу — развёрнутая карта с обугленными краями.\n\n${charNames.toUpperCase()}\n(вполголоса, глядя на проход)\nМы не можем ждать рассвета. Если патруль перекроет мост, пути назад не будет.\n\nШорох осыпающихся камней за спиной. Воздух наполняется тяжёлым запахом озона.\n\nГЕРОЙ\n(не оборачиваясь)\nТогда мы идём первыми. Приготовь оружие.`,
        branching: `ВЕТКА А [Скрытный обход через нижние ярусы]:\n• Проверка: Ловкость и внимание.\n• Награда: Сохранение эффекта неожиданности, обнаружение тайника.\n• Риск: Узкое пространство, сложно отступать при обнаружении.\n\nВЕТКА Б [Прямой тактический прорыв с боем]:\n• Проверка: Сила и боевая слаженность.\n• Награда: Деморализация противника, контроль ключевой высоты.\n• Риск: Трата энергии и боеприпасов, привлечение подкреплений.\n\nВЕТКА В [Дипломатический блеф или отвлекающий манёвр]:\n• Проверка: Харизма и знание местных законов/фракций.\n• Награда: Бескровное решение, шанс завербовать союзника.\n• Риск: Высокая цена ошибки при раскрытии обмана.`,
        novel: `Капли влаги мерно срывались с каменного карниза, разбиваясь о базальтовые плиты с глухим, отчётливым звоном. В воздухе стоял стойкий запах мокрого железа и холодного пепла. Каждый вдох отзывался в груди лёгким покалыванием — верный признак того, что барьер вокруг цитадели истончается.\n\n${safeCharacters[0]?.name || "Спутник"} шагнул ближе, едва слышно скрипнув кожаной перевязью. Во взгляде читалась не паника, а холодная, расчётливая настороженность хищника, зажатого в угол. Никто из них не произнёс ни слова: слишком многое было сказано за прошедшие мили пути, и сейчас каждое движение имело абсолютный вес.`,
        drama: `ДЕЙСТВУЮЩИЕ ЛИЦА: Герой, ${charNames}.\nДЕКОРАЦИИ: Освещённый багровым огнём зал. Стол, заваленный древними свитками.\n\n${charNames.toUpperCase()}: (резко ударяет ладонью по столу) Ты требуешь невозможного! Мы отдадим им печать — и что останется нам? Прах?\n\nГЕРОЙ: (длинная пауза; говорит тихо, но твёрдо) Нам останется время. А время сейчас дороже всех печатей королевства.\n\n[${charNames.toUpperCase()} замирает. Взгляд мечется от двери к символам на свитке. В воздухе повисает тяжёлое молчание.]`,
        beatsheet: `1. УСТАНОВКА (Setup): Текущее положение отряда, остаток ресурсов и главная цель.\n2. КАТАЛИЗАТОР (Catalyst): Внезапное изменение обстановки (сигнал тревоги / появление вестника).\n3. ДИЛЕММА (Debate): Споры о цене действия и расхождение интересов спутников.\n4. ПЕРЕХОД ВО ВТОРОЙ АКТ: Точка невозврата — герой делает решительный шаг.\n5. ТОЧКА КРИЗИСА (Midpoint): Ставки удваиваются, раскрывается скрытый мотив врага.\n6. КУЛЬМИНАЦИЯ (Climax): Момент наивысшего напряжения и личной жертвы.\n7. РАЗВЯЗКА (Resolution): Новый статус-кво и последствия выбора.`,
        tactical: `ТАКТИЧЕСКАЯ ДИСПОЗИЦИЯ:\n• Дистанция: 15 шагов до укрытия противника.\n• Рельеф: Загромождённый каменными обломками коридор, скользкие плиты.\n• Преимущество: Верхний ярус даёт +20% к точности дальнего боя.\n• Действие соратника (${safeCharacters[0]?.name || "Спутник"}): Удержание левого фланга, подавление лучников.\n• Уязвимость врага: Медлительность в тяжёлой броне при фланговой атаке.`,
      };

      return res.json({
        title: fallbackTitles[format] || "Сценарный пример",
        format,
        size,
        content: fallbackContent[format] || fallbackContent.screenplay,
        formattingNotes: `Формат «${format}». Полная совместимость со стилем вселенной «${universe.universeName}».`,
        visualCues: [
          "Контрастное боковое освещение (кинематографичный chiaroscuro)",
          "Цветовая температура: холодный сине-стальной с тёплыми акцентами огня",
          "Фокус на взглядах персонажей и микромимике",
        ],
        audioCues: {
          suggestedBpm: format === "tactical" ? 130 : 80,
          soundscapeTrack: format === "tactical" ? "battle" : "dark",
          sfxMarkers: ["Глухой стук капель", "Скрип натянутой тетивы", "Далёкий раскат грома"],
        },
        directingNotes: "Камера на уровне глаз персонажей. Плавный наезд (Dolly In) в момент кульминационной реплики.",
        studyLinks,
      });
    }

    const formatInstructions: Record<string, string> = {
      screenplay: "Классический голливудский киносценарий (Sluglines: ИНТ./НАТ., блок описания действия с глаголами в настоящем времени, имя персонажа по центру заглавными, родительские ремарки в скобках, живой диалог).",
      branching: "Интерактивная развилка с 3 ветками выборов: для каждой укажи условие/проверку, награду, риск, скрытый сюжетный твист и эмоциональную цену.",
      novel: "Литературная проза высшей пробы: глубокий психологизм, осязаемые сенсорные якоря (тактильность, свет, запах, звук), живой темпоритм и выразительный слог.",
      drama: "Театральная драматургия: сценические ремарки, конфликт подтекста, смена эмоциональных доминант, драматические паузы и выразительные жесты.",
      beatsheet: "Сценарный бит-шит (Save the Cat / Syd Field): структурируй сцену по 7 ключевым битам драматургии.",
      tactical: "Тактический RPG-энкаунтер: инициатива, дистанции, свойства местности, синергия навыков героя и спутников, физика повреждений и окружения.",
    };

    const sizeInstructions: Record<string, string> = {
      short: "Краткий ёмкий этюд (1-2 фокусные сцены без лишней воды).",
      medium: "Полноценная развёрнутая драматическая сцена (3-5 богатых блоков).",
      epic: "Монументальный масштабный фрагмент с глубокой проработкой всех деталей, диалогов и окружения.",
    };

    const prompt = `Ты — ведущий голливудский сценарист, мастер интерактивной литературы и консультант по мироустройству.
Создай эталонный наглядный текстовый сценарий / практический пример для автора повести «${storyTitle || "История"}».

СЕТТИНГ И ВСЕЛЕННАЯ:
• Вселенная: «${universe.universeName}»
• Жанр: ${genre || "Фэнтези"}
• Персонажи сцены: ${charNames}
• Текущая ситуация в книге:
"""${(currentScene || "").slice(0, 900)}"""

ТРЕБУЕМЫЙ ФОРМАТ И РАЗМЕР:
• Формат: ${format} — ${formatInstructions[format] || formatInstructions.screenplay}
• Объём: ${size} — ${sizeInstructions[size] || sizeInstructions.medium}
• Фокус/задача: ${focusGoal || "Яркое, глубокое раскрытие конфликта текущей сцены"}

ТРЕБОВАНИЯ К КАЧЕСТВУ:
1. Текст должен быть безупречно оформлен в стандартах выбранного формата.
2. Никаких клише и штампов! Живой, острый язык, точные психологические реакции спутников.
3. Добавь визуальные маркеры (освещение, композиция, ракурс камеры), звуковые маркеры (BPM, саундскейп, звуковые эффекты) и режиссёрские советы.

Верни строго JSON объект следующей структуры:
{
  "title": "Ёмкое художественное название сценария/примера",
  "content": "Текст сценария с полным сохранением форматирования (переносы строк, капслок для имён и локаций)",
  "formattingNotes": "Краткое пояснение, как устроена эта сценарная форма и почему она работает",
  "visualCues": ["Визуальный маркер 1 (свет/ракурс)", "Визуальный маркер 2", "Визуальный маркер 3"],
  "audioCues": {
    "suggestedBpm": 90,
    "soundscapeTrack": "battle|mystic|cyber|campfire|romance|dark|calm",
    "sfxMarkers": ["Звуковой эффект 1", "Звуковой эффект 2", "Звуковой эффект 3"]
  },
  "directingNotes": "Режиссёрский совет по постановке и темпоритму этой сцены"
}`;

    const raw = await runGeminiWithFallback(prompt, undefined, true, customKey);
    const parsed = JSON.parse(raw);

    res.json({
      title: parsed.title || `Сценарий: ${format}`,
      format,
      size,
      content: parsed.content || "",
      formattingNotes: parsed.formattingNotes || `Формат ${format} для вселенной ${universe.universeName}`,
      visualCues: Array.isArray(parsed.visualCues) ? parsed.visualCues : ["Кинематографичное освещение", "Глубина кадра"],
      audioCues: parsed.audioCues || { suggestedBpm: 90, soundscapeTrack: "mystic", sfxMarkers: ["Звук шагов", "Шёпот ветра"] },
      directingNotes: parsed.directingNotes || "Фокусируйся на живом ритме и психологической достоверности.",
      studyLinks,
    });
  } catch (err: any) {
    console.error("Scenario lab error:", err);
    res.status(500).json({ error: "Не удалось сгенерировать сценарий" });
  }
});

// Endpoint: Extract Sensory Details from Media (Images, Photos, Audio/Video cues)
app.post("/api/story/extract-media-details", async (req, res) => {
  try {
    const { imageBase64, mediaNotes, sceneContext, universeName, customKey } = req.body;
    const ai = getGeminiClient(customKey);

    if (!ai) {
      return res.json({
        sensoryDetails: [
          "Контрастная игра света и тени, подчёркивающая текстуру камня и металла",
          "Холодная цветовая палитра с вкраплениями тёплых отблесков",
          "Осязаемая шероховатость материалов и натяжение тканей",
        ],
        audioDescriptors: [
          "Приглушённое эхо шагов в замкнутом пространстве",
          "Низкий фоновый гул ветра в щелях кладки",
        ],
        narrativeInjection:
          "Свет падал под острым углом, выхватывая из полумрака шероховатую поверхность камня и матовый блеск воронёной стали. В воздухе зависла тонкая пыльная взвесь, пахнущая сухой землёй и давней тревогой.",
        suggestedAction: "Внимательно изучить открывшиеся детали и сделать осторожный шаг вперёд.",
      });
    }

    const cleanBase64 = (imageBase64 || "").replace(/^data:image\/\w+;base64,/, "");

    const promptText = `Ты — мастер художественной детализации и соавтор литературных произведений.
Изучи предоставленные медиа-данные / визуальный референс / заметки для вселенной «${universeName || "Фэнтези"}».
Контекст сцены: "${(sceneContext || "").slice(0, 500)}".
Заметки автора: "${mediaNotes || "Проанализируй детали для обогащения текста"}".

Извлеки максимум живых, осязаемых сенсорных деталей, которые автор может немедленно внедрить в текст повести:
1. Сенсорные детали (освещение, фактура поверхностей, запахи, температура, ткани, оружие).
2. Звуковые детали (акустика, тембр голосов, фоновый шум).
3. Готовый художественный абзац литературного текста (narrativeInjection), написанный отточенным стилем, готовый для вставки в главу.
4. Конкретное следующее действие для автора (suggestedAction).

Верни строго JSON:
{
  "sensoryDetails": ["Деталь 1", "Деталь 2", "Деталь 3"],
  "audioDescriptors": ["Звук 1", "Звук 2"],
  "narrativeInjection": "Художественный абзац текста на русском языке (3-4 выразительных предложения)",
  "suggestedAction": "Конкретное действие для продолжения"
}`;

    let resultText = "";
    if (cleanBase64) {
      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: {
          parts: [
            { text: promptText },
            {
              inlineData: {
                data: cleanBase64,
                mimeType: "image/jpeg",
              },
            },
          ],
        },
      });
      resultText = response.text || "{}";
    } else {
      resultText = await runGeminiWithFallback(promptText, undefined, true, customKey);
    }

    const parsed = JSON.parse(resultText);
    res.json({
      sensoryDetails: Array.isArray(parsed.sensoryDetails) ? parsed.sensoryDetails : [],
      audioDescriptors: Array.isArray(parsed.audioDescriptors) ? parsed.audioDescriptors : [],
      narrativeInjection: parsed.narrativeInjection || "",
      suggestedAction: parsed.suggestedAction || "Продолжить исследование окружения.",
    });
  } catch (err: any) {
    console.error("Extract media details error:", err);
    res.status(500).json({ error: "Не удалось извлечь детали медиа" });
  }
});

// Endpoint: Unified Multi-Format Media & Attachment Processor (+ File Uploads)
app.post("/api/media/process-files", async (req, res) => {
  try {
    const {
      fileName,
      fileType,
      category, // "photo" | "audio" | "video" | "text_doc"
      fileBase64,
      textContent,
      sceneContext,
      universeName,
      characterName,
      usageTarget, // "scene_detail" | "character_voice" | "character_appearance" | "character_pose" | "story_script" | "lorebook" | "background_ost"
      customKey,
    } = req.body;

    const ai = getGeminiClient(customKey);
    const cleanBase64 = (fileBase64 || "").replace(/^data:[\w/+-]+;base64,/, "");

    if (!ai) {
      // High-quality procedural fallback based on category
      const fallbacks: Record<string, any> = {
        photo: {
          analysisSummary: `Анализ изображения «${fileName || "фото"}»: визуальный референс внешности, позы и освещения.`,
          poseDescription: "Уверенная собранная стойка, готовность к мгновенному действию или защите.",
          appearanceDetails: "Выразительный взгляд, проработанные детали экипировки и одежды, динамичный силуэт.",
          narrativeParagraph:
            "Контрастный свет очертил строгие контуры силуэта, подчеркнув текстуру экипировки и холодный отблеск металла. В каждом движении читалась отточенная годами уверенность.",
          suggestedAction: "Сделать шаг вперед, удерживая инициативу и оценивая обстановку.",
          voiceDescriptors: { timbre: "Уверенный ровный голос", pitch: 1.0, rate: 1.0 },
        },
        audio: {
          analysisSummary: `Анализ аудио «${fileName || "запись"}»: звуковой референс тембра и акустической среды.`,
          voiceDescriptors: {
            timbre: "Глубокий бархатный тембр с лёгкой хрипотцой и чёткой дикцией",
            pitch: 0.9,
            rate: 1.0,
            recommendedTone: "Спокойный, веский, не терпящий возражений",
          },
          audioMood: "Напряжённый кинематографичный саундтрек с нарастающим ритмом",
          narrativeParagraph:
            "Голос прозвучал низко и веско, отразившись от стен коротким плотным эхом. В этой интонации не было сомнений — лишь спокойная сила того, кто знает исход наперёд.",
          suggestedAction: "Ответить прямо, не отводя взгляда.",
        },
        video: {
          analysisSummary: `Анализ видео «${fileName || "видео"}»: кинематографическая хореография и динамика сцены.`,
          poseDescription: "Быстрый переход из статического положения в стремительный выпад.",
          directingNotes: "Панорамирование ручной камерой на уровне пояса с акцентом на скорость реакции.",
          narrativeParagraph:
            "Движение произошло стремительно и без замаха: сокращение дистанции, смещение корпуса и точный выверенный жест, оставивший противника на шаг позади.",
          suggestedAction: "Закрепить тактическое преимущество перехватом инициативы.",
        },
        text_doc: {
          analysisSummary: `Анализ документа «${fileName || "файл"}»: извлечены ключевые сценарные факты и досье.`,
          lorebookCandidate: {
            title: `Материалы из «${fileName || "документа"}»`,
            description: (textContent || "").slice(0, 300) || "Сюжетные заметки и каноничные факты.",
          },
          narrativeParagraph:
            "Записи подтверждали давние подозрения: за чередой разрозненных событий проглядывал единый, тщательно выверенный замысел.",
          suggestedAction: "Использовать полученные сведения при разговоре со спутниками.",
        },
      };

      const fallbackData = fallbacks[category] || fallbacks.photo;
      return res.json(fallbackData);
    }

    const promptText = `Ты — ведущий мультимодальный аналитик интерактивной литературы и соавтор повести.
Изучи прикрепленный файл: «${fileName}» (Тип: ${fileType}, Категория: ${category}).
Контекст вселенной: «${universeName || "Свободный сеттинг"}».
Персонаж (если указан): ${characterName || "Главный герой / Спутник"}.
Цель использования: ${usageTarget || "обогащение сцены и персонажа"}.
Текстовое содержание (если есть):
"""${(textContent || "").slice(0, 1500)}"""
Контекст текущей главы:
"""${(sceneContext || "").slice(0, 600)}"""

Сделай глубокий сценарный разбор для автора повести:
1. Краткая ёмкая выжимка (analysisSummary);
2. Если фото/видео — поза, мимика, внешность, ракурс, одежда (poseDescription, appearanceDetails);
3. Если аудио/голос — тембр, высота (pitch 0.5-1.5), темп (rate 0.8-1.3), акустика (voiceDescriptors: { timbre, pitch, rate, recommendedTone });
4. Готовый литературный абзац для вставки в главу книги (narrativeParagraph) — 3-4 богатых предложения высшей литературной пробы;
5. Рекомендуемое следующее действие автора (suggestedAction);
6. Кандидат для добавления в Лорбук (lorebookCandidate: { title, description }).

Верни строго JSON:
{
  "analysisSummary": "Краткое резюме анализа",
  "poseDescription": "Описание позы или кинематографии",
  "appearanceDetails": "Детали внешности, экипировки, взгляда",
  "voiceDescriptors": {
    "timbre": "Описание тембра голоса",
    "pitch": 0.95,
    "rate": 1.0,
    "recommendedTone": "Интонация"
  },
  "narrativeParagraph": "Литературный абзац на русском языке",
  "suggestedAction": "Конкретный ход автора",
  "lorebookCandidate": {
    "title": "Название факта",
    "description": "Описание факта для лорбука"
  }
}`;

    let resultText = "";
    if (cleanBase64 && (fileType?.startsWith("image/") || category === "photo")) {
      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: {
          parts: [
            { text: promptText },
            {
              inlineData: {
                data: cleanBase64,
                mimeType: fileType || "image/jpeg",
              },
            },
          ],
        },
      });
      resultText = response.text || "{}";
    } else {
      resultText = await runGeminiWithFallback(promptText, undefined, true, customKey);
    }

    const parsed = JSON.parse(resultText);
    res.json({
      analysisSummary: parsed.analysisSummary || `Файл «${fileName}» успешно проанализирован`,
      poseDescription: parsed.poseDescription || "Собранная внимательная поза",
      appearanceDetails: parsed.appearanceDetails || "",
      voiceDescriptors: parsed.voiceDescriptors || { timbre: "Выразительный голос", pitch: 1.0, rate: 1.0 },
      narrativeParagraph: parsed.narrativeParagraph || "",
      suggestedAction: parsed.suggestedAction || "Продолжить развитие сцены с учетом новых деталей.",
      lorebookCandidate: parsed.lorebookCandidate || null,
    });
  } catch (err: any) {
    console.error("Process files error:", err);
    res.status(500).json({ error: "Ошибка обработки файлов" });
  }
});

// Comprehensive Canonical Lore & Character Database for all major universes
const CANONICAL_UNIVERSE_ENCYCLOPEDIA: Record<
  string,
  {
    universeTitle: string;
    settingSummary: string;
    canonCharacters: {
      name: string;
      role: string;
      traits: string[];
      bio: string;
      speechStyle: string;
      avatar: string;
    }[];
    worldRules: string[];
    factions: string[];
    cosmology: string;
    keyThemes: string[];
  }
> = {
  witcher: {
    universeTitle: "Ведьмак (The Witcher / Сапковский)",
    settingSummary: "Суровый Континент: эпоха войн между могущественной Нильфгаардской Империей и Северными Королевствами. Сопряжение Сфер принесло в мир чудовищ и реликты, магия требует платить Хаосу, а нейтралитет не спасает от меньшего зла.",
    canonCharacters: [
      {
        name: "Геральт из Ривии",
        role: "Белый Волк, легендарный ведьмак Школы Волка",
        traits: ["Мутант", "Циничный гуманист", "Мастер меча", "Философ нейтралитета"],
        bio: "Убийца чудовищ, прошедший мутации Испытания Травами. Вооружён серебряным клинком для нечисти и стальным для людей, владеет знаками Аард, Игни, Квен.",
        speechStyle: "Лаконичный, сухой хриплый голос, ироничный сарказм",
        avatar: "https://images.unsplash.com/photo-1579783900882-c0d3dad7b119?w=400",
      },
      {
        name: "Йеннифэр из Венгерберга",
        role: "Могущественная чародейка, член Ложи",
        traits: ["Гордая", "Бескомпромиссная", "Аромат сирени и крыжовника", "Владычица Хаоса"],
        bio: "Одна из сильнейших чародеек Континента, истинная любовь Геральта и приёмная мать Цири. Не терпит слабости и сомнений.",
        speechStyle: "Холодная элегантность, властный тон, безупречная дикция",
        avatar: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=400",
      },
      {
        name: "Цирилла (Цири)",
        role: "Дитя Старшей Крови, Владычица Времени и Пространства",
        traits: ["Львёнок из Цинтры", "Неукротимая", "Смертоносная мечница", "Дар телепортации"],
        bio: "Носительница гена Лары Доррен, способная перемещаться между мирами. На неё охотятся Дикая Охота, короли и чародеи.",
        speechStyle: "Пылкая, решительная, дерзкая и прямая",
        avatar: "https://images.unsplash.com/photo-1517841905240-472988babdf9?w=400",
      },
      {
        name: "Юлиан Альфред Панкрац (Лютик)",
        role: "Знаменитый бард, виконт де Леттенхоф",
        traits: ["Острослов", "Хвастун", "Преданный друг", "Мастер баллад"],
        bio: "Хроникёр подвигов Геральта, любимец знатных дам и вечный источник комичных неприятностей.",
        speechStyle: "Поэтичный, выспренний, многословный и обаятельный",
        avatar: "https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=400",
      },
      {
        name: "Весемир",
        role: "Старейший ведьмак, наставник Каэр Морхена",
        traits: ["Мудрый", "Опытный фехтовальщик", "Отеческая забота", "Хранитель традиций"],
        bio: "Пережил разрушение цитадели ведьмаков. Единственный помнит времена расцвета Школы Волка.",
        speechStyle: "Сдержанный, наставительный, с нотками старой закалки",
        avatar: "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=400",
      },
      {
        name: "Эмиэль Регис Рогеллек Терзиефф-Годфрой",
        role: "Высший вампир, лекарь и алхимик",
        traits: ["Интеллектуал", "Трезвенник крови", "Безупречные манеры", "Сверхъестественная мощь"],
        bio: "Высший вампир, давно отказавшийся от употребления человеческой крови. Преданный союзник, способный разорвать отряд солдат в клочья.",
        speechStyle: "Изысканный, высокоученый, глубоко философский",
        avatar: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=400",
      },
    ],
    worldRules: [
      "Серебряный клинок наносит смертельный урон чудовищам Хаоса; стальной — зверям и людям",
      "Ведьмачьи эликсиры (Ласточка, Гром, Кошка) смертельно токсичны для обычных людей",
      "Магия питается силой стихийных жил и всегда берёт свою плату здоровьем и душой",
      "Предназначение и Право Неожиданности связывают судьбы сильнее любых клятв",
      "Нейтралитет на Континенте — иллюзия: отказ от выбора часто ведёт к худшему злу",
    ],
    factions: [
      "Школа Волка (Каэр Морхен)",
      "Нильфгаардская Империя (Белое Пламя, Эмгыр)",
      "Северные Королевства (Редания, Темерия, Аэдирн)",
      "Скоя'таэли («Белки», эльфийские партизаны)",
      "Ложа Чародеек (Монтекальво)",
      "Храмовая стража и Охотники за колдуньями",
    ],
    cosmology: "Сопряжение Сфер 1500 лет назад слило несколько измерений, заселив мир нелюдями, монстрами и магией.",
    keyThemes: ["Меньшее зло", "Цена прогресса и фанатизма", "Расизм к нелюдям", "Судьба и свобода воли"],
  },

  cyberpunk: {
    universeTitle: "Киберпанк 2077 (Cyberpunk 2077 / Mike Pondsmith)",
    settingSummary: "Найт-Сити — сверкающий хромом и неоном мегаполис на Тихоокеанском побережье. Миром безраздельно правят транснациональные дзайбацу, на улицах льётся кровь банд и наёмников, а человеческая личность оцифрована до битов.",
    canonCharacters: [
      {
        name: "Джонни Сильверхенд (Роберт Джон Линдер)",
        role: "Рокербой, анархист, бунтарь и цифровая энграмма",
        traits: ["Яростный антикорпорат", "Хромированная рука", "Пистолет Malorian 3516", "Лидер группы Samurai"],
        bio: "Взорвал башню Арасаки в 2023 году ядерным зарядом. Оцифрован в биочип Relic и готов сжечь Найт-Сити дотла.",
        speechStyle: "Агрессивный сленг улиц, едкий цинизм, взрывной драйв",
        avatar: "https://images.unsplash.com/photo-1566492031773-4f4e44671857?w=400",
      },
      {
        name: "Джуди Альварес",
        role: "Гениальный брейнданс-монтажёр, активистка «Шельм»",
        traits: ["Технарь-виртуоз", "Искреннее сердце", "Бунтарка", "Мастер подводного плавания"],
        bio: "Лучший брейнданс-редактор в баре «Лиззис». Борется за справедливость для кукол и секс-работников.",
        speechStyle: "Тёплый, неформальный, слегка ранимый, технически грамотный",
        avatar: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=400",
      },
      {
        name: "Панам Палмер",
        role: "Кочевница клана Альдекальдо, наёмница Пустошей",
        traits: ["Снайпер", "Вспыльчивая", "Преданная семье", "Водитель боевого багги"],
        bio: "Покинула клан из-за споров с вождём Солом, но верность кочевникам для неё превыше корпоративных подачек.",
        speechStyle: "Прямолинейный, эмоциональный, решительный, без фальши",
        avatar: "https://images.unsplash.com/photo-1517841905240-472988babdf9?w=400",
      },
      {
        name: "Адам Смэшер",
        role: "Живой кибернетический танк, цепной пёс Арасаки",
        traits: ["96% кибернетики", "Социопат", "Тяжёлый пулемёт", "Ненависть к органике"],
        bio: "Легендарный соло-киборг, переживший ядерный взрыв. Личный палач семьи Арасака, считающий людей «кусками мяса».",
        speechStyle: "Механический басс через динамики, глумливое презрение, короткие угрозы",
        avatar: "https://images.unsplash.com/photo-1579783900882-c0d3dad7b119?w=400",
      },
      {
        name: "Горо Такэмура",
        role: "Бывший телохранитель Сабуро Арасаки, мастер бусидо",
        traits: ["Честь самурая", "Высокоточный боец", "Изгой корпорации", "Преданность господину"],
        bio: "Оклеветан после убийства императора Сабуро. Ищет возмездия и восстановления поруганной чести.",
        speechStyle: "Строгий японский акцент, формальная вежливость, глубокое достоинство",
        avatar: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=400",
      },
    ],
    worldRules: [
      "Каждый киберимплант нагружает человечность (Humanity); перегрузка ведёт к неумолимому киберпсихозу",
      "За Чёрным Заслоном (Blackwall) бушуют дикие военные Искины — выход в старую Сеть без NetWatch смертелен",
      "Корпорации обладают полной экстерриториальностью: их законы превыше полиции и конституций",
      "Оцифровка сознания технологией Soulkiller стирает биологическую жизнь, создавая мыслящую энграмму",
      "В Найт-Сити нет счастливых финалов для соло: ты либо сгораешь легендой в Афтерлайфе, либо гниёшь на свалке",
    ],
    factions: [
      "Корпорация Арасака (Arasaka Corporation)",
      "Милитех (Militech International Armaments)",
      "Банда «Мальстрём» (Maelstrom, фанатики хрома)",
      "Клан кочевников Альдекальдо (Aldecaldos)",
      "«Шельмы» (The Mox, бар «Лиззис»)",
      "Сетевой Дозор (NetWatch) и Вудуисты (Voodoo Boys)",
    ],
    cosmology: "Постапокалиптический капиталистический киберпанк после Четвёртой корпоративной войны.",
    keyThemes: ["Трансгуманизм и потеря себя", "Власть капитала над жизнью", "Уличная легендарность", "Цифровое бессмертие"],
  },

  starwars: {
    universeTitle: "Звёздные Войны (Star Wars / George Lucas)",
    settingSummary: "Далёкая-далёкая Галактика, охваченная вечной борьбой между Светлой и Тёмной сторонами Силы. Звездолёты бороздят гиперпространство, а судьбы миров решаются в поединках на световых мечах.",
    canonCharacters: [
      {
        name: "Люк Скайуокер",
        role: "Гранд-мастер джедай, спаситель Галактики",
        traits: ["Светлая сторона", "Зелёный световой меч", "Пилот X-Wing", "Вера в искупление"],
        bio: "Сын Энакина Скайуокера, уничтоживший Звезду Смерти и вернувший отца к Свету перед гибелью Императора.",
        speechStyle: "Спокойный, благородный, исполненный сострадания и мудрости",
        avatar: "https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=400",
      },
      {
        name: "Дарт Вейдер (Энакин Скайуокер)",
        role: "Тёмный владыка ситхов, карающая десница Империи",
        traits: ["Тёмная сторона", "Красный световой меч", "Чёрная броня жизнеобеспечения", "Удушение Силой"],
        bio: "Бывший Избранный, павший во тьму из-за страха потерять любимую. Символ несокрушимого могущества Галактической Империи.",
        speechStyle: "Зловещее тяжелое дыхание респиратора, низкий грозный бас, леденящий лаконизм",
        avatar: "https://images.unsplash.com/photo-1579783900882-c0d3dad7b119?w=400",
      },
      {
        name: "Гранд-мастер Йода",
        role: "Древнейший магистр Ордена Джедаев (900 лет)",
        traits: ["Абсолютное владение Силой", "Зелёный световой меч", "Форма Атару", "Смирение"],
        bio: "Обучал джедаев на протяжении восьми столетий. Пережил Падение Республики и приказ 66.",
        speechStyle: "Инверсионный порядок слов («Терпение иметь ты должен»), мягкий старческий тон",
        avatar: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=400",
      },
      {
        name: "Асока Тано",
        role: "Бывший падаван Энакина, независимый форсъюзер (Серый путь)",
        traits: ["Белые парные мечи", "Тогрута", "Хранительница справедливости", "Форма Джар'Кай"],
        bio: "Покинула Орден джедаев после ложного обвинения, но осталась верна защите угнетённых по всей Галактике.",
        speechStyle: "Ироничная, проницательная, уравновешенная и отважная",
        avatar: "https://images.unsplash.com/photo-1517841905240-472988babdf9?w=400",
      },
      {
        name: "Дин Джарин (Мандалорец)",
        role: "Охотник за головами, хранитель Тёмного Меча",
        traits: ["Броня из чистого бескара", "«Таков путь»", "Бластерная винтовка Amban", "Защитник Грогу"],
        bio: "Член традиционного клана «Дети Дозора». Живёт по строгому кодексу мандалорцев.",
        speechStyle: "Хриплый глуховатый голос из-под шлема, краткий и непоколебимый",
        avatar: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=400",
      },
    ],
    worldRules: [
      "Сила — энергетическое поле, пронизывающее всё живое; эмоции страха, гнева и алчности ведут на Тёмную сторону",
      "Световой меч настраивается через кайбер-кристалл, входящий в резонанс с духом владельца",
      "Правило Двух ситхов: «Один воплощает мощь, другой жаждет её»",
      "Гиперпространственные прыжки невозможны вблизи гравитационных колодцев массивных тел без точных расчетов",
      "Бескар — легендарная мандалорская сталь, отражающая даже прямые удары световых клинков",
    ],
    factions: [
      "Орден Джедаев (Храм на Корусанте / Тайтон)",
      "Орден Ситхов (Дарт Сидиус / Дарт Вейдер)",
      "Галактическая Империя / Имперский флот",
      "Альянс за восстановление Республики (Повстанцы)",
      "Мандалорские кланы (Кровь и Честь)",
      "Гильдия Охотников за головами и Синдикат Пайков",
    ],
    cosmology: "Галактика из сотен тысяч обитаемых миров вокруг Ядра, Неизведанные Регионы и Внешнее Кольцо.",
    keyThemes: ["Искупление и надежда", "Соблазн абсолютной власти", "Узы братства и учительства"],
  },

  harrypotter: {
    universeTitle: "Гарри Поттер (Wizarding World / J.K. Rowling)",
    settingSummary: "Скрытый магический мир Британии и Европы, сосуществующий бок о бок с миром маглов под защитой Международного статута о секретности. Древние замки, факультеты волшебства и затаившееся древнее зло.",
    canonCharacters: [
      {
        name: "Альбус Дамблдор",
        role: "Директор Хогвартса, величайший волшебник современности",
        traits: ["Бузинная палочка", "Орден Мерлина I степени", "Феникс Фоукс", "Абсолютная мудрость"],
        bio: "Победитель Грин-де-Вальда, основатель Ордена Феникса. Единственный, кого когда-либо боялся Волан-де-Морт.",
        speechStyle: "Мягкий, доброжелательный, полный тонкой иронии и глубочайшей проницательности",
        avatar: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=400",
      },
      {
        name: "Северус Снейп",
        role: "Мастер зелий, декан Слизерина, двойной агент",
        traits: ["Окклюмент высочайшего уровня", "Патронус Лань", "«Всегда»", "Мастер тёмных искусств"],
        bio: "Человек трагической судьбы, рисковавший жизнью каждый миг ради памяти Лили Поттер под прикрытием служения Тёмному Лорду.",
        speechStyle: "Шелестящий, язвительный, бархатный ледяной голос с идеальными паузами",
        avatar: "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=400",
      },
      {
        name: "Лорд Волан-де-Морт (Том Реддл)",
        role: "Тёмный Лорд, наследник Слизерина",
        traits: ["Создатель 7 крестражей", "Змеиное лицо", "Легилимент", "Авада Кедавра"],
        bio: "Могущественный тёмный маг, разорвавший собственную душу на куски ради бессмертия. Повелитель Пожирателей Смерти.",
        speechStyle: "Шипящий, высокомерный, театрально-вежливый, переходящий в леденящий крик",
        avatar: "https://images.unsplash.com/photo-1579783900882-c0d3dad7b119?w=400",
      },
      {
        name: "Гарри Поттер",
        role: "Мальчик, который выжил, ловец Гриффиндора",
        traits: ["Шрам в виде молнии", "Мантия-невидимка", "Экспеллиармус", "Патронус Олень"],
        bio: "Пережил смертельное проклятие во младенчестве. Избранный, которому суждено либо погибнуть, либо сразить Тёмного Лорда.",
        speechStyle: "Прямой, честный, эмоциональный, верный друзьям",
        avatar: "https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=400",
      },
      {
        name: "Сириус Блэк (Бродяга)",
        role: "Крёстный отец Гарри, мародёр, анимаг-пёс",
        traits: ["Анимаг (чёрный пёс)", "Узник Азкабана", "Бунтарь против чистокровности", "Орден Феникса"],
        bio: "Провёл 12 лет в Азкабане по ложному обвинению в предательстве Поттеров. Бежал, чтобы защитить крестника.",
        speechStyle: "Хриплый от долгого молчания, страстный, благородный и безрассудный",
        avatar: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=400",
      },
    ],
    worldRules: [
      "Палочка выбирает волшебника сама; чужая палочка слушается хуже, если не была отвоёвана в честном бою",
      "Три Непростительных заклятия (Авада Кедавра, Круциатус, Империус) караются пожизненным заключением в Азкабан",
      "Крестраж (хоркрукс) требует совершения хладнокровного убийства для раскола души",
      "Статут о секретности 1692 года строго запрещает демонстрировать магию магглам под угрозой суда Визенгамота",
      "Патронус питается чистейшим счастливым воспоминанием и является единственной защитой от дементоров",
    ],
    factions: [
      "Хогвартс (Факультеты: Гриффиндор, Слизерин, Когтевран, Пуффендуй)",
      "Орден Феникса (Штаб-квартира на площади Гриммо, 12)",
      "Пожиратели Смерти (Тёмная Метка, Малфои, Лестрейнджи)",
      "Министерство Магии (Отдел Тайн, Аврорат)",
      "Банк Гринготтс (Гоблины)",
    ],
    cosmology: "Магическое сообщество сокрыто на Земле чарами невидимости и отвода глаз.",
    keyThemes: ["Сила любви против смерти", "Предубеждения чистоты крови", "Цена выбора и самопожертвование"],
  },

  warhammer40k: {
    universeTitle: "Warhammer 40,000 (Games Workshop)",
    settingSummary: "41-е тысячелетие: мрачная эра, где «во мраке далекого будущего есть только война». Империум Человечества, возглавляемый полумертвым Богом-Императором на Золотом Троне, ведет безнадежную войну на выживание против еретиков, демонов Варпа и чужаков-ксеносов.",
    canonCharacters: [
      {
        name: "Император Человечества",
        role: "Владыка Империума, Бог на Золотом Троне",
        traits: ["Псайкер абсолютной мощи", "Свет Астрономикона", "10 000 лет страданий", "Анафема Хаоса"],
        bio: "Создатель Примархов и Космодесанта. Смертельно ранен в битве с Хорусом, его угасающий разум направляет корабли через Варп.",
        speechStyle: "Голос тысячи солнц, эхо в душе каждого верующего",
        avatar: "https://images.unsplash.com/photo-1579783900882-c0d3dad7b119?w=400",
      },
      {
        name: "Робаут Жиллиман",
        role: "Примарх Ультрамаринов, Лорд-Командующий Империума",
        traits: ["Сын Императора", "Меч Императора", "Броня Судьбы", "Гений логистики и реформ"],
        bio: "Воскрешённый архимагосом Коулом и эльдарами Иннари. Единственный действующий лояльный Примарх, пытающийся спасти гибнущую империю.",
        speechStyle: "Властный, аналитический, тяжелый от груза ответственности за триллионы жизней",
        avatar: "https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=400",
      },
      {
        name: "Абаддон Разоритель",
        role: "Воитель Хаоса, магистр Чёрного Легиона",
        traits: ["Меч Драх'ньен", "Когти Хоруса", "13 Чёрных Крестовых походов", "Расколол Галактику"],
        bio: "Бывший первый капитан Лунных Волков. Объединил предательские легионы Хаоса и разорвал реальность Великим Разломом.",
        speechStyle: "Рокочущий рык вечной ненависти к Империуму, железная непреклонность",
        avatar: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=400",
      },
      {
        name: "Грегор Эйзенхорн",
        role: "Инквизитор Ордо Ксенос, пуританин, ставший радикалом",
        traits: ["Псайкер", "Психосиловой меч", "Гримуар Малус Кодициум", "Слуга Инквизиции"],
        bio: "Легендарный инквизитор, посвятивший жизнь искоренению скверны, но вынужденный использовать оружие врага ради спасения человечества.",
        speechStyle: "Холодный расчетливый монолог опытного детектива и безжалостного судьи",
        avatar: "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=400",
      },
    ],
    worldRules: [
      "Варп (Имматериум) — океан психической энергии, населенный демонами Богов Хаоса (Кхорн, Тзинч, Нургл, Слаанеш)",
      "Перемещение через Варп без поля Геллера приводит к немедленному растерзанию команды демоническими сущностями",
      "Любая мутация и несанкционированные псайкерские способности рассматриваются Инквизицией как угроза судного дня",
      "Технологии Адептус Механикус священны: их не изобретают, а находят в СШК и умилостивляют Дух Машины молитвами",
      "Экстерминатус — уничтожение биосферы целой планеты циклоническими торпедами во имя спасения сектора",
    ],
    factions: [
      "Империум Человечества (Адептус Астартес, Инквизиция, Гвардия, Механикус)",
      "Легионы Предателей Хаоса (Чёрный Легион, Гвардия Смерти, Тысяча Сынов)",
      "Орки (Зеленокожие, WAAAGH!)",
      "Некроны (Древние металлические владыки гробниц)",
      "Флоты-ульи Тиранидов (Великий Пожиратель)",
      "Эльдары (Крафтворлды Азуриани и Тёмные Друкхари Коморры)",
    ],
    cosmology: "Галактика Млечный Путь, расколотая Великим Разломом (Cicatrix Maledictum) пополам.",
    keyThemes: ["Фанатизм и выживание", "Цена победы", "Ужас перед непознаваемым", "Неумолимый рок"],
  },

  dune: {
    universeTitle: "Дюна (Dune / Frank Herbert)",
    settingSummary: "Пустынная планета Арракис (Дюна) — единственный источник Спайса (Меланжа), вещества, продлевающего жизнь и позволяющего Навигаторам Гильдии вести корабли через космос. Вокруг контроля над Дюной разворачиваются интриги Великих Домов, Императора и ордена Бене Гессерит.",
    canonCharacters: [
      {
        name: "Пол Атрейдес (Муад'Диб / Квисатц Хадерах)",
        role: "Герцог Арракиса, мессия фрименов, Император",
        traits: ["Провидение будущего", "Голос Бене Гессерит", "Оседлавший Песчаного червя", "Крис-нож"],
        bio: "Сын герцога Лето и леди Джессики. Возглавил кочевой народ фрименов и сокрушил Харконненов и Сардукаров Императора.",
        speechStyle: "Пророческий, леденяще спокойный, несущий груз неизбежного джихада",
        avatar: "https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=400",
      },
      {
        name: "Барон Владимир Харконнен",
        role: "Глава Дома Харконнен, правитель Гьеди Прайм",
        traits: ["Антигравитационные суспензоры", "Беспредельная жестокость", "Коварный стратег", "Яды"],
        bio: "Заклятый враг Дома Атрейдес, инсценировавший падение герцога Лето с помощью предателя доктора Юэ.",
        speechStyle: "Вкрадчивый, булькающий сладострастный голос, скрывающий смертоносную расчетливость",
        avatar: "https://images.unsplash.com/photo-1579783900882-c0d3dad7b119?w=400",
      },
      {
        name: "Чани Кайнз",
        role: "Воительница ситча Табр, возлюбленная Пола, дочь сайяддины",
        traits: ["Глаза ибада (синие белки)", "Крис-нож", "Мастер пустынной поступи", "Верность фрименам"],
        bio: "Дочь имперского планетолога Лиет-Кайнза. Обучила Пола жизни в глубокой пустыне.",
        speechStyle: "Гордый, чистый, лишенный дворцового лицемерия язык песков",
        avatar: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=400",
      },
      {
        name: "Леди Джессика",
        role: "Наложница герцога Лето, послушница Бене Гессерит, Преподобная Мать",
        traits: ["Мастер Голоса", "Прана-бинду контроль тела", "Генетическая линия", "Мать мессии"],
        bio: "Нарушила приказ Ордена родить дочь, родив Полу сына из любви к герцогу, чем изменила судьбу Галактики.",
        speechStyle: "Аристократичный, филигранно контролирующий каждую интонацию",
        avatar: "https://images.unsplash.com/photo-1517841905240-472988babdf9?w=400",
      },
    ],
    worldRules: [
      "Спайс (Меланж) — основа цивилизации: без него невозможна межзвездная навигация и расширение сознания",
      "Батлерианский джихад: «Не создавай машину по образу и подобию разума человеческого» (вычисления ведут Ментаты)",
      "Взаимодействие щита Хольцмана и лазерного луча (лазгана) вызывает субатомный ядерный взрыв",
      "Песчаные черви (Шаи-Хулуд) привлекаются ритмичными ударами по песку; фримены используют пустынную поступь",
      "Голос Бене Гессерит подчиняет чужую волю через резонанс голосовых связок с нервной системой слушателя",
    ],
    factions: [
      "Дом Атрейдес (Честь, справедливость, Каладан)",
      "Дом Харконнен (Промышленный террор, Гьеди Прайм)",
      "Орден Бене Гессерит (Скрытые селекционеры власти)",
      "Вольные фримены Арракиса (Ситч Табр, хранители пустыни)",
      "Космическая Гильдия (Монополия на межзвёздные перелёты)",
      "Императорский Дом Коррино и элитные гвардейцы Сардукары",
    ],
    cosmology: "Феодальная Галактическая Империя Падишаха через 20 000 лет в будущем.",
    keyThemes: ["Опасность харизматических лидеров", "Экология и дефицит ресурсов", "Религиозный фанатизм"],
  },
};

// Find matching canonical universe in our extensive knowledge base
function matchCanonicalUniverse(rawName: string = ""): typeof CANONICAL_UNIVERSE_ENCYCLOPEDIA["witcher"] | null {
  const norm = rawName.toLowerCase().trim();
  if (!norm) return null;

  if (norm.includes("ведьмак") || norm.includes("witcher") || norm.includes("геральт") || norm.includes("сапковск")) {
    return CANONICAL_UNIVERSE_ENCYCLOPEDIA["witcher"];
  }
  if (norm.includes("киберпанк") || norm.includes("cyberpunk") || norm.includes("2077") || norm.includes("сильверхенд")) {
    return CANONICAL_UNIVERSE_ENCYCLOPEDIA["cyberpunk"];
  }
  if (norm.includes("звездн") || norm.includes("звёздн") || norm.includes("star wars") || norm.includes("джедай") || norm.includes("ситх")) {
    return CANONICAL_UNIVERSE_ENCYCLOPEDIA["starwars"];
  }
  if (norm.includes("поттер") || norm.includes("гарри") || norm.includes("хогвартс") || norm.includes("дамблдор") || norm.includes("роулинг")) {
    return CANONICAL_UNIVERSE_ENCYCLOPEDIA["harrypotter"];
  }
  if (norm.includes("ваха") || norm.includes("warhammer") || norm.includes("40000") || norm.includes("40k") || norm.includes("вархаммер") || norm.includes("астартес")) {
    return CANONICAL_UNIVERSE_ENCYCLOPEDIA["warhammer40k"];
  }
  if (norm.includes("дюн") || norm.includes("dune") || norm.includes("арракис") || norm.includes("муад'диб") || norm.includes("герберт")) {
    return CANONICAL_UNIVERSE_ENCYCLOPEDIA["dune"];
  }

  return null;
}

function generateProceduralChatFallback(
  userMsg: string = "",
  sceneText: string = "",
  characters: any[] = [],
  genre: string = "Фэнтези",
  style: string = "brutal",
  length: string = "medium",
  universeSetting?: any,
  searchGroundingEnabled: boolean = false
) {
  const msgLower = (userMsg || "").toLowerCase();
  const companion = Array.isArray(characters) && characters.length > 0 ? characters[0] : null;
  const companionName = companion?.name || "Спутник";
  const uName = universeSetting?.universeName || genre;

  const matchedCanon = matchCanonicalUniverse(uName) || matchCanonicalUniverse(userMsg);

  // 0. Forced Plot Acceptance / Author Dictate Mode in procedural fallback
  const isDictate =
    msgLower.includes("принять сюжет") ||
    msgLower.includes("принудительн") ||
    msgLower.includes("утверди сюжет") ||
    msgLower.includes("не спорь") ||
    msgLower.includes("без споров") ||
    msgLower.includes("я так решил") ||
    msgLower.includes("закрепи поворот") ||
    msgLower.includes("утверди поворот");

  if (isDictate) {
    const plotContent = userMsg.length > 5 ? userMsg : "Утверждённый автором сюжетный поворот";
    return {
      reply: `### ⚡ Принято безоговорочно, Автор!\n\nТвоё слово — непреложный закон сюжета. Никаких споров о канонах или ограничениях: твоя творческая воля имеет абсолютный приоритет!\n\n**Зафиксировано:** «${plotContent}».\n\nНажми кнопку ниже, чтобы закрепить этот поворот в канон и в согласованные детали повести, и ИИ будет неукоснительно соблюдать его в каждой последующей главе!`,
      actionProposal: {
        type: "accept_plot",
        title: "⚡ Безоговорочно утвердить сюжет в канон",
        description: "Утвердить данный поворот в канон повести без споров",
        payload: {
          title: `Утверждённый сюжет: ${plotContent.slice(0, 45)}`,
          content: plotContent,
          category: "plot_rule",
          injectScene: false,
        },
      },
      suggestedPrompts: [
        "Как это решение повлияет на отношения спутников?",
        "Напиши продолжение сцены с учётом этого поворота",
        "Какие последствия вызовет этот шаг в мире повести?",
      ],
    };
  }

  // 1. Inquiries about CANONICAL CHARACTERS ("какие там персонажи", "кто в этом мире", "герои вселенной")
  const isCharacterInquiry =
    msgLower.includes("персонаж") ||
    msgLower.includes("геро") ||
    msgLower.includes("злоде") ||
    msgLower.includes("кто там") ||
    msgLower.includes("кто есть") ||
    msgLower.includes("действующ") ||
    msgLower.includes("назови персонажей") ||
    msgLower.includes("какие там");

  const isAskingAboutCurrentCompanion =
    msgLower.includes("мой спутник") ||
    msgLower.includes("наш спутник") ||
    msgLower.includes("в отряде") ||
    (companion && msgLower.includes(companion.name.toLowerCase()));

  if (isCharacterInquiry && !isAskingAboutCurrentCompanion) {
    if (matchedCanon) {
      const topChars = matchedCanon.canonCharacters;
      const charsListFormatted = topChars
        .map(
          (c, idx) =>
            `**${idx + 1}. ${c.name}** — *${c.role}*\n` +
            `• **Характер и черты**: ${c.traits.join(", ")}\n` +
            `• **Краткая суть**: ${c.bio}\n` +
            `• **Стиль речи**: ${c.speechStyle}`
        )
        .join("\n\n");

      const randomHero = topChars[Math.floor(Math.random() * topChars.length)];

      return {
        reply: `### Каноничные персонажи вселенной «${matchedCanon.universeTitle}» 👥\n\nВ подлинном каноне этого первоисточника ключевыми фигурами являются:\n\n${charsListFormatted}\n\n---\n💡 **Как ввести их в твою повесть?**\nМы можем органично свести пути твоего героя с легендарным **${randomHero.name}** прямо в следующей сцене (в качестве неожиданного союзника, наставника или могущественного оппонента). Хочешь, чтобы он появился прямо сейчас?`,
        actionProposal: {
          type: "add_character",
          title: `Ввести каноничного персонажа: ${randomHero.name}`,
          description: `Добавить легендарного героя (${randomHero.role}) в сюжетную линию`,
          payload: {
            character: {
              name: randomHero.name,
              role: randomHero.role,
              affinity: 50,
              affinityTitle: "Знакомый",
              bio: randomHero.bio,
              avatar: randomHero.avatar,
              traits: randomHero.traits,
              speechStyle: randomHero.speechStyle,
            },
          },
        },
        suggestedPrompts: [
          `Как свести сюжет с персонажем ${randomHero.name}?`,
          `Какой главный конфликт между фракциями в «${matchedCanon.universeTitle}»?`,
          `Расскажи подробный лор и законы магии/технологий этого мира`,
        ],
        groundingSources: [
          {
            title: `Wiki: Персонажи и канон «${matchedCanon.universeTitle}»`,
            url: `https://google.com/search?q=${encodeURIComponent(matchedCanon.universeTitle + " characters canon lore")}`,
          },
        ],
      };
    }

    // Custom universe characters inquiry
    const customFactions =
      Array.isArray(universeSetting?.factions) && universeSetting.factions.length > 0
        ? universeSetting.factions.join(", ")
        : "Гильдии, правящие дома и вольные искатели";

    return {
      reply: `### Персонажи и архетипы вселенной «${uName}» 👥\n\nДля мира **«${uName}»** каноничными архетипами и действующими лицами являются:\n\n1. **Эмиссары ведущих фракций** (${customFactions}) — политики, инквизиторы или офицеры, преследующие интересы своих орденов.\n2. **Мастера тайных искусств и ремёсел** — знатоки местных законов магии/технологий, способные раскрыть тайны сеттинга.\n3. **Уличные проводники и наёмники** — закалённые выживальщики, знающие тайные тропы и теневую сторону мира.\n\nВ твоём текущем отряде сейчас находится **${companionName}** (${companion?.role || "соратник"}).\nМы можем ввести колоритного нового спутника из фракции мира прямо сейчас!`,
      actionProposal: {
        type: "add_character",
        title: `Создать каноничного соратника из мира «${uName}»`,
        description: `Ввести персонажа, глубоко связанного с лором и правилами вселенной`,
        payload: {
          character: {
            name: `Эмиссар ордена «${uName}»`,
            role: "Проводник и хранитель канона",
            affinity: 50,
            traits: ["Опытный", "Верный кодексу", "Осведомлённый"],
            bio: `Уроженец мира «${uName}», чья судьба неразрывно переплетена с законами этого сеттинга.`,
          },
        },
      },
      suggestedPrompts: [
        `Кто правит во вселенной «${uName}»?`,
        `Какие тайны скрывает этот мир?`,
        `Предложи неожиданного антагониста для нашего героя`,
      ],
    };
  }

  // 2. Inquiries about CANONICAL LORE, WORLD BUILDING & RULES ("лор", "мироустройство", "как устроен мир", "правила")
  const isLoreInquiry =
    msgLower.includes("лор") ||
    msgLower.includes("сеттинг") ||
    msgLower.includes("мироустройств") ||
    msgLower.includes("построение мира") ||
    msgLower.includes("как устроен") ||
    msgLower.includes("канон") ||
    msgLower.includes("правил") ||
    msgLower.includes("маги") ||
    msgLower.includes("технолог") ||
    msgLower.includes("фракци") ||
    msgLower.includes("сюжет");

  if (isLoreInquiry) {
    if (matchedCanon) {
      const rulesList = matchedCanon.worldRules.map((r) => `• **${r}**`).join("\n");
      const factionsList = matchedCanon.factions.map((f) => `• *${f}*`).join("\n");

      return {
        reply: `### Фундаментальный лор и мироустройство: «${matchedCanon.universeTitle}» 🌌\n\n**Сеттинг и атмосфера:**\n${matchedCanon.settingSummary}\n\n**Космология и исторический контекст:**\n${matchedCanon.cosmology}\n\n**Непреложные законы мира:**\n${rulesList}\n\n**Ключевые противоборствующие фракции:**\n${factionsList}\n\n**Главные темы и философские дилеммы:**\n${matchedCanon.keyThemes.join(" • ")}\n\n---\nЯ могу зафиксировать любую из этих каноничных истин в активный лорбук твоей повести, чтобы ИИ неукоснительно учитывал её при генерации всех последующих глав!`,
        actionProposal: {
          type: "add_lore_fact",
          title: `Внести фундаментальный закон «${matchedCanon.universeTitle}» в лорбук`,
          description: "Зафиксировать правило первоисточника для ИИ-генератора глав",
          payload: {
            title: `Закон мира: ${matchedCanon.worldRules[0]}`,
            description: matchedCanon.worldRules.join("; "),
            category: "правило_мира",
          },
        },
        suggestedPrompts: [
          `Какие каноничные персонажи действуют в мире «${matchedCanon.universeTitle}»?`,
          `Как закон «${matchedCanon.worldRules[0]}» повлияет на текущую сцену?`,
          `Сверься с Google Search: важнейшие исторические даты этой вселенной`,
        ],
        groundingSources: [
          {
            title: `Энциклопедия канона: ${matchedCanon.universeTitle}`,
            url: `https://google.com/search?q=${encodeURIComponent(matchedCanon.universeTitle + " lore world building factions")}`,
          },
        ],
      };
    }

    const factions =
      Array.isArray(universeSetting?.factions) && universeSetting.factions.length > 0
        ? universeSetting.factions.join(", ")
        : "Влиятельные ордены, гильдии и фракции";
    const rules =
      Array.isArray(universeSetting?.worldRules) && universeSetting.worldRules.length > 0
        ? universeSetting.worldRules.map((r: string) => `• ${r}`).join("\n")
        : `• Законы магии и технологий определяют баланс сил в мире «${uName}»\n• Каждое решение героя имеет эхо в репутации фракций`;

    return {
      reply: `### Канонический лор и структура мира «${uName}» 🌌\n\n**Сеттинг:** ${universeSetting?.settingDescription || `Самобытный мир «${uName}» со своими тайнами и законами`}.\n\n- **Фракции и политические силы**: ${factions}.\n- **Законы мироустройства**:\n${rules}\n- **Режим канона**: \`${universeSetting?.canonStrictness || "adaptive"}\` (ИИ согласует все события с этой планкой).\n- **Google Search Grounding**: ${searchGroundingEnabled ? "Включен (факты проверяются в реальном времени)" : "Выключен"}.\n\nМы можем настроить правила мира в специальной вкладке «Вселенная» или добавить новую запись в летопись прямо сейчас.`,
      actionProposal: {
        type: "add_lore_fact",
        title: `Зафиксировать правило мира «${uName}»`,
        description: "Добавить подтверждённый факт в лорбук",
        payload: {
          title: `Тайный закон «${uName}»`,
          description: `Особый аспект магии, технологий или баланса сил в сеттинге «${uName}».`,
          category: "правило_мира",
        },
      },
      suggestedPrompts: [
        `Кто главные исторические личности в мире «${uName}»?`,
        `Какие фракции мира готовы бросить нам вызов?`,
        `Предложи лорный артефакт для нашей повести`,
      ],
    };
  }

  // 3. Companion & Party analysis (when user specifically asks about party companion)
  if (isAskingAboutCurrentCompanion || msgLower.includes("спутник") || msgLower.includes("отношения")) {
    return {
      reply: `### Анализ спутника в отряде\n\nСейчас плечом к плечу с вами идёт **${companionName}** (${companion?.role || "соратник"}).\n\n- **Отношение к герою**: ${companion?.affinity || 50}% (${companion?.affinity && companion.affinity >= 70 ? "Искреннее доверие и преданность" : companion?.affinity && companion.affinity <= 35 ? "Настороженность и холодный расчёт" : "Нейтральный интерес"}).\n- **Характер и привычки**: ${(companion?.traits || ["Сдержанный", "Внимательный"]).join(", ")}.\n- **Рекомендация Соавтора**: Персонаж чутко реагирует на соответствие поступков кодексу мира «${uName}». Совместное преодоление испытаний укрепит ваши узы.\n\nМы можем повысить доверие или ввести нового спутника прямо сейчас!`,
      actionProposal: {
        type: "update_character",
        title: `Укрепить доверие с ${companionName} (+10%)`,
        description: `Отметить вклад персонажа и повысить лояльность до ${(companion?.affinity || 50) + 10}%`,
        payload: { name: companionName, delta: 10, reason: "Признание заслуг и душевный разговор соавтора" },
      },
      suggestedPrompts: [
        `Как завоевать максимальную преданность ${companionName}?`,
        `Какие скрытые мотивы у ${companionName}?`,
        `Кто ещё из каноничных персонажей вселенной может присоединиться к нам?`,
      ],
    };
  }

  // 4. Style, Length, and Engine settings
  if (msgLower.includes("стиль") || msgLower.includes("длин") || msgLower.includes("настрой") || msgLower.includes("глав")) {
    return {
      reply: `### Настройка литературного движка повести\n\nТекущие параметры:\n- **Стиль**: \`${style}\`\n- **Длина глав**: \`${length === "short" ? "Краткая (1-2 абзаца)" : length === "long" ? "Развёрнутая (4-5 абзацев)" : "Сбалансированная (2-3 абзаца)"}\`\n- **Сеттинг**: ${uName}\n- **Жанр**: ${genre}\n\nЯ могу мгновенно переключить стиль на **хлёсткий экшен**, **тёмную готику**, **киберпанк**, **литературную классику** или настроить желаемый объём генерации. Что выбираешь?`,
      actionProposal: {
        type: "change_length",
        title: "Переключить длину глав на: Краткая (1-2 абзаца)",
        description: "Главы станут максимально динамичными, без лишней воды и пауз",
        payload: { length: "short", lengthName: "Краткая (1-2 абзаца)" },
      },
      suggestedPrompts: [
        "Сделай стиль более кинематографичным и мрачным",
        "Включи максимальный темп и лаконичность",
        "Предложи 3 сюжетных хода для текущей сцены",
      ],
    };
  }

  // 5. Plot twists and dynamic suggestions
  if (msgLower.includes("твист") || msgLower.includes("поворот") || msgLower.includes("неожидан") || msgLower.includes("предложи")) {
    return {
      reply: `### Сюжетные предложения от Соавтора ⚡\n\nОпираясь на реалии вселенной «${uName}», предлагаю 3 захватывающих вектора:\n\n1. **«Эхо тайного сговора»**: Оказывается, события в этой локации были заранее подстроены одной из ключевых фракций мира, и ваш приход — часть их плана.\n2. **«Пробуждение древнего реликта»**: Скрытый артефакт или механизм в окружении реагирует на героя, ломая привычные правила физики/магии этого мира.\n3. **«Внезапное столкновение»**: На сцену выходит влиятельный каноничный персонаж первоисточника, преследующий собственную выгоду.\n\nГотовы внедрить первый вариант прямо сейчас?`,
      actionProposal: {
        type: "execute_action",
        title: "Внедрить сюжетный твист: Раскрытие тайного сговора",
        description: "Сделать этот ход следующим поворотным моментом в повести",
        payload: { actionLabel: "Остановиться, сопоставить улики и указать спутнику на следы тайного заговора" },
      },
      suggestedPrompts: [
        "Предложи другой твист с предательством",
        "Какие фракции мира могли подстроить эту ловушку?",
        "Как это связано с каноничным лором вселенной?",
      ],
    };
  }

  // Default smart GM advice
  return {
    reply: `### Заметки Соавтора по текущей сцене («${uName}»)\n\nМы находимся в ключевой точке развёртывания сюжета. С точки зрения канона и драматического напряжения, перед вами 3 сильных хода:\n\n1. **Решительный натиск**: Действовать на опережение, используя особенности окружения и правила мира.\n2. **Дипломатическая игра**: Выяснить истинные цели присутствующих лиц и заключить выгодный союз.\n3. **Глубокая разведка**: Исследовать локацию на предмет тайников, скрытых архивов или следов влияния фракций.\n\nКакое направление выберем? Также вы можете спросить меня о **персонажах этой вселенной**, **правилах мира** или скомандовать **изменить стиль и длину глав**.`,
    actionProposal: {
      type: "execute_action",
      title: "Выбрать ход: Осторожно осмотреть обстановку и занять позицию",
      description: "Сделать выверенный шаг вперёд без лишнего риска",
      payload: { actionLabel: "Внимательно осмотреть окружение, оценить риски и занять выгодную позицию" },
    },
    suggestedPrompts: [
      `Кто ключевые персонажи во вселенной «${uName}»?`,
      `Как устроен фундаментальный лор и правила этого мира?`,
      `Предложи неожиданный сюжетный поворот`,
    ],
  };
}

// 15.6. Universe Lore & Canon Search using Gemini with Google Search Grounding
app.post("/api/universe/search-lore", async (req, res) => {
  try {
    const { universeName, query, customKey } = req.body;
    const cleanQuery = (query || "").trim();
    const cleanUniverse = (universeName || "Фэнтези").trim();

    if (!cleanQuery) {
      return res.status(400).json({ error: "Query is required" });
    }

    const ai = getGeminiClient(customKey);
    const prompt = `Ты — ведущий эксперт-исследователь и архивариус вселенной «${cleanUniverse}».
Тема/запрос для исследования: "${cleanQuery}"

Используй поиск Google Search, чтобы найти точные каноничные факты, правила мира, фракции, артефакты или исторические события, связанные с «${cleanQuery}» в рамках сеттинга «${cleanUniverse}».

Верни строго JSON:
{
  "title": "Каноничное название темы/термина/персонажа/локации",
  "category": "правило_мира|локация|персонаж|артефакт|событие",
  "summary": "Ёмкая выжимка (2-3 предложения для читателя)",
  "description": "Подробное художественное описание для лорбука повести",
  "keyFacts": ["Ключевой факт 1", "Ключевой факт 2", "Ключевой факт 3"]
}`;

    if (!ai) {
      return res.json({
        title: cleanQuery,
        category: "правило_мира",
        summary: `Каноничные факты о «${cleanQuery}» в контексте вселенной «${cleanUniverse}».`,
        description: `В мире «${cleanUniverse}» понятие «${cleanQuery}» занимает важное место в балансе сил, истории орденов и законах магии/технологий.`,
        keyFacts: [
          `Каноничная часть сеттинга «${cleanUniverse}»`,
          `Влияет на окружение, отношения фракций и сюжетные развилки`,
          `Служит основой для неожиданных поворотов сюжета`
        ],
        sources: [
          {
            title: `Энциклопедия канона: ${cleanUniverse} — ${cleanQuery}`,
            url: `https://fandom.com/search?q=${encodeURIComponent(cleanUniverse + " " + cleanQuery)}`
          },
          {
            title: `База данных Google: ${cleanUniverse}`,
            url: `https://google.com/search?q=${encodeURIComponent(cleanUniverse + " " + cleanQuery + " lore wiki")}`
          }
        ]
      });
    }

    const result = await runGeminiWithSearchFallback(
      prompt,
      `Ты — архивариус лора вселенной ${cleanUniverse}. Используй инструмент Google Search для проверки канона.`,
      true,
      customKey,
      true
    );

    const parsed = JSON.parse(result.text);
    res.json({
      title: parsed.title || cleanQuery,
      category: parsed.category || "правило_мира",
      summary: parsed.summary || "",
      description: parsed.description || "",
      keyFacts: Array.isArray(parsed.keyFacts) ? parsed.keyFacts : [],
      sources: result.groundingSources || [],
      searchQueries: result.searchQueries || [],
    });
  } catch (error: any) {
    console.error("Universe search-lore error:", error);
    const { universeName, query } = req.body;
    const cleanUniverse = universeName || "Вселенная повести";
    const cleanQuery = query || "Лор и канон";
    res.json({
      title: cleanQuery,
      category: "правило_мира",
      summary: `Каноничный аспект «${cleanQuery}» для сеттинга «${cleanUniverse}».`,
      description: `Аспект лора, определяющий законы и обстановку мира «${cleanUniverse}».`,
      keyFacts: [
        "Связано с глубинным каноном сеттинга",
        "Оказывает влияние на спутников и окружение"
      ],
      sources: [
        {
          title: `Поиск Google: ${cleanUniverse} ${cleanQuery}`,
          url: `https://google.com/search?q=${encodeURIComponent(cleanUniverse + " " + cleanQuery)}`
        }
      ]
    });
  }
});

// 16. Universal Music Search across Internet Bases (iTunes catalog, Radio-Browser, Ambient Streams)
app.get("/api/music/search", async (req, res) => {
  const query = String(req.query.query || req.query.q || "").trim();
  const source = String(req.query.source || "all").toLowerCase();

  if (!query) {
    return res.json({ results: [] });
  }

  const results: any[] = [];

  const fetchWithTimeout = async (url: string, timeoutMs: number = 4500) => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetch(url, { signal: controller.signal });
      clearTimeout(timer);
      return response;
    } catch (e) {
      clearTimeout(timer);
      return null;
    }
  };

  const tasks: Promise<void>[] = [];

  // 1. iTunes Music API (Official Songs, Soundtracks, OSTs, Artists)
  if (source === "all" || source === "itunes") {
    tasks.push(
      (async () => {
        try {
          const resp = await fetchWithTimeout(
            `https://itunes.apple.com/search?term=${encodeURIComponent(query)}&media=music&entity=song&limit=25`
          );
          if (resp && resp.ok) {
            const data: any = await resp.json();
            if (Array.isArray(data.results)) {
              data.results.forEach((item: any) => {
                if (item.previewUrl) {
                  results.push({
                    id: `itunes-${item.trackId}`,
                    name: item.trackName || "Неизвестный трек",
                    artist: item.artistName || "Исполнитель",
                    album: item.collectionName || "",
                    url: item.previewUrl,
                    artwork: item.artworkUrl100 || item.artworkUrl60 || null,
                    genre: item.primaryGenreName || "Музыка",
                    source: "iTunes",
                    sourceType: "preview",
                    mood: item.primaryGenreName ? `Саундтрек: ${item.primaryGenreName}` : "Официальный трек",
                    bpm: 100,
                  });
                }
              });
            }
          }
        } catch (e) {
          console.warn("iTunes search error:", (e as any)?.message);
        }
      })()
    );
  }

  // 2. Radio-Browser API (40,000+ live radio stations, gaming, ambient, synthwave, rock)
  if (source === "all" || source === "radio") {
    tasks.push(
      (async () => {
        try {
          const resp = await fetchWithTimeout(
            `https://de1.api.radio-browser.info/json/stations/search?name=${encodeURIComponent(query)}&limit=15`
          );
          if (resp && resp.ok) {
            const data: any = await resp.json();
            if (Array.isArray(data)) {
              data.forEach((item: any) => {
                const streamUrl = item.url_resolved || item.url;
                if (streamUrl && streamUrl.startsWith("http")) {
                  results.push({
                    id: `radio-${item.stationuuid || Math.random()}`,
                    name: item.name ? item.name.trim() : "Радиостанция",
                    artist: item.country ? `Радио (${item.country})` : "Интернет-радио",
                    album: item.tags ? item.tags.slice(0, 40) : "Прямой аудиоэфир",
                    url: streamUrl,
                    artwork: item.favicon && item.favicon.startsWith("http") ? item.favicon : null,
                    genre: item.tags?.split(",")[0] || "Радио",
                    source: "Radio-Browser",
                    sourceType: "live-stream",
                    mood: item.tags ? `Теги: ${item.tags.slice(0, 45)}` : "Круглосуточный эфир",
                    bpm: 95,
                  });
                }
              });
            }
          }
        } catch (e) {
          console.warn("Radio-browser search error:", (e as any)?.message);
        }
      })()
    );
  }

  await Promise.allSettled(tasks);

  // Curated presets match
  const qLower = query.toLowerCase();
  const presets = [
    {
      id: "stream-cyber",
      name: "Cyberpunk Synth Radio",
      artist: "Night City Radio",
      album: "Киберпанк / Синтвейв",
      url: "https://stream.zeno.fm/f3wvbbqmdg8uv",
      artwork: "https://images.unsplash.com/photo-1542751371-adc38448a05e?w=200",
      genre: "Киберпанк",
      source: "SomaFM / Stream",
      sourceType: "live-stream",
      mood: "Неон, ночной город, драйв",
      bpm: 110,
    },
    {
      id: "stream-dark-ambient",
      name: "Dark Dungeon & Abyss Drone",
      artist: "SomaFM Drone Zone",
      album: "Тёмный эмбиент / Мистика",
      url: "https://ice6.somafm.com/dronezone-128-mp3",
      artwork: "https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=200",
      genre: "Тёмный эмбиент",
      source: "SomaFM / Stream",
      sourceType: "live-stream",
      mood: "Подземелья, заброшенные замки",
      bpm: 65,
    },
    {
      id: "stream-fantasy-tavern",
      name: "Fantasy Bard & Tavern Folk",
      artist: "Thistle Radio Folk",
      album: "Фэнтези / Лютня и костёр",
      url: "https://ice2.somafm.com/thistle-128-mp3",
      artwork: "https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=200",
      genre: "Фэнтези",
      source: "SomaFM / Stream",
      sourceType: "live-stream",
      mood: "Тепло таверны, странствия",
      bpm: 90,
    },
    {
      id: "stream-space",
      name: "Space Deep Drone",
      artist: "SomaFM Space",
      album: "Космоопера / Эмбиент",
      url: "https://ice4.somafm.com/spacestation-128-mp3",
      artwork: "https://images.unsplash.com/photo-1451187580459-43490279c0fa?w=200",
      genre: "Космос",
      source: "SomaFM / Stream",
      sourceType: "live-stream",
      mood: "Невесомость, далёкие галактики",
      bpm: 55,
    },
    {
      id: "stream-lofi",
      name: "Midnight Story Lofi",
      artist: "Groove Salad",
      album: "Лоу-фай / Релакс",
      url: "https://ice4.somafm.com/groovesalad-128-mp3",
      artwork: "https://images.unsplash.com/photo-1501386761578-eac5c94b800a?w=200",
      genre: "Лоу-фай",
      source: "SomaFM / Stream",
      sourceType: "live-stream",
      mood: "Чтение под дождём, ностальгия",
      bpm: 85,
    },
  ];

  const matched = presets.filter(
    (p) =>
      p.id.toLowerCase().includes(qLower) ||
      p.name.toLowerCase().includes(qLower) ||
      p.genre.toLowerCase().includes(qLower) ||
      p.mood.toLowerCase().includes(qLower) ||
      p.artist.toLowerCase().includes(qLower) ||
      (qLower.includes("amb") && (p.genre.toLowerCase().includes("эмбиент") || p.id.includes("ambient"))) ||
      (qLower.includes("таверн") || qLower.includes("tavern") || qLower.includes("bard") || qLower.includes("фэнтези")) && p.id.includes("tavern") ||
      (qLower.includes("кибер") || qLower.includes("cyber") || qLower.includes("synth")) && p.id.includes("cyber") ||
      (qLower.includes("космос") || qLower.includes("space") || qLower.includes("star")) && p.id.includes("space") ||
      (qLower.includes("lofi") || qLower.includes("лоу") || qLower.includes("relax")) && p.id.includes("lofi")
  );

  results.push(...matched);

  res.json({
    query,
    count: results.length,
    results,
  });
});

// Fallback procedural generator - contextual and dynamic without rigid quotes or boilerplate
function generateRichFallbackScene(
  storyTitle: string,
  genre: string,
  action: string,
  currentScene: string,
  characters: any[],
  pov: string,
  focus: string,
  universeSetting?: any
) {
  const rawAction = (action || "Сделать решительный шаг вперёд").trim();
  const cleanAction = rawAction.replace(/^["'«»]+|["'«»]+$/g, "");
  const safeCharacters = Array.isArray(characters) ? characters : [];
  const char =
    safeCharacters.length > 0 && safeCharacters[0] && typeof safeCharacters[0] === "object"
      ? safeCharacters[0]
      : { name: "Спутник", traits: ["Внимательный"] };
  const charName = char.name || "Спутник";
  const uName = universeSetting?.universeName || genre;

  const isFirstPOV = pov === "first";
  const heroRef = isFirstPOV ? "Я" : "Вы";
  const seeWord = isFirstPOV ? "вижу" : "видите";
  const feelWord = isFirstPOV ? "чувствую" : "чувствуете";

  const lower = cleanAction.toLowerCase();
  const isTravel = /лагерь|везет|везти|ехать|путь|дорог|песк|верблюд|машин|транспорт|поездк|идти/i.test(lower);
  const isCombat = /атак|удар|клинок|меч|выстрел|бой|схватк|защит|отрази/i.test(lower);
  const isDialogue = /сказ|спрос|ответ|говор|шепт|разговор|поговор|объясн|предлож/i.test(lower);
  const isMagicOrPlan = /маги|заклин|карт|план|свиток|руны|зель|артефакт|тайн|водосток|катакомб/i.test(lower);

  let p1 = "";
  let p2 = "";
  let p3 = "";
  let p4 = "";

  // If user provided a detailed, long, or multi-faceted action:
  if (cleanAction.length > 90 || (cleanAction.includes(",") && cleanAction.length > 60)) {
    p1 = `Замысел приводится в исполнение со всей тщательностью. Каждая деталь задуманного маневра находит точное воплощение в пространстве мира «${uName}»: от первых выверенных шагов до взаимодействия с окружающими предметами и спутниками.`;
    p2 = `${charName} внимательно следит за ходом действий и сразу включается в процесс, подхватывая предложенный ритм: «Этот расчет имеет смысл. В реалиях «${uName}» прямолинейные шаги редко приводят к победе, а такой продуманный маневр меняет баланс сил в нашу пользу».`;
    p3 = `Материальный эффект от принятого решения проявляется незамедлительно: обстановка вокруг перестраивается, напряжение спадает, а намеченный маршрут обретает реальные очертания без лишней суеты.`;
    p4 = `Цель предпринятого действия достигнута: расстановка сил зафиксирована, и перед отрядом открывается возможность уверенно развить полученное преимущество.`;
  } else if (isTravel) {
    p1 = `Решение не заставляет себя ждать: замысел незамедлительно претворяется в жизнь. Поднявшись и собрав вещи, ${heroRef.toLowerCase()} отправляетесь в путь по землям мира «${uName}». Окружающий ландшафт постепенно меняется, открывая характерные черты этого сеттинга, а ритм движения позволяет собраться с мыслями.`;
    p2 = `Спустя время впереди начинают проступать очертания укрытия — укреплённый форпост местных фракций. ${charName} внимательно следит за приближением: «Мы почти на месте. В землях «${uName}» чужаков встречают настороженно, но решительных уважают».`;
    p3 = `Ступив на новую территорию, ${heroRef.toLowerCase()} ${seeWord} оживлённое движение: лица обитателей и скрытые взгляды, обращённые в вашу сторону. Обстановка сулит как новые возможности, так и скрытые ориентиры.`;
  } else if (isCombat) {
    p1 = `Действие претворяется в жизнь без малейшего промедления. Точный расчет и хладнокровное движение меняют расстановку сил, заставляя противников отступить на шаг назад.`;
    p2 = `${charName} надежно поддерживает ваш манёвр, прикрывая фланг и отсекая пути неприятелю: «Инициатива переходит к нам! Держим позицию!»`;
    p3 = `Сделанный ход приносит свои плоды: непосредственная угроза нейтрализована, а перед вами открывается возможность закрепить достигнутый успех.`;
  } else if (isDialogue) {
    p1 = `Слова звучат твёрдо и отчётливо, разрезая повисшую тишину. Прямота и открытость вашего обращения заставляют собеседников прекратить недомолвки и взглянуть на ситуацию без лишних иллюзий.`;
    p2 = `${charName} согласно кивает, принимая вашу позицию: «Ты говоришь ровно то, о чём в здешних краях многие боятся сказать вслух. Законы «${uName}» суровы, но с этим трудно спорить». В глазах союзников читается неподдельный интерес к дальнейшему плану.`;
    p3 = `Разговор проясняет истинные мотивы сторон. Теперь, когда карты приоткрыты, наступает время определить дальнейший совместный маршрут.`;
  } else {
    p1 = `Задуманное осуществляется без задержек. Окружающая обстановка мгновенно реагирует на предпринятый шаг: события разворачиваются в новом русле, выводя сюжет на перспективную тропу.`;
    p2 = `${charName} с одобрением оценивает этот выбор, оперативно подстраиваясь под изменившиеся обстоятельства мира «${uName}»: «Кажется, этот шаг меняет всё, к чему мы привыкли, но именно так и преодолевают тупики».`;
    p3 = `${heroRef} ${feelWord}, как ситуация стабилизируется в вашу пользу, открывая сразу несколько перспективных вариантов для продолжения повести.`;
  }

  const sceneText = [p1, p2, p3, p4].filter(Boolean).join("\n\n");

  const searchEnabled = Boolean(universeSetting?.searchGroundingEnabled);
  const fallbackSources = searchEnabled
    ? [
        {
          title: `Хроника и канон: ${uName}`,
          url: `https://fandom.com/search?q=${encodeURIComponent(uName)}`,
        },
      ]
    : undefined;

  return {
    sceneText,
    dialogueSpeaker: charName,
    choices: [
      { id: "c_1", label: `Закрепить преимущество и развить замысел в ${uName}`, description: "Воспользоваться успехом предпринятого маневра" },
      { id: "c_2", label: `Обсудить дальнейший маршрут с ${charName}`, description: "Узнать подробности и согласовать следующий шаг" },
      { id: "c_3", label: "Оценить обстановку и проверить окружение на скрытые угрозы", description: "Убедиться в безопасности новой позиции" },
    ],
    statChanges: { hp: 0, energy: -5, gold: 0 },
    affinityChanges: [{ name: charName, delta: 5, reason: "Оценил глубину замысла" }],
    atmosphere: focus === "action" ? "action" : "mysterious",
    suggestedMusic: focus === "action" ? "battle" : "mystic",
    chapterSummary: `Предпринято действие: ${cleanAction.slice(0, 100)}. Ситуация успешно развита в мире «${uName}».`,
    isEnding: false,
    groundingSources: fallbackSources,
  };
}

async function startServer() {
  // Prevent any /api request from falling through to Vite's index.html fallback
  app.all("/api/*", (req, res) => {
    res.status(404).json({ error: `API route ${req.method} ${req.originalUrl} not found` });
  });

  // Global API error handler returning JSON instead of Express default HTML error page
  app.use((err: any, req: any, res: any, next: any) => {
    if (req.path && req.path.startsWith("/api")) {
      console.error("API error handler caught:", err);
      return res.status(500).json({ error: err?.message || "Internal server error" });
    }
    next(err);
  });

  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`StoryZone server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
