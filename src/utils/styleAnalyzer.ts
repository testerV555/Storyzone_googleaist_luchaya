export interface AnalyzedStyleDirective {
  styleSummary: string;
  promptDirective: string;
  tone: string;
  pacing: string;
  keyMarkers: string[];
}

/**
 * Heuristic style analyzer that evaluates text syntax, pacing, vocabulary,
 * and punctuation to generate a tailored AI prompt directive mirroring the author.
 */
export function extractAuthorStyleHeuristic(text: string): AnalyzedStyleDirective {
  if (!text || text.trim().length < 20) {
    return {
      styleSummary: "Сбалансированный стиль",
      promptDirective:
        "Исполняй действие игрока точно и без задержек. Излагай текст в строгом соответствии с выбранным стилем повествования, без навязчивого морализаторства и лишней воды.",
      tone: "нейтральный",
      pacing: "умеренный",
      keyMarkers: ["Сбалансированный темп", "Ясный синтаксис"],
    };
  }

  const clean = text.trim();
  const sentences = clean
    .split(/[.!?]+/)
    .map((s) => s.trim())
    .filter(Boolean);
  const words = clean.split(/\s+/).filter(Boolean);
  const avgWordsPerSentence = sentences.length > 0 ? words.length / sentences.length : 12;

  const lines = clean.split("\n").filter(Boolean);
  const dialogueLines = lines.filter(
    (l) =>
      l.trim().startsWith("—") ||
      l.trim().startsWith("-") ||
      l.trim().startsWith("«") ||
      l.trim().startsWith('"')
  );
  const dialogueRatio = dialogueLines.length / (lines.length || 1);

  const exclamationsCount = (clean.match(/!/g) || []).length;
  const ellipsesCount = (clean.match(/\.\.\.|…/g) || []).length;
  const questionsCount = (clean.match(/\?/g) || []).length;

  const hasSensoryWords =
    /холод|запах|кров|тишин|шепот|тень|свет|гул|ветер|пепел|сталь|мрак|дрож|касани|аромат|скрип/i.test(
      clean
    );
  const hasCombatWords =
    /клинок|удар|выпад|шаг|прыжок|секунда|взрыв|пламя|схватка|сталь|уворот|рукоять|выстрел/i.test(
      clean
    );

  const markers: string[] = [];

  // Pacing
  let pacing = "умеренный";
  let rhythmInstruction = "сбалансированные, выверенные предложения";
  if (avgWordsPerSentence < 9) {
    pacing = "стремительный";
    rhythmInstruction = "рубленые, хлёсткие короткие фразы, высокий динамизм и скорость подачи событий";
    markers.push("Короткие динамичные фразы");
  } else if (avgWordsPerSentence > 17) {
    pacing = "развёрнутый";
    rhythmInstruction = "богатые сложносочинённые периоды, глубокие размышления и развёрнутые описания";
    markers.push("Богатый развёрнутый слог");
  } else {
    markers.push("Сбалансированная ритмика");
  }

  // Tone
  let tone = "сдержанный";
  if (exclamationsCount >= 2) {
    tone = "экспрессивный, эмоциональный";
    markers.push("Яркая эмоциональность");
  } else if (ellipsesCount >= 2) {
    tone = "загадочный, психологический саспенс";
    markers.push("Психологический подтекст");
  } else if (questionsCount >= 2) {
    tone = "рефлексивный, полный сомнений";
    markers.push("Внутренний монолог и сомнения");
  } else {
    markers.push("Лаконичная подача");
  }

  // Focus
  let focusInstruction = "";
  if (dialogueRatio >= 0.35) {
    focusInstruction =
      "Делай упор на живые, естественные диалоги между героями, характерные реплики и невысказанные мысли.";
    markers.push("Приоритет живых диалогов");
  } else if (hasCombatWords) {
    focusInstruction =
      "Фокусируйся на тактическом преодолении препятствий, кинематографичности движений и физической реакции персонажей.";
    markers.push("Боевой фокус и кинематографичность");
  } else if (hasSensoryWords) {
    focusInstruction =
      "Уделяй особое внимание осязаемой атмосфере мира, звукам, запахам, свету и телесным ощущениям персонажа.";
    markers.push("Густая сенсорная атмосфера");
  } else {
    focusInstruction = "Веди сюжет чётко и последовательно, развивая решения автора.";
  }

  const styleSummary = `${pacing.toUpperCase()} темп (~${Math.round(
    avgWordsPerSentence
  )} сл./предл.), ${tone} тон, ${markers[0] || "авторский слог"}.`;

  const promptDirective = `Пиши строго в авторском стиле читателя: ${rhythmInstruction}. ${focusInstruction} Общий тон: ${tone}. Исполняй действие игрока точно и без задержек. Категорически избегай шаблонных нравоучений, пустой воды и морализаторства.`;

  return {
    styleSummary,
    promptDirective,
    tone,
    pacing,
    keyMarkers: markers,
  };
}
