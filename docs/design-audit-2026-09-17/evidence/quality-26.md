# Issue #26 验收证据（工程侧）：自适应画质与后台运行

对应工单：docs/design-audit-2026-09-17/tickets/09-adaptive-quality.md。本文件按验收标准逐条给出工程证据；最终观感确认属于观看者（#30），不以本文件代替。

**AI 参与声明**：本变更及其证据描述由 AI 辅助完成。

## 改动内容

- **新增 `src/lib/qualityGovernor.ts`**（纯函数，模式照 viewerControl.ts）：`evaluateQuality` 逐帧喂入帧时间，按 2s 窗口取 P75 聚合（单帧毛刺不计），连续 2 个慢窗（P75>19ms）降一档、连续 2 个快窗（P75<13ms）升一档，每次换档步进一档并进入 8s 冷却；13–19ms 之间为滞回带，健康 60fps 落带内不换档。`stallFrameMs=250`：更慢的帧是 rAF 饥饿（最小化/遮挡窗口不会总是触发 visibilitychange，实测见第 3 条），不是 GPU 能力的度量，不计入证据。`driveQualityGovernor` 入口约定：**entry gate 等待期不评估**——加载与着色器编译的帧时间不是稳态画质证据（CI 软渲下加载 10s+，探针帧会在场景呈现前把档位走穿，PR #37 CI 红的根因）；gate 落地那一帧才初始化 governor，启动宽限从此刻计。`resolveGovernorSetup`：显式 `?quality=` 钉死档位 governor 不启动；短边 <640px 的设备在 desktopOnly 下不设帧率门槛。`?quality-probe/window/cooldown/start` 为 dev-only 测试钩子（照 idleTiming 的 PROD 门控；`quality-start` 只定起始档、不钉死，与 gate 门控正交——前者是模块级一次性解析的初始值，后者决定何时开始评估）。`window.__miraQuality` 常驻记录器（always-on）：帧时间环形缓冲、换档事件、每 5s 资源采样（几何体/纹理/JS 堆/dpr/分辨率/档位）——SPEC 要求"真实记录"，观测是交付物本身。
- **`src/constants/quality.ts`**：`detectQualityTier` 现在识别显式 `?quality=high|mid|low` 三档钉死（原仅 low）；新增 `explicitQualityPin` 与 `isMobileSized`（短边规则提取复用，governor 的手机判定与分档同源）。
- **`src/components/Scene/Scene.tsx`**：档位从模块常量改为 React state（初值=探测档或 dev `?quality-start=`），governor 的 change verdict 才触发重渲染；LOD/bloom/dpr 随档切换（dpr 用 r3f 原生响应式 prop）。后台绘制控制：`visibilitychange` → Canvas `frameloop` 在 'always'/'never' 间切换（r3f 内部单循环管理，天然无双循环）；回前台时 governor 状态重置（同档、新窗口、新冷却宽限）。观测属性：canvas 上 `data-quality-tier`/`data-quality-last-change`（always-on，仅换档时写入）与 dev-only `data-frame-count`（帧心跳）。antialias 是上下文创建期参数，跟随初始档。
- **降档顺序**（先砍高成本后处理/分辨率再砍装饰）由 LOD 表体现，review 修正后严格成立：high→mid **只**动 bloom levels 4→2 与 dpr 1.5→1，星野 5000、尾巴 10000、来流 600、球面 64 段全部保持；mid→low 才关 EffectComposer 并把装饰砍到 300/300/150/16。（首版 mid 档同时砍了 70% 装饰，不符合票面顺序，本轮修正；LOD 键名随之从 mobile/desktop 改为 mid/high 名实一致。）副带取舍：自动选档的手机落 mid 档，现在保留满装饰、只减 dpr 与 bloom——SPEC 明确手机无帧率门槛，观感优先。
- **`experiments/measure-quality.mjs`**：headed Chromium + 本机真实 GPU，跑生产构建（vite preview）；启动时打印 UNMASKED_RENDERER 并拒绝软件渲染。协议照 SPEC：静置 ~2min、连续拖动 ~30s、真实最小化后台 ~20s（CDP `Browser.setWindowBounds`，非合成事件）、连续观看 ~5min、10x CPU 节流强制慢帧、恢复观察。输出 `quality-26.json`。

## 逐条验收标准

### 1. 档位不随短时波动反复跳动，恢复有阈值和冷却；先调整高成本后处理/分辨率再减少装饰

状态：通过。

- 滞回与冷却：单测 `tests/unit/qualityGovernor.spec.ts` 21 例——滞回带内（16ms）永不换档、单慢窗不动、连续两窗才动、每次只步进一档（high→mid→low 不跳档）、冷却期内 verdict 为 cooldown 不换档、启动宽限、P75 抗 20% 尖刺、stall 帧不计证据也不断连击、entry gate 等待期不评估且落地帧才开始计时（gate 门控 4 例）。
- e2e `tests/e2e/quality-governor.spec.ts`：合成慢帧下档位 high→mid→low 逐级经过（`data-quality-last-change` 记录 `high>mid:sustained-slow` 再到 `mid>low:sustained-slow`）；10s 冷却下只发生一次换档；`?quality-start=mid` + 快帧探针观察到 mid→high 恢复换档；稳态探针（16ms）下档位不动。
- 降档顺序由 LOD 表保证（见改动内容），先 bloom/dpr 后装饰。

### 2. 双星关系、光河方向和独立竖屏构图在各档保持；减少动态效果覆盖背景闪烁

状态：通过。

- 档位只喂 LOD 数量/segments/bloom/dpr props，不触碰轨道几何、相机、光河方向与竖屏旋转组；e2e 竖屏（700×900，桌面宽度所以 governor 启用）断言降级穿越 high→mid→low 时 `data-camera-pose` 逐字不变。
- 减少动态对背景闪烁的覆盖为既有实现（advanceTime 冻结 uTime，StarField 闪烁静止），由全量回归守护（reduced-motion 用例在 viewer-control、mira-cosmic 等套件内）。

### 3. 后台/静止状态控制绘制，回前台不突跳或追赶运动；恢复后不会双重循环

状态：通过（含一条实测发现的环境备注）。

- 代码路径：`visibilitychange` → `frameloop='never'` 停渲染循环（r3f 单一循环管理，无手动循环可叠加）；回前台恢复，governor 重置、`advanceTime` 既有 0.05s delta clamp 防追赶。e2e（合成 visibilitychange，照 ambient-sound 先例）：`data-frame-count` 隐藏期完全停涨、恢复后续涨、`data-camera-pose` 逐字不变。
- **实测发现（真实 GPU 运行，headed 最小化窗口）**：Windows 上最小化窗口时 Chrome 停发 BeginFrames（20s 仅 24 帧，浏览器层面已控制绘制），但 `visibilityState` 保持 `visible`、不触发 visibilitychange——第一版实现因此把 ~900ms 的饥饿帧当作"持续慢帧"误降两级。修复为 stall 阈（>250ms 的帧不是 GPU 能力证据），修复后同协议重跑：后台 20s、0 换档、恢复后 3s 内 495 帧（≈165fps）无突跳。
- 恢复升级实测：第一版运行中（stall 修复前）误降至 low 后，高刷新率显示器上快窗规则自动把档位 low→mid→high 升回（`sustained-fast` 事件记录在 quality-26.json 时间线中）。

### 4. 真实 GPU 记录质量切换、帧时间、资源变化和长时表现

状态：通过。

- 环境：headed Chromium，**NVIDIA GeForce RTX 4060 Laptop GPU**（ANGLE/D3D11，UNMASKED_RENDERER 打印在 quality-26.json；检测到 SwiftShader/llvmpipe 即退出，不作为证据），生产构建（vite preview），1440×900，dpr 1，165Hz 显示器。记录于 2026-09-18。
- 协议与结果（quality-26.json，全程约 9.5 分钟）：
  - 静置 120s：19298 帧，均值 160.6fps，P75 6.1ms，P95 6.4ms，>25ms 卡顿帧 3/8192，0 换档。
  - 连续拖动 30s：161.8fps，P95 6.3ms，0 换档。
  - 后台（真实最小化）20s：24 帧（浏览器节流），0 换档；恢复即满速。
  - 连续观看 300s：48562 帧，161.4fps，P75 6.1ms，P95 7.3ms，>25ms 0/8192，0 换档。
  - 10x CPU 节流 30s：均值 125fps、P75 7.7ms——GPU 主导的场景对 CPU 节流不敏感，仍远低于降档阈，0 换档（诚实记录：本机余量大，换档路径由单测/e2e 与第 3 条的实测误降/恢复事件证明）。
  - 资源：JS 堆 13MB→11MB（峰值 16MB），几何体 24→24、纹理 11→11，长时无增长。
- 记录能力本身常驻：`window.__miraQuality`（帧统计/换档事件/资源采样）与 `data-quality-tier`/`data-quality-last-change` 随产品构建发布。

### 5. 桌面以效果为先、接近 60fps 为目标；手机不设帧率门槛；规则与行为回归通过

状态：通过。

- 桌面实测 160fps 且全程保持最高档——"效果优先"落实在：只有持续越阈的证据才换档，且恢复有对称阈值与冷却。60fps 目标远超达成（本机显示器 165Hz）。
- 手机：governor desktopOnly，短边 <640px 设备不启用帧率治理（与分档同一 `isMobileSized` 规则；单测覆盖横屏手机），手机无帧率门槛。
- 回归：全量套件 228/228（含既有行为套件全部使用 `?quality=low` 钉死，不受 governor 影响）；capture 模式下 governor 完全不采样（verify-baseline 见下）。

## 门槛数字（本分支）

| 门槛 | 结果 |
| --- | --- |
| `npm run build` | 通过（仅有既有的 >500 kB chunk 提示） |
| `npm run lint` | 通过 |
| `npx playwright test --project=unit` | 171 passed |
| `npx playwright test`（全量） | 228 passed |
| `node experiments/measure-quality.mjs` | 真实 GPU 9.5 分钟协议完成，0 非预期换档 |
| `node experiments/verify-baseline.mjs` | 见下方诚实备注 |

**verify-baseline 诚实备注**：该校验在本机热态下间歇失败——已确认与负载强相关：紧接 5 分钟以上的全量 SwiftShader 套件运行时必现（default 621/1296000 像素 max diff 10、az90 4780 像素 max diff 147 两种固定签名），安静环境下本分支 4/4 PASS（default/az90 逐字节一致）；且在基线提交 6bac784（#25 合入点，不含本票任何改动）上复现完全相同的失败签名，确认与 #26 无关。疑似既有采集脚本在热机上的时机问题（milestone-hint 的 JS 驱动淡出不被 FREEZE_CSS 冻结，waitForExploreReady 的 catch 兜底放行）。是否加固采集脚本属父票 #18/#19 范围，本票不扩大。

## TDD 记录

- RED：`c48501a` 先提交 `tests/unit/qualityGovernor.spec.ts` 与 quality.spec.ts 扩展——运行报 `Cannot find module .../src/lib/qualityGovernor` 与缺 `explicitQualityPin` 导出。
- GREEN：实现 qualityGovernor.ts + quality.ts 后 171/171 转绿；Scene 接线后 e2e 7/7 转绿。
- 实测驱动的一次设计修正：第一轮真实 GPU 测量暴露"最小化不触发 visibilitychange → 饥饿帧误降档"，据此加入 stallFrameMs 阈（先补单测再改实现），第三轮测量确认 0 误换档。
- CI 驱动的第二次修正：PR #37 在 GitHub runner（SwiftShader）上红——governor 在 entry gate 等待期就开始评估，加载期帧把档位走穿；且三条 e2e 断言依赖本机探测档（CI 4 核探测为 mid）。修为 gate 落地才开始评估（单测先行）+ 相关 e2e 显式 `quality-start=` 与环境解耦。

## 提交

- `c48501a` Add failing quality governor specs for #26
- `5c17713` Govern quality at runtime: hysteresis tier changes, background draw control (#26)
- `fc3f8b9` Ignore starved frames in the governor and record real-GPU long-run evidence (#26)（stall 阈、测量脚本、本证据文件）
- `62eb77d` Cut post-processing before decoration in the quality descent (#26)（review 修正：LOD 表重排装饰最后砍、注释与证据笔误、测量脚本去重）

最终观感验收（各档画面气质）属于观看者，见 #30。
