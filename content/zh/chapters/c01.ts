import type { Chapter } from "../../../src/types.ts";
import { code, fig, note, table, p, ul, ch } from "../../../src/ui.ts";
import en, { REQ_SVG } from "../../chapters/c01.ts";

const explore = en.sections.find((s) => s.id === "explore")!;

const chapter: Chapter = {
  ...en,
  title: "模型调用",
  subtitle: "消息、停止原因、token，以及其他一切赖以建立的那一个函数",
  blurb:
    "模型是一个从消息数组到响应的无状态函数。它的签名要扛住流式、重试、用量记账和取消；把这件事做对，决定了接下来二十三章读起来有多舒服。",

  sections: [
    {
      id: "motivation",
      kicker: "动机",
      title: "这个原语你会调用一万次",
      html:
        p(`${ch("c00", "C00")} 写下 <code>await model(messages, tools)</code> 就往下走了。那是一句图省事的谎话。你的智能体里每一个 token、每一毫秒、每一次瞬时故障，都是从这一次调用进来的，这让它的签名变成了承重结构。返回一个字符串，你就看不到用量。省掉取消，你就实现不了时限。遇到限流就抛异常，你的智能体就会恰好死在它最有用的那一刻。`) +
        p(`所以，认真地把它写一次。这里八行类型定义，能替你省掉后面四次重构，因为这门课里每一层抽象——工具、记忆、规划、子智能体、评测——都是包在这个函数外面的一层壳。`) +
        note(
          "key",
          "塑造了一切的那个性质",
          p(`<strong>模型是无状态的。</strong> 它不记得上一次调用，没有会话，也不知道你正做到一半。它对这段对话"知道"的一切，都是因为你把它放进了这次请求里。成本、上下文上限、记忆、压缩、多智能体交接——智能体工程里每一个难题，都是从这一个事实往下推出来的。`)
        ),
    },
    {
      id: "core-idea",
      kicker: "核心思想",
      title: "一个带类型的函数，以及每个字段替你买到了什么",
      html:
        p(`下面就是这门课其余部分要 import 的那个接口。把它当成一串决定来读，因为它本来就是。`) +
        code({
          title: "code/c01_model_call.ts — 契约",
          src: `export type Role = "system" | "user" | "assistant" | "tool";

export type Block =
  | { type: "text"; text: string }
  | { type: "tool_use"; id: string; name: string; input: unknown }
  | { type: "tool_result"; id: string; content: string; isError?: boolean };

export interface Message { role: Role; content: string | Block[]; }

export interface Usage { input: number; output: number; cacheRead?: number; cacheWrite?: number; }

export type StopReason = "end_turn" | "tool_use" | "max_tokens" | "stop_sequence" | "refusal";

export interface ModelResponse {
  content: Block[];          // 同一轮里可能同时有文本和 tool_use
  stopReason: StopReason;    // 它为什么停下 —— 这不是细节，是控制信号
  usage: Usage;              // 它花了多少，每次调用都有，永远都有
  model: string;             // 实际是哪个模型服务的这次请求
  latencyMs: number;
}

export interface CallOptions {
  system?: string;
  tools?: ToolSchema[];
  temperature?: number;      // 决策用 0，写文字用高一点的
  maxTokens?: number;
  signal?: AbortSignal;      // 取消不是可选项
  onDelta?: (text: string) => void;  // 想要的话，流式
}

export type Model = (messages: Message[], opts?: CallOptions) => Promise<ModelResponse>;`,
        }) +
        `<h3>content 是块，不是字符串</h3>` +
        p(`最常见的早期错误，是把 content 的类型写成 <code>string</code>。现代的一轮 assistant 输出可以同时包含推理文本<em>和</em>两个工具调用，而一轮 user 输入可以携带好几个工具结果。把这些压平成字符串，你就失去了并行执行工具的能力（${ch("c03", "C03")}）、失去了把结果和发起它的那次调用配对的能力，也失去了压缩时单独剥离推理内容的能力（${ch("c05", "C05")}）。块结构现在只花你一个类型定义，以后能省掉一次重写。`) +
        `<h3><code>stopReason</code> 是控制流，不是遥测</h3>` +
        p(`你的循环靠它分支：`) +
        table(
          ["stopReason", "含义", "你的循环该做什么"],
          [
            ["<code>end_turn</code>", "模型说完了", "返回答案"],
            ["<code>tool_use</code>", "它需要先拿到观察才能继续", "执行工具，追加结果，进入下一轮"],
            ["<code>max_tokens</code>", "它话说到一半被截断了", "继续这一轮，或者大声地失败——<b>永远不要</b>当成答案"],
            ["<code>stop_sequence</code>", "它撞上了你提供的某个分隔符", "按你设计的那套框架去解析"],
            ["<code>refusal</code>", "它拒绝了", "把它透传出去；不要原样重试"],
          ]
        ) +
        p(`危险的是 <code>max_tokens</code>。一个被截断的响应在语法上就是一个正常响应。它有文本，能解析，看起来就是个答案。从不检查这个字段的智能体，会拿着半个计划继续往下做，而且一声不吭。给它加断言。`) +
        `<h3>每次调用都带 <code>usage</code>，否则你就是在盲飞</h3>` +
        p(`不是一个你到最后才去查的计数器，而是每个响应上的一个字段，由你的循环累加。智能体的成本主要由<em>被反复重发的输入 token</em> 构成，而只有把输入和输出分开计数，你才看得见这一点。一旦有了这个字段，${ch("c20", "C20")} 的可观测性就是十五行代码，而不是一场考古。`),
    },
    {
      id: "mechanics",
      kicker: "机制",
      title: "一次调用里到底装了什么",
      html:
        fig({
          label: "图解",
          title: "一个请求，一个响应，没有记忆",
          body: REQ_SVG,
          caption:
            `那条虚线返回路径是整个系统里唯一的"记忆"：你把响应追加进自己的数组。服务端不会在两次调用之间记住你任何东西，这就是为什么请求每一轮都在变大，以及为什么成本是轮数的二次函数。`,
        }) +
        `<h3>四种角色，各自派什么用场</h3>` +
        ul([
          `<strong>system</strong> —— 身份、约束、工具策略、输出格式。它每次调用都会被发送，所以这里的每一个 token，你每一轮都在付钱。把它当成昂贵的东西。几乎没人这么做。`,
          `<strong>user</strong> —— 目标，以及后来人类插进来的话。在智能体里，第一轮之后的大多数 "user" 轮，其实是披着 user 角色的工具结果，具体取决于 API。`,
          `<strong>assistant</strong> —— 模型说过的一切，包括它发出的工具请求。这些你必须一字不差地回传：丢掉一个 <code>tool_use</code> 块却留着它的结果，会产生一个孤儿结果，大多数 API 会直接拒收。`,
          `<strong>tool</strong> —— 观察。这是现实进入模型世界的通道，也因此成了攻击者进入模型世界的通道（${ch("c21", "C21")}）。`,
        ]) +
        `<h3>温度：两个档位，不是一个拿来来回拨的旋钮</h3>` +
        p(`温度在采样之前缩放 logits。实践中，智能体只有两个有用的档位：`) +
        ul([
          `<strong>决策用 0（或接近 0）</strong> —— 选哪个工具、走哪个分支、分成哪一类，以及任何结构化输出。你要的是 argmax，而且你调试的时候需要多次运行之间可以对照。`,
          `<strong>写文字用 0.7–1.0</strong> —— 最终写给人看的答案、头脑风暴，以及任何"千篇一律就显得像机器"的地方。`,
        ]) +
        note(
          "warn",
          "温度 0 不等于确定性",
          p(`同样的输入在温度 0 下，不同次运行仍然会变。批处理 GPU kernel 里浮点运算不满足结合律、MoE 路由取决于和你同批的是哪些请求、版本别名背后模型被悄悄更新、负载均衡打到了配置并不一致的副本上。你该期待的是<em>高度一致</em>，而不是可复现。任何假设输出逐字节相同的评测设计（${ch("c19", "C19")}），都建在沙子上。`)
        ),
    },
    { ...explore, kicker: "动手试试", title: "看着请求长大，看着账单滚雪球" },
    {
      id: "build",
      kicker: "写出来",
      title: "客户端：重试、超时、流式、记账",
      html:
        p(`一个生产级的模型客户端，大部分内容是错误处理。下面这三件事不是可选的附加项。缺了它们的智能体，第一个不顺的下午就会倒下。`) +
        code({
          title: "code/c01_model_call.ts — 带抖动的重试和一个硬时限",
          src: `const RETRYABLE = new Set([408, 409, 429, 500, 502, 503, 504]);

export async function callModel(
  messages: Message[],
  opts: CallOptions = {},
  cfg = { maxAttempts: 5, baseMs: 500, capMs: 20_000 },
): Promise<ModelResponse> {
  let attempt = 0;
  for (;;) {
    attempt++;
    const started = Date.now();
    try {
      const res = await fetch(ENDPOINT, {
        method: "POST",
        headers: { "content-type": "application/json", "x-api-key": KEY },
        body: JSON.stringify(toWire(messages, opts)),
        signal: opts.signal,          // 调用方的时限说了算
      });

      if (!res.ok) {
        if (!RETRYABLE.has(res.status) || attempt >= cfg.maxAttempts) {
          throw new ModelError(res.status, await res.text());
        }
        // 先听服务端自己的建议，再退回我们的退避策略。
        const retryAfter = Number(res.headers.get("retry-after")) * 1000;
        await sleep(retryAfter || backoff(attempt, cfg), opts.signal);
        continue;
      }

      return fromWire(await res.json(), Date.now() - started);
    } catch (err) {
      if ((err as Error).name === "AbortError") throw err;   // 取消，绝不重试
      if (attempt >= cfg.maxAttempts) throw err;
      await sleep(backoff(attempt, cfg), opts.signal);
    }
  }
}

// 全抖动：没有这个随机因子，你整个机群会踩着同一个节拍重试，
// 把当初造成 429 的那场过载原样重演一遍。
const backoff = (n: number, cfg: { baseMs: number; capMs: number }) =>
  Math.random() * Math.min(cfg.capMs, cfg.baseMs * 2 ** (n - 1));`,
        }) +
        p(`三个容易做错的细节：`) +
        ul([
          `<strong>永远不要重试 <code>AbortError</code>。</strong> 调用方已经取消了；还去重试，等于客户端在跟自己的时限吵架。这个 bug 在你做 ${ch("c16", "C16")} 的中断处理之前一直是隐形的，直到你发现被取消的运行还在继续花钱花了一分钟。`,
          `<strong>先尊重 <code>retry-after</code>，再用你自己的退避。</strong> 服务端知道自己什么时候能缓过来，你不知道。`,
          `<strong>是全抖动，不是"指数退避"。</strong> 确定性的退避会把你的机群同步成一波一波的重试潮，把那场故障复现出来。乘上一个 <code>Math.random()</code>，惊群效应就消失了。`,
        ]) +
        `<h3>流式，但别让它污染你的类型</h3>` +
        p(`流式是一个传输细节。就让它保持是细节：内部走流式，最后解析成同一个 <code>ModelResponse</code>，把部分文本通过回调暴露出去。这样你的智能体循环就永远不会有两条代码路径。`) +
        code({
          title: "流式，但仍然返回同一个带类型的值",
          src: `export async function callModelStream(
  messages: Message[], opts: CallOptions = {},
): Promise<ModelResponse> {
  const res = await fetch(ENDPOINT, { /* …, stream: true */ });
  const reader = res.body!.pipeThrough(new TextDecoderStream()).getReader();

  const acc = new BlockAccumulator();
  let buf = "";
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += value;
    // SSE 帧之间用空行分隔；一帧可能是分两次到达的。
    const frames = buf.split("\\n\\n");
    buf = frames.pop() ?? "";
    for (const f of frames) {
      const ev = parseSSE(f);
      if (ev?.type === "text_delta") opts.onDelta?.(ev.text);
      acc.apply(ev);
    }
  }
  return acc.finish();   // 和非流式路径完全相同的 ModelResponse 形状
}`,
        }) +
        note(
          "bad",
          "每个人都会上线一次的那个 bug",
          p(`<code>buf.split("\\n\\n")</code> 之后没把结尾那个碎片留下来。TCP 不会照顾你的帧边界，一个 4 KB 的 chunk 早晚会把一个 SSE 事件劈成两半。把最后一个元素塞回 <code>buf</code> 就是全部的修复。漏掉它，你会得到大约两百次运行一次的 JSON 解析错误：频繁到确实会造成麻烦，又稀少到足以让人怪罪服务商一整个星期。`)
        ) +
        code({
          title: "跑一下",
          lang: "bash",
          plain: true,
          src: `node --experimental-strip-types code/c01_model_call.ts

#   C01 · The Model Call — mock
#
#   turns                  12
#   input  billed          67,241 tok
#   output                 207 tok
#   ratio                  325 : 1
#   est. cost              $0.2048
#
#   input tokens per turn  2K 3K 3K 4K 5K 5K 6K 7K 7K 8K 8K 9K
#
#   Note the growth: turn 1's observation is billed again on every later turn.
#   That is why C05 exists.
#
#   12-turn agent             12 calls     67,241 in      207 out  $0.2048`,
        }),
    },
    {
      id: "production",
      kicker: "生产实践",
      title: "SDK 在这个函数背后做了些什么",
      html:
        ul([
          `<strong>提示词缓存</strong>是智能体里最大的那根成本杠杆。各家服务商允许你把一段前缀标记为可缓存；后续共享这段完全相同前缀的调用，大约按十分之一计费。因为智能体每一轮都要重发固定的系统提示词加工具定义，缓存基本上是白捡的钱。代价是这段前缀必须<em>逐字节相同</em>：不能有时间戳，不能打乱工具顺序，系统提示词里不能有按轮插值的东西。在 ${ch("c05", "C05")} 里就按这个前提设计。`,
          `<strong>token 计数接口</strong>之所以存在，是因为不同模型的分词器不一样，而 <code>text.length / 4</code> 在代码上会偏差 30%，在非拉丁文字上偏得更多。重要的预算用真正的计数器；UI 上用估算。`,
          `<strong>模型别名是会漂移的。</strong> <code>*-latest</code> 指向了新地方，就是你智能体里一次无声的行为变更。凡是你拿来做评测的地方都要钉死具体版本，并且把版本升级当成一次代码变更来对待，重跑 ${ch("c19", "C19")} 的那套用例。`,
          `<strong>限流通常是按 token 算的，不是按请求数。</strong> 一个上下文 40k token 的智能体，会在撞上每分钟请求数上限之前很久，就先撞上每分钟输入 token 上限——这就是为什么天真的"N 个智能体并发"扩容会在一个很反直觉的数字上失败。`,
          `<strong>这东西在真实代码里长什么样：</strong> Anthropic 和 OpenAI 的 SDK 都把这个函数包了一层重试和流式；LangChain 管它叫 <code>BaseChatModel.invoke</code>；AutoGen 管它叫 <code>ChatCompletionClient.create</code>，而且值得注意的是，它让客户端自己累加用量——正是上面论证过的那个设计。`,
        ]),
    },
  ],

  exercises: [
    {
      difficulty: "warm-up",
      prompt: `你的智能体大约每五十次运行就会返回一个自信但被截断的计划。代码漏检了哪个字段？写出那三行修复。`,
      answer:
        p(`它忽略了 <code>stopReason === "max_tokens"</code>。被截断的响应是一个格式完好的响应，所以什么异常都不会抛。`) +
        code({
          title: "修复",
          src: `const res = await model(messages, opts);
if (res.stopReason === "max_tokens") {
  // 要么把这一轮继续下去，要么大声失败。永远不要当成答案。
  throw new TruncatedError(\`response hit max_tokens after \${res.usage.output} tokens\`);
}`,
        }) +
        p(`在智能体里，更好的分支通常是继续而不是抛异常。把那半轮 assistant 内容追加上去再调一次，大多数 API 直接支持这么做。不能接受的是那个一声不吭的选项。`),
    },
    {
      difficulty: "core",
      prompt: `用模拟器找出一种配置，让打开提示词缓存能省下超过 60% 的运行成本；再找出一种几乎省不到钱的配置。说出能同时解释这两者的那条规则。`,
      answer:
        p(`省得多：系统提示词很大（5,000+）、工具很多、工具结果很小（100）、跑十二轮。几乎省不到：系统提示词很小（200）、没有工具、工具结果巨大（4,000）。`) +
        p(`<strong>规则：</strong>缓存只为那段<em>固定前缀</em>付费。节省 ≈ 固定&nbsp;token 数 × 轮数 × 0.9，而未缓存的成本是随着累积起来的<em>可变</em>尾部一起涨的。所以当前缀相对于这次运行追加的内容很大时，缓存赢；当工具输出占了大头时，缓存输。把它当成一条设计指令而不是一个观察：把稳定的材料放在最前面——指令、工具 schema、few-shot 示例、长参考文档——并且永远不要往里插入任何按轮变化的东西。`),
    },
    {
      difficulty: "core",
      prompt: `实现 <code>withDeadline(model, ms)</code>——一个包装器，给整次多轮调用的智能体运行一个统一的墙钟预算，并在预算耗尽时取消正在飞的请求。解释为什么它必须组合在<em>运行</em>这一层，而不是每次调用那一层。`,
      answer:
        code({
          title: "一个信号，整次运行里所有调用共享",
          src: `export function withDeadline(model: Model, ms: number) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(new DOMException("deadline", "AbortError")), ms);

  const wrapped: Model = (messages, opts = {}) => {
    // 组合：既尊重调用方的信号，也尊重这次运行的时限。
    const signal = opts.signal
      ? AbortSignal.any([opts.signal, ctrl.signal])
      : ctrl.signal;
    return model(messages, { ...opts, signal });
  };

  return { model: wrapped, cancel: () => ctrl.abort(), done: () => clearTimeout(timer) };
}`,
        }) +
        p(`每次调用各自的超时并不能给一次运行设界。五次调用、每次 30 秒超时，最坏情况是 150 秒；而一个不断决定"再走一步"的智能体，永远不会触发任何一个单独的超时，却能把你所有的延迟预算全部烧穿。时限属于<em>任务</em>，所以这个信号必须每次运行创建一次并共享出去——而这正是 <code>AbortSignal.any</code> 的用途。`) +
        p(`别忘了 <code>clearTimeout</code>：一个悬着的定时器会在运行结束后继续吊着 Node 进程，表现出来就是一个关不掉的服务。`),
    },
    {
      difficulty: "stretch",
      prompt: `为一个会运行子智能体（${ch("c17", "C17")}）的智能体设计一套 <code>Usage</code> 账本。它必须能回答：这次运行花了多少、每个子智能体各花了多少、哪个工具的输出造成了最多的输入 token。给出类型草图，并说明累加发生在哪里。`,
      answer:
        code({
          title: "按 span 归因，而不是按计数器",
          src: `interface Span {
  id: string; parent?: string;
  kind: "run" | "subagent" | "model_call" | "tool";
  label: string;                     // 智能体名或工具名
  usage: Usage;                      // 只算自己的用量
  bytesOut?: number;                 // 对工具而言：这条观察有多大
  startedAt: number; endedAt?: number;
}

class Ledger {
  spans: Span[] = [];
  open(kind: Span["kind"], label: string, parent?: string): string { /* … */ }
  close(id: string, usage?: Usage, bytesOut?: number): void { /* … */ }

  totals(rootId: string): Usage { /* 把整棵子树加起来 */ }

  // 有意思的那个查询：把输入 token 归因到产生它们的那个工具。
  blame(): Array<{ tool: string; inputTokensCaused: number }> {
    // 第 k 轮产生的一条 T token 的工具结果，会在之后每一轮被重发，
    // 所以它的真实成本是 T × (剩余轮数 + 1)，而不是 T。
    // …
  }
}`,
        }) +
        p(`有三个设计点值得挑明。`) +
        ul([
          `<strong>在客户端累加，不要在循环里。</strong> 模型客户端是唯一一个能看到所有调用的地方，包括重试，也包括子智能体内部发起的调用。把账本传进 <code>callModel</code>，你才不会有一天发现 20% 的开销是没人算过的重试。`,
          `<strong>要 span，不要计数器。</strong> 一个扁平的计数器只能回答"一共花了多少"，别的什么都答不了。一棵 span 树能回答"哪个子智能体"、"哪个工具"、"哪个阶段"，而且能原封不动地接进 ${ch("c20", "C20")} 的链路追踪，不用返工。`,
          `<strong>归因时必须乘上剩余轮数。</strong> 天真的算法会把 4,000 个 token 记到某个话多的工具头上。真实的归因是 4,000 × 之后重发过它的轮数，而这通常就是"那个工具有点啰嗦"和"那个工具占了账单的 60%"之间的差别。`,
        ]),
    },
  ],

  qa: [
    {
      q: "我该用官方 SDK 还是裸 fetch？",
      a: p(`生产上用 SDK。它会跟进线上格式的变化、处理流式的边角情况，还实现了你本来得自己写一遍的重试。不过先用 <code>fetch</code> 自己写一次，因为 SDK 恰好把这一章讲的东西藏起来了：什么被重发了、停止原因意味着什么、token 都花到哪去了。然后不管你最后用哪个，都把它包进<em>你自己的</em> <code>Model</code> 类型里，这样换服务商或者给测试加个 mock 就是改一个文件的事。`),
    },
    {
      q: "在智能体里，流式值得那份复杂度吗？",
      a: p(`对最终答案，值得。感知延迟就是用户体验的大部分。对中间的推理和工具调用轮次，它基本上是噪音：token 到齐了，然后智能体还是要跑两秒钟的工具。一个好的默认是只对以 <code>end_turn</code> 结束的那一轮做流式，而把工具活动显示成一个个离散事件（"正在搜索…"、"正在读取文件 X"），而不是原始 token。用户是通过智能体的<em>动作</em>理解它的进度的，不是通过它的文笔。`),
    },
    {
      q: "不调 API 的话怎么估 token？",
      a: p(`做预算就用服务商的 token 计数接口。本地估算的话，英文散文用 <code>字符数 / 3.7</code> 还凑合，代码和 JSON 用 <code>字符数 / 3</code>；而这两个在中日韩文字和 base64 上都错得离谱——一张"小"图片可以是好几万个 token。永远不要让估算值去决定一个请求装不装得下；让它决定的应该是要不要去<em>查</em>。`),
    },
    {
      q: "为什么 Usage 里要把 `cacheRead` 和 `cacheWrite` 分开？",
      a: p(`因为写缓存是按<em>溢价</em>计费的（写一次缓存比一个普通输入 token 更贵），而读缓存则有很大折扣。一个不停把缓存冲掉的系统——比如系统提示词里带了个时间戳——表现出来就是 <code>cacheWrite</code> 很高而 <code>cacheRead</code> 接近零。把这两个字段分开，这个毛病一眼就能诊断出来；把它们加在一起，它就彻底隐形了。`),
    },
    {
      q: "我能不能让服务端保存会话状态，而不是每次重发？",
      a: p(`有些 API 提供这个，但它省的是带宽而不是 token——模型仍然要注意力扫过整段历史，所以你还是要为它付钱。更重要的是，它拿走了这门课赖以成立的那个东西：<em>编辑</em>上下文的能力。压缩（${ch("c05", "C05")}）、记忆注入（${ch("c07", "C07")}）、子智能体的上下文隔离（${ch("c17", "C17")}），全都是对一个归你所有的数组做的操作。这个数组要握在自己手里。`),
    },
  ],

  project: {
    title: "项目 · 你自己的模型客户端",
    brief:
      p(`把你接下来整门课都要用的那个 <code>Model</code> 函数写出来。这一章之后的所有内容都会 import 它，所以它值一个小时。一个类型，两套实现：一个真实客户端和一个确定性的 mock。`),
    spec: [
      "导出单一的 <code>Model</code> 类型和两套实现：<code>liveModel(cfg)</code> 和 <code>mockModel(script)</code>，在任何调用点都可以互换。",
      "对 429 和 5xx 用全抖动重试，尊重 <code>retry-after</code>，并且绝不重试 <code>AbortError</code>。",
      "每次调用都返回 <code>usage</code>、<code>stopReason</code> 和 <code>latencyMs</code>，mock 也不例外。",
      "接受一个 <code>AbortSignal</code>，并把它和内部的单次调用超时组合起来。",
      "遇到 <code>max_tokens</code> 时抛出带类型的 <code>TruncatedError</code>，而不是返回那段残缺的文本。",
      "mock 由一个脚本驱动——一个预设响应的数组，或者一个以消息数组为参数的函数——好让各章的测试确定且离线。",
    ],
    stretch: [
      "加一个 <code>Ledger</code>，跨调用累加用量并打印每次运行的成本汇总。",
      "加上 <code>onDelta</code> 流式，并让它解析出和非流式路径完全相同的 <code>ModelResponse</code> 形状；写一个同时跑两条路径并做深比较的测试来证明这一点。",
      "加一个录制型 mock：真实跑一次，把响应快照成 JSON，之后永远回放。这就是你如何为一个随机系统拿到又快、又免费、又确定的测试。",
    ],
  },

  quiz: [
    {
      q: "为什么 `content` 必须是带类型的块数组，而不是一个字符串？",
      options: [
        "一轮 assistant 输出可以同时包含文本和多个工具调用，而结果必须和发起它的那次调用保持配对",
        "字符串不能超过上下文窗口",
        "块结构在网络传输时压缩得更好",
        "API 会拒绝字符串形式的 content",
      ],
      answer: 0,
      why:
        "压平成字符串会摧毁 tool_use 块和它的 tool_result 之间的配对关系，于是并行执行工具没法做，选择性压缩也没法做。现在是一个类型定义，以后是 C03 和 C05 里的一次重写。",
    },
    {
      q: "响应带着 `stopReason: \"max_tokens\"`，而且看起来是个完整的计划。循环该怎么做？",
      options: [
        "把这一轮继续下去，或者大声失败——永远不要当成一个完成了的答案",
        "接受它；模型做完了才会停",
        "用更高的温度重试同一次调用",
        "截断消息历史然后重试",
      ],
      answer: 0,
      why:
        "被截断的响应在语法上和完整响应无法区分——它有文本，也能解析。这恰恰是它必须被显式检查的原因。默默地拿半个计划继续做，是智能体代码里最昂贵的那类无声 bug 之一。",
    },
    {
      q: "对一群正在撞 429 的智能体，哪个重试策略是对的？",
      options: [
        "有 `retry-after` 就听它的，否则用乘了随机因子的指数退避，并且绝不重试 AbortError",
        "立刻重试，最多五次",
        "固定 1 秒起步的指数退避，不加随机化",
        "什么都重试，包括取消，因为取消可能是误触发的",
      ],
      answer: 0,
      why:
        "确定性的退避会把整个机群同步成一波波重试潮，把那场过载重演一遍。全抖动打破这种同步。`retry-after` 胜过你做的任何猜测。而重试 AbortError 意味着客户端在跟自己的时限吵架——用户都取消了，它还在花钱。",
    },
    {
      q: "在一次典型的 12 轮智能体运行里，输入与输出的 token 比大致是什么样，为什么？",
      options: [
        "输入高出一到两个数量级，因为每一轮都要重发整段历史，而每一轮只产出一个简短的决策",
        "大约 1:1，因为每轮读和写的量差不多",
        "输出占大头，因为模型每轮都要写很长的推理",
        "这只取决于模型，和循环的形状无关",
      ],
      answer: 0,
      why:
        "智能体是一种输入 token 型负载，和聊天恰好相反。每一轮都要重发系统提示词、工具 schema 和之前所有的观察，就为了产出可能一百个输出 token。这就是提示词缓存和上下文工程能当成本杠杆的原因，也是一个话多的工具如此昂贵的原因：它的输出会在之后每一轮都被计费。",
    },
    {
      q: "什么会破坏系统提示词上的提示词缓存？",
      options: [
        "插入任何按轮变化的东西，比如时间戳，因为被缓存的前缀必须逐字节相同",
        "把系统提示词写得太长",
        "同时使用工具",
        "把温度设成 0",
      ],
      answer: 0,
      why:
        "缓存匹配的是一段精确前缀。一个时间戳、一个被打乱的工具顺序，或者一个按轮插值的变量，都会让它每次调用都失效——于是你每一轮都在付写缓存的溢价，却永远读不到一次。诊断方法：cacheWrite 很高、cacheRead 接近零，这也正是这两个字段不该相加的原因。",
    },
    {
      q: "为什么整次运行的时限需要组合在运行这一层，而不是做成每次调用的超时？",
      options: [
        "智能体的调用次数是无界的，每一次都能在自己的超时内完成，而整次运行却把所有延迟预算都烧穿了",
        "fetch 不支持每次调用的超时",
        "AbortSignal 每个进程只能创建一次",
        "每次调用的超时会把重试重复计算",
      ],
      answer: 0,
      why:
        "五次调用、每次 30 秒超时，最坏是 150 秒，而且没有任何东西能阻止循环决定再来第六次。时限是任务的属性，所以每次运行一个 AbortController，再用 AbortSignal.any 组合进每一次调用。",
    },
  ],

  continues:
    p(`客户端返回的是一块块文本。你的循环需要的是一个<em>决策</em>——一个它能拿来分支的带类型的值。夹在这两者中间的，是智能体工程里最被低估的可靠性问题：让一个语言模型每一次都吐出解析器肯收的东西，包括它决定把 JSON 裹在一句道歉里的那一次。${ch("c02", "C02")} 会把它正经解决掉。`),
};

export default chapter;
