> 2026-11-18，Claude Code（Claude Opus 5.5）在 Jacky Yao 的指导下起草。决定已确认：部件库拼题；三档难度按推理步数加房间划分。部件内容是草稿，请团队复核。

# 题目生成器：从部件库拼题

> **状态（第 67 轮，2026-11-18）**：第 1–3 步已实现。15 个部件生成 **45 道题：Easy 26、Medium 7、Hard 12**。直接提问探针显示 0/45 道题能被直接问题解开（改之前是 2/8）。和下面的设计相比有两处调整：
> - **跳数按实测**：`street_tv`、`dog_before_moon`、`first_door` 一个直接问题就能拿到答案，所以记为 0 跳。现在有测试保证"标了跳数的部件在任何组合里都不会被直接问题解开"。
> - **Medium 定义为"必须用房间"**：Easy 不用房间，Medium 至少有一个答案只在房间里，Hard 要有 3 跳的年份。目前只有门牌号（412）是"只在房间里"的部件，所以 Medium 只有 7 道。**下一步最值得做的是再写几个需要房间的部件**，见文末。

## 目标

- 去掉 8 道手写的整题。每次访问时，从 Grandma 的**部件库**里按档位抽部件，拼成一道题。
- 难度统一为 **Easy / Medium / Hard 三档**，由部件的推理步数和"是否必须用房间"决定。
- 生成的每道题都要满足现有的公平性要求：可解、不泄露、至少一跳、直接提问解不开。这些要求由测试**遍历所有组合**来保证，不靠运行时运气。

## 核心思路：生成结果仍是一个 Recipe

现在引擎、服务器、离线 Grandma、验证器、话题卡、链路测试都围绕 `Recipe`（槽位、`separate`、隐藏年份、提示、`note_facts`）工作。生成器的输出**仍然是一个标准的 Recipe 对象**，所以下游代码几乎不用改，风险最小。

```
部件库 (world.parts)  ──按档位和种子抽取──▶  composeRecipe()  ──▶  Recipe（和现在同一个 schema）
                                              │
                                              └─ 兼容性检查：不共用事实、不冲突的隐藏年份、合计分数落在档位内
```

## 部件（Part）的数据结构

一个部件就是便条上的一行，加上它的全部谜题数据。从现有 8 道题的 16 个槽位拆出来，去掉重复后约 15 个，以后可以继续添加。

```jsonc
{
  "id": "p_sock_thief",
  "kind": "word",                 // word：名字、地点、鸟名 | number：年份、门牌
  "line": "the sock thief",       // 便条上的这一行
  "smudged": "the ████ thief",    // 可选：需要老花镜才看得清的版本（Medium/Hard 用）
  "slot": { "fact_id": "f_dog1", "field": "object", "transform": "capitalize" },
  "requires_anchor": null,        // 年份要绕一步时填 anchor（Grandma 看不到这个年份）
  "hops": 1,                      // 推理步数：0 直接给出 · 1 · 2 · 3
  "needs_room": false,            // true：至少一步只有房间里的物品能给出
  "decoys": ["f_dog2"],           // 需要排除的近似答案
  "note_facts": ["f_dog1_ptr"],   // 点这一行的话题卡时讲的记忆
  "separate": [["f_dog1", "f_dog1_home"]],
  "nudge": "That rascal is in the album somewhere, chewing on something.",
  "rules": ["first letter capital"]
}
```

## 三档难度（按推理步数加房间）

每个部件的分数 = `hops`，`needs_room` 再加 1。

| 档位 | 部件数 | 合计分数 | 其他要求 | 例子 |
|---|---|---|---|---|
| **Easy** | 2 | 1–2 | 每个部件 ≤ 1 跳 | the sock thief + the year we said "I do" |
| **Medium** | 2 | 3–4 | 至少一个 `needs_room` 部件，并且有诱饵要排除 | the street we lived on the year we got the color TV + the number Grandpa painted crooked |
| **Hard** | 2 + 符号后缀 | ≥ 5 | 至少一个 3 跳部件，一行需要老花镜才能看清 | the bird Grandpa named me after + year of the big snowstorm + ! |

par（星级标准）先按档位定，等 AI 玩家实测出中位数后再调整。

## 组合规则（composeRecipe）

1. **格式**：一个 word 部件加一个 number 部件。这和现在一致，路由器的逐格反馈也照旧。
2. **不冲突**：
   - 两个部件不能共用答案事实，也不能有同一个答案实体。比如不能两个部件都是 Biscuit。
   - 一个部件隐藏的年份，不能是另一个部件的答案，也不能出现在另一个部件链路上会被 Grandma 直接说出的地方。
3. **自动合成跨部件的 `separate`**：两个部件的答案事实放进同一组，保证一句话不会同时给出两部分。
4. **便条文字**：`line1 + line2`，Hard 再加 ` + !`。Medium 和 Hard 中有 `smudged` 版本的那一行会被抹掉一部分，需要老花镜才能看清。
5. **确定性 ID**：比如 `g:medium:p_street_tv+p_painted_number`。存档、刷新后继续、每日题、日志都用这个 ID，`recipeById` 能从 ID 原样重建这道题。
6. **抽题**：
   - 普通访问：在该档位的合法组合里随机抽，不重复刚玩过的那道。
   - 每日题：用日期作种子，轮流排 Easy、Medium、Hard。

## 公平性保证（测试遍历全部组合）

现有的检查对每个**合法组合**都跑一遍：

- `checkWorld`：答案能重算，隐藏年份不出现在任何文本里；
- 链路测试：不能有一句回答跨过一跳；
- 公平性机器人：只用话题卡就能解开；
- 直接提问探针：Medium/Hard 的任何一格都不能被一个直接问题完整给出；
- 新测试：`needs_room` 部件不看物品就解不开。

15 个部件大约能组成 50–60 道合法题，测试几秒就能跑完。新增部件时，不合格的组合会在测试里直接报出来。

## 新机制：看到才想起来（`needs_room`）

Medium 要求"至少一格必须用房间"，所以需要加入评审阶段 2 的机制：

- 在事实上标记 `revealed_by: ["photo_album"]`。在玩家看过或给她看过对应物品之前，Grandma（模型和离线版）都只会说一个模糊的指向，比如"有张照片的……在相册里吧？"，不会说出关键内容。
- 实现方式：在代码里把这条事实从她的记忆列表中暂时移除，换成一条指向句。规则在代码里，模型只负责措辞。

## 部件库初版（从现有题拆出，草稿）

跳数按离线探针实测：一个直接问题就能拿到答案的记为 0。可以看出现有的名字类部件几乎都是 0 跳，这正是题目太浅的原因。第 3 步加上 `needs_room` 之后，需要把其中几个改成必须先看物品。

| 部件 | 类型 | 答案 | 跳数 | 房间 | 诱饵 |
|---|---|---|---|---|---|
| the sock thief | word | Biscuit | 0 | 相册 | Buttons |
| where we spent our honeymoon | word | Niagara | 0 | 结婚照 | Presque Isle |
| my favorite dog | word | Buttons | 0 | 相册 | Biscuit |
| the friend I bowl with every Tuesday | word | Marge | 0 | 奖杯 | — |
| the bird Grandpa named me after | word | Sparrow | 0 | 结婚照背面 | — |
| the street we lived on the year we got the color TV | word | Maple | 2 | 月球纪念盘、相册 | Cherry |
| the dog we got the year before the men walked on the moon | word | Buttons | 2 | 月球纪念盘 | Biscuit |
| the year we said "I do" | number | 1961 | 1 | 结婚照背面 | 1960 |
| the year your mom was born | number | 1963 | 1 | 相册 | 1964、1966 |
| the year I won the blue ribbon | number | 1972 | 1 | 蓝丝带 | 1958、1970 |
| the year your grandpa lost three dollars at the fair | number | 1958 | 1 | 蓝丝带 | 1972 |
| the number Grandpa painted crooked | number | 412 | 0 | 门牌、相册 | 27 |
| the number on the door of our first home | number | 27 | 1 | 相册 | 412 |
| year of the big snowstorm | number | 1977 | 3 | 雪橇、出生通知 | 1976、1978 |
| the year my first dog came home | number | 1949 | 3 | 相册 | — |

之后新增的部件，比如"她记错、由证据纠正"、排除法、排时间顺序（评审阶段 3），都作为新部件加入，不需要改生成器。

## 受影响的地方

| 地方 | 改动 |
|---|---|
| `data/grandmas/rosie.json` | `recipes` 改为 `parts`，`rosie.chains.md` 改成按部件写链路图 |
| `packages/engine` | 新增 `compose.ts`（组合规则、合法组合枚举、种子抽题）；`recipeById` 支持生成 ID；`checkWorld` 检查部件；`daily.ts` 用生成的题；新增 `revealed_by` |
| `apps/server` | 创建访问时按档位生成；`recipeId` 存生成 ID；旧存档里的 `r_easy` 等 ID 映射到对应部件组合 |
| `apps/web` | "Choose a sticky note"（8 张便条）改成三个档位按钮，最佳星级按档位记录；旧的每题星级合并到对应档位 |
| `eval` | 问题库本来就按事实写，不用改；探针、评测、AI 玩家改为在全部合法组合（或每档的固定样本）上跑 |
| 测试和文档 | 遍历全部组合的公平性测试；README、docs/01、chains 图更新 |

## 分步实施

1. **生成器核心**：Part schema、`composeRecipe`、组合枚举、确定性 ID，把 16 个槽位迁移成部件。验收：生成结果和原来 8 道题的 password、`separate` 一致；全部组合通过 `checkWorld` 和链路测试。
2. **接入游戏**：服务器按档位抽题，每日题，旧存档映射；前端改成三档选择和三档星级。验收：浏览器里三档各玩一局，刷新后能继续。
3. **`needs_room` 机制**：加上 `revealed_by`，给 Medium/Hard 部件标上。验收：新测试证明不看物品解不开；全部组合通过公平性机器人；探针结果 0 道题能被直接提问解开。
4. **评测和文档**：探针和 AI 玩家改为按组合运行；按实测结果定 par；更新文档。

每一步结束都跑一遍 typecheck、全部测试、validate、golden 和 probe。

## 下一步：给 Medium 加部件（草稿想法，需团队决定）

Medium 现在只有门牌号一个"只在房间里"的部件，所以只有 7 道题。可以考虑的新部件（多数需要给房间加物品或文字）：

- **保龄球最高分**（212）：Grandma 只记得"两百多"，奖杯铭牌上写着 212。现成物品就能用，但 0 跳 + 房间 = 1 分，需要和 1 跳的年份配对。
- **结婚照背面的另一行字**：比如 Grandpa 写的日期只剩一半，另一半在相册里。
- **冰箱上的购物清单 / 食谱卡**：她不记得某个配料的名字，卡片上有。
- **"她记错、由证据纠正"类部件**（评审阶段 3）：她坚持一个错误的年份，房间里的证据纠正她。数据里明确标出这是固定的"记错"，属于既定事实，不是模型编的。

新增部件之后，测试会自动遍历所有新组合，检查公平性、泄露和跳数。

