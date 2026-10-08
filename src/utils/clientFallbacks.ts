import { ActiveGameState, NarrativePOV, SceneFocus, StoryChoice } from "../types";

export interface StoryStepResponse {
  sceneText: string;
  dialogueSpeaker?: string | null;
  choices: StoryChoice[];
  characterUpdates?: {
    add?: any[];
    remove?: string[];
    meritChanges?: { name: string; newMerit: string }[];
    statusChanges?: { name: string; newStatus: string }[];
  };
  worldChange?: string | null;
  statChanges?: {
    hp?: number;
    energy?: number;
    gold?: number;
  };
  affinityChanges?: { name: string; delta: number; reason?: string }[];
  characterEvolution?: { name: string; addedTrait?: string; addedHabit?: string; reason?: string }[];
  newItems?: string[];
  atmosphere?: "mysterious" | "action" | "romantic" | "dark" | "triumphant" | "calm";
  suggestedMusic?: string;
  chapterSummary?: string;
  newLore?: {
    title: string;
    description: string;
    category: "персонаж" | "локация" | "артефакт" | "событие" | "правило_мира";
  } | null;
  isEnding?: boolean;
  endingTitle?: string | null;
  groundingSources?: { title: string; url: string }[];
}

/**
 * Resilient procedural narrative generator when offline, high-demand,
 * or when the backend returns a gateway error.
 */
export function generateClientStoryStepFallback(
  gameState: ActiveGameState,
  action: string
): StoryStepResponse {
  const cleanAction = (action || "Сделать шаг вперёд").trim();
  const characters = gameState.characters || [];
  const companion = characters.length > 0 ? characters[0] : null;
  const companionName = companion?.name || "Спутник";
  const companionRole = companion?.role || "союзник";

  const isFirstPOV = gameState.narrativePOV === NarrativePOV.FIRST;
  const isThirdPOV = gameState.narrativePOV === NarrativePOV.THIRD;
  const isCompanionPOV = gameState.narrativePOV === NarrativePOV.COMPANION;

  let actorRef = "Вы";
  let decideWord = "решаете";
  let feelWord = "чувствуете";

  if (isFirstPOV) {
    actorRef = "Я";
    decideWord = "решаю";
    feelWord = "чувствую";
  } else if (isThirdPOV) {
    actorRef = "Герой";
    decideWord = "решает";
    feelWord = "чувствует";
  } else if (isCompanionPOV) {
    actorRef = companionName;
    decideWord = "наблюдает, как вы решаете";
    feelWord = "замечает, как дрожит воздух";
  }

  const lower = cleanAction.toLowerCase();
  const isTravel = /лагерь|везет|везти|ехать|путь|дорог|песк|верблюд|машин|транспорт|поездк|идти/i.test(lower);
  const isCombat =
    gameState.currentFocus === SceneFocus.ACTION ||
    /атак|удар|клинок|схватк|меч|выстрел|бой/i.test(lower);
  const isDialogue =
    gameState.currentFocus === SceneFocus.DIALOGUE ||
    /сказ|спрос|ответ|поговор|шепн|говор/i.test(lower);

  let sceneParagraphs: string[] = [];

  // If user provided a detailed, rich, multi-sentence action, develop every facet
  if (cleanAction.length > 90 || (cleanAction.includes(",") && cleanAction.length > 60)) {
    sceneParagraphs = [
      `Замысел воплощается в жизнь последовательно и точно. Каждая деталь намеченного маневра находит отражение в действиях отряда: от первых решительных шагов до взаимодействия с окружающими предметами и спутниками.`,
      `${companionName} мгновенно подхватывает темп, распределяя внимание и координируя действия: «План продуман до мелочей. В здешних краях такой хладнокровный расчет спасает жизнь куда надежнее, чем слепая спешка».`,
      `Результат предпринятых шагов меняет обстановку вокруг в вашу пользу: намеченный маршрут открыт, нежелательное внимание отведено в сторону, а союзники чувствуют уверенность в выбранном пути.`,
      `Ситуация стабилизируется, предоставляя возможность развить достигнутый успех и сделать следующий решающий ход.`,
    ];
  } else if (isTravel) {
    sceneParagraphs = [
      `Шаг сделан без лишних колебаний. Оставив прежнюю стоянку позади, ${actorRef.toLowerCase()} направляетесь вглубь неизведанных земель. Дорога стелется под ногами, а знакомые очертания постепенно сменяются новым ландшафтом.`,
      `${companionName} держится рядом, зорко сканируя горизонт. «Местность здесь неспокойная, — негромко замечает ${companionRole}, поправляя походное снаряжение. — Но решение верное. Задерживаться на месте было куда опаснее».`,
      `Преодолев затяжной переход, отряд достигает ключевого ориентира. Перед взором открывается новая панорама: впереди виднеются следы недавнего присутствия других путников и укрытие, где можно перевести дух или подготовиться к следующему манёвру.`,
      `Ситуация обретает отчётливые контуры. Сделанный выбор уже изменил расстановку сил, открывая дорогу к новым тайнам этого мира.`,
    ];
  } else if (isCombat) {
    sceneParagraphs = [
      `Вместо праздных раздумий ${actorRef.toLowerCase()} немедленно переходите к делу. Точный расчёт и уверенное движение ломают планы противника, заставляя угрозу пошатнуться.`,
      `${companionName} мгновенно подхватывает инициативу, закрывая уязвимое направление и отвлекая внимание на себя: «Держи темп! Инициатива переходит к нам!» — звучит уверенный голос соратника.`,
      `Манёвр завершается успехом. Противник вынужден отступить на несколько шагов, перестраивая оборону и теряя контроль над пространством.`,
      `${actorRef} ${feelWord}, как напряжение схватки кристаллизуется в осязаемое преимущество. Момент для закрепления успеха настал.`,
    ];
  } else if (isDialogue) {
    sceneParagraphs = [
      `Сказанное звучит веско и спокойно, разрезая повисшую паузу. Собеседники замирают, осознавая подлинный смысл прозвучавших слов.`,
      `${companionName} слегка щурится, оценивая произведённый эффект. Во взгляде ${companionRole} мелькает уважение: «Мало кто решился бы поднять этот вопрос столь прямо. Теперь им придётся считаться с нашей позицией».`,
      `В воздухе между участниками разговора тает былая недосказанность. Прямота принесла плоды: собеседники открывают подробности, о которых прежде предпочитали умалчивать, и ждут вашего окончательного вердикта.`,
      `Диалог выводит историю на принципиально новый уровень доверия и взаимопонимания.`,
    ];
  } else {
    sceneParagraphs = [
      `Намеченный замысел органично претворяется в жизнь. Окружающая обстановка мгновенно откликается на предпринятые действия: пространство перестраивается, а недавняя неопределённость уступает место ясности.`,
      `${companionName} внимательно изучает последствия сделанного шага, одобрительно кивая: «Грамотный ход. Мы смешали карты тем, кто рассчитывал застать нас врасплох».`,
      `Обстановка вокруг стабилизируется, обнажая новые любопытные детали: от не замеченных ранее знаков до открывшихся троп и скрытых возможностей.`,
      `${actorRef} ${feelWord}, как история делает уверенный шаг вперёд, закрепляя ваши достижения в этом мире.`,
    ];
  }

  const generatedChoices: StoryChoice[] = [
    {
      id: `c_flb_1_${Date.now()}`,
      label: "Развить достигнутый успех и закрепить преимущество",
      description: "Воспользоваться возникшей ситуацией и продвинуться дальше",
      type: isCombat ? "combat" : "special",
    },
    {
      id: `c_flb_2_${Date.now()}`,
      label: `Обсудить следующий шаг с ${companionName}`,
      description: "Сверить планы, распределить роли и укрепить союз",
      type: "dialogue",
    },
    {
      id: `c_flb_3_${Date.now()}`,
      label: "Осмотреть окружение и изучить скрытые детали",
      description: "Отыскать зацепку, тайник или безопасный обходной путь",
      type: "stealth",
    },
  ];

  return {
    sceneText: sceneParagraphs.join("\n\n"),
    dialogueSpeaker: companionName,
    choices: generatedChoices,
    statChanges: {
      hp: 0,
      energy: -5,
      gold: 0,
    },
    affinityChanges: companion
      ? [
          {
            name: companionName,
            delta: 5,
            reason: "Оценил уверенность и авторское решение",
          },
        ]
      : [],
    characterUpdates: {
      meritChanges: [
        {
          name: companionName,
          newMerit: "Проявил надёжность в решающий момент сцены",
        },
      ],
    },
    atmosphere: isCombat ? "action" : "mysterious",
    suggestedMusic: isCombat ? "battle" : "mystic",
    chapterSummary: `Замысел успешно воплощён. События развернулись в пользу отряда.`,
    isEnding: false,
    endingTitle: null,
  };
}

export function generateClientTacticalFallback(
  gameState: ActiveGameState,
  combo: any
): StoryStepResponse {
  const stanceName = combo?.stanceName || "Боевая стойка";
  const targetDesc = combo?.targetDescription || "противник";
  const comp = gameState.characters?.[0]?.name || "Спутник";

  const sceneText = `Приняв стойку «${stanceName}», вы молниеносно проводите серию выверенных движений. Ваши приёмы складываются в единый сокрушительный ритм: воздух взрывается от энергии, заставляя ${targetDesc} пошатнуться и потерять равновесие.\n\n${comp} мгновенно подхватывает темп вашей атаки, не давая цели опомниться. «Безупречная связка!» — звучит одобрительный возглас.\n\nПространство вокруг очищается от непосредственной угрозы, даруя вам тактическую свободу.`;

  return {
    sceneText,
    dialogueSpeaker: comp,
    choices: [
      { id: "tac_1", label: "Нанести решающий удар", description: "Поставить точку в схватке" },
      { id: "tac_2", label: "Предложить сдаться или отступить", description: "Проявить милосердие" },
      { id: "tac_3", label: "Осмотреть трофеи и снаряжение", description: "Собрать ценности" },
    ],
    statChanges: { hp: 0, energy: -10, gold: 5 },
    affinityChanges: [{ name: comp, delta: 6, reason: "Восхищён мастерством боя" }],
    atmosphere: "action",
    suggestedMusic: "battle",
    chapterSummary: `Применена тактическая серия «${stanceName}». Враг повержен.`,
    isEnding: false,
  };
}

export function generateClientDivergenceFallback(
  gameState: ActiveGameState,
  payload: any
): StoryStepResponse {
  const dTitle = payload?.title || "Параллельная реальность";
  const comp = gameState.characters?.[0]?.name || "Спутник";

  const sceneText = `Ткань реальности с лёгким треском искажается, когда вступает в силу поворот: «${dTitle}»! Пространство вокруг на мгновение теряет цвета, а затем собирается воедино уже по новым правилам.\n\nВсе взгляды обращаются к изменившемуся окружению. ${comp} замирает, оглядывая преображённый мир: «Что только что произошло?.. Кажется, теперь всё пойдёт совсем иначе».\n\nСудьба открывает перед вами неизведанную тропу.`;

  return {
    sceneText,
    dialogueSpeaker: comp,
    choices: [
      { id: "div_1", label: "Использовать новые правила мира", description: "Действовать без промедления" },
      { id: "div_2", label: "Оценить изменения вместе со спутником", description: "Обсудить дальнейший путь" },
      { id: "div_3", label: "Затаиться и понаблюдать за реакцией окружения", description: "Собрать сведения" },
    ],
    statChanges: { hp: 0, energy: 0, gold: 0 },
    affinityChanges: [{ name: comp, delta: 5, reason: "Разделил удивление новому повороту" }],
    atmosphere: "mysterious",
    suggestedMusic: "mystic",
    chapterSummary: `Активирована сюжетная развилка: «${dTitle}».`,
    isEnding: false,
  };
}
