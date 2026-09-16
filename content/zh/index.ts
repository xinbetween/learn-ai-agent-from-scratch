/** Chinese translations.
 *
 *  Partial by design: anything absent here falls back to the English body
 *  with a banner, so /zh/ is always a complete, navigable site. Add a file
 *  to `content/zh/chapters/` and register it below to translate a chapter. */
import type { Chapter, Page } from "../../src/types.ts";

import c00 from "./chapters/c00.ts";
import c01 from "./chapters/c01.ts";
import c02 from "./chapters/c02.ts";
import c03 from "./chapters/c03.ts";
import c04 from "./chapters/c04.ts";

/** Translated chapters, keyed by chapter id. */
export const zhChapters: Record<string, Chapter> = { c00, c01, c02, c03, c04 };

/** Translated page overrides, keyed by slug. Pages are generated from the
 *  chapter set, so a translation only needs to restate the chrome strings
 *  the generator cannot derive. */
export const zhPageMeta: Record<string, { title: string; subtitle: string; kicker: string }> = {
  map: { title: "课程地图", kicker: "地图", subtitle: "二十五章如何串成一条线" },
  setup: { title: "本地环境", kicker: "开始之前", subtitle: "Node 22.6+，没有别的依赖" },
  glossary: { title: "术语表", kicker: "参考", subtitle: "全课程用到的术语，按字母排序" },
  projects: { title: "项目", kicker: "动手", subtitle: "每章一个小项目，外加两个实战" },
  qa: { title: "问答", kicker: "参考", subtitle: "各章问答汇总" },
  answers: { title: "习题答案", kicker: "参考", subtitle: "全部练习的完整解答" },
  compare: { title: "框架对比", kicker: "参考", subtitle: "每个框架各占哪一层" },
  timeline: { title: "时间线", kicker: "参考", subtitle: "这些想法出现的顺序" },
  references: { title: "参考资料", kicker: "参考", subtitle: "值得一读的原始资料" },
};

/** Slugs whose *body* has been translated. Others show the fallback banner.
 *  Pages generated from chapter data (map, qa, answers, projects) already show
 *  Chinese for the translated chapters; the banner says the rest is English. */
export const zhTranslatedPages = new Set<string>();
