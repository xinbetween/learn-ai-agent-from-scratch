import type { Chapter } from "../../../src/types.ts";
import { code, fig, note, table, p, ul, ch } from "../../../src/ui.ts";
import en, { DISPATCH_SVG } from "../../chapters/c03.ts";

const explore = en.sections.find((s) => s.id === "explore")!;
const build = en.sections.find((s) => s.id === "build")!;

const chapter: Chapter = {
  ...en,
  title: "工具",
  subtitle: "模型的意图和你的函数之间的那层接口",
  blurb:
    "一个工具是一个名字、一份 schema、一段描述和一个函数——而那段描述才是决定这个智能体能不能用的部分。分发、校验、并行、截断，以及为什么每一次失败都必须以观察的形式回来。",

  sections: [
    {
      id: "motivation",
      kicker: "动机",
      title: "工具是走出盒子的唯一通道",
      html:
        p(`模型只有一个输出通道，那就是 token。读一个文件、查一个数据库、发一封邮件、跑一次测试：这里面每一件事之所以会发生，都是因为你的代码把其中一部分 token 认成了一个请求，然后调用了一个函数。工具就是这层识别，也是智能体触碰现实的全部表面积。`) +
        p(`这让工具设计成了整门课里最有价值的工作，也是被低估得最一致的那一项。团队会花一周调系统提示词，花十分钟写工具描述——而描述是模型每一次调用都会读的，系统提示词也在旁边，每轮读一次。一段精确的工具描述比一整页提示词工程更值钱，因为它恰好出现在做决定的那个位置。`) +
        note("key", "值得随身带走的那个重新框定", p(`你不是在为一个程序写 API。你是在为一位<strong>读者</strong>写一份<strong>可供性说明</strong>，而这位读者能力很强、速度很快、从没见过你的代码库、没法追问你任何问题，而且在你说得含糊时会自信地猜。你留下的每一处歧义，都会被一次猜测填上，而你要为这次猜测付出一次失败的运行。`)),
    },
    {
      id: "core-idea",
      kicker: "核心思想",
      title: "四个字段，其中一个是程序本身",
      html:
        code({
          title: "code/c03_tools.ts — 契约",
          src: `export interface Tool<A = unknown> {
  name: string;                    // verb_noun，在整个清单里保持不相交
  description: string;             // 模型唯一读到的东西 —— 这是规格说明
  input: Schema<A>;                // C02 的 schema，导出 JSON Schema
  run: (args: A, ctx: Ctx) => Promise<unknown>;

  // 这些永远不会发给模型 —— 它们是给你的循环用的
  readOnly?: boolean;              // 可以和别的工具并行跑吗？
  idempotent?: boolean;            // 超时之后重试安全吗？
  timeoutMs?: number;
  maxResultTokens?: number;
}`,
        }) +
        p(`这个划分很重要。<code>name / description / input</code> 发给模型；其余的永远不发。<code>readOnly</code> 不是给模型的提示，它是你的循环用来判断能不能并发跑五个工具、以及 ${ch("c16", "C16")} 要不要打断一个人的依据。`) +
        `<h3>描述是一份规格说明，它有五项职责</h3>` +
        p(`对比一下。两段都很诚实；只有一段管用。`) +
        code({
          title: "60% 和 95% 选中率之间的差别",
          lang: "text",
          plain: true,
          src: `✗  search_orders —— 搜索订单。

✓  search_orders —— 按客户邮箱、订单号或日期区间查询订单数据库。
   何时使用：用户提到某个具体订单，或者问"我的东西在哪儿"。
   何时不要使用：退货政策问题（用 search_policy）；
     配送位置（用 get_tracking，它更新更快）。
   返回：最多 20 条订单摘要，含 id、状态、下单日期、金额。
     没有匹配时返回空列表——这不是错误。
   成本：约 200ms，只读。`,
        }) +
        p(`五项职责，按被跳过的频率排序：`) +
        `<ol>
  <li><strong>它做什么</strong> —— 这一条所有人都会写。</li>
  <li><strong>什么时候用它</strong> —— 触发条件，用用户的词汇，不是你的。</li>
  <li><strong>什么时候<em>不要</em>用它，以及该改用什么</strong> —— 这一条是用来把相似的工具区分开的，也是在一个拥挤的工具清单里对选中准确率提升最大的那个字段。</li>
  <li><strong>会返回什么</strong> —— 形状、上限，以及"空"意味着什么。它能防止模型把零结果当成错误然后永远重试。</li>
  <li><strong>它的代价</strong> —— 延迟和副作用，好让模型能做预算。</li>
</ol>` +
        `<h3>命名就是选择</h3>` +
        p(`把 <code>search</code>、<code>query</code>、<code>find</code>、<code>lookup</code> 放进同一个清单，一定会乱，因为它们在英语里是同义词，而模型读的就是英语。用 <code>verb_noun</code>，并且让名词互不相交。一旦你有了 <code>search_orders</code>、<code>search_policies</code> 和 <code>search_archive</code>，光工具名本身就承载了大部分的路由信号。`),
    },
    {
      id: "mechanics",
      kicker: "机制",
      title: "分发，以及四种失败",
      html:
        fig({
          label: "图解",
          title: "一次工具调用，从头到尾",
          body: DISPATCH_SVG,
          caption: `最底下那一行是大家会漏掉的部分。一个工具层遇到坏输入就抛异常的智能体，把一个本来有救的局面变成了一次死掉的运行。`,
        }) +
        `<h3>错误是观察</h3>` +
        p(`这是本章最重要的一条实现规则，而它只有三行代码。`) +
        code({
          title: "全部的规则",
          src: `const tool = registry[call.name];
if (!tool) {
  // 不抛异常。把这次失败当成模型能看见的东西返回回去。
  return toolResult(call.id, {
    isError: true,
    content: \`没有名为 "\${call.name}" 的工具。可用：\${Object.keys(registry).join(", ")}。\`
           + \`你是想用 "\${closest(call.name, Object.keys(registry))}" 吗？\`,
  });
}`,
        }) +
        p(`同样的形状适用于全部四类失败。实测效果很大。可恢复错误处理通常值 10–20 个百分点的端到端任务成功率，而它的代价是一个 <code>try/catch</code> 加一句有用的字符串。`) +
        table(
          ["失败", "这条观察里必须包含什么"],
          [
            ["工具名不存在", "真实的名字列表，以及最接近的那个"],
            ["参数非法", "校验器给出的路径 —— <code>.query: expected string, got null</code>（这是 <a href=\"/zh/c02/\" class=\"mono\">C02</a> 开始回本了）"],
            ["工具抛了异常", "异常信息，以及重试有没有用"],
            ["超时了", "它等了多久，以及那个副作用是否仍可能已经生效"],
            ["空结果", "<b>这不是错误。</b> <code>\"没有订单匹配。放宽日期范围，或者检查一下邮箱。\"</code>"],
          ]
        ) +
        `<h3>安全的地方并行，不安全的地方串行</h3>` +
        p(`模型经常在一轮里发出好几个 <code>tool_use</code> 块。在读密集的步骤上并发执行它们，通常是 3–5 倍的延迟收益——而如果其中两个是写操作，那就是一个数据损坏的 bug。`) +
        code({
          title: "readOnly 标志开始挣它的工钱",
          src: `const [reads, writes] = partition(calls, (c) => registry[c.name]?.readOnly);

const readResults = await Promise.allSettled(reads.map(exec));   // 并发
const writeResults = [];
for (const w of writes) writeResults.push(await exec(w));        // 串行，按序

// 按原始调用顺序重排 —— 大多数 API 要求结果和请求一一对应。
return calls.map((c) => byId.get(c.id)!);`,
        }) +
        p(`这八行里有两个陷阱。用 <code>Promise.allSettled</code> 而不是 <code>Promise.all</code>，因为一次被拒绝的读取不该把四个好结果一起扔掉，而且每一次拒绝反正都会变成一条错误观察。然后是重排：很多 API 要求 <code>tool_result</code> 块的顺序和发起它们的 <code>tool_use</code> 块一致，而顺序对不上会给你一个 400，够你查一个小时。`) +
        `<h3>截断，或者说那个把上下文吃掉的工具</h3>` +
        p(`一个返回 200 KB JSON 的工具不是只花你一次钱；它在这次运行<em>之后的每一轮</em>都要花你一次（${ch("c01", "C01")} 的模拟器把这件事演得很清楚）。给每一个工具结果设上限，并且让截断这件事是看得见的。`) +
        code({
          title: "在边界处截断，并且说出来",
          src: `function cap(text: string, tool: string, max = 2_000): string {
  const tokens = estimate(text);
  if (tokens <= max) return text;
  const head = slice(text, max * 0.7);
  const tail = sliceEnd(text, max * 0.2);   // 结尾往往有总数和收尾括号
  return \`\${head}\\n\\n[... 截断：共 \${tokens} tokens，显示 \${max}。\`
       + \`缩小查询范围，或者给 \${tool} 传一个 page/offset 参数 ...]\\n\\n\${tail}\`;
}`,
        }) +
        note("", "掐头留尾，不要只留头", p(`只截头部会把摘要行、总数和收尾的括号藏起来，而这些恰恰是告诉模型要不要翻页的部分。两头都留不花什么成本，却把一条死路变成了下一步。而且永远要告诉模型<em>怎么</em>拿到剩下的部分；一条没有补救办法的截断提示，只会教它放弃。`)),
    },
    { ...explore, kicker: "动手试试", title: "看着一个工具清单变得太大" },
    { ...build, kicker: "写出来", title: "工具清单" },
    {
      id: "production",
      kicker: "生产实践",
      title: "一线笔记",
      html:
        ul([
          `<strong>工具 schema 每一轮都在计费。</strong> 四十个工具、每个 240 token，就是每一次调用上的 9,600 token。有提示词缓存的话这很便宜；没有的话，它可能是你账单的大头。把它测出来——这是智能体成本模型里最常被漏掉的一项。`,
          `<strong>不要把你的 REST API 直接当成工具暴露出去。</strong> API 是为一个手里有文档和调试器的程序员设计的。工具面是为一个只有一次机会的读者设计的。把 <code>GET /orders</code> + <code>GET /orders/:id</code> + <code>GET /orders/:id/tracking</code> 合成一个 <code>get_order_status</code>，返回一个人真正想知道的东西。更少、更厚、按任务塑形的工具，每一次都胜过忠实的一一映射。`,
          `<strong>返回自然语言，不要只返回 JSON。</strong> 一个 <code>{"status":"D","eta_d":2}</code> 的工具结果会让模型去猜。<code>"两天前已发出，预计 3 月 14 日周四送达（运单号 1Z…）。"</code> 则不会。token 成本相差无几，准确率的差别可不是。`,
          `<strong>Anthropic 的工具使用指南、OpenAI 的函数调用指南和 MCP 规范</strong>全都汇聚到了这一章给出的同一套建议上，这挺让人安心的：描述性的名字、明确的"何时不要用"、内容丰富的返回值、错误以内容而非异常的形式出现。${ch("c15", "C15")} 讲的就是当你把这一切的传输格式标准化之后会发生什么。`,
          `<strong>去哪里读真实代码：</strong>AutoGen 的 <code>FunctionTool</code> 从 Python 函数签名和 docstring 推导 schema；OpenAI Agents SDK 从一个加了装饰器的函数做同样的事；Claude Agent SDK 附带一套文件系统和 shell 工具，很值得当成一份设计来研究，尤其是那些他们选择<em>不</em>暴露某个原语的地方。`,
        ]),
    },
  ],

  exercises: [
    {
      difficulty: "warm-up",
      prompt: `把下面这三段描述重写，让模型能在它们之间可靠地路由：<code>search</code> —— "搜索。"，<code>query</code> —— "查询数据库。"，<code>lookup</code> —— "查东西。"`,
      answer:
        p(`先从改名开始，因为造成伤害的就是这些名字。三个同义词，靠任何描述都区分不开。`) +
        code({
          title: "先让名字不相交，再让描述不相交",
          lang: "text",
          plain: true,
          src: `search_orders     —— 按邮箱、订单号或日期区间查订单数据库。
  何时使用：问的是某个具体购买行为、某个订单状态、某笔退款。
  何时不要：政策问题（search_policies）；配送位置（get_tracking）。
  返回：最多 20 条摘要。空列表表示没有匹配，不是错误。

search_policies  —— 全文检索面向客户的政策文档。
  何时使用：问的是规则——退货窗口、保修、资格条件。
  何时不要：任何关于某一个具体订单的问题。
  返回：最多 5 段带标题路径的片段。

search_archive   —— 检索 2019 年之前已归档的订单（慢，冷存储）。
  何时使用：只在 search_orders 返回空、而用户坚持订单确实存在时。
  何时不要：作为第一次尝试；它要 3–8 秒。
  返回：和 search_orders 相同的形状。`,
        }) +
        p(`注意 <code>search_archive</code> 的"何时使用"引用了另一个工具的<em>结果</em>。把回退顺序编码进描述里，就是你不写任何编排代码也能得到一个合理重试序列的方式。`),
    },
    {
      difficulty: "core",
      prompt: `你的智能体调用了 <code>send_email</code>，这次调用在 30 秒后超时，而这个工具不是幂等的。写出模型应该收到的那条观察，并解释为什么重试是错误的默认行为。`,
      answer:
        code({
          title: "那条观察",
          lang: "text",
          plain: true,
          src: `ERROR: send_email 在 30 秒后超时。

这封邮件**可能已经发出去了**。这个工具不是幂等的，所以重试
有可能给客户发出第二封邮件。

在重试之前，先调用 get_recent_emails(customer_id, since="10m")
确认一下。如果那封邮件已经在里面，就当作成功继续往下走。`,
        }) +
        p(`超时<em>不是</em>失败。它是"副作用有没有发生"这条信息的缺失。把它当成失败去重试，是在把一个未知变成一个重复——而对邮件、支付或者建工单来说，重复是一个比什么都没做更糟的结果。`) +
        p(`三条设计上的推论：(1) 给每个工具标上幂等与否，因为超时消息的内容取决于它；(2) 对任何非幂等的工具，配一个让智能体可以去核对的读工具；(3) 更好的做法是用客户端提供的键让这个工具变成幂等的——<code>send_email(idempotency_key: callId)</code>——于是这一整类问题都消失了。${ch("c12", "C12")} 会把这一点推广开。`),
    },
    {
      difficulty: "core",
      prompt: `实现安全的并行工具执行：读并发、写按序串行、一次失败不丢掉其他结果、并且结果顺序符合 API 的要求。说出大多数人会写出的那两个 bug。`,
      answer:
        code({
          title: "安全的版本",
          src: `async function executeAll(calls: ToolCall[], reg: Registry): Promise<ToolResult[]> {
  const byId = new Map<string, ToolResult>();

  const isRead = (c: ToolCall) => reg[c.name]?.readOnly === true;
  const reads = calls.filter(isRead);
  const writes = calls.filter((c) => !isRead(c));

  // 读：并发。allSettled，这样一次拒绝不会毁掉其他结果。
  const settled = await Promise.allSettled(reads.map((c) => exec(c, reg)));
  settled.forEach((s, i) => {
    byId.set(reads[i].id, s.status === "fulfilled"
      ? s.value
      : toolResult(reads[i].id, { isError: true, content: String(s.reason) }));
  });

  // 写：按序串行，因为并发的写互相之间不安全。
  for (const w of writes) byId.set(w.id, await exec(w, reg));

  // 按原始顺序返回，不是按完成顺序。
  return calls.map((c) => byId.get(c.id)!);
}`,
        }) +
        ul([
          `<strong>Bug 1 —— <code>Promise.all</code>。</strong> 一次被拒绝的读取会把它所有兄弟的结果一起扔掉，于是模型丢了四条好观察，还要把那四次调用重来一遍。<code>allSettled</code> 加上"错误即观察"可以把这些全留住。`,
          `<strong>Bug 2 —— 按完成顺序返回结果。</strong> 大多数 API 要求 <code>tool_result</code> 块和 <code>tool_use</code> 块的顺序一致。快的工具先完成，所以按 id 建映射再最终重排是必须的。症状是一个只在真实延迟波动下才出现的间歇性 400，也就是说，只在生产环境出现。`,
        ]) +
        p(`还有第三个更隐蔽的问题：<code>readOnly</code> 只有在这个工具<em>相对于其他并行调用会碰到的一切</em>都是只读时，才能标成 true。一个会写审计日志行的"读"没问题；一个会填充其他工具要修改的缓存的"读"就不行。`),
    },
    {
      difficulty: "stretch",
      prompt: `你有跨六个服务的 60 个工具，选中准确率已经崩了。设计一个能保住全部 60 项能力的修复方案。至少比较三种做法，并选一个。`,
      answer:
        table(
          ["做法", "怎么做", "代价", "结论"],
          [
            ["<b>带命名空间的门面</b>", "暴露 6 个粗粒度工具（<code>orders.*</code>、<code>billing.*</code>）；每个接一个 <code>operation</code> 枚举加参数，遇到非法 operation 时返回它自己的子 schema", "模型猜错 operation 时多一次往返", "好 —— 所有东西留在同一个上下文里，schema token 砍掉约 80%"],
            ["<b>两阶段选择</b>", "一个便宜的模型先从目录里挑出 5 个相关工具，然后只带着这些工具发起真正的调用", "每轮多一次小调用，以及第一阶段选错时的一种新失败模式", "当目录是动态的或因用户而异时，好用"],
            ["<b>子智能体</b>", "每个服务一个专家，各带 10 个工具；编排者只看到 6 个<em>智能体</em>工具（C17）", "上下文隔离既是特性也是 bug —— 编排者丢失了细节", "当这些服务确实是互相独立的工作流时，最好"],
            ["<b>对工具做检索</b>", "把描述做成向量，每轮注入 top-k", "工具面本身变得不确定；极难评测", "除非目录是上千级别，否则别用"],
          ]
        ) +
        p(`<strong>选择：先上带命名空间的门面。</strong> 它用最少的架构换来了最多的好处，测试起来毫不费力，而且它保住了一条单一的线性 trace——这件事比听上去重要，因为 ${ch("c20", "C20")} 里跨子智能体边界的调试确实要难得多。`) +
        p(`只有当某个服务的工作长到它的中间观察开始污染主上下文时，才升级到子智能体。那才是多智能体真正的触发条件，而且那是一个<em>上下文</em>层面的论证，不是一个组织层面的论证。`),
    },
  ],

  qa: [
    { q: "多少个工具算太多？", a: p(`准确率在大约 15–20 个工具之前平缓下降，之后急剧下降，而且下降主要是语义重叠驱动的，不是纯粹的数量。二十个互不相交的工具，胜过八个容易混淆的。如果你已经超过 20 个，该问的不是"我怎么把它们描述得更好"，而是"哪四个粗粒度工具能覆盖 90% 的活"。`) },
    { q: "该让模型看到我的内部 ID 吗？", a: p(`该。模型处理不透明标识符没问题，也能准确地把它们原样传回来。它们做不到的是<em>凭空造</em>一个合法的出来，所以任何接收 ID 的工具，都必须能从某个返回 ID 的工具那里到达。一个有 <code>get_order(id)</code> 却没有任何东西产出订单 ID 的清单，是一条看起来很能干的死路。`) },
    { q: "工具该返回 JSON 还是散文？", a: p(`带结构的散文。需要模型一字不差引用回来的东西（ID、路径、金额）用 JSON，需要它拿来推理的东西用散文。最糟的选项是键名缩写过的压缩 JSON——你省了 40 个 token，买回来一次误解。看看 Codex 和 Claude Code 的文件工具：它们的输出是刻意做成人类友好形状的。`) },
    { q: "工具名已经很明显了，还需要描述吗？", a: p(`需要，因为"明显"这个词干了很多活。<code>get_user</code> —— 按 ID 还是按邮箱？返回哪些字段？已删除的用户怎么办？它是抛异常还是返回 null？这里每一个都是模型会去做的一次猜测，而它下周二会做出一个不一样的猜测。`) },
    { q: "工具能调用别的工具吗？", a: p(`能，而且对一段固定的子序列来说这通常是正确的做法：如果模型总是先调 <code>find_file</code> 再调 <code>read_file</code>，那就做一个两件事一起做的工具。你是在恰好那个能动性什么也买不到的地方，把能动性换成了工作流，而这正是 ${ch("c11", "C11")} 的整个论点。记得让这个组合工具的描述对它内部做了什么保持诚实。`) },
  ],

  project: {
    title: "项目 · 一个有牙齿的工具清单",
    brief:
      p(`把这门课其余部分要用的那个工具清单搭出来，至少包含五个工具，覆盖一个小的假域（订单、政策、一个归档库、一个写操作，以及一个故意很慢的工具）。有意思的地方不是这些工具，而是证明那些失败路径的行为是对的。`),
    spec: [
      "<code>defineTool()</code> 接收名字、描述、C02 的 schema、run 函数，以及 <code>readOnly</code> / <code>idempotent</code> / <code>timeoutMs</code> / <code>maxResultTokens</code> 这些元数据。",
      "<code>executeTool()</code> 永不抛异常：工具名不存在、参数非法、执行抛错和超时，全都返回带 <code>isError</code> 和一条可照做的消息的 <code>ToolResult</code>。",
      "工具名不存在的错误里要带上最接近的候选（Levenshtein 距离二十行就能写完）。",
      "并行执行：读走 <code>allSettled</code>，写串行，结果重排回调用顺序。",
      "每个结果都掐头留尾地截断，并带一条明确的翻页提示。",
      "为那四条失败路径各写一个测试，断言智能体恰好多花一步就能恢复。",
    ],
    stretch: [
      "给那个写工具加一个幂等键，并证明重复调用是一次空操作。",
      "给每个工具埋点：调用次数、p50/p99 延迟、错误率，以及<em>结果 token 数</em>，然后按'造成的 token'（结果大小 × 剩余轮数）给工具排名。冠军通常出人意料。",
      "加一个 <code>dryRun</code> 模式，让写工具描述它<em>将要</em>做什么而不真的去做——这是 C16 审批界面的地基。",
    ],
  },

  quiz: [
    {
      q: "在一个工具互相重叠的清单里，工具定义的哪一部分最能提升选中准确率？",
      options: [
        "一句明确的'什么时候不要用这个——改用 X'",
        "对实现细节更长的描述",
        "对参数更精确的 JSON Schema",
        "模型调用时更低的温度",
      ],
      answer: 0,
      why: "重叠是一个区分问题，而否定式的指引在区分上远比更多肯定式描述来得高效。Schema 只在工具已经被选中之后约束参数；它对'选哪个'这件事毫无帮助。",
    },
    {
      q: "模型请求了一个并不存在的工具。最好的行为是：",
      options: [
        "返回一个带 isError 的 tool_result，列出可用工具和最接近的候选",
        "抛异常，让这个 bug 立刻暴露",
        "悄悄模糊匹配到最接近的工具并执行它",
        "用同样的消息重新调用模型",
      ],
      answer: 0,
      why: "循环存在的意义，就是让模型能从观察里自我纠正。抛异常会丢掉一次离恢复只差一步的运行。悄悄做模糊匹配比这两者都糟：它掩盖了'你的工具名容易混淆'这个信号，而且早晚会跑错工具。",
    },
    {
      q: "为什么并行的工具结果在追加进消息数组之前必须重新排序？",
      options: [
        "大多数 API 要求 tool_result 块的顺序和发起它们的 tool_use 块一致",
        "模型只会读第一个结果",
        "顺序错乱的结果更费 token",
        "这样人看 trace 的时候更顺",
      ],
      answer: 0,
      why: "快的工具先结束，所以在真实的延迟波动下，完成顺序和调用顺序是不一样的。这个不匹配会产生一个只在生产环境出现的间歇性 400。按调用 id 建映射，再按原始顺序发出去。",
    },
    {
      q: "一个非幂等的工具超时了。这条观察应该说什么？",
      options: [
        "它超时了、那个副作用可能已经发生了，以及在重试之前该调用哪个读工具去核对",
        "操作失败了，应该重试",
        "什么都别说——压掉它然后自动重试",
        "这个工具坏了，以后别再用了",
      ],
      answer: 0,
      why: "超时是信息的缺失，不是一次失败。重试一个非幂等操作，是把一个未知变成一次重复扣款、一封重复邮件、一张重复工单。要么给智能体一条核对的路，要么用客户端提供的键让这个工具变成幂等的。",
    },
    {
      q: "一个工具返回了 180 KB 的 JSON。它对这次运行真实的代价是什么？",
      options: [
        "它会在之后每一轮都作为输入被重发，所以它的成本要乘上剩余的轮数",
        "一次性的：大约 45,000 个输入 token，就一次",
        "没有代价，只要上下文窗口够大",
        "只有模型用来总结它的那些输出 token",
      ],
      answer: 0,
      why: "消息数组每一轮都会被整个重发。一次 12 轮运行里第 3 轮的大观察，之后还要被计费九次。给工具归因成本时，要把结果大小乘上剩余轮数——这正是'有点啰嗦'变成'账单的大头'的地方。",
    },
    {
      q: "你有 60 个工具，选中准确率已经崩了。第一件该试的事是什么？",
      options: [
        "把它们收拢成少数几个带命名空间的门面工具，各自接一个 operation 枚举",
        "把这 60 段描述都写得更详细",
        "换一个更大的模型",
        "把描述做成向量，每轮检索 top-k",
      ],
      answer: 0,
      why: "超过大约 20–30 个工具之后，问题出在清单本身，再好的描述质量也救不回来。门面能大幅削减 schema token、把所有东西留在一条线性 trace 里，而且测试起来毫不费力。对工具做检索会让工具面本身变得不确定，那是极难评测的。",
    },
  ],

  continues:
    p(`你现在有了一个模型可以调用、而且不会抛出任何东西的函数清单。下一步是把 ${ch("c01", "C01")}、${ch("c02", "C02")} 和这一章接起来，放进那个会一直转到任务完成为止的循环里——以及那四道让它能活下来的防线。${ch("c04", "C04")} 就是整门课挂在上面的那一章。`),
};

export default chapter;
