> 由 Claude Code（Claude Opus 5.5）在 Jacky Yao 的指导下起草，2026-11-17（第 49 轮）。观察来自开发版在浏览器里的截图；业界做法来自一次网络调研，每条都附了来源。

**进度（第 51 轮）：** 第 1–5 步已完成，见第六、七节。第 6 步（姿势网格回归测试）只做了一部分，第 7 步（换现成坐姿）没做。

# Grandma 穿模：观察、原因与优化方案

## 一、现在穿在哪里（第 49 轮截图）

| # | 位置 | 现象 | 怎么看到的 |
|---|---|---|---|
| C1 | 两只手 | 两只手放在腿上时互相穿过，左手手指插进右手掌。 | 正面近看 |
| C2 | 茶杯 | 杯子浮在右手拇指一侧，没有落在掌心里。 | 正面近看 |
| C3 | 左臂与扶手 | 从侧面看，她的左上臂和手肘埋进了扶手里。 | 侧面 |
| C4 | 毯子与腿 | 毯子窄，两侧露出裙子和大腿。毯子是静态网格，腿一动就会和它互相穿。 | 正面俯视 |
| C5 | 喝茶动作 | 喝茶时手和杯子可能穿过脸或眼镜。代码里没有任何限制。 | **未验证**（预览窗格限帧，没截到动作中段） |
| C6 | 头发与领口 | 她转头看玩家时，头发可能插进开衫领口。 | **未验证** |
| C7 | 开衫与身体 | 开衫是身体网格沿法线外推 1.4 cm 得到的。腋下、肘弯这些地方外推会塌陷，身体就会从开衫里露出来。 | 读代码推断，截图里不明显 |

## 二、根本原因

1. **坐姿是"朝哪个方向指"，不知道椅子在哪。** `Grandma.tsx` 用 `aim(骨骼, 子骨骼, 方向)` 摆出坐姿，所有方向都是手写常数。椅子的扶手和坐垫在哪里，代码完全不知道。
2. **椅子模型是被拉伸塞进碰撞盒的。** KayKit 扶手椅用 `fit: "stretch"` 拉到 1.0×1.15×1.06 m，扶手的真实高度和宽度随拉伸变化。她的位置是手调的偏移量（`position={[0, -h/2+0.1, -0.1]}`）。
3. **毯子只用髋、膝 4 个点生成**，不贴着摆好姿势后的腿。
4. **杯子是挂在手骨上的刚体**，位置是"手腕到指根连线的 55% 处、往上 4 cm"，不是真正落在掌心里。
5. **没有任何动作范围限制，也没有自动检查。** 喝茶、手势、转头、点头这些动作叠加时，没有东西能发现"穿了"。

## 三、别人怎么做（调研摘要）

| 做法 | 谁在用 | 对我们的成本 | 对我们的用处 |
|---|---|---|---|
| **把衣服下面的身体藏掉**：删掉三角形，或用遮罩丢弃像素 | 《极乐迪斯科》每件衣服一张遮挡图，叠乘后用作透明裁剪 [1]；Reallusion "Auto Hide" [2]；Unreal Mutable "Remove Unseen" [3]；Ready Player Me 的服装指南 [4] | 很低，纯代码 | 开衫本来就是从身体三角形复制出来的，所以知道它盖住了哪些身体三角形，直接不画就行。毯子下面的大腿同理。可以解决 C7，也能缓解 C4。 |
| **衣服和身体用同一套骨骼权重**（权重转移、外推壳、Roblox 的内外笼） | Blender Data Transfer [5]；Roblox 分层服装 [6] | 我们已经在用 | 开衫的权重和身体完全一样，是最理想的情况。剩下的问题是腋下、肘弯外推后塌陷，配合上一条就看不见了 [7]。 |
| **姿势空间修正形状**（corrective shape keys / PSD） | Unreal Pose Driver [8]；Blender 修正形状键 [9] | 高，需要会雕刻 | **不做。** |
| **坐姿贴合家具**：家具上放挂点，把手和肘对准目标，用双骨 IK 求解 | Unreal Smart Object + Motion Warping [10]；Unity Two Bone IK [11] | 中 | 臀部落座、前臂搭扶手、双手放膝上，都改成"从目标点反推"，不再手写方向。可以解决 C1、C2、C3。 |
| **现成坐姿动画** | Quaternius 的 CC0 "Universal Animation Library" 里有 sitting，官方页面说和我们用的身体兼容 [12][13] | 中，需要下载新素材 | 用同一套骨骼的现成坐姿，替换手写的 `aim()` 坐姿。注意别的骨骼套用这类坐姿时出过问题 [14]，同一套骨骼应该没事。 |
| **关节限制** | Unity `SetLookAtWeight` 的 clamp [15]；Godot `LookAtModifier3D` 越靠近极限阻力越大 [16]；VRM 转头约 ±50°，颈、头按 0.2 : 0.8 分摊 [17]；three.js CCDIKSolver 支持每个关节设最小、最大角 [18] | 低 | 给转头、点头、歪头、手势混合都设上限，靠近上限时平滑减速。可以解决 C6，也能缓解 C5。 |
| **自动穿插检查** | three.js `SkinnedMesh.getVertexPosition` 能算出动画后的顶点位置 [19]；three-mesh-bvh 可以把蒙皮网格烘成静态网格，再做最近点查询 [20] | 低到中，约 100 行 | 写一个"姿势网格"测试，任何一处穿进超过 3 mm 就算失败。没有现成的库。 |
| **低多边形的取巧** | 衣服和身体做成一个网格 [21]；看不见的身体不要 [22] | 很低 | 我们 0.6 倍像素渲染，1 个屏幕像素以内的穿插玩家看不出来。镜头构图也可以避开扶手外沿。 |

## 四、方案（便宜、见效大的排前面）

### 第 1 步：藏住衣服下的身体（解决 C7，缓解 C4）。规模 S
- 在 `dress()` 里，开衫覆盖的身体三角形（region 1）从身体的索引里去掉，只画开衫。
- 毯子永远盖住的大腿上部三角形也不画。
- **验证：** 加一个开发开关，把被藏的三角形染成洋红；分别在 4 个手臂快照下截肩和肘。

### 第 2 步：动作上限（解决 C6，缓解 C5）。规模 S
- 转头 ±45°，靠近上限时平滑减速。颈和头按 0.3 : 0.7 分摊，现在全加在颈上。
- 点头、歪头分别设上限。
- 手势混合权重最高 0.85。
- **验证：** 一个测试把每个控制量推到最小和最大，断言骨骼角度没有超出上限。

### 第 3 步：坐姿从目标点反推（解决 C1、C2、C3）。规模 M
- **落座：** 摆好姿势后，找大腿和臀部最低的蒙皮顶点，把她整体放到"椅面顶 + 3 mm"。椅面高度从椅子模型的包围盒读，不再用手调常数。
- **双手：** 给左右手各一个落点（膝上，左右分开 8 cm，不再交叠），用双骨 IK（上臂、前臂）求肘角。肘的朝向提示朝外下方，避免肘埋进扶手。
- **扶手：** 读扶手内侧面的位置，限制上臂离身体的距离，让手肘贴着扶手内侧而不进去。
- **茶杯：** 杯底对准掌心中点（手掌三个指根和手腕的平均位置，沿掌心法线抬起杯底半径），而不是按比例估计。
- **验证：** 自动断言大腿最低点在椅面以上 0–5 mm、前臂没有一个顶点在扶手里、两手之间至少 2 cm。

### 第 4 步：毯子跟着腿生成（解决 C4）。规模 S
- 用摆好姿势后大腿和小腿的蒙皮顶点生成毯子，向外偏 1.5 cm，宽度盖到大腿外侧。
- 配合第 1 步，把盖住的腿藏掉。
- **验证：** 用 BVH 查距离，没有一个腿部顶点离毯子近于偏移量。

### 第 5 步：喝茶的禁区球（解决 C5）。规模 S
- 在头和眼镜周围放一个禁区球，手和杯子的目标点被推到球外。
- 杯子靠倾斜送到嘴边，不靠手往脸里伸。
- **验证：** 喝茶动作的混合系数从 0 到 1 每隔 0.1 采样，检查杯子的包围球和手部顶点都在禁区球外。

### 第 6 步：姿势网格回归测试。规模 M
- 组合扫一遍：转头（−上限、0、+上限）、点头和歪头的极值、每对手臂快照在 t = 0、0.25、0.5、0.75、1、呼吸的最大和最小。
- 任何穿插超过 3 mm 就失败，并把最差的 5 个姿势截成一张图给人看。
- 这一步的价值在于：以后换模型、换动作、调参数，都能知道有没有穿。

### 第 7 步（可选）：换成 Quaternius 现成坐姿。规模 M，**需要你同意下载**
- 文件：Quaternius "Universal Animation Library"（CC0），来源 https://quaternius.com/packs/universalanimationlibrary.html 。大小要下载页面上确认。
- 用同一套骨骼的 sitting 片段替换 `aim()` 手写坐姿，然后重跑第 6 步。
- 要加到 `CREDITS.md`。

### 不做
修正形状键（姿势空间形变）、权重转移流程、内外笼。团队里没有美术，这几项成本高，而在我们 0.6 倍像素的画面里看不出多少差别。

## 五、建议顺序

1. **先做第 1、2、5 步：** 都是小改动，不需要新素材，能去掉最显眼的几处。
2. **再做第 3、4 步，同时做第 6 步：** 先有测试再调坐姿，否则又回到手调常数。
3. **第 7 步看第 3 步的效果：** 手写坐姿加 IK 已经够自然，就不用下载。

## 来源

1. https://discoelysium.com/devblog/2016/06/20/new-tech-day-occluding-clothes
2. https://manual.reallusion.com/Character_Creator/ENU/1/08_Cloth/Conforming_Clothing_Basic.htm
3. https://www.unrealengine.com/news/mutable-sample-for-runtime-character-customization-now-updated-for-ue-5-8
4. https://docs.readyplayer.me/ready-player-me/customizing-guides/create-custom-outfits （调研时网站打不开，内容来自搜索摘要）
5. https://docs.blender.org/manual/en/5.2/modeling/modifiers/modify/data_transfer.html
6. https://create.roblox.com/docs/art/accessories/caging-best-practices
7. https://superhivemarket.com/products/clipfix/faq
8. https://docs.unrealengine.com/4.27/AnimatingObjects/SkeletalMeshAnimation/AnimPose/PoseDriverNode/
9. https://static.makehumancommunity.org/oldsite/documentation/corrective_shape_keys.html
10. https://dev.epicgames.com/documentation/unreal-engine/motion-warping-in-unreal-engine
11. https://docs.unity3d.com/Packages/com.unity.animation.rigging@1.0/manual/constraints/TwoBoneIKConstraint.html
12. https://quaternius.com/packs/universalanimationlibrary.html
13. https://quaternius.com/packs/universalbasecharacters.html
14. https://blenderartists.org/t/issues-with-retargeting-animations-in-auto-rig-pro/1604289
15. https://docs.unity.com/en-us/engine/6000.0/script-reference/unityengine/animator/setlookatweight
16. https://docs.godotengine.org/en/4.5/classes/class_lookatmodifier3d.html
17. https://www.animaze.us/manual/vrmavatar/vrmanimations
18. https://threejs.org/docs/pages/CCDIKSolver.html
19. https://threejs.org/docs/pages/SkinnedMesh.html
20. https://npmjs.com/package/three-mesh-bvh
21. https://blenderartists.org/t/commercial-low-poly-character-model-single-mesh-or-multiple/1357728
22. https://polycount.com/discussion/comment/2636661/

## 六、第 50 轮做了什么

- **第 1 步：** 开衫下面的 2,794 个身体三角形不再绘制（`body.ts` 的 `uncoveredTriangles`）。开衫和皮肤交界的一圈三角形保留，所以领口、袖口、腰部不会露出缝。毯子下面的腿**没有**藏：现在的毯子太窄，两侧会露出空洞，要等第 4 步。
- **第 2 步：** 头、颈、脊柱的所有动作叠加后，统一经过软上限（`poseLimits.ts`）：
  - 转头 ±0.75 rad，颈和头按 0.35 : 0.65 分摊；
  - 低头 0.5、抬头 0.22、歪头 0.28 rad；
  - 前倾 0.2、后仰 0.1 rad；
  - 打盹时颈部下垂最多 0.3 rad。
- **第 5 步：** 喝茶的目标点加了禁区：
  - 杯子和手指必须在嘴唇前方至少 1.2 cm（杯子再加杯身半径），并且在眼镜下方至少 3 cm；
  - 不满足就把手腕目标往前、往下推。
  - 整个抬手过程每隔 0.1 采样检查一次。实测最紧的时候：离脸 3.1 cm，离眼镜 3.5 cm。原来的姿势本来就满足，这一步现在是一道保险，以后改姿势时会自动推开。
- **验证：**
  - 浏览器里固定住极端姿势截图：喝茶到嘴边；转头、低头、歪头同时到最大；反方向转头、抬头，再加说话手势。都没有看到穿模。
  - 开发钩子 `__grandma.pose({...})` 可以固定姿势，`__grandma.info` 给出间隙数值。
  - 新增 5 个测试（`apps/web/test/clipping.test.ts`）。
- **还没解决：** 两手在膝上互相穿过（C1）、茶杯浮在手边（C2）、左臂陷进扶手（C3）、毯子太窄（C4）。这些是第 3、4 步的事。

## 七、第 51 轮做了什么（第 3、4 步）

**先量，再改。** 在运行中的游戏里用射线测了扶手椅（KayKit 模型拉伸后的实际形状），又读出她摆好姿势后的蒙皮顶点。结果：
- 椅面顶在 0.47 m，她最低的臀部顶点陷进去 9 mm。
- 靠背前表面在 0.7 m 高处，她的后腰陷进去 8 mm。
- **扶手内侧面离她的手臂还有 13–15 cm。C3 不是穿模：** 扶手顶高 0.94 m，比椅面高 47 cm，所以从侧面看手臂被扶手挡住了。手臂并没有插进扶手里。要让手臂露出来，得换一把扶手更矮的椅子，或者调低椅子的高度。这是美术决定，这一轮没改。
- 这些量出来的数写成了 `Grandma.tsx` 里的 `CHAIR` 常量（以她的物体中心为原点）。椅子的模型或碰撞盒变了，要重新量。

**改了什么：**
- **落座（第 3 步）：** 她的位置不再用手调的偏移量。按摆好姿势后的顶点放：臀部和大腿最低点离椅面 3 mm，后腰和开衫离靠背 5 mm。靠背是斜的，所以按每个顶点的高度算靠背在哪里。
- **毯子（第 4 步）：**
  - 宽度取大腿实际最宽处，两侧再各多出 3.5 cm。
  - 高度取刚好让大腿每个顶点都在毯子下面 8 mm 的最小值（`liftToClear`）。只算从髋部往膝盖四分之一以后的部分，因为靠近腹股沟的髋部隆起会把整块毯子顶高。
  - 两侧下垂 9 cm，盖住大腿外侧。
- **双手（第 3 步）：**
  - 不再用手写方向。用双骨 IK（`twoBoneElbow`）把手腕放到各自大腿上方，肘部向外、向后弯。左手掌心朝下，右手掌心朝上托着杯子。
  - 手指比手腕低，所以放好后会检查整只手最低的点。如果在毯子里，就把手腕抬高再放，直到手在毯子上面。
- **茶杯（第 3 步）：** 杯底放在掌心中点（手腕和三个指根的平均位置），杯身沿掌心法线并偏向竖直，不再是按比例估计的悬空位置。

**量出来的间隙**（`__grandma.info.fit`，单位：房间里的米）：

| 间隙 | 结果 |
|---|---|
| 双手在毯子上方 | 6 mm |
| 两只手之间 | 6.2 cm（以前互相穿过） |
| 手臂离扶手内侧 | 7.8 cm |
| 喝茶时离脸 | 3.0 cm |
| 喝茶时离眼镜 | 3.1 cm |

**截图：** 正面看双手分开放在毯子上，杯子立在右手掌心；侧面看她靠着椅背，毯子盖过膝盖垂下来。

**测试：** 新增 5 个，覆盖 IK（够得到、肘朝提示方向弯、够不到时伸到最远）和毯子（表面形状、刚好让开每个点）。

**还没做：**
- 第 6 步只做了一部分：这些间隙在开发模式里能读到，但还没有自动化测试。原因是 Vitest 在 Node 里加载不了这个 glTF 身体模型。要做完，需要在测试里加载模型，或者在浏览器里跑一个检查脚本。
- ~~毯子偏厚~~ **第 52 轮已改：**
  - 原因：基础身体的大腿很粗，大腿中段高出骨线 13.8 cm。
  - 现在毯子只抬到刚好盖过膝盖（离骨线 8.0 cm，原来 12.7 cm）。会顶出毯子的 242 个大腿三角形不画，因为毯子从上面盖住了这里。
  - 两侧下垂从 9 cm 改成 3.5 cm。
