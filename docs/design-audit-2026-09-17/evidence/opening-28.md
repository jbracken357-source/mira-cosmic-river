# Issue #28 验收证据（工程侧）：完整开场逐步揭示相伴与光河尺度

对应工单：docs/design-audit-2026-09-17/tickets/03-cinematic.md。本文件按验收标准逐条给出工程证据；最终观感确认属于观看者（#30），不以本文件代替。

**AI 参与声明**：本变更及其证据描述由 AI 辅助完成。

## 改动内容

- **新增 `src/lib/openingTimeline.ts`**（纯函数，模式照 viewerControl.ts）：`resolveOpeningPose(t, { reduceMotion, portrait })` 是完整开场的唯一镜头/尾巴数据源——停顿（CLOSE）→ 尺度揭示（pull-back）→ 落位（settle）三段与尾巴透明度包络全部由时间解算，`Scene.tsx` 的帧循环只应用结果。三处行为变化：
  - **落位（修交班断点）**：12.5–15s 镜头从 FAR 缓动到 EXPLORE（位置 + lookAt + fov 一起），15s 落地即自由探索构图，`introComplete` 交接不再移动相机（交接分支只把轨道目标并入 EXPLORE.lookAt——FAR 与 EXPLORE 共享 lookAt，两种取向均成立）。
  - **前景经过**：pull-back 段路径由直线改为经 MID 航点的二次贝塞尔弧，向光河一侧（-X，尾巴流向）弯约 2.4 个单位，8–11s lookAt 扫向光河时近缘从镜头掠过；`CAMERA.MID` 从「未被引用的中间机位」改为路径航点，语义名实相符。
  - **尾巴透明度连续化**：原 ramp 在 8s 从 0.15 重置为 0 再爬升（可见跳变），改为 0.15 为地板向上长至 0.85，单调无 pop。
  - 横屏其余行为逐帧等价：停顿段机位、pull-back 缓动（easeInOutCubic）、fov 35→50、8–11s lookAt 扫描、相位切换阈值全部不变。
- **`src/constants/animation.ts`**：`PORTRAIT_CAMERA` 补 CLOSE/MID 独立构图——CLOSE 的 lookAt 下压（[0,-2,0]）让红巨星主体居于画面上部、下方留给光河方向，竖屏近景不会卡在空黑；MID 为竖屏对应的河中航点。
- **字幕重渲修复（SPEC 界面订阅离散阶段）**：Scene 不再逐帧 `setCinematicTime(t)`，改为只在字幕分段边界（`openingCaptionMark`：0/2/4/8/12.5）变化时写 store，字幕时序逐字不变。
- **dev-only 钩子**（均照 `idleTiming` 的 PROD 门控，不进生产包）：
  - `?cinematic-scale=N`：开场墙钟乘 N，e2e 用 N=2 把 15s 压到约 7.5s 跑完自然结束。
  - `?cinematic-t=MS`：配合 `?capture=1` 把开场冻结在指定毫秒出相位图（`captureMode().cinematicT`；无该参数时 capture 行为逐字节不变——`useBinaryStar` 的直达判定只在 cinematicT 为 null 时生效，verify-baseline 见下）。
- **`experiments/capture-opening-28.mjs`**：照 capture-baseline.mjs 模式出确定性相位图（冻结时钟 + 固定 epoch/种子 + 字幕等 JS 淡入用墙钟静置兜底），输出 `baselines/opening-28/`。

未动：字幕文案、父票 #18 范围外项、开场音乐（票面外）、既有 `?capture=1&cam=` 基线视图。

## 逐条验收标准

### 1. 首次完整开场自然结束，回访直达，重播重置；提前进入场景和语言切换均正常

状态：通过。

- 既有回归守护：direct-entry.spec.ts（首访开场→自然/提前结束、回访直达、重播重置、清存储恢复首访）、mira-cosmic.spec.ts（自然结束）、language-test.spec.ts。
- 新增 e2e `tests/e2e/full-opening.spec.ts`（`?cinematic-scale=2` 压缩墙钟）：自然结束后 explore-ui 出现且 `mira:seen-opening=1`、落地机位逐字等于 EXPLORE（`data-camera-pose` = `8.0,7.0,28.0`）；提前进入落在同一构图；开场中切换语言后字幕按新语言出现且开场照常完成。

### 2. 镜头起中末三阶段清楚，交给自由探索无突跳或目标错位

状态：通过。

- 三阶段由单测固定（`tests/unit/openingTimeline.spec.ts` 15 例）：停顿段 0–4s 机位逐值等于 CLOSE；pull-back 段 z 与 fov 单调推进、8s 中点偏离直线 ≥1 且偏向光河一侧；12s 末逐值落在 FAR；**t=15s（及之后任意时刻）pose 逐值等于 EXPLORE**，且 14.0–15.0s 逐 0.05s 采样相邻步长 < 0.2 单位、fov 步长 < 0.5°——交接零跳变的核心断言。
- e2e：自然结束与提前进入的落地机位均逐字等于 EXPLORE 机位（见第 1 条）。
- 相位图：`baselines/opening-28/t0-hold.png`（停顿，巨星近景）、`t6-river-pass.png`（中段尺度展开）、`t9-tail-reveal.png`（尾巴随 lookAt 扫描进入画面左侧）、`t13-settle.png`（落位段：标题 + 光河构图，与直达探索的 `baselines/default.png` 构图连续）。

### 3. 竖屏独立构图保留双星与尾巴方向，不卡在空黑画面

状态：通过。

- `PORTRAIT_CAMERA.CLOSE/MID` 新增（`src/constants/animation.ts:68-82`），配合既有 fittedFov 垂直扩展与竖屏旋转组；单测断言竖屏停顿段与横屏不同、落位逐值等于 PORTRAIT_CAMERA.EXPLORE、全程无 NaN。
- 相位图：`portrait-t1-hold.png` 红巨星主体与伴星清楚在画面中部（非空黑）；`portrait-t6-river-pass.png` 双星与来流可辨；`portrait-t9-tail-reveal.png` 尾巴向左下方的流向清楚。
- e2e：竖屏（390×844）冻结在 t=1s，断言机位为竖屏 CLOSE（`8.0,4.0,13.0`）且截图亮度 mean>1、stddev>1（非全黑、非平色——照 resilient-entry 的像素判据先例）。

### 4. 减少动态跳过戏剧性镜头但保留内容和进入能力；字幕互不重叠

状态：通过。

- 减少动态：`resolveOpeningPose(t, { reduceMotion: true })` 全程钉 EXPLORE 机位（单测），尾巴揭示保留（t=6 已 >0，t=12 到 0.85）；e2e 断言开场全程 `data-camera-pose` 逐字不变、字幕仍出现、开场自然完成且可进入探索。
- 字幕互不重叠：AnimatePresence `mode="wait"` 为既有机制；新增 e2e 在 2x 压缩的开场全程每 80ms 采样字幕节点数，最大值 ≤ 1（覆盖 1s/2s/4s 三次换句）。字幕时序未改——`openingCaptionMark` 的边界值与 CinematicOverlay 的阈值逐一对应（单测固定）。

### 5. 提供镜头阶段视觉证据与相关页面行为回归

状态：通过。

- 相位图：`baselines/opening-28/` 8 视图（横屏 0s/3s/6s/9s/13s + 竖屏 1s/6s/9s），`manifest.json` 记录 epoch（2026-09-12）、种子、各相位毫秒数、视口与 git commit；由 `experiments/capture-opening-28.mjs` 重采复现。
- 行为回归：全量套件见门槛数字。

## 门槛数字（本分支）

| 门槛 | 结果 |
| --- | --- |
| `npm run build` | 通过（仅有既有的 >500 kB chunk 提示） |
| `npm run lint` | 通过 |
| `npx playwright test --project=unit` | 190 passed（含 openingTimeline 15 例） |
| `npx playwright test`（全量） | 253 passed（含 full-opening 6 例） |
| `node experiments/verify-baseline.mjs` | PASS（default/az90 逐字节一致，安静环境单次通过） |

**诚实备注**：第一次全量运行（紧接 verify-baseline 与相位截图之后的热机状态）出现 1 例失败——resilient-entry 的挂起素材超时用例（`252 passed, 1 failed`）；该用例单独重跑 6/6 通过，随后安静环境全量重跑 253/253 通过。失败形态与 quality-26 记录的热机 flake 同类（时间敏感用例在高负载下超时），与本票改动无因果（该用例不经 cinematic-t/cinematic-scale 路径，挂起素材下的开场路径未被本票触碰门控逻辑之外的部分）。

## TDD 记录

- RED：`2a59e06` 先提交 `tests/unit/openingTimeline.spec.ts`——运行报 `Cannot find module .../src/lib/openingTimeline`。
- GREEN：`831aa57` 实现 openingTimeline.ts + 常量/Scene/captureMode 接线后 unit 190/190 转绿；新增 e2e 6/6 一次通过。
- 视觉验证走确定性相位图（`?cinematic-t=` 冻结），未采用旧 `experiments/capture-opening.mjs` 的墙钟方案。

## 视觉取舍说明

- 「前景经过」选了保守实现：MID 航点只把路径向光河弯约 2.4 单位（中点偏离直线 1.5/-0.75/-1.75），效果是让 8–11s 尾巴扫入画面时近缘更贴近镜头，而不是制造一次夸张的穿越。t6 相位图上尾巴仍只是微光（透明度包络在 8s 前上限 0.15 是既有设计，未动），经过感主要由镜头路径与 lookAt 扫描的合成产生。
- 竖屏 CLOSE 的 lookAt 下压幅度（-2）取「巨星居上半、下方留光河方向」的最小有效值，未引入新的构图语言。

## 提交

- `2a59e06` Add failing opening timeline specs for #28
- `831aa57` Choreograph the full opening: river pass, settle landing, portrait framing (#28)
- 本证据文件与 opening-28 基线随后续提交入库。

最终美术验收（三阶段节奏与经过感的整体气质）属于观看者，见 #30。
