# Issue #24 验收证据（工程侧）：慢加载与绘制故障下的韧性进入

对应工单：docs/design-audit-2026-09-17/tickets/08-resilient-entry.md。本文件按验收标准逐条给出工程证据；最终观感确认属于观看者（#30），不以本文件代替。

**AI 参与声明**：本变更及其证据描述由 AI 辅助完成。

## 入口路径现状（改动前）

- `Scene.tsx`：`data-testid="loading"` 遮罩仅等 `Canvas onCreated`（WebGL 上下文创建）；`onCreated` 后遮罩立即消失。
- 完整开场的时钟在 `SceneContent` 首个 `useFrame` 即开始走动，没有任何就绪门槛——慢网/缺图下开场照常播放。
- 素材加载：`MiraA.tsx` 加载 `surface-density-v1.webp`（失败仅注释放过）；`RiverVeil.tsx` 加载 `river-density-v1.webp`（失败走程序化回退 `tailBaseOpacity(false)`，此前已有）。
- WebGL 不可用：`Canvas` 创建直接抛错，无边界、无后备，白屏。context lost：完全未处理。

## 逐条验收标准

### 1. 主素材或有效程序化回退可呈现后才开始完整开场；慢网/404 不导致无限等待

状态：通过。

- 纯逻辑门槛：`src/lib/entryReadiness.ts`（pending/ready/failed/timed-out → `waiting | materials | fallback`），`MATERIALS_TIMEOUT_MS = 5000` 为硬上限；单测 `tests/unit/entryReadiness.spec.ts` 16 例（含"挂起请求被超时截断""已落定状态不被迟到结果改写"）。
- 接线：`MiraA`/`RiverVeil` 的加载成败上报 `useEntryReadiness`；`Scene.tsx` 在 `useFrame` 中门槛未开时不动开场时钟；`Scene` 内的超时 effect 把 pending 落成 timed-out。
- TDD 证据（RED）：模块不存在时 `npx playwright test --project=unit tests/unit/entryReadiness.spec.ts` 报 `Cannot find module .../src/lib/entryReadiness`，"No tests found"；实现后 16/16 通过。
- e2e：`tests/e2e/resilient-entry.spec.ts` 挂起全部素材 → `data-entry-gate` 保持 `waiting`、完整开场不出现；超时后落定 `fallback` 且开场开始；404 → 迅速落定 `fallback`；健康首访 → `materials`。

### 2. WebGL 不可用 / context lost 有清楚的静态后备和重试；恢复后可探索，交互/声音不重复注册

状态：通过。

- 创建前探测 `detectWebGLSupport()`（注入式纯决策 `probeWebGLSupport`，探测上下文随即 lose 释放，不占浏览器上下文配额）；探测失败或创建期抛错（`SceneBoundary` → `create-failed`）都落到 `SceneFallback`。
- context lost：`Scene` 对 canvas 挂 `webglcontextlost`（`preventDefault` 以允许恢复）/ `webglcontextrestored` 各一次；丢失期间静态后备覆盖，恢复事件经纯函数 `reduceSceneAccess` 只应答恰好一次丢失——组件树不重挂，监听器与环境音图都不重建。
- e2e（真实 `WEBGL_lose_context` lose/restore）：丢失 → 后备可见；恢复 → 后备消失、一次点击只开一张卡（count === 1）、拖拽确实改变 `data-camera-pose`、`__miraAmbient.liveContexts() === 1` 且仍在 playing。
- 与 #23 保存流程的分层：context 丢失期间全屏后备接管（保存入口不可达，不会以丢失画面冒充静帧）；恢复后同一保存流程照常成功。`tonight-save.spec.ts` 的丢失用例相应改写为验证这一分层行为；保存状态机的 `context-lost` 分支仍由 `tests/unit/tonightSave.spec.ts` 覆盖（覆盖保存按下与丢失同任务的竞态窗口）。
- 视觉证据：`evidence/fallback-webgl-unavailable.png`、`evidence/fallback-context-lost.png`（`experiments/capture-entry-fallback-evidence.mjs` 可重采）。

### 3. 回访不增加强制等待仪式；静帧与实时画面衔接明确；后备不冒充可探索

状态：通过。

- 回访（`mira:seen-opening=1`）：遮罩条件为 `!canvasReady || (!introComplete && gate === 'waiting')`——直达路径只看 canvas 就绪，不看门槛；e2e 在素材挂起时 4s 内 explore-ui 可见。
- 衔接：加载遮罩与静态后备共用同一张记录静帧（`entry-still-v1.jpg`），门槛一开遮罩撤、开场起，属于同一次明确的交接。
- 后备只有"重试"一个动作；e2e 断言此时无 canvas、无 explore-ui、无 tail-hint；静帧本身在捕获时已隐去全部 UI 控件（`capture-entry-still.mjs` 用样式隐藏 explore-ui 后截图）。

### 4. 加载静帧与静态后备记录来源场景版本

状态：通过。

- 静帧：`public/materials/entry-still-v1.jpg`（1440×900，默认视角，epoch 2026-09-12T00:00:00Z，high 档，基线法捕获）。
- 来源记录三处：`public/materials/entry-still-v1.SOURCE.txt`（场景 commit 9273c7c、捕获日期、命令、视角）；`src/constants/entryStill.ts`（`ENTRY_STILL`，注释写明由 11/#29 在新美术落地后重制）；页面上 `data-still-source="entry-still-v1"`（遮罩与后备均带）。
- 不以旧美术冒充新场景：静帧明确标注来自 01/02 之前的场景；#29 票面含"静态后备重制（08→11）"。

### 5. 冷启动/解析测量；拆分与否由数字决定

状态：已测量，决定暂不拆分。

- 探针：`Scene` 在 `onCreated` 记录 `performance.now()`（navigation start → 首个可呈现帧），写入 `window.__miraEntry.firstFrameMs` 与 canvas 的 `data-entry-first-frame-ms`；console 行 dev-only。
- 测量脚本：`experiments/measure-cold-start.mjs`，对**生产构建**（`vite preview`）冷载 5 次、每次全新 context。本机中位数：

| 指标 | 中位数 |
| --- | --- |
| navigation start → 首个可呈现帧 | 981 ms |
| HTML responseEnd | 3 ms |
| DOMContentLoaded | 852 ms |
| load | 854 ms |
| 主 bundle 传输 | 437 kB（gzip），fetch 37 ms |

- 解读：本机 localhost 下传输可忽略，DCL 前的 ~850ms 主要是 1.45MB 单 bundle 的解析/求值与场景创建（SwiftShader 软件渲染）。但首个可呈现帧必须等 three.js 就绪——拆包只能让壳层文字更早出现，不能让首帧更早；按 SPEC "分包本身不作为变快证据"，这些数字不构成拆分理由。决定：**暂不拆包**；真实设备/慢网数字留待 #29 的桌面与真机证据收口时复测（本机数字不外推为移动端结论）。

### 6. 故障注入验证非空画面与恢复操作，行为与视觉回退各留证

状态：通过。

- 行为证据：`tests/e2e/resilient-entry.spec.ts` 6 例（健康首访 / 素材挂起 / 素材 404 / 回访不等待 / WebGL 不可用+重试 / context 丢失+恢复）。
- 非空画面不是"有 canvas"：用例解码截图并断言亮度均值 > 1 且标准差 > 1（非纯黑非平场）。
- 视觉回退证据：见第 2 条两张 PNG。

## 门槛复跑（2026-09-17 测量，2026-09-18 全量复跑）

- `npm run build`：通过（1030 modules；既有 >500 kB chunk 提示保留，见第 5 条决定）。
- `npm run lint`：通过，0 错误。
- `npx playwright test --project=unit`：126 通过（含新增 entryReadiness 16 例）。
- `npx playwright test`（全量）：176 通过 / 0 失败（约 3.7 分钟；含本票新增 e2e 6 例与 tonight-save 丢失场景用例的分层改写）。
- `node experiments/verify-baseline.mjs`：PASS，两轮逐字节一致——加载遮罩与门槛不改变 capture 模式的已渲染画面。

## verify-baseline 间歇失败排查（未静默）

复跑门槛时 verify-baseline 出现间歇 FAIL，两种签名：default 889/1296000 像素（max 32/255）、az90 11154/1296000 像素（max 164/255）——后者与 EVIDENCE-19 记录的 #19 时代既有 flake **逐数字一致**，早于本分支。排查记录：

- 差异区域定位：az90 为 Mira B 吸积盘及其 bloom 光晕；default 为同一伴星区域（默认视角下位于 Mira A 临边旁）。
- 发散对上全场景状态（全部 uniforms、变换、相机）经脚本逐对象 dump **完全一致**；强制 `advance()` 重渲染后差异不变（非陈旧帧）；同 run 内连拍稳定；rAF 存活（约 4.5fps，SwiftShader high 档）。
- 结论：差异位于场景图之下（SwiftShader/合成层），与机器负载相关（满载复跑后高发，空载时连续多轮 byte-identical）。对照实验（干净工作树、交错各 2 轮）：master 与分支均 PASS；veil 静帧去除后 flake 仍出现，排除本分支新增素材请求为成因。
- 处置：不改阈值、不静默；维持逐字节断言。残余风险写入 #29 收口清单：最终基线采集需在低负载窗口进行，或后续为 harness 增加"逐 run 状态指纹"输出以便发散时直接定位。

## 遗留事项

- 静帧重制归 #29（11），新美术落地后按 `capture-entry-still.mjs` 重采并更新 `ENTRY_STILL`。
- 真实慢网/真机的冷启动复测归 #29/#30；本文件数字仅为本机工程读数。
- verify-baseline 的既有间歇 flake（见上节）归 #29 采集最终证据时复核。
