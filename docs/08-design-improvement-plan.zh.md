> Drafted with Claude Code (Claude Opus 5.5) under Jacky Yao's direction, 2026-11-16, from a review of the design docs, the project skill references, the current build and published game-design sources. Items marked 【团队决定】 are proposals for the team to approve.

# Grandma's Wi-Fi Password：专业游戏设计改进方案

## Context（为什么做）

前 41 轮迭代把工程质量做扎实了：安全、输入、可访问性的底线都已过线，测试 162 个全绿。但从**游戏设计**角度看，这仍是一个"功能完整、体验未打磨"的版本：

- 唯一的设计评分停在 2026-11-12，平均 3.5/10，未达标（及格线：均分 ≥ 6、单项 ≥ 4）。之后修了很多，但**没人重新打过分**。
- 没有真人玩过，真实 LLM Grandma 也从没跑过。

**目标（已确认）**：课程期末演示 + 一个公开可玩的链接。谜题内容和规则的改动只作为**提案**，由团队批准后才动。

**方法**：对照三类标准逐条检查：
1. 项目自己的 GDD 支柱和 `llm-deduction-game-dev` 技能的质量底线与 10 维评分表；
2. 业界做法：三线索原则、《金色偶像案》《奥伯拉丁的回归》《星际拓荒》、1001 Nights / Suck Up! 等 LLM 角色游戏复盘、Wordle 系每日题、Swink《游戏手感》、GAG / XAG 无障碍指南、Golden Idol 的静默试玩法、Poki 和 itch.io 的上架指南；
3. 当前版本的内容清单。

---

## 一、诊断：当前版本对照支柱的主要差距

| # | 差距 | 证据 | 违反的原则 |
|---|---|---|---|
| D1 | **重玩性几乎为零** | 每个难度只有 1 个配方，同难度每次都是同一个密码。每日池只有 3 题，3 天一循环。 | Wordle 系"每天一题、人人相同"要求题池够大 |
| D2 | **物品直接给出答案，跳过推理** | 婚礼照片背面直接写 "June 1961"、"My Sparrow"；门牌直接写 "412"。离线版 Easy 2 问就能解，而评测目标是 4–10 问。 | 支柱"推理而非照抄"；Golden Idol 会删掉能跳步的线索 |
| D3 | **线索路线不足 3 条，诱饵无法排除** | Medium 第 2 跳（1969 年住哪）只能问 Grandma。房间里没有任何物品能用来排除 Cherry St / 27 / Buttons / 1960 这些诱饵。 | 三线索原则；诱饵必须能被找到的线索排除 |
| D4 | **空白输入框** | 没有建议问题，看完物品后也没有"问问这个"按钮。 | Emily Short、Yonder 复盘：开放文本框需要先给玩家起个头 |
| D5 | **进展看不见** | 笔记本只是事实列表，看不出"街名：?（已找到 2 条线索）"。 | 《星际拓荒》的飞船日志：用"已知/听说/未知"展示进展 |
| D6 | **错误反馈信息量低** | 猜错只说"2 部分里对了 1 个"，不说是哪一个。 | Golden Idol 的部分确认；Framed 每次猜错都给新信息 |
| D7 | **开场以文字为主** | 标题页有 3 段文字 + 10 个按键说明；没有"一键开玩"；茶的规则从未在玩的过程中教。 | Poki"几秒内开玩"；GAG 的互动式教学 |
| D8 | **UI 不在场景里，角色反应少** | 茶量是 HUD 进度条，不是桌上会变空的茶杯；玩家查看物品时 Grandma 没有反应；说话时镜头不会对准她。 | 场景内 UI；"世界喂养对话" |
| D9 | **没有音乐，音量不能分开调** | 只有合成音效；没有音乐、kettle、提示音层；只有一个静音键。 | GDD §8.2；GAG 基础项：分轨音量 |
| D10 | **真实 LLM 体验未验证** | 没有流式输出（N11），首字延迟未测，评测没跑过。 | 业界首字延迟约 1 秒；评测计划要求 p50 < 1.2 s |
| D11 | **没有数据漏斗** | 不知道玩家卡在哪一步。 | 埋点漏斗；"玩家怎么做"比"玩家怎么说"更可信 |
| D12 | **还没上线，也没有展示物料** | 没有部署、itch 页面、GIF 或预告片。CSP 的 `frame-ancestors 'none'` 会挡住 itch 的 iframe 嵌入。 | itch / Steam 上架做法："首图就是玩法" |

**粗估分数**（按代码阅读，需真人重评）：推理深度约 4、世界即证据约 4、角色约 6、对话约 5（离线版）、公平与反馈约 6、操作约 7、新手引导约 5、视觉约 6、音频约 3、稳健约 8。最弱的是**推理深度、世界即证据、音频、新手引导**。

---

## 二、方案总览

按"演示价值 ÷ 工作量"排序。标【团队决定】的是内容或规则提案，要先由你们批准。每个阶段都写明退出检查。

### 阶段 A：开场十分钟（新手引导 + 空白框 + 反馈）。规模 M，**最优先**

目标：新玩家在 60 秒内问出第一个问题，全程不需要读说明。

1. **一键开玩**：标题页主按钮"Visit Grandma"默认进 Easy；第一次来的玩家不显示难度说明长句。按键说明改成情境提示：到 Grandma 身边才提示 Enter，看向物品才提示 E。
   - 改：`apps/web/src/App.tsx`（TitleScreen）、`data/i18n/en.json`、`Hud.tsx`（Crosshair / look-hint）。
2. **建议问题条**：输入框上方放 2–3 个会消失的建议问题。
   - 来源：便条上的关键词（"sock thief?"）、刚看过的物品（"Ask about the old sled"）、卡住时的提示方向。
   - 只是预填文字，玩家仍需按发送，所以不会把答案说穿。
   - 改：`Hud.tsx`（AskBar）、新文件 `apps/web/src/suggest.ts`（纯函数 + 测试）。复用 `notebook.ts` 的关键词提取。
3. **看完物品后"问问她"**：物品卡上加一个按钮"Ask Grandma about this"，会把物品带过去展示（复用现有 `showCarried` 流程）。
4. **情境教学，一次只教一件事**：
   - 茶第一次下降时提示"每个问题会喝掉她的茶"；
   - 第一次有追问折扣时提示"顺着她的话追问更省茶"；
   - 第一次打盹时提示"她会睡一会儿"。
   - 每条提示只出现一次，记在 `storage.ts`。改：`store.ts`、`Hud.tsx`（HintToast）。
5. **部分确认更具体**【团队决定】：
   - 现状："2 部分里对了 1 个"。
   - 提案：Easy/Medium 标出具体哪一格对、哪一格错（格子变绿/红）；Hard 保持只给数量。
   - 改：`packages/engine/src/run.ts` 的 `checkGuessParts` 返回逐格结果；`RouterCard`。

**退出检查**：
- 用 3 个从没玩过的人做静默观察，记录"首问时间"和是否读了说明；
- 单元测试覆盖建议生成；
- 漏斗埋点（阶段 E）显示首问中位数 < 60 s。

### 阶段 B：推理深度与公平（谜题内容）。规模 M，全部【团队决定】

目标：每个答案格至少 1 跳；每个事实至少 3 条路线（至少 1 条在房间里）；最常见的 10 个直白问题都拿不到完整答案格。

1. **物品只给一跳，不给答案**：
   - 婚礼照片背面："June 1961" → "Our wedding day, the June after Walt's Christmas proposal"（需要再问求婚年份 1960 → 1961）；
   - "My Sparrow" 改到别处或去掉；
   - 门牌改成"crooked numbers, the middle one half peeled"，需要问爷爷画的是什么，或者结合照片。
   - 改：`data/scenes/rosie-living-room.json`、`rosie.chains.md`。用现有的 `validate` 和走查测试保证仍然可解。
2. **三线索矩阵**：在 `rosie.chains.md` 为每个答案格列出 Grandma / 物品 / 故事三类路线。
   - 补 Medium 第 2 跳的房间线索：比如相册里一张"1969 年 Maple Ave 门廊前看登月"的照片。
   - 加一个测试：每格至少有 1 个房间物品携带链上事实（扩展 `engine.test.ts` 的链路测试，复用 `progressFacts` / `chainFacts`）。
3. **诱饵可被排除**：给 Cherry St / 27 加一个能排除它们的证据，比如相册里"1961–1964 Cherry St apartment"的照片，时间对不上 1969。
4. **老花镜有意义**：
   - Medium 的污渍改为遮住关键信息，比如"the █████ we lived on"；
   - Hard 也加一处污渍。
   - 改：`rosie.json` 的配方 `format`、`noteText`。
5. **"十个直白问题"自动测试**：每个难度写 10 个最直白的问题，跑离线版，断言没有一个回答同时给出整格答案。加到 `apps/server/test/api.test.ts` 的走查区。

**退出检查**：
- 离线版走查的问题数落在评测目标里：Easy 4–10、Medium 6–14、Hard 8–18；
- `npm run validate`、黄金对话、走查测试全部通过；
- 没有任何难度能"不走动就解出"（脚本断言至少要查看 1 个物品）。

### 阶段 C：角色、手感与音频。规模 M

目标：静音时也能读出她的情绪；每个动作 100 ms 内有反馈；有音乐和事件提示音。

1. **场景内的茶杯**：边桌上的茶杯水位跟着茶量变（Grandma.tsx 里已有 teacup 跟随茶量，要确认在玩家视角里看得见）。茶到 30% 时她打哈欠。HUD 进度条保留，作为文字的等价信息。
2. **对物品的即时小反应**：玩家查看或拿起物品时，Grandma 说一句短 bark。
   - 例："Careful with that trophy, sweetheart."
   - 每个物品 2–3 句，存在 `en.json`，不调模型，不花茶。
   - 改：`store.ts` 的 `openPanel` / `take`，新增台词库。
3. **说话时镜头缓推，对准她的脸**（可关，尊重减少动效设置）。改：`Player.tsx`。
4. **音乐与提示音**：
   - 标题曲 + 房间里的低音量循环（CC0 曲目，或用 WebAudio 合成 ragtime 风格的简单循环）；
   - 新事实、钉选、答对时各一个短提示音；
   - kettle 环境音。
   - 改：`audio.ts`、`CREDITS.md`。
5. **分轨音量**：音乐 / 音效 / 语音三个滑杆。改：`settings.ts`、`Settings.tsx`。
6. **按键重映射**（GAG 基础项）：至少支持 WASD/E/Q/Tab/V 换键。改：`Player.tsx`、`settings.ts`。
7. **高对比度模式**（XAG 102）：一个开关，加深面板、加粗文字。

**退出检查**：
- 静音情绪测试：5 人里 4 人能说出她的情绪；
- 两位评审重评第 8、9 维（视觉、音频）≥ 6。

### 阶段 D：重玩与每日题。规模 M，内容部分【团队决定】

目标：每日题池 ≥ 9，至少一周内不重复；普通游玩每次换题。

1. **每难度 3–4 个配方**【团队决定】：用 Rosie 现有的 38 个事实组合新配方，比如 Easy："the first dog's name + the year we met"。每个配方要配套写链路图、诱饵、提示。
   - 改：`rosie.json`、`rosie.chains.md`。
   - 服务端选题：`apps/server/src/app.ts` 第 266 行附近改成在该难度的配方里随机选（按 run id 做种子）。
   - `dailyPick` 自动纳入新配方。
2. **（可选）第二位 Grandma**【团队决定】：规模 L。GDD 的课程下限是 4 位，但演示只要 Rosie 足够有深度即可。建议放到演示之后。
3. **宽容的连胜**：只玩练习局不会断连胜；未来可加"冻结一天"。改：`apps/web/src/daily.ts`。
4. **每日题结束后提供练习入口**："Try another visit"直接开一个同难度的不同配方。

**退出检查**：
- 测试断言连续 9 天的每日题互不相同；
- 同难度连开 5 局至少出现 2 种配方。

### 阶段 E：真实 Grandma、评测与试玩。规模 M，需要课程 API 密钥

1. **流式输出**（N11）：服务端用 SSE 推送，前端逐字显示（复用 `TypingText`），思考姿势保留。目标首字 p50 < 1.2 s。
   - 改：`apps/server/src/grandma.ts`、`app.ts`、`apps/web/src/api.ts`。
   - 验证器在完整回复之后才运行，所以流式需要"先缓冲到验证通过再放出"，或者"流式显示 + 失败时替换"。建议前者加思考动画，比较简单安全。
2. **跑一遍评测**：`npm run eval -- --brain llm --yes`、攻击集、裁判校准。拿到真实的泄露率、矛盾率、延迟、成本。
3. **漏斗埋点**（只存聚合数据，不存玩家原文）：
   - 事件：载入 → 首问 → 首次查看物品 → 首次钉选 → 首次打盹 → 第 1/2/3 次猜 → 解出/放弃 → 分享。
   - 每个线索的发现率。
   - 改：`apps/server/src/store.ts` 的 TurnLog 增加事件类型；`eval/src/playstats.ts` 输出漏斗。
4. **两轮静默试玩**（Golden Idol 法）：每轮 5 位新人，录屏，只观察不说话。
   - 记录：解出率、问题数、首问时间、卡住点、笑点、"什么时候觉得自己很聪明"。
   - 第一轮后修改，第二轮验证。协议沿用 `docs/04-evaluation-plan.md` §6。

**退出检查**：
- 评测计划 §2 的指标有真实数字；
- 试玩解出率接近 90% / 70% / 45%（Easy / Medium / Hard）；
- 有人愿意再玩的比例 ≥ 70%。

### 阶段 F：发布与展示。规模 S–M

1. **部署到 Fly**（`fly deploy --ha=false`，见 README），配真实密钥和每日预算。
2. **itch.io 页面**：
   - 页面直接链接到 Fly 版本，或者用 iframe 嵌入。
   - 若嵌入，需要把 CSP 的 `frame-ancestors` 放宽到 `https://itch.io https://*.itch.zone`（`apps/server/src/app.ts` 的 secureHeaders），并更新对应测试。
   - 页面内容：封面 GIF（便条 → 提问 → 好笑的回答 → 线索亮起）、3–5 张实机截图、无障碍功能列表、"AI 生成内容"说明。
3. **45 秒预告片**：5 秒内就开始玩法，不放 logo 淡入。用"锚点 + 卖点"一句话介绍，比如"像 Wordle 一样的每日推理，但你在套 AI 奶奶的话"。
4. **演示脚本**：3 分钟现场流程：Daily → 两问 → 物品 → 猜错一次看部分反馈 → 解出 → 分享卡。另备一份离线版降级方案（无网络也能演示）。

**退出检查**：
- 公开链接在一台新电脑的 Chrome / Edge / Firefox 上能从头玩到尾；
- itch 页面审核清单逐项打勾。

---

## 三、建议顺序与取舍

1. **A（开场十分钟）+ C1–C5（手感、音频）**：不改谜题，马上能做，演示提升最大。
2. **B + D1（谜题内容）**：等团队批准提案后做。B 和 D1 一起设计，新配方从一开始就按三线索原则写。
3. **E**：拿到课程密钥就做；试玩可以先用离线版跑第一轮。
4. **F**：演示前一周。
5. **暂不做**：第二位 Grandma、关系网 / 解锁进度、Expert 难度、服务端语音识别、助听器道具、Steam 版。这些都超出"课程演示 + 公开链接"的范围。

## 四、需要团队拍板的提案清单

- B1 物品文字改为只给一跳（婚礼照片、门牌、"My Sparrow"）
- B2–B3 新增房间线索：1969 年门廊照片、Cherry St 时间照片
- B4 老花镜：新的污渍位置
- A5 Easy/Medium 逐格对错反馈
- D1 每个难度新增 2–3 个配方（附草稿后再定）
- C4 音乐风格：ragtime / lo-fi / 无音乐
- F2 是否用 itch 嵌入（影响 CSP）

## 五、验证方式（整体）

- **每个阶段**：`npm run typecheck`、`npm test`、`npm run validate`、`npm run eval:golden`、`npm run build`；界面改动在浏览器预览里实测并截图。
- **设计重评**：阶段 A+C 完成后，按 `review-rubric.md` 的 10 维重新打分，写入 `docs/`；目标均分 ≥ 6、单项 ≥ 4、无 P0。
- **真人**：阶段 E 两轮试玩，数据由 `npm run stats` 汇总。
- **上线**：阶段 F 的新电脑端到端检查。

## 六、关键文件

- 内容：`data/grandmas/rosie.json`、`data/grandmas/rosie.chains.md`、`data/scenes/rosie-living-room.json`、`data/i18n/en.json`
- 规则：`packages/engine/src/run.ts`（`checkGuessParts`、`stallNudge`）、`packages/engine/src/world.ts`（`chainFacts`、`progressFacts`）、`packages/engine/src/daily.ts`
- 前端：`apps/web/src/App.tsx`、`apps/web/src/ui/Hud.tsx`、`apps/web/src/store.ts`、`apps/web/src/notebook.ts`、`apps/web/src/audio.ts`、`apps/web/src/settings.ts`、`apps/web/src/scene/Grandma.tsx`、`apps/web/src/scene/Player.tsx`
- 服务端与评测：`apps/server/src/app.ts`、`apps/server/src/grandma.ts`、`apps/server/src/store.ts`、`eval/src/playstats.ts`
- 设计依据：`.claude/skills/llm-deduction-game-dev/references/*.md`、`docs/01-game-design.md`、`docs/04-evaluation-plan.md`

---

## 进度（2026-11-16）

- 第 42 轮已完成：A1–A4、C1–C7。
- 第 43 轮已完成（应 Jacky 要求，内容为草稿，待团队审阅）：A5 逐格对错；B1–B5 物品只给一跳、诱饵可排除、老花镜有用、相关测试；D1、D3、D4 新增 5 个配方（共 8 个）、随机选题、“再来一题”、宽容连胜；E3 漏斗埋点与统计；F 的准备工作（EMBED_ORIGINS、演示脚本、itch 页面草稿、发布清单，见 `docs/09-demo-and-launch-kit.md`）。
- 仍待条件：E1/E2（课程密钥）、F 的实际部署和发布（团队账号与许可）、真人试玩。
- 不做：第二位 Grandma（D2）、Expert 难度等，见第三节。
- 第 44 轮：完成第五节的"设计重评"。由独立评审代理离线打分，9 个维度均分约 5.9，未达 6 分及格线，没有 P0。详见 `docs/10-design-rescore.md`。已修复 F1 和 F3–F7、F10、F11（路由器接受全名；离线 Grandma 的检索），以及建议问题的人称。F2、F8、F9 涉及谜题内容，待团队决定。
