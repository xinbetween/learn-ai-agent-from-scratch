/** Locales, URL shapes, and the UI string catalogue.
 *
 *  English lives at the root (`/c04/`), Chinese under a prefix (`/zh/c04/`).
 *  Chapter and page *bodies* are translated separately in `content/zh/`;
 *  anything not translated yet falls back to English with a banner, so the
 *  Chinese site is always complete and navigable even while it is partial. */

export type Locale = "en" | "zh";

export const LOCALES: Locale[] = ["en", "zh"];
export const DEFAULT_LOCALE: Locale = "en";

/** The `lang` attribute and the label shown in the nav switcher. */
export const LOCALE_META: Record<Locale, { lang: string; label: string; name: string }> = {
  en: { lang: "en", label: "EN", name: "English" },
  zh: { lang: "zh-Hans", label: "中", name: "简体中文" },
};

/** `/c04/` → `/zh/c04/` for non-default locales. */
export function localePath(loc: Locale, path: string): string {
  if (loc === DEFAULT_LOCALE) return path;
  return path === "/" ? `/${loc}/` : `/${loc}${path}`;
}

/** Strip a locale prefix back to the canonical path. */
export function stripLocale(path: string): string {
  for (const loc of LOCALES) {
    if (loc === DEFAULT_LOCALE) continue;
    if (path === `/${loc}/`) return "/";
    if (path.startsWith(`/${loc}/`)) return path.slice(loc.length + 1);
  }
  return path;
}

type Dict = Record<string, string>;

const en: Dict = {
  // nav
  "nav.map": "Map",
  "nav.projects": "Projects",
  "nav.qa": "Q&A",
  "nav.answers": "Answers",
  "nav.glossary": "Glossary",
  "nav.compare": "Frameworks",
  "nav.start": "Start",
  "nav.search": "Search",
  "nav.searchAria": "Search (Command K)",
  "nav.searchPlaceholder": "Search chapters, concepts, glossary…",
  "nav.openChapters": "Open chapter list",
  "nav.theme": "Theme",
  "nav.themeAria": "Toggle theme",
  "nav.language": "Language",
  "nav.github": "GitHub",
  "nav.x": "X",
  "nav.linkUnset": "link not set yet",
  "nav.skip": "Skip to content",

  // rail
  "rail.onThisPage": "On this page",
  "rail.progress": "Progress",
  "rail.chaptersPassed": "Chapters passed",
  "rail.begin": "Open a chapter to begin",
  "rail.reset": "reset",

  // chapter sections
  "sec.exercises": "Exercises",
  "sec.exercisesTitle": "Make the chapter yours",
  "sec.exercisesLede":
    'Every answer is written out below, and collected on the <a href="{answers}">answers page</a>. Try each one before opening it — the gap between reading the mechanism and implementing it is where the learning happens.',
  "sec.answer": "Answer",
  "sec.qa": "Q&A",
  "sec.qaTitle": "Questions people ask here",
  "sec.project": "Project",
  "sec.doneMeans": "Done means",
  "sec.ifYouWantMore": "If you want more",
  "sec.continue": "Continue",
  "sec.whereThisGoes": "Where this goes",
  "sec.review": "Review",
  "sec.reviewTitle": "Check your understanding",
  "sec.reviewLede":
    "Six questions. Commit to an answer before you read the explanation — a wrong answer you thought about teaches more than a right one you guessed.",
  "quiz.question": "Question",
  "quiz.of": "of",
  "quiz.next": "Next question",
  "quiz.retake": "Retake",
  "chapter.lines": "lines",

  // pagination
  "pn.prev": "Previous",
  "pn.next": "Next",
  "pn.theMap": "The map",
  "pn.allLayers": "All six layers",
  "pn.howTheyFit": "How the chapters fit together",
  "pn.projects": "Projects",
  "pn.everything": "Everything you can build with this",

  // footer
  "foot.course": "Course",
  "foot.reference": "Reference",
  "foot.startAt": "Start at C00",
  "foot.theMap": "The map",
  "foot.setup": "Local setup",
  "foot.projects": "Projects &amp; capstones",
  "foot.answers": "Exercise answers",
  "foot.qa": "Q&amp;A",
  "foot.glossary": "Glossary",
  "foot.compare": "Framework comparison",
  "foot.timeline": "Timeline",
  "foot.references": "References",
  "foot.about":
    "{chapters} chapters and roughly {lines} lines of dependency-free {lang}, with diagrams, simulators, exercises and two capstones. An agent is a loop; this course is what goes inside it.",

  // fallback banner + 404
  "fallback.title": "Not translated yet",
  "fallback.body":
    "This has not been translated into Chinese yet, so it is shown in English. C00–C04 — the irreducible core of the course — are translated; the rest is in progress.",
  "404.title": "Page not found",
  "404.kicker": "404",
  "404.subtitle": "That page is not part of the course.",
  "404.body":
    '<p><a href="{home}">Back to the start</a> or <a href="{map}">see the map of all {n} chapters</a>.</p>',
};

const zh: Dict = {
  // nav
  "nav.map": "地图",
  "nav.projects": "项目",
  "nav.qa": "问答",
  "nav.answers": "习题答案",
  "nav.glossary": "术语表",
  "nav.compare": "框架对比",
  "nav.start": "开始",
  "nav.search": "搜索",
  "nav.searchAria": "搜索（Command K）",
  "nav.searchPlaceholder": "搜索章节、概念、术语…",
  "nav.openChapters": "打开章节列表",
  "nav.theme": "主题",
  "nav.themeAria": "切换主题",
  "nav.language": "语言",
  "nav.github": "GitHub",
  "nav.x": "X",
  "nav.linkUnset": "链接尚未设置",
  "nav.skip": "跳到正文",

  // rail
  "rail.onThisPage": "本页目录",
  "rail.progress": "学习进度",
  "rail.chaptersPassed": "已通过章节",
  "rail.begin": "打开一章开始学习",
  "rail.reset": "重置",

  // chapter sections
  "sec.exercises": "练习",
  "sec.exercisesTitle": "把这一章变成你自己的",
  "sec.exercisesLede":
    '每题的答案都写在下面，也汇总在<a href="{answers}">答案页</a>。先自己做一遍再展开：读懂一个机制和亲手实现它之间的那道坎，才是真正学到东西的地方。',
  "sec.answer": "答案",
  "sec.qa": "问答",
  "sec.qaTitle": "读到这里，大家常问的问题",
  "sec.project": "项目",
  "sec.doneMeans": "做完的标准",
  "sec.ifYouWantMore": "还想再深入",
  "sec.continue": "接下来",
  "sec.whereThisGoes": "这条线通向哪里",
  "sec.review": "自测",
  "sec.reviewTitle": "检验你的理解",
  "sec.reviewLede":
    "六道题。先给出答案再看解释：一个你认真想过的错答案，比一个蒙对的正确答案教给你的更多。",
  "quiz.question": "第",
  "quiz.of": "题，共",
  "quiz.next": "下一题",
  "quiz.retake": "重做",
  "chapter.lines": "行",

  // pagination
  "pn.prev": "上一章",
  "pn.next": "下一章",
  "pn.theMap": "课程地图",
  "pn.allLayers": "六个层次",
  "pn.howTheyFit": "各章之间如何衔接",
  "pn.projects": "项目",
  "pn.everything": "用这门课能做出来的东西",

  // footer
  "foot.course": "课程",
  "foot.reference": "参考",
  "foot.startAt": "从 C00 开始",
  "foot.theMap": "课程地图",
  "foot.setup": "本地环境",
  "foot.projects": "项目与实战",
  "foot.answers": "习题答案",
  "foot.qa": "问答",
  "foot.glossary": "术语表",
  "foot.compare": "框架对比",
  "foot.timeline": "时间线",
  "foot.references": "参考资料",
  "foot.about":
    "{chapters} 章，约 {lines} 行零依赖 {lang} 代码，配有图解、可交互模拟器、练习和两个实战项目。智能体就是一个循环；这门课讲的是循环里面装什么。",

  // fallback banner + 404
  "fallback.title": "尚未翻译",
  "fallback.body":
    "这部分还没有中文版，因此以英文显示。目前已翻译的是 C00–C04，也就是这门课不可再简的核心部分；其余章节正在翻译中。",
  "404.title": "页面不存在",
  "404.kicker": "404",
  "404.subtitle": "这个页面不属于本课程。",
  "404.body":
    '<p><a href="{home}">回到首页</a>，或者<a href="{map}">看看全部 {n} 章的地图</a>。</p>',
};

const CATALOGUE: Record<Locale, Dict> = { en, zh };

/** Look up a UI string, interpolating `{name}` placeholders. */
export function t(loc: Locale, key: string, vars: Record<string, string | number> = {}): string {
  const s = CATALOGUE[loc][key] ?? CATALOGUE[DEFAULT_LOCALE][key] ?? key;
  return s.replace(/\{(\w+)\}/g, (_, k) => String(vars[k] ?? `{${k}}`));
}

/* ------------------------------------------------------------------ */
/* Landing-page copy. Kept apart from the UI catalogue because it is   */
/* prose rather than chrome, and it is the one page that is entirely   */
/* marketing voice.                                                    */

type LandingCopy = {
  eyebrow: string;
  h1: string;
  blurb1: string;
  blurb2: string;
  ctaStart: string;
  ctaMap: string;
  ctaProjects: string;
  cards: Array<{ h: string; p: string }>;
  whoKicker: string;
  whoTitle: string;
  whoLead: string;
  who: Array<{ href: string; h: string; p: string }>;
  currKicker: string;
  currTitle: string;
  currLead: string;
  everyKicker: string;
  everyTitle: string;
  every: Array<{ h: string; p: string }>;
  beginTitle: string;
  beginLead: string;
  beginCta: string;
};

export const LANDING: Record<Locale, LandingCopy> = {
  en: {
    eyebrow:
      "{chapters} chapters · ~{lines} lines of {lang} · no framework, no API key required to start",
    h1: "Build an AI agent<br><em>from scratch.</em>",
    blurb1:
      "Calling a model is easy. Getting a model to reliably do a twelve-step job in the real world — choosing tools, recovering from its own mistakes, remembering what it learned, and not deleting your files — is a systems problem. This course builds that system one piece at a time, in plain TypeScript, with nothing imported that you did not write.",
    blurb2:
      "Every chapter approaches one mechanism five ways: a diagram of the mechanism, an interactive simulator you can break, a runnable file, exercises with worked answers, and six questions that check you actually got it.",
    ctaStart: "Start with C00 →",
    ctaMap: "See the map",
    ctaProjects: "Projects &amp; capstones",
    cards: [
      {
        h: "Start with the loop, then pay for it.",
        p: "An agent calls a model, reads a decision, runs a tool, appends the result, and repeats. Four lines. Everything hard about agents is a consequence of that loop meeting a real environment.",
      },
      {
        h: "The context window is the whole world.",
        p: "The model knows nothing except what is in the request you just sent. Retrieval, memory, compaction and subagents are four answers to that single constraint.",
      },
      {
        h: "Read small code to read large code.",
        p: "Each chapter maps its 200-line version onto AutoGen, LangGraph, the OpenAI Agents SDK and the Claude Agent SDK, so production source arrives with context instead of vocabulary.",
      },
    ],
    whoKicker: "Who this is for",
    whoTitle: "Who gets the most out of this",
    whoLead:
      "Prerequisites: TypeScript or JavaScript, and having called an LLM API once. No machine learning background is needed — nothing here trains a model.",
    who: [
      {
        href: "/c04/",
        h: "You have used a framework and it felt like magic",
        p: "Build the loop yourself once and LangGraph's <code>StateGraph</code> or AutoGen's <code>RoutedAgent</code> stop being vocabulary. C04 is the whole idea in 120 lines. →",
      },
      {
        href: "/c12/",
        h: "Your agent works in the demo and not on Tuesday",
        p: "The failure taxonomy, retries, loop detection and budget enforcement — the four things that separate a demo from a system people depend on. →",
      },
      {
        href: "/c21/",
        h: "You have to sign off on shipping one",
        p: "Prompt injection, the lethal trifecta, least privilege, egress control and the human-approval design that actually holds. →",
      },
      {
        href: "/c18/",
        h: "You learn by breaking things",
        p: "Twenty-five simulators that run the mechanism they draw. Starve the context budget and watch the agent forget its goal; break a tool and watch the retry policy decide. →",
      },
    ],
    currKicker: "The curriculum",
    currTitle: "Seven layers, twenty-five chapters, two capstones",
    currLead:
      "Each layer exists because the previous one created a problem. Read in order the first time: the sequence is what turns a list of techniques into a design you could defend.",
    everyKicker: "In every chapter",
    everyTitle: "The same five things, twenty-five times",
    every: [
      {
        h: "A mechanism diagram",
        p: "Follow one request through the system and see exactly where tokens, latency, money and trust enter the path.",
      },
      {
        h: "A simulator you can break",
        p: "Not an animation of the idea — an implementation of it. Overflow the context window, corrupt a tool result, set the temperature to zero, watch what the loop does.",
      },
      {
        h: "A file you can run",
        p: "Self-contained TypeScript, run with <code>node --experimental-strip-types</code>. A deterministic mock model ships with the course, so every chapter runs offline with no key and no spend.",
      },
      {
        h: "Exercises, answers, and six questions",
        p: "Three to four exercises per chapter with full worked answers, a Q&amp;A of what people actually get stuck on, a build-it project, and a graded quiz.",
      },
    ],
    beginTitle: "Begin where every agent begins.",
    beginLead:
      "C00 is one uncomfortable question — is the thing you are building actually an agent, and should it be? — and one dial that answers it. The other twenty-four chapters follow from that dial.",
    beginCta: "C00 · What an agent actually is →",
  },

  zh: {
    eyebrow: "{chapters} 章 · 约 {lines} 行 {lang} 代码 · 无框架，开始时也不需要 API key",
    h1: "从零开始<br><em>写一个 AI 智能体。</em>",
    blurb1:
      "调用一次模型很容易。难的是让模型在真实环境里可靠地完成一件十二步的任务：自己挑工具、从自己的错误里爬出来、记住学到的东西，还不能把你的文件删了。这是一个系统工程问题。这门课用纯 TypeScript 一块一块地把这个系统搭起来，不引入任何你没有亲手写过的东西。",
    blurb2:
      "每一章都从五个角度讲透一个机制：一张机制图、一个你可以随便玩坏的交互式模拟器、一个能直接运行的文件、带完整解答的练习，以及六道检验你是否真的学会了的自测题。",
    ctaStart: "从 C00 开始 →",
    ctaMap: "看课程地图",
    ctaProjects: "项目与实战",
    cards: [
      {
        h: "先写出循环，再为它买单。",
        p: "智能体调用模型、读出一个决策、执行一个工具、把结果追加回去，然后重复。四行代码。智能体所有难的地方，都是这个循环撞上真实环境之后的连锁反应。",
      },
      {
        h: "上下文窗口就是它的整个世界。",
        p: "模型只知道你刚刚发过去的那个请求里有什么，除此之外一无所知。检索、记忆、压缩和子智能体，是对这同一个约束给出的四种回答。",
      },
      {
        h: "读小代码，是为了读得懂大代码。",
        p: "每一章都会把自己那两百行的实现对应到 AutoGen、LangGraph、OpenAI Agents SDK 和 Claude Agent SDK 上，于是你再去读生产级源码时，带的是理解而不是名词。",
      },
    ],
    whoKicker: "适合谁读",
    whoTitle: "什么样的人收获最大",
    whoLead:
      "前置条件：会 TypeScript 或 JavaScript，并且至少调用过一次大模型 API。不需要机器学习背景，这里没有任何一处要训练模型。",
    who: [
      {
        href: "/c04/",
        h: "你用过框架，但总觉得它像魔法",
        p: "自己动手把循环写一遍，LangGraph 的 <code>StateGraph</code> 和 AutoGen 的 <code>RoutedAgent</code> 就不再只是名词。C04 用 120 行讲完整个思路。→",
      },
      {
        href: "/c12/",
        h: "你的智能体在演示里好好的，一到周二就出事",
        p: "失败分类法、重试、循环检测和预算强制执行：把一个演示和一个别人真敢依赖的系统区分开的，就是这四件事。→",
      },
      {
        href: "/c21/",
        h: "你是那个要签字同意上线的人",
        p: "提示注入、致命三要素、最小权限、出口管控，以及真正站得住脚的人工审批设计。→",
      },
      {
        href: "/c18/",
        h: "你习惯把东西拆坏了来学",
        p: "二十五个模拟器，跑的就是它们画的那个机制。把上下文预算压干，看智能体怎么忘掉自己的目标；把一个工具弄坏，看重试策略怎么决定。→",
      },
    ],
    currKicker: "课程结构",
    currTitle: "七个层次，二十五章，两个实战项目",
    currLead:
      "每一层的存在，都是因为上一层制造了一个新问题。第一次读请按顺序来：正是这个顺序，把一堆零散的技巧变成一套你能为之辩护的设计。",
    everyKicker: "每一章都有",
    everyTitle: "同样的五件事，重复二十五次",
    every: [
      {
        h: "一张机制图",
        p: "跟着一个请求走完整个系统，看清 token、延迟、金钱和信任究竟在哪几个点上进入这条路径。",
      },
      {
        h: "一个能玩坏的模拟器",
        p: "它不是这个想法的动画演示，而是这个想法的实现。把上下文窗口撑爆、把工具结果弄脏、把温度调到零，然后看循环会怎么反应。",
      },
      {
        h: "一个能直接跑的文件",
        p: "自包含的 TypeScript，用 <code>node --experimental-strip-types</code> 运行。课程自带一个确定性的模拟模型，所以每一章都能离线运行，不需要 key，也不花钱。",
      },
      {
        h: "练习、答案，还有六道题",
        p: "每章三到四个练习并附完整解答，一份汇集了大家真正卡住的地方的问答，一个动手项目，以及一套会打分的自测题。",
      },
    ],
    beginTitle: "从每个智能体都要面对的那个起点开始。",
    beginLead:
      "C00 只有一个让人不太舒服的问题：你正在做的这个东西，真的是智能体吗，它应该是吗？以及一个能回答这个问题的旋钮。剩下二十四章，全都是从这个旋钮推导出来的。",
    beginCta: "C00 · 智能体到底是什么 →",
  },
};

/* ------------------------------------------------------------------ */
/* Curriculum layer names. These come from `curriculum.ts`, which is    */
/* the English source of truth; this overrides them per locale.         */

export const LAYER_TEXT: Record<Locale, Record<string, { name: string; desc: string; bridge: string }>> = {
  en: {},
  zh: {
    machine: {
      name: "这东西的形状",
      desc: "一章序幕：智能体和聊天机器人、和工作流的分界线在哪里，以及那个决定你到底在做哪一种的旋钮。",
      bridge: "……于是你知道了智能体是什么。接下来把能跑的最小的那个写出来。所以：",
    },
    model: {
      name: "模型",
      desc: "一次模型调用、一个带类型的输出、一个工具，以及把它们串起来的那个循环。学完这一层，你手上会有一个约 120 行的、能用的智能体。",
      bridge: "……于是你有了一个能用、但转头就忘光一切的智能体。所以：",
    },
    context: {
      name: "上下文与记忆",
      desc: "上下文窗口就是智能体的整个世界，而它很小。给它做预算、往里检索、跨着它记事，还要能在它中途崩掉时活下来。",
      bridge: "……于是智能体有了过去。它还是没有计划。所以：",
    },
    reasoning: {
      name: "推理与控制",
      desc: "把任务拆开、检查做出来的活、决定模型到底该拿到多少自由度，以及处理每个智能体都会遇到的四类失败。",
      bridge: "……于是智能体在自己脑子里变得可靠了。现在让它去碰真实世界。所以：",
    },
    environment: {
      name: "环境",
      desc: "代码执行、文件与 shell、Model Context Protocol，以及那个必须为危险操作点头的人。",
      bridge: "……于是你有了一个能干的智能体。但生产环境需要不止一个，而且需要证据。所以：",
    },
    systems: {
      name: "系统与生产",
      desc: "多个智能体、它们底下那个事件驱动的运行时、度量、可观测性、智能体从设计上就会打破的安全模型，以及把这一切发出去的那个服务端。",
      bridge: "……于是这门课要教的东西就全在这儿了。现在把它组装两遍。所以：",
    },
    capstone: {
      name: "实战项目",
      desc: "两个完整的智能体，全部用这门课里的零件从头搭起来：一个深度研究智能体，和一个会改你文件的编码智能体。",
      bridge: "",
    },
  },
};

/** A layer as a given locale sees it. */
export function layerFor<T extends { id: string; name: string; desc: string; bridge: string }>(
  loc: Locale,
  l: T
): T {
  const tr = LAYER_TEXT[loc]?.[l.id];
  return tr ? { ...l, ...tr } : l;
}
