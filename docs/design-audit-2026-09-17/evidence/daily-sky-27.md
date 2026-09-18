# Issue #27 验收证据（工程侧）：不同日期的天空变化保持统一且耐看

对应工单：docs/design-audit-2026-09-17/tickets/10-daily-sky.md。本文件按验收标准逐条给出工程证据；最终观感确认属于观看者（#30），不以本文件代替。

**AI 参与声明**：本变更及其证据描述由 AI 辅助完成。

## 改动内容

- **纯函数 seam（`src/lib/riverLighting.ts`）**：新增 `dailySkyCoupling(sky: SkyState)`，与 `skyRiverGain` 同文件同风格，把"今晚的天空"落到光河的协调通道上：
  - `warmth`：局部色温，沿用既有 `0.25·(1−colorShift)` 曲线（数值与 `skyRiverGain` 完全一致），收进同一 seam 让各通道同源同行；
  - `gain`：`skyRiverGain` 的增益叠加 `brightnessLift` 后在 seam 内一次组好，组件与单测消费同一公式，不再各自拼装；
  - `brightnessLift`：亮度微调 `0.05·max(0, colorShift−brightness)`。颜色比光度先饱和（starClock 的既有设计），两者的差在极大/极小恰为零、在周期中段达峰——实测全周期 0 ~ 0.0093，叠在既有 gain（地板 0.8）之上是约 1% 的抬起，不是第二个增益；
  - `density`：微妙密度 `1 + 0.08·(0.5−brightness)`，全周期 0.96 ~ 1.04。0.5 是两段半余弦的精确周期均值，全年不留净增减；较亮的 Mira A 星风更强、光河略稀，较暗时物质略沉。
- **消费点**：尾巴点精灵的基础不透明度 `tailBaseOpacity(..., density)`（第三参数缺省为 1，旧调用数值不变）与光河各层 `uOpacity` 同乘 density（`MiraTail.tsx`、`RiverVeil.tsx`）；`uSkyGain`/`uSkyWarmth` 直接取 seam 组好的 `coupling.gain/warmth`。密度同时作用于贴图路径与程序化回退路径，稀疏的夜晚读作"更稀疏的河"，不会读成"河断了"。
- **天空刷新（`src/App.tsx`）**：回到前台（visibilitychange → visible）时 `setSky(currentSkyState())`——`setSky` 此前有定义无调用方。不加轮询：天空按日变化，回到前台一次重读足够。 pinned clock（`?epoch=`）路径同源，capture 模式不受影响。`App.tsx` 同时暴露 `data-sky-density` 供 e2e 与证据脚本读取。
- **未动**：`advanceTime` 的暂停/后台冻结与 delta clamp（不补播由它继续保证）、今晚的 Mira 快照路径、里程碑/相位读数、直达/重播、父票 #18 的其他部分。

## 逐条验收标准

### 1. 单一确定性时间来源驱动变化；相同日期/相位可复现，不新增实时观测承诺

状态：通过。

- `dailySkyCoupling` 唯一输入是 store 里那份 `SkyState`（`skyStateAt(date)` 纯函数，`src/lib/starClock.ts`），无网络、无随机、无墙钟读取。单测"the same date couples to the same river, value for value"逐值断言两次调用全等。
- e2e `tests/e2e/daily-sky.spec.ts`"the same night is reproducible down to the canvas pixels"：同 epoch（2026-09-12，capture 冻结相位）两次独立加载，`data-sky-*` 全等且 canvas 截图**逐字节一致**。
- 代表日期集中 mid-decline 与 mid-rise 亮度同为 0.5000，两帧**逐字节一致**——同相位即同天空的直接证据。
- 无新增实时观测：密度/色温/亮度全部由确定性周期近似派生，文案与注释不声称实时观测。

### 2. 代表日期对照：变化细腻且不让尾巴消失、星体过曝、两星难辨

状态：通过（工程侧）。

对照捕获：`baselines/daily-sky-27/`，同一脉动周期（第 16 周）四个代表相位、同机位（default）、同冻结动画相位，仅 `?epoch=` 不同；manifest.json 记录每帧的 epoch、页面实报的 sky 属性与统计量。

| 相位 | epoch (UTC) | brightness | density | 全图平均亮度 | 尾区平均亮度 | 尾区色温 (R−B) |
| --- | --- | --- | --- | --- | --- | --- |
| 近极大 | 2026-04-10 | 1.0000 | 0.9600 | 9.055 | 9.468 | −4.274 |
| 下降中段 | 2026-08-04 | 0.5000 | 1.0000 | 8.296 | 9.104 | −3.996 |
| 近极小 | 2026-11-28 | 0.0000 | 1.0400 | 7.311 | 8.609 | −3.519 |
| 上升中段 | 2027-01-17 | 0.5000 | 1.0000 | 8.296 | 9.104 | −3.996 |

量化（0–255 通道）：极大→极小全图平均亮度 −19%，尾区平均亮度 −9%，尾区 R−B +0.76（偏暖，与"暗红星投暖河"一致）；逐像素对比极大 vs 极小 36% 像素有差、最大单通道差 96（集中在星体盘面本身，属预期）。密度摆动 ±4%，远低于"尾巴消失"的量级（增益地板 0.8 仍未动）。

目检（ReadMediaFile 逐帧 + 星区局部全分辨率裁切）：

- 尾巴：四个相位均完整可读，极小帧中光河结构仍在（密度 1.04 略厚）。
- 星体：极大帧 Mira A 表面斑块纹理完整、无死白裁切（#25 的高光软肩未受影响）；极小帧星体变暗偏红但仍为有结构的盘面。
- 两星：冻结相位下伴星位于巨星临边内侧，与既有 `after/` 基线完全一致（既有构图特性，非本票引入；见 binary-25.md 的诚实备注）；实时观看中公转持续带离临边。

### 3. 暂停/后台后更新到当前时间但不补播积压动作，导出使用按下时的同一状态

状态：通过。

- 更新到当前时间：`src/App.tsx` 的 visibilitychange 监听在回到前台时重读星钟。e2e"returning to the foreground re-reads the star clock"：以极大 epoch 载入（`data-sky-brightness` = 1.0000），dev-only 地把时钟钉到极小并派发 visibilitychange，属性变为 0.0000——天空更新到"当前"时间。
- 不补播：`advanceTime`（`src/lib/captureMode.ts`）的暂停源、后台冻结与 0.05s delta clamp 一行未动；后台期间 frameloop=never 亦未动。重读天空只换"在哪一天"，不补播任何积压运动。
- 导出：今晚的 Mira 快照在按下的同一任务内强制渲染并读回（`useTonightSave.ts` 既有机制），叠字日期取按下瞬间墙钟、画面取按下瞬间的同一份 store sky——两者在按下时刻同源；本票未改该路径。

### 4. 相位信息、里程碑、语言和直达/重播不回归；纯时钟与页面回归通过

状态：通过。

- 相位读数与里程碑（`InfoCards.tsx`、`MilestoneHint.tsx`）与画面读的是同一份 store sky——天空刷新后两者自然同步，无第二来源。
- 全量回归：`npx playwright test` 全绿（含 phase-readout、language、direct-entry、full-opening、tonight-save、viewer-control 等既有套件），数字见下方门槛表。

## 预期变化记录（默认 capture epoch 基线）

本票在默认基线日期 2026-09-12 产生**有意、有限**的调整：brightness 0.2500 处 brightnessLift = +0.0093（gain 0.8550 → 0.8643，+1.1%）、density = 1.020（尾巴/光河不透明度 ×1.02）、warmth 不变（0.1412）。这是每日天空耦合在该日期的真实取值，不是回归。

- `experiments/verify-baseline.mjs` 断言的是同代码两次重采逐像素一致，不受影响（PASS，见门槛表）。
- 既有 `baselines/after/` 等已提交基线**未重捕覆盖**：其变化幅度为河域约 1–2% 亮度/不透明度，低于视觉可辨阈值；README 亦已声明跨代码变更的像素对比会有局部翻转。如需一份反映新耦合的默认日期基准，可在观看者确认后另起标签重捕。
- 证据目录中的六张 `interface-20-*.png` **已按新耦合重捕**（界面叠在实时场景上，场景变了约 1–2%，重捕让文档与画面保持一致）；`interface-20.md` 文字结论不受影响。基线（回归参照）与证据图（文档插图）因此有意走了两条路。

## 门槛数字（本分支）

| 门槛 | 结果 |
| --- | --- |
| `npm run build` | 通过（仅有既有的 >500 kB chunk 提示） |
| `npm run lint` | 通过 |
| `npx playwright test --project=unit` | 201 passed（含新增 5 例 daily sky coupling / tail density） |
| `npx playwright test`（全量，chromium 83 + unit 201） | 284 passed（5.6 分钟） |
| `node experiments/verify-baseline.mjs` | PASS（default 与 az90 逐字节一致；首轮遇已知热机抖动，安静重跑即过） |

## TDD 记录

- RED：先在 `tests/unit/riverLighting.spec.ts` 提交 daily sky coupling 与 tail density 用例——模块尚无 `dailySkyCoupling` 导出，运行报 `SyntaxError: ... does not provide an export named 'dailySkyCoupling'`。
- GREEN：`riverLighting.ts` 落地纯函数后 22/22 全绿；随后接线 MiraTail/RiverVeil、App 前台刷新，新增 e2e 三例一次通过。

## 遗留与边界

- mid-decline 与 mid-rise 亮度相同、耦合输出相同，视觉上不可区分；本票不引入升/降支滞回（属美术决策，可由观看者提出）。
- 天空刷新仅发生在"回到前台"这一刻；标签页跨午夜保持前台时，画面仍是打开时的天空，直到下一次后台往返。按日变化的场景下这是有意为之（无轮询）。
- 最终观感（"变化可感知且耐看"）属观看者验收（#30），以上数字与对照图为工程侧证据。
