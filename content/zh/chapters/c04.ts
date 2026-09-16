import type { Chapter } from "../../../src/types.ts";
import { code, fig, note, table, p, ul, ch } from "../../../src/ui.ts";
import en, { LOOP_SVG } from "../../chapters/c04.ts";

const explore = en.sections.find((s) => s.id === "explore")!;
const build = en.sections.find((s) => s.id === "build")!;
const production = en.sections.find((s) => s.id === "production")!;

const chapter: Chapter = {
  ...en,
  title: "智能体循环",
  subtitle: "推理、行动、观察——以及让它活下来的那四道防线",
  blurb:
    "其他一切都挂在这一章上。大约 120 行写出一个完整可用的智能体：ReAct 循环、停止条件、预算强制、循环检测，以及为什么消息数组是唯一存在的状态。",

  sections: [
    {
      id: "motivation",
      kicker: "动机",
      title: "把前面所有东西接起来",
      html:
        p(`${ch("c01", "C01")} 给了你一个带类型的模型调用。${ch("c02", "C02")} 让它的输出变成一个你能拿来分支的值。${ch("c03", "C03")} 给了你一组模型可以请求、而且永远不会抛出任何东西的函数。这一章花大约四十行把它们接起来，结果是一个真的能干活的智能体。它会订上那个会、找出那个 bug、回答那个层层套着的问题。`) +
        p(`然后这一章剩下的篇幅，都花在那八十行让它能活下来的代码上——而这正是教程里没人会写的部分：什么让它停下来、当它不肯停下来时怎么办，以及预算在任务做到一半时耗尽了，你该交给用户什么。`) +
        note("key", "把这个文件一路带下去", p(`从这里开始，每一章都是在修改这个循环，而不是替换它。C05 改变进入 <code>messages</code> 的东西。C09 给它加一个计划。C12 加固这些防线。C17 把这个循环本身变成一个工具。如果这门课你只动手写一个文件，就写这一个。`)),
    },
    {
      id: "core-idea",
      kicker: "核心思想",
      title: "推理、行动、观察",
      html:
        p(`ReAct（<em>reasoning and acting</em>，出自 Yao 等人 2022）说的是这样一个观察：把推理和行动交错起来，比单独做其中任何一个都好。一个只推理不行动的模型会把事实幻觉出来；一个只行动不推理的模型会乱扑腾。让两者交替，意味着每一个想法都被上一条观察锚住，而每一个动作都由上一个想法挑出来。`) +
        p(`原始论文是让模型把 <code>Thought: … Action: … Observation: …</code> 当成字面文本输出，再由你去解析。原生工具调用取代了那层解析，但它的<em>形状</em>没变，而且值得平铺直叙地看一遍：`) +
        code({
          title: "把 ReAct 写成字面的样子",
          lang: "text",
          plain: true,
          src: `目标：4471 号订单能退款吗？

想法 1     我需要这个订单，还需要退款政策。先拿订单。
行动 1     lookup_order(id="4471")
观察 1     {status:"delivered", delivered:"2024-01-28", category:"electronics"}

想法 2     已送达。电子产品的退货窗口有特殊规定，我得查一下。
行动 2     search_policy(q="electronics return window")
观察 2     "电子产品：自送达起 14 天内，除非商品有质量问题。"

想法 3     送达至今已经 31 天了。超出 14 天窗口——除非它有质量问题，
           而这一点我还没核实过。
行动 3     get_order_notes(id="4471")
观察 3     {notes: []}

想法 4     没有质量问题记录。窗口已过。我可以回答了。
回答       "2024 年 1 月 28 日送达；14 天的电子产品窗口已经过了。"`,
        }) +
        p(`把想法 3 再读一遍。智能体注意到了<em>它自己证据里的一个缺口</em>——"除非它有质量问题，而这一点我还没核实过"——然后花了一步去把它补上。你的代码里没有任何一个分支产生了这个行为。它来自模型在同一时刻同时持有政策文本和订单数据，而这就是这个循环全部的价值主张。`) +
        `<h3>循环</h3>` +
        code({
          title: "code/c04_agent_loop.ts — 核心",
          src: `export async function run(goal: string, cfg: Config): Promise<Outcome> {
  const messages: Message[] = [{ role: "user", content: goal }];
  const budget = new Budget(cfg.limits);

  while (true) {
    // 防线 1：预算在花钱之前检查，不是之后。
    const stop = budget.check();
    if (stop) return partial(stop, messages, budget);

    const res = await cfg.model(messages, {
      system: cfg.system,
      tools: cfg.registry.schemas(),
      signal: budget.signal,
    });
    budget.record(res.usage);
    messages.push({ role: "assistant", content: res.content });

    // 防线 2：截断的响应不是答案。
    if (res.stopReason === "max_tokens") return partial("truncated", messages, budget);

    const calls = toolCalls(res);
    if (calls.length === 0) return { ok: true, text: textOf(res), messages, budget };

    // 防线 3：重复的 (tool, args) 说明它卡住了 —— 告诉它。
    const repeat = detector.observe(calls);
    if (repeat) messages.push(systemNote(repeat));

    // 防线 4：工具永不抛异常；每一次失败都是一条观察。
    const results = await cfg.registry.executeAll(calls);
    messages.push({ role: "user", content: results });
  }
}`,
        }) +
        p(`就是它了。其他的一切都是这四道防线的细化。`),
    },
    {
      id: "mechanics",
      kicker: "机制",
      title: "停止条件和预算",
      html:
        fig({
          label: "图解",
          title: "一次迭代，以及能中止它的每一种方式",
          body: LOOP_SVG,
          caption: `每一条出口都会返回一份<em>部分报告</em>，而不是一个异常。一个耗尽预算的智能体仍然知道一些东西，而那些东西属于用户。`,
        }) +
        `<h3>五种终止状态，各自意味着不同的事</h3>` +
        table(
          ["终止状态", "含义", "要交回去什么"],
          [
            ["<b>answered</b>", "模型发出了 end_turn", "答案"],
            ["<b>budget</b>", "步数、token 或墙钟时间用完了", "已确立的事实，加上下一步"],
            ["<b>blocked</b>", "它需要一个它拿不到的东西", "具体缺的是什么，以及谁能给"],
            ["<b>cancelled</b>", "用户中止了", "已完成的工作，以及任何已经落地的副作用"],
            ["<b>error</b>", "不可恢复——鉴权、重试之后的网络故障、取消", "那个错误，加上此前已经确立的一切"],
          ]
        ) +
        p(`把这五种区分开，不是记账上的洁癖。生产环境里"answered"往"budget"漂移，意味着任务变难了；往"blocked"漂移，通常意味着某个凭证过期了。这两件事的处理方式完全不同，而一个笼统的"失败"计数器会把它们混成一团。`) +
        `<h3>循环检测：三种形状</h3>` +
        p(`预算能挡住失控，但挡不住浪费。在预算耗尽之前，一个智能体可以有三种不同的卡住方式：`) +
        ul([
          `<strong>完全重复</strong> —— 同一个工具、同样的参数、同样的结果。对 <code>(name, args)</code> 做哈希，连续命中两次就触发。`,
          `<strong>来回震荡</strong> —— A、B、A、B、A。保留最近 N 次调用的窗口，检测周期。`,
          `<strong>语义漂移</strong> —— 参数每次都不一样，但毫无进展：<code>search("refund policy")</code>、<code>search("return policy")</code>、<code>search("refund rules")</code>。这个要靠结果的相似度来抓，不是靠参数。`,
        ]) +
        p(`三种的干预方式是同一个：把这个行为当成一条观察描述回给模型。一旦循环被描述出来，模型很擅长自己跳出去；而在没人提醒时，它又非常不擅长注意到，因为从上下文内部看，每一次重复都像是一个崭新的合理主意。`) +
        note("warn", "预算属于任务，不属于调用", p(`三种上限，全都在运行这一层：步数、总 token、墙钟时间。它们共享一个 <code>AbortController</code>，所以时限一到，正在飞的那次模型调用会被真的取消，而不是等它自己回来。还要给最后那份报告留出余量——一个把 token 精确烧到零的智能体，连告诉你它学到了什么的预算都没有了。明确地留出这份余量，并且记得清掉定时器，否则你的 Node 进程不会退出。`)),
    },
    { ...explore, kicker: "动手试试", title: "让它卡住，然后把它解开" },
    { ...build, kicker: "写出来", title: "完整的循环" },
    { ...production, kicker: "生产实践", title: "真实系统里的这个循环" },
  ],

  exercises: [
    {
      difficulty: "warm-up",
      prompt: `循环在模型调用<em>之前</em>检查 <code>budget.exceeded()</code>。把它挪到模型调用之后。说出两件会因此坏掉的事。`,
      answer:
        ul([
          `<strong>你为那次本想避免的调用付了钱。</strong> 在一次死于步数上限的运行里，最后那次调用是纯粹的浪费，而在 40k token 的上下文上，那是整次运行里最贵的一次调用。`,
          `<strong>墙钟时限变得无法强制执行。</strong> 一次模型调用可能要 60 秒；放在之后检查，意味着一个 30 秒的时限迟到 90 秒才生效。这个检查必须发生在你承诺执行一个时长无界的操作<em>之前</em>。`,
        ]) +
        p(`还有第三个更隐蔽的：检查放在后面，循环的退出条件就依赖于你刚做完那次调用所改动的状态，于是终止性这件事更难陈述，也更难测试。放在最顶端的防线读起来就是一个前置条件——它们本来就是。`),
    },
    {
      difficulty: "core",
      prompt: `实现"语义漂移"检测器：参数每次不同，但没有新信息。把"没有新信息"定义得足够精确，好让它不用向量模型也能实现。`,
      answer:
        code({
          title: "用观察重叠度衡量新颖性",
          src: `export class DriftDetector {
  private shingles: Array<Set<string>> = [];

  /** 当最近 3 条观察什么新东西都没带来时返回 true。 */
  observe(text: string): boolean {
    const s = shingle(normalise(text), 4);      // 4 词一组的 shingle
    const novelty = this.shingles.length === 0 ? 1 : 1 - maxJaccard(s, this.shingles);
    this.shingles.push(s);
    if (this.shingles.length > 10) this.shingles.shift();

    this.recentNovelty.push(novelty);
    if (this.recentNovelty.length > 3) this.recentNovelty.shift();
    return this.recentNovelty.length === 3 && this.recentNovelty.every((n) => n < 0.15);
  }
}

const normalise = (t: string) => t.toLowerCase().replace(/[^a-z0-9 ]+/g, " ").replace(/\\s+/g, " ").trim();
const shingle = (t: string, k: number) => {
  const w = t.split(" "); const out = new Set<string>();
  for (let i = 0; i + k <= w.length; i++) out.add(w.slice(i, i + k).join(" "));
  return out;
};
const jaccard = (a: Set<string>, b: Set<string>) => {
  let inter = 0; for (const x of a) if (b.has(x)) inter++;
  return inter / (a.size + b.size - inter || 1);
};`,
        }) +
        p(`<strong>定义：</strong>一条观察是<em>新颖的</em>，当且仅当它对最近十条观察的最大 Jaccard 相似度（基于 4 词 shingle）低于 0.85。连续三条不新颖的观察，意味着智能体是在换着说法而不是在推进。`) +
        p(`阈值需要按领域调。代码搜索会合理地返回几乎相同的文件头，所以在那里 0.85 太激进了。干预方式和处理重复时一样：把这个行为描述回给模型，并加上一句"如果这条信息不存在，就直说"，因为漂移最常见的成因，是一个不肯报告"没有"的智能体。`),
    },
    {
      difficulty: "core",
      prompt: `你的智能体必须支持从界面上中途取消，而且取消必须产出一份部分报告，而不是什么都没有。画出控制流，包括一次已经在飞的工具调用会怎么样。`,
      answer:
        code({
          title: "两个信号：取消工作，保住报告",
          src: `export class Budget {
  private readonly work = new AbortController();   // 取消模型调用和工具
  private cancelled = false;

  cancel(): void { this.cancelled = true; this.work.abort(); }
  get signal(): AbortSignal { return this.work.signal; }
  exceeded(): StopCause | null { return this.cancelled ? "cancelled" : /* … */ null; }
}

// 在循环里：
try {
  const res = await cfg.model(messages, { signal: budget.signal, /* … */ });
} catch (e) {
  if (budget.signal.aborted) {
    // 用一个全新的信号来生成报告 —— 工作信号已经作废了。
    return degrade("cancelled", messages, { ...cfg, model: cfg.freshModel });
  }
  throw e;
}`,
        }) +
        ul([
          `<strong>报告不能用那个已经中止的信号。</strong> 事后看很显然，而这正是每个人都会上线一次的 bug：<code>degrade()</code> 继承了那个已取消的 controller，于是瞬间中止，用户等了半天什么也没拿到。`,
          `<strong>一次正在飞的工具调用才是难的地方。</strong> 只读工具：中止并丢弃。写工具：你没法把一封邮件收回来。即使在取消的过程中也要等这次写完成，把结果记下来，并放进报告里。"我取消了，但发给 Alice 的邮件已经出去了"是唯一诚实的输出。`,
          `<strong>取消是一种终止状态，不是一个错误。</strong> 在 ${ch("c20", "C20")} 里单独记录它；取消数量的尖峰意味着你的智能体太慢，或者明显在往错的方向走，而这和错误数量的尖峰是两个不同的问题。`,
        ]),
    },
    {
      difficulty: "stretch",
      prompt: `给这个循环加上流式，让用户在每一步的 500ms 内看到进展，同时不改变循环的结构和它的类型。说出你在每个阶段流什么，以及你刻意不流什么。`,
      answer:
        code({
          title: "一条在循环旁边的事件通道，而不是在循环里面",
          src: `export type AgentEvent =
  | { type: "thinking"; textDelta: string }
  | { type: "tool_start"; name: string; summary: string }   // "正在搜索 4471 号订单"
  | { type: "tool_end"; name: string; ms: number; ok: boolean }
  | { type: "answer"; textDelta: string }
  | { type: "done"; result: AgentResult };

export async function* runAgentStream(goal: string, cfg: AgentConfig): AsyncGenerator<AgentEvent> {
  const q = new EventQueue<AgentEvent>();
  const done = runAgent(goal, { ...cfg, emit: q.push })     // 循环不变，只多一个回调
    .then((r) => q.push({ type: "done", result: r }))
    .finally(() => q.close());
  yield* q;
  await done;
}`,
        }) +
        p(`<strong>要流的：</strong>最终答案的文本增量（感知延迟就住在这里），以及每次工具调用开始时的一行<em>人类可读摘要</em>——"正在读取 src/agent.ts"、"正在政策库里搜索退款窗口"。用户是通过动作来追踪智能体进度的。`) +
        p(`<strong>不要流的：</strong>原始工具参数（噪音大，而且有泄露风险：文件路径、查询串、内部 ID）、原始工具结果（一坨 4,000 token 的东西不叫进展），以及默认情况下的中间推理。中间推理值得放在一个"显示详情"开关后面：它是你能给用户的最好的调试抓手，同时也是最糟的默认值，因为它会让一个胸有成竹的智能体看起来像在乱扑腾。`) +
        p(`结构上的关键是那个 <code>emit</code> 回调：循环多了一个可选参数，没有多任何分支。流式仍然只是一件传输层的事，和 ${ch("c01", "C01")} 里一模一样。`),
    },
  ],

  qa: [
    { q: "工具调用已经原生支持了，我还需要 'Thought:' 这种提示法吗？", a: p(`不需要把它当成一种解析格式。但在困难的多步任务上，要求模型在行动前先说出它的推理仍然有帮助，而在原生工具调用下，你可以通过允许一个文本块和 tool_use 块并存来拿到它，或者给工具输入加一个 <code>reasoning</code> 字段。扩展思考模式把这件事做得更明确，现在通常是更好的那根杠杆。`) },
    { q: "最大步数该设多少比较合理？", a: p(`从 10 开始，然后埋点。有用的那个数字来自你自己的数据：那些<em>成功</em>的运行所用步数的第 95 百分位，再加一点余量。如果成功运行在 p95 上是 4 步，那把上限设成 20 只意味着失败在被你发现之前要多花 5 倍的钱。从成功数据推出这个上限，是 ${ch("c20", "C20")} 里回报最高的事情之一。`) },
    { q: "该让智能体看到自己的步数吗？", a: p(`该，但要晚一点。从一开始就注入"你还剩 10 步里的 2 步"会让模型赶工、跳过验证。只在剩余不到大约 30% 时才注入，会产生确实更好的行为，因为模型会开始收敛和排优先级。把它当成一个截止提醒，而不是一个预算显示器。`) },
    { q: "既然温度 0 其实并不确定，那为什么还要用它？", a: p(`为了一致性，不是为了可复现。在温度 0 下，同样的上下文通常会产生同样的工具选择，所以当你重跑一个失败用例时，你调试的是自己的代码，而不是另一个采样。你仍然会因为批处理和路由效应偶尔看到分歧（${ch("c01", "C01")}），而这恰恰是为什么 ${ch("c19", "C19")} 的评测是在多次运行上给行为打分，而不是去 diff 某一次。`) },
    { q: "我的智能体停得太早，活没干完就说自己做完了。这是循环的 bug 吗？", a: p(`不是，这是一个验证问题，而且它是"停不下来"的镜像。循环是按模型给的信号正确终止的；错的是那个信号。修复属于 ${ch("c10", "C10")}：系统提示词里一份明确的完成清单、一个模型在回答前必须调用的验证工具，或者对答案做一遍批评。不要试图靠调高步数预算来修它。`) },
  ],

  project: {
    title: "项目 · 你的智能体",
    brief:
      p(`把 C01–C04 组装成一个能用的智能体，跑在一个你能手工验证的小领域上——一个假的订单系统、你自己的只读文件系统，或者一份 wiki 导出。这就是这门课其余部分要不断修改的那个产物，所以在构造 <code>messages</code> 的地方留一条干净的接缝：C05 会把它替换掉。`),
    spec: [
      "<code>runAgent(goal, config)</code> 返回一个带类型的结果，包含终止状态、完整的消息数组、用量和步数。",
      "四道防线全都要有：预算（步数、token、墙钟）、截断处理、重复/震荡检测，以及未知工具的恢复。",
      "<code>degrade()</code> 产出一份部分报告，说明已经确立了什么、有什么还在飞，以及下一步具体该做什么。",
      "一份 trace 日志：每一步一行，含角色、工具、参数、延迟和累计 token。人能读，也能 grep。",
      "五个测试场景——顺利路径、工具名拼错、完全重复、来回震荡、预算耗尽——每一个都断言预期的终止状态。",
      "全程离线运行，用的是 C01 里那个 mock 模型。",
    ],
    stretch: [
      "加上 <code>AgentEvent</code> 事件流，以及一个把工具活动实时渲染出来的小终端界面。",
      "加上带部分报告的取消功能，包括正确处理一次正在飞的写工具调用。",
      "让步数上限变成自适应的：从 6 开始，每当最近两步产生了新颖的观察就延长 4 步（有一个硬上限）。在你那五个场景上，把它和固定上限 14 的成本与成功率做对比。",
    ],
  },

  quiz: [
    {
      q: "为什么预算检查要放在循环体的最顶端？",
      options: [
        "因为只有在模型调用之前检查，才真正省下了那次调用的钱",
        "因为放在别处 TypeScript 通不过编译",
        "因为模型需要先看到预算",
        "因为这样重试才能被正确计数",
      ],
      answer: 0,
      why: "在之后检查，等于为你本想避免的那次调用付了钱，而在一个 40k token 的上下文上，那是整次运行里最贵的一次调用。放在最后检查根本不算防线。",
    },
    {
      q: "智能体连续三次用几乎相同的查询调用了同一个搜索工具。最好的干预是什么？",
      options: [
        "把这个重复行为当成一条观察描述给它，并建议换个办法",
        "立刻终止这次运行",
        "把那个工具从清单里永久移除",
        "提高温度再试一次",
      ],
      answer: 0,
      why: "从上下文内部看，每一次重复都像是一个新的合理主意——模型没有任何机制能看出自己在打转。一旦这个模式被明确指出来，它通常一步就能跳出去。终止会丢掉一次本可以恢复的运行。",
    },
    {
      q: "预算在第 9 步耗尽，而任务还没完成。该返回什么？",
      options: [
        "一份部分报告：已经确立了什么、证据是什么、以及下一步具体该做什么",
        "抛一个异常",
        "一个空结果，附带'预算耗尽'",
        "模型最后一次说的那段话，当成答案",
      ],
      answer: 0,
      why: "一个耗尽预算的智能体仍然知道不少东西，而那些东西属于用户。它也是 C08 的恢复点和 C17 的交接说明——一次调用，三种用途。把最后那轮输出当成答案交出去，是最糟的选项：它听起来像完成了。",
    },
    {
      q: "`stopReason` 是 `max_tokens`，而且内容看起来像一个完整的计划。循环该怎么办？",
      options: [
        "把它当成被截断处理——继续这一轮，或者带着明确的原因失败",
        "当成答案返回",
        "重跑同一次调用",
        "丢掉这一轮，继续下一次迭代",
      ],
      answer: 0,
      why: "被截断的响应在语法上和完整响应无法区分。这就是为什么它必须被显式检查，而不是靠观察输出来判断。默默拿着半个计划往下做，是这个循环里最贵的一种无声失败。",
    },
    {
      q: "为什么消息数组是这个循环里唯一的状态？",
      options: [
        "模型是无状态的，所以任何不在数组里的东西，对下一次决策来说都不存在",
        "因为这样代码更短",
        "因为 API 要求这样",
        "因为它让重试更容易",
      ],
      answer: 0,
      why: "模型对这次任务知道的一切，都是因为它在你刚发出的那个请求里。这就是为什么 C05 的压缩、C07 的记忆注入和 C17 的上下文隔离，全都是对这一个数组做的操作——以及为什么服务端保存的会话状态会拿走这门课赖以成立的能力。",
    },
    {
      q: "运行级别的时限和每次调用的超时，哪个才能真正给一次运行设界？",
      options: [
        "运行级别的时限，因为调用次数是无界的，每一次都能在自己的超时内完成",
        "每次调用的超时，因为它更精确",
        "两者等价",
        "两个都不行；只有步数上限管用",
      ],
      answer: 0,
      why: "五次调用、每次 30 秒，最坏是 150 秒，而且没有任何东西阻止循环决定再来第六次。时限是任务的属性，所以每次运行创建一个 AbortController，再用 AbortSignal.any 组合进每一次调用。",
    },
  ],

  continues:
    p(`你现在有了一个能用的智能体。它会在大约第 18 轮开始变笨：重新读它已经读过的文件、和自己早先的结论打架、忘掉最初的目标。这不是模型的问题，是上下文的问题——而 ${ch("c05", "C05")} 讲的就是把进入那个数组的东西当成一份需要经营的预算，而不是一堆不断追加的东西。`),
};

export default chapter;
