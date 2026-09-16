import type { Chapter } from "../../../src/types.ts";
import { code, fig, note, table, p, ul, ol, ch } from "../../../src/ui.ts";
import en, { LADDER_SVG } from "../../chapters/c02.ts";

const explore = en.sections.find((s) => s.id === "explore")!;
const build = en.sections.find((s) => s.id === "build")!;

const chapter: Chapter = {
  ...en,
  title: "结构化输出",
  subtitle: "把散文变成一个你的代码能拿来分支的值",
  blurb:
    "智能体要靠模型的输出来分支，所以那个输出必须是一个带类型的值，而不是一段话。Schema、一个你自己写的校验器，以及把解析成功率从 94% 拉到 99.9% 的那把五级修复梯子。",

  sections: [
    {
      id: "motivation",
      kicker: "动机",
      title: "94% 是一场灾难",
      html:
        p(`你向模型要 JSON，它大约有 94% 的时候会给你 JSON。剩下 6%，它会给你一段裹在 markdown 代码块里的 JSON，或者前面加一句"好的！这是您要的数据："的 JSON，或者一个多了个尾逗号的 JSON，或者形状完全正确但写着 <code>"quantity": "two"</code> 的 JSON，又或者——最特别的那种——一个完美的对象，后面跟着一段兴高采烈的解释。`) +
        p(`在聊天应用里，94% 完全够用；人会自动绕过那点毛病。在智能体里，这个数字会复利。一个十步的任务，如果每一步的解析成功率是 94%，整体完成率是 <strong>0.94<sup>10</sup> = 54%</strong>。一半的运行死于一个标点符号，而且死得很<em>晚</em>——在八个昂贵的步骤成功之后。`) +
        p(`更好的提示词不是解法。"只输出合法 JSON，不要有任何其他文字"大概能把这个数推到 97%，也就是十步之后的 74%。真正管用的是结构上的办法：能让非法输出根本表示不出来的地方就让它表示不出来，做不到的地方就搭一把确定性的修复梯子。`) +
        note("key", "真正重要的那个数", p(`每一步的解析可靠性，会被你的步数当成指数抬上去。任何低于 99.9% 的数字，都是一个伪装起来的步数上限。照着 99.9% 去设计、去测量，并且把它的回退当成一次线上事故来处理。`)),
    },
    {
      id: "core-idea",
      kicker: "核心思想",
      title: "先约束，永远校验，最后才修",
      html:
        p(`三层，优先级从高到低。`) +
        `<h3>1 · 约束解码器，而不是说服模型</h3>` +
        p(`服务商可以强制输出匹配一个由你的 schema 推导出来的文法，把任何会让文本变非法的 token 全部屏蔽掉。如果 schema 说下一个 token 只能是 <code>"</code> 或者 <code>}</code>，那别的 token 就采样不出来。这不是劝说，这是算术——畸形的 JSON 变得<em>无法表示</em>。`) +
        p(`有两种拿到它的方式，而它们其实是同一个机制：`) +
        ul([
          `<strong>一个工具 schema。</strong> 定义一个工具，让它的输入 schema 就是你想要的形状，然后强制模型调用它。你既拿到了约束解码，又复用了 ${ch("c03", "C03")} 的那套机制。这是可移植性最好的选项，也是这门课采用的方式。`,
          `<strong>原生结构化输出模式</strong>（OpenAI 上是 <code>response_format: { type: "json_schema", json_schema: { name, schema, strict: true } }</code>，其他家有对应的写法）。当你要的是数据而不是一个动作时，这种写法更干净。`,
        ]) +
        note("warn", "约束解码保证形状，从不保证含义", p(`文法会强制 <code>{"severity": "high"}</code> 格式合法、枚举值合法。它不会阻止模型给一个无关紧要的小事故选 <code>high</code>。Schema 合法性和语义合法性是两个不同的问题；${ch("c10", "C10")} 讲的是第二个。`)) +
        `<h3>2 · 无论如何都在边界上校验</h3>` +
        p(`约束解码是一项服务商功能，而服务商功能也有不顺的日子。你可能回退到了一个不支持它的模型，或者某个代理把这个参数丢了，又或者某个 schema 深到文法编译器处理不了。不管怎样都要在边界上解析和校验，并且让这个校验器成为产出你 TypeScript 类型的那个东西。`) +
        code({
          title: "schema 就是类型，而不是类型的一份副本",
          src: `const Ticket = obj({
  severity: enumOf(["low", "medium", "high", "critical"]),
  component: str({ desc: "受影响的服务名，取自组件列表" }),
  steps: arr(str()),
  assignee: opt(str()),
});

type Ticket = Infer<typeof Ticket>;   // 唯一的事实来源

const schemaForApi = Ticket.json;      // 发给服务商的 JSON Schema
const result = Ticket.validate(raw);   // 你自己的校验，带路径信息`,
        }) +
        p(`把这个校验器写出来就是${ch("c02", "本章")}的项目。六十行代码能给你路径、强制转换钩子，以及好到可以直接丢回给模型的错误信息——而最后这一点才是全部的意义所在，也恰恰是通用校验库做得最差的地方。`) +
        `<h3>3 · 按固定顺序修复</h3>` +
        p(`校验失败时，先别急着花掉一次往返。大多数失败在本地修就是免费的。`),
    },
    {
      id: "mechanics",
      kicker: "机制",
      title: "修复梯子",
      html:
        fig({
          label: "图解",
          title: "五级台阶，最便宜的在前面",
          body: LADDER_SVG,
          caption: `第 0–2 级不花 token 也不花延迟。第 3 级是真正需要做设计的地方：你错误信息的质量，决定了这次重试能不能成功。第 4 级之所以存在，是因为一个已经在上下文里产出过坏对象的模型，倾向于把它再产一遍。`,
        }) +
        `<h3>第 3 级是最值得下功夫的那一级</h3>` +
        p(`把同一个失败之后的两种重新提示放在一起比。`) +
        code({
          title: "没用的 vs 有用的",
          lang: "text",
          plain: true,
          src: `✗  那不是合法的 JSON，请再试一次。

✓  你的输出有 2 处不符合 schema：
     .severity: 期望 "low" | "medium" | "high" | "critical"，实际得到 "pretty bad"
     .steps:    期望 string 数组，实际得到 string
   只修正这两个字段。其他每一个字段都原样保留。`,
        }) +
        p(`有三个性质让第二种奏效。它用路径<strong>定位</strong>了错误，它同时<strong>说出</strong>了期望值和实际值，而且它<strong>禁止了附带改动</strong>。去掉最后那一条，模型就会去重写那些本来已经正确的字段，然后交给你一个不一样的失败。`) +
        `<h3>值得做的强制转换，以及一个必须拒绝的</h3>` +
        table(
          ["模型给出", "Schema 想要", "转不转？"],
          [
            [`<code>"3"</code>`, "整数", "转 —— 没有歧义"],
            [`<code>"true"</code>`, "布尔", "转"],
            [`<code>{…}</code>`, "数组", "转 —— 包成单元素数组"],
            [`<code>"HIGH"</code>`, `枚举 <code>"high"</code>`, "转 —— 忽略大小写匹配枚举"],
            [`<code>"2024-13-45"</code>`, "日期", "<b>不转</b> —— 暴露出来；一个静默的 Invalid Date 比一次重试更糟"],
            [`<code>null</code>`, "必填字符串", "<b>不转</b> —— 模型是在告诉你它不知道"],
          ]
        ) +
        p(`规则是：可以转换表示形式，绝不转换含义。<code>"3"</code> 和 <code>3</code> 是同一个事实的两种写法。<code>null</code> 和 <code>""</code> 是两个不同的事实，把前者变成后者，会藏起你最需要的那个信号——模型缺少这条信息。那个信号应该送到 ${ch("c10", "C10")} 手上，而不是掉在地上。`) +
        `<h3>Schema 的设计，在任何修复跑起来之前就改变了失败率</h3>` +
        ul([
          `<strong>扁平胜过嵌套。</strong> 每多一层嵌套，畸形率都会有可测量的上升。三层就是一个坏味道。`,
          `<strong>枚举胜过自由字符串。</strong> <code>"severity": string</code> 会给你 <code>"挺严重的"</code>。枚举则让那个 token 在约束解码下根本采样不出来，就算没有约束解码，也只是一行错误信息的事。`,
          `<strong>每个字段都写描述。</strong> 描述是提示词的一部分，而且是你能买到的最便宜的准确度。<code>"eta: 距离解决还有多少整分钟，不确定就省略"</code> 能挡掉 <code>"大概一小时吧"</code>。`,
          `<strong>可选胜过可空。</strong> "不存在"只有一种表示法；"可空"有两种（<code>null</code>、字段缺失），而模型两种都会挑。`,
          `<strong>把推理放进一个字段里，而不是放在 JSON 前面。</strong> 一个开头的 <code>"reasoning": string</code> 字段给了模型在对象<em>内部</em>思考的空间，这既改善了决策，又把"JSON 前面带一段话"这个失败模式彻底消灭了。`,
        ]),
    },
    { ...explore, kicker: "动手试试", title: "自己把失败率复利一遍" },
    { ...build, kicker: "写出来", title: "一个值 60 行的校验器" },
    {
      id: "production",
      kicker: "生产实践",
      title: "真实系统里这是什么样子",
      html:
        ul([
          `<strong>Zod / Pydantic 加一个 JSON Schema 导出器</strong>是大多数团队的选择，这也是对的。只是要检查一下你的库导出了什么。深层嵌套的 <code>anyOf</code>、递归 <code>$ref</code>，以及正则 <code>pattern</code> 约束，在严格结构化输出模式下常常不被支持，而服务商要么拒收这个 schema，要么悄悄把那条约束丢掉。`,
          `<strong>Codex 和 Claude Code 的文件编辑工具</strong>是本章论点的极端案例：它们没有去要一段包着代码的结构化 JSON，而是定义了一个自定义的、面向行的信封（${ch("c14", "C14")} 会完整讲 <code>apply_patch</code>），原因恰恰是把一个多行文件塞进 JSON 字符串里转义，是一场可靠性灾难。当你的载荷是代码时，面向行的格式胜过 JSON 字符串。`,
          `<strong>Instructor、Outlines、llama.cpp grammars、XGrammar</strong> 都在不同的位置实现了第 0 级——库里、服务端，或者 kernel 里。读其中任何一个，都是最快认清"约束解码"不过是一个屏蔽 logits 的有限状态机的方式，而这件事比听上去要不神秘得多，也让人安心得多。`,
          `<strong>每次校验失败都把原始文本记下来。</strong> 当一个 schema 在生产环境开始出问题时，最有用的那份材料就是模型实际产出的那个字符串。只记录"校验失败"的团队要花好几天，而二十份原始输出的样本几分钟就能回答。`,
        ]) +
        note("good", "一个能自己回本的模式", p(`凡是支撑判断类决定的 schema，都在最前面加一个 <code>reasoning: string</code> 字段。它给了模型在对象内部思考的地方，它可测量地改善了决策，它消灭了最常见的那种畸形模式，而且它免费给你的日志留下了一段人能读懂的解释。用这个值之前把这个字段剥掉。`)),
    },
  ],

  exercises: [
    {
      difficulty: "warm-up",
      prompt: `你的智能体每一步的解析成功率是 97%。它在一个 20 步任务上的天花板是多少？要让 20 步任务中的 95% 能完成，每步需要多高的成功率？`,
      answer:
        p(`0.97<sup>20</sup> = <strong>54%</strong>。将近一半的长运行死于格式问题。`) +
        p(`要在 20 步上达到 95%，你需要 <code>0.95<sup>1/20</sup></code> = <strong>99.74%</strong>，也就是大约每 390 次失败一次。这个数字靠提示词是够不着的，靠约束解码加一级修复则绰绰有余。这个通式值得记住：<code>每步所需成功率 = 目标<sup>1/步数</sup></code>。`),
    },
    {
      difficulty: "core",
      prompt: `为一个负责提交 bug 报告的智能体写出三个最糟糕的 schema，并把每一个修好。假设模型必须产出 <code>{title, severity, component, stepsToReproduce, assignee}</code>。`,
      answer:
        table(
          ["糟糕写法", "为什么会坏", "修正"],
          [
            [`<code>severity: string</code>`, `你会收到 "挺严重的"、"P1"、"有点高"、"紧急！！"`, `<code>enumOf(["low","medium","high","critical"])</code> —— 错的写法根本采样不出来`],
            [`<code>component: string</code>`, `编造出一堆你的工单系统里根本不存在的组件`, `用实时组件列表生成枚举，在调用时注入 schema`],
            [`<code>stepsToReproduce: string</code>`, `有时是一段话，有时是编号列表，有时是一坨带字面 \\n 的 JSON 转义`, `<code>arr(str())</code> —— 一步一个元素，不存在转义歧义`],
            [`<code>assignee: string</code>`, `幻觉出来的人名`, `<code>opt(enumOf(teamMembers))</code> —— 可选，因为"我不知道"必须是可表示的`],
            [`嵌套的 <code>{meta:{source:{system:…}}}</code>`, `每多一层嵌套都会抬高畸形率`, `压平成 <code>metaSourceSystem</code>`],
          ]
        ) +
        p(`更上位的那条教训是：<em>用实时数据生成 schema</em>。一个在调用时用真实组件列表构造出来的枚举，会让幻觉出来的组件根本无法表示，这严格优于事后再去校验它们。`),
    },
    {
      difficulty: "core",
      prompt: `为第 1 级实现 <code>extractJson(text: string)</code>。它必须能处理：markdown 代码块、前后都有散文、以及一个内部字符串里本身就含有 <code>}</code> 的对象。说出它绝对不能做什么。`,
      answer:
        code({
          title: "括号配对，且能识别字符串",
          src: `export function extractJson(text: string): string | null {
  const start = text.indexOf("{");
  if (start === -1) return null;

  let depth = 0, inStr = false, esc = false;
  for (let i = start; i < text.length; i++) {
    const c = text[i];
    if (esc) { esc = false; continue; }
    if (c === "\\\\") { esc = true; continue; }
    if (c === '"') { inStr = !inStr; continue; }
    if (inStr) continue;                 // 字符串里的括号不算数
    if (c === "{") depth++;
    else if (c === "}" && --depth === 0) return text.slice(start, i + 1);
  }
  return null;                           // 没配平 —— 多半是被 max_tokens 截断了
}`,
        }) +
        p(`<strong>它绝对不能做的：</strong>用 <code>/\\{[\\s\\S]*\\}/</code> 这样的正则。它会贪婪地跨过好几个对象，会在字符串内部的括号上崩掉，而且它在大量生产代码里都存在。能识别字符串才是全部的难点，其余都只是记账。`) +
        p(`它也绝对不能默默返回<em>最后</em>那个看起来像 JSON 的东西。当模型先给了一个示例对象再给真正的那个时，取第一个配平匹配的错误频率，和取最后一个差不多——这正是第 0 级存在的原因，也是为什么这个函数是一条退路，而不是一套策略。`),
    },
    {
      difficulty: "stretch",
      prompt: `约束解码保证了枚举值合法。设计一个能抓出<em>合法但错误</em>的值的检查——比如一份打字错误报告被标成 <code>severity: "critical"</code>——而且不能简单地给每个请求都加一次模型调用。`,
      answer:
        p(`Schema 合法性和语义合法性是正交的，所以第二个需要它自己的机制。下面四种，成本递增：`) +
        ol([
          `<strong>写在代码里的廉价不变量。</strong> 那些不需要模型就能陈述的规则：<code>critical ⇒ affected.length > 0</code>、<code>critical ⇒ needsHuman === true</code>、<code>eta ≤ 1440</code>。它们能零成本抓出相当比例的胡话，而且每一条都是一个单元测试。`,
          `<strong>拿 reasoning 字段做跨字段一致性检查。</strong> 如果 schema 里有 <code>reasoning</code>，就检查一个 critical 级别的理由里有没有出现一小串词（宕机、数据丢失、安全）中的任何一个。粗糙、免费，而且能抓到模型先选标签再编理由的情况。`,
          `<strong>有条件地升级。</strong> 只在决定既高风险又低置信度时才花那次验证调用：在温度 0.3 下采样两次，只在两次不一致时才去验证。这会把开销集中在大约 5% 的模糊情形上，而不是向全部 100% 征税。这就是 ${ch("c10", "C10")} 的核心招数。`,
          `<strong>按阈值转人工。</strong> 不管怎样都把 <code>critical</code> 路由给人。对任何不可逆的事情这都是正确答案，而让 ${ch("c16", "C16")} 可以忍受的设计，就是把阈值选到队列不会堆积的地方。`,
        ]) +
        p(`要避免的是一刀切的"所有东西都用第二次模型调用验一遍"。它让成本和延迟翻倍，而且验证者和第一个模型共享盲区，所以它认同那个错误的次数，比它抓到那个错误的次数还多。`),
    },
  ],

  qa: [
    { q: "结构化输出该用 JSON 模式还是工具调用？", a: p(`当输出是智能体要执行的一个<em>动作</em>时，用工具调用——它和 C03 的分发统一在一起，同一条代码路径就能同时处理两者。当输出是给你的代码消费的<em>数据</em>时，用原生结构化输出模式。机制上它们是同一套约束解码，区别只在于哪种抽象让你的调用点读起来更顺。`) },
    { q: "要求输出 JSON 会不会让模型变笨？", a: p(`会，而且机制很具体。约束解码拿走了模型在给出答案之前用散文思考的余地。正确的做法是把思考放进结构里面，而不是放弃结构：一个开头的 <code>reasoning</code> 字符串字段，或者先来一轮不受约束的输出、再来一轮受约束的抽取。两轮的版本多花一次往返，而在困难判断上它稳定地优于另外两种做法。`) },
    { q: "用 YAML 或 XML 代替 JSON 怎么样？", a: p(`当内容很长、多行、或者充满引号和反斜杠时，XML 标签确实更容易被模型产出——这也是好几个编码智能体选择标签分隔或面向行的格式、而不是 JSON 字符串的原因（见 ${ch("c14", "C14")} 里的 <code>apply_patch</code>）。YAML 是个陷阱：有意义的空白加上模型的缩进习惯，是一个比 JSON 更糟的失败面，而且它的类型强制规则会把你的 <code>NO</code> 枚举变成 <code>false</code>。`) },
    { q: "放弃之前该修几次？", a: p(`两次，然后停。实测的恢复率大约是第一次重新提示 90%、第二次 40%，之后接近于零。一个已经失败两次的模型是卡在一个盆地里了，再试下去买到的基本只有延迟。如果你真需要第三次，那第三次应该是一次<em>冷</em>重试：把被污染的历史丢掉重来；如果那还不行，那是 schema 错了，不是模型错了。`) },
    { q: "我的 schema 里有联合类型，服务商拒收了。现在怎么办？", a: p(`把它压平成一个带判别标签的对象：一个必填的 <code>kind</code> 枚举，加上各个变体的可选字段，解析之后在代码里校验。你在 schema 边界上失去了编译期的穷尽性检查，然后立刻在自己的校验器里把它拿了回来。这是严格模式下最常见的一种拒收，值得在你设计一个很深的联合类型之前就知道。`) },
  ],

  project: {
    title: "项目 · 一个错误信息本身就是提示词的校验器",
    brief:
      p(`把这门课其余部分要用的那个 schema 库写出来：<code>str</code>、<code>int</code>、<code>num</code>、<code>bool</code>、<code>enumOf</code>、<code>arr</code>、<code>obj</code>、<code>opt</code>。一次声明产出两样东西——一份给服务商的 JSON Schema，以及一个错误信息好到可以直接丢回给模型的校验器。`),
    spec: [
      "一次声明同时产出 <code>.json</code>（给 API 的 JSON Schema）和 <code>.validate()</code>，这样它们不可能漂移。",
      "<code>Infer&lt;typeof S&gt;</code> 给出 TypeScript 类型——任何地方都不许有手写的重复 interface。",
      "校验要收集<em>全部</em>问题并带上点号路径，绝不在第一个问题处短路。",
      "只做表示形式的强制转换：<code>\"3\"→3</code>、<code>\"true\"→true</code>、对象→单元素数组、忽略大小写的枚举。必填字段上的 <code>null</code> 仍然是错误。",
      "<code>renderIssues()</code> 产出重新提示的文本，包含那句'其他每一个字段都原样保留'。",
      "<code>structured(model, messages, schema)</code> 实现完整的梯子，返回一个带类型的值或者抛异常。",
    ],
    stretch: [
      "加上 <code>refine(fn, message)</code> 处理语义不变量，让 <code>critical ⇒ needsHuman</code> 住在 schema 里，并产出同样形状的问题描述。",
      "在调用时用实时数据构建 schema 的枚举（一个组件列表、一组用户名），并证明幻觉出来的值变成了无法表示，而不仅仅是非法。",
      "照着本章的运行输出写一套测试台：1,000 份模拟输出，植入那七种真实的失败模式，报告每一级台阶上的成功率。你现在有了一套解析层的回归测试。",
    ],
  },

  quiz: [
    {
      q: "一个智能体每一步正确解析模型输出的概率是 97%。20 步的任务里，有多大比例能在不发生解析失败的情况下完成？",
      options: ["大约 54%", "大约 97%", "大约 85%", "大约 40%"],
      answer: 0,
      why: "0.97^20 ≈ 0.54。每步的可靠性会被步数当成指数抬上去，这就是为什么任何低于 ~99.9% 的数字，都是你的智能体能完成多长任务的硬上限。要让 20 步运行中的 95% 成功，你需要每步 99.74%。",
    },
    {
      q: "约束解码实际保证了什么？",
      options: [
        "输出符合 schema 的形状和枚举——它对这些值对不对只字未提",
        "输出既格式良好又语义恰当",
        "模型会更仔细地推理答案",
        "所有失败模式都不再需要重试",
      ],
      answer: 0,
      why: "解码器屏蔽掉了会违反文法的 token，于是非法形状变得无法表示。给一份打字错误报告选 `severity: \"critical\"` 在文法下完全合法。Schema 合法性和语义合法性需要各自独立的机制。",
    },
    {
      q: "校验器应该拒绝执行哪一种强制转换？",
      options: [
        "必填字符串字段上的 `null` → `\"\"`",
        "整数字段上的 `\"3\"` → `3`",
        "布尔字段上的 `\"TRUE\"` → `true`",
        "数组字段上的 `{…}` → `[{…}]`",
      ],
      answer: 0,
      why: "转换表示形式，绝不转换含义。`\"3\"` 和 `3` 是同一个事实的两种写法。`null` 是模型在告诉你它不知道——把它变成空字符串，恰好摧毁了那个本该触发升级或追问的信号。",
    },
    {
      q: "为什么校验器应该收集全部问题，而不是返回第一个？",
      options: [
        "这样一次重新提示就能把所有问题一起修好，而不是花好几次往返慢慢收敛",
        "它产生的错误信息更短",
        "JSON Schema 要求这样做",
        "它避免了异常",
      ],
      answer: 0,
      why: "短路意味着模型修好问题 1，你才发现问题 2，然后如此下去——本来一次往返能解决的事变成了四次。这在 `obj` 里是两行代码的差别，在修复成本上大约是 3 倍的差别。",
    },
    {
      q: "校验失败之后，哪一种重新提示的恢复效果最好？",
      options: [
        "给出精确的字段路径、期望值和实际值，再加上一句不要改动其他任何东西",
        "'那不是合法的 JSON，请再试一次'",
        "把完整的 JSON Schema 再贴一遍",
        "用更高的温度重发同一个请求",
      ],
      answer: 0,
      why: "定位准确、内容具体、可以直接照做——恢复率大约 90%，而通用重试大约 40%。那句'其他每一个字段都原样保留'和路径一样重要：没有它，模型会重写正确的字段，然后产生一个不一样的失败。",
    },
    {
      q: "什么时候在 schema 里放一个开头的 `reasoning: string` 字段是个好主意？",
      options: [
        "做判断类决定时——它在对象内部给了模型思考空间，改善了决策，也消灭了 JSON 前带散文的问题",
        "永远不要；它浪费输出 token",
        "只在模型不支持约束解码时",
        "只在输出是给人读的时候",
      ],
      answer: 0,
      why: "约束解码拿走了模型在给出答案之前出声思考的余地，而这在困难判断上有可测量的损害。把推理放进对象内部既恢复了它，又干掉了最常见的畸形模式，还免费在你的日志里留下一段解释。用这个值之前把这个字段剥掉。",
    },
  ],

  continues:
    p(`现在你能可靠地从模型那里拿到一个带类型的值了。而一个指明了某个<em>动作</em>的带类型的值——<code>{tool: "search", args: {...}}</code>——离一个能改变世界的智能体，只差一张分发表。${ch("c03", "C03")} 讲的是模型的意图和你的函数之间的那层接口，以及为什么那个描述字符串比代码还重要。`),
};

export default chapter;
