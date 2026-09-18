# Issue #29 验收证据（工程侧）：全体验集成与桌面证据收口

对应工单：docs/design-audit-2026-09-17/tickets/11-integration.md。本文件按验收标准逐条给出工程证据；最终观感与真机验收属于观看者（#30），不以本文件代替。

**AI 参与声明**：本变更及其证据描述由 AI 辅助完成。

## 改动内容

- **连续旅程 e2e（`tests/e2e/integration-journey.spec.ts`）**：一条测试按观看者的真实顺序串起全部能力——首访完整开场 → 重载直达 → 拖动探索（立即接管）→ 键盘入口打开/关闭信息卡（读卡期间闲置不接管）→ 环境音开启（单音轨、偏好入存储）→ 今晚的 Mira 保存（按下锁定、面板期间镜头保持、叠字重组同一快照、导出可解码 PNG）→ 闲置恢复运镜 → 结语浮现 → 单键打断 → 重播完整开场（音轨不叠加）→ 回到主视角。防 flake 约定与既有套件一致（`?quality=low`、dev-only 时间压缩、全部断言走可观测属性）。
- **静态后备与加载静帧按新美术重制（08→11 的移交项）**：`experiments/capture-entry-still.mjs` 重采 `public/materials/entry-still-v1.jpg`（场景 commit d601df1，基线法捕获、无 UI 控件，内容经像素/OCR 核验：星景+尾巴、零文字）；`entry-still-v1.SOURCE.txt` 与 `src/constants/entryStill.ts` 元数据同步；`experiments/capture-entry-fallback-evidence.mjs` 重采两张后备证据图（同一静帧作底、重试入口可读）。
- **最终美术对照基线集 `baselines/integration-29/`**：default / near / az90 / az180 / az270 / portrait / reduced-motion 七视角，确定性冻结捕获（manifest 记录 epoch、种子、相机位、commit d601df1）。既有 `after/`（#19 时代）保留不动作历史参照。
- **真实桌面 GPU 证据 `evidence/integration-29-quality.json`**：`experiments/measure-quality.mjs` 参数化输出标签（默认仍写 quality-26.json，不覆盖 #26 证据），按 #26 同协议在最终集成美术上重跑全程约 9.2 分钟。
- **verify-baseline 间歇失败收口（#24/#26 移交项）**：定位到 Mira A 星盘内 38×44 像素的 SwiftShader 合成层负载不确定性；`baseline-harness.mjs` 增加覆盖层稳定等待与 manifest 状态指纹，`verify-baseline.mjs` 改为逐视角相邻比对，default 签名消除；断言仍逐字节、不加阈值。详见下文专节。
- **产品文档一致性**：README 补环境音、今晚的 Mira、每日天空三段能力描述；`src/lib/`、`tests/unit/` 目录说明更新到当前实际内容；CONTEXT 术语清单补全；`docs/visual-direction/ASSETS.md` 补录 entry-still-v1.jpg 条目（本项目自身场景捕获，无第三方权利，来源见 SOURCE.txt）。

## 逐条验收标准

### 1. 首访/直达→探索→信息卡→声音→保存→闲置→结语→打断→重播可连续完成

状态：通过。

- 旅程 e2e 单条测试覆盖全链（含回到主视角恢复构图），本地通过（44.7s）。三轮调试红点均为测试编写问题（sr-only 星体入口需走键盘路径、漏 await、快速闲置下精确落点断言改为容差+主动回主视角），第三轮起稳定绿——集成本身一次接通，无产品缺陷需要修复。
- 旅程同时内嵌跨段断言：重载直达后同一 pin 日期天空逐属性一致（直达不改变"今晚"）；读卡/保存期间越过闲置阈值 `data-auto-camera` 保持 `off`；重播期间 `__miraAmbient.liveContexts()===1` 且状态 `running`（不叠音轨）；全程零 pageerror。

### 2. 读卡/导出/故障/后台/reduced-motion 与镜头、声音、日期无冲突；保存结果与当时画面一致

状态：通过（旅程 + 既有专项套件共同覆盖）。

| 边界 | 证据 |
| --- | --- |
| 读卡 × 镜头 | 旅程内嵌断言 + `viewer-control.spec.ts` "reading a card suppresses the takeover; closing it restarts the count" |
| 保存 × 镜头/画面 | 旅程内嵌断言 + `tonight-save.spec.ts` "pressing the entry locks the frame…"、单测 "overlay toggles re-compose the same snapshot"；导出解码断言尺寸/比例/非空/无控件文字 |
| 故障（WebGL 不可用/丢失） | `resilient-entry.spec.ts` 6 例（后备可见、重试可用、恢复不双重注册，含 `liveContexts()===1`）；丢失期间保存入口不可达不冒充静帧 |
| 后台 | `ambient-sound.spec.ts` 后台 suspend/回前台 resume 不追赶；`quality-governor`（#26 证据 + 本票 GPU 协议后台段）；`viewer-control` background 抑制闲置接管 |
| reduced-motion | `viewer-control.spec.ts` "reduced motion never moves the camera but still allows the epilogue text"、`full-opening.spec.ts` reduced-motion 用例、`integration-29/reduced-motion.png` |
| 声音 × 日期/重播 | 旅程断言：pin 日期稳定、重播不叠轨、偏好持久化（`mira:ambient-sound='1'`） |

### 3. build/lint、相关完整行为回归和 CI 通过；低档行为测试与高档美术证据分开

状态：通过。

- 行为测试全程 `?quality=low`（软渲可跑、行为与高档一致，仅粒子数/后处理不同）；美术证据（integration-29 基线集、GPU 协议、静帧）全部高档采集。两者路径互不混用。
- 门槛数字见下表；CI（lint + build + e2e，GitHub Actions ubuntu/SwiftShader）随 PR 运行，见合并记录。

### 4. 按 ADR-0002 经 Vercel 发布可访问构建（预览或生产）并记录版本与 URL

状态：通过（以生产为准；预览的门禁状态如实标注）。

- 生产：https://mira-cosmic-river.vercel.app —— 公开可访问（HTTP 200，页面标题核验），master push 自动部署（ADR-0002 既有回路，本票零手动部署）。**#30 的 iPhone 验收对象即本票合入 master 后的自动生产部署。**
- 预览：本 PR 的 Vercel 预览部署已构建完成（地址见 PR #41 的 Vercel check），但该 Vercel 项目的预览 URL 带账号 SSO 门禁（匿名访问重定向到 vercel.com/login），不能直接交给观看者验收——不静默降级，如实标注。按票面"预览或生产"的口径，可访问构建取生产 URL。
- 版本：旅程/基线/GPU 证据均产自分支 commit d601df1 起的工作树；生产版本以合入 master 的 squash 提交为准（合入后由既有 CI/CD 自动上线，无手动步骤）。

### 5. 真实桌面 GPU：静置约 2 分钟、拖动约 30 秒、连续观看至少 5 分钟，记录设备/浏览器/DPR/画质及帧时间，不使用 SwiftShader 代替

状态：通过。

环境：headed Chromium（生产构建 vite preview），NVIDIA GeForce RTX 4060 Laptop GPU（ANGLE/D3D11，UNMASKED_RENDERER 记录于 JSON，脚本检测到软件渲染即拒绝运行），1440×900，dpr 1，165Hz 显示器，全程最高档，2026-09-18 记录。

| 阶段 | 时长 | 帧数 | 平均 fps | 换档 |
| --- | --- | --- | --- | --- |
| 静置（自然闲置运镜） | 120s | 19524 | 162.2 | 0 |
| 连续拖动 | 30s | 5187 | 162.4 | 0 |
| 真实最小化后台 | 20s | 隐藏期 23 帧（浏览器级节流） | — | 0 |
| 连续观看 | 300s | 48364 | 160.7 | 0 |
| 10x CPU 节流 | 30s | 4572 | 150.7 | 0 |
| 节流解除恢复 | 40s | 6428 | 160.3 | 0 |

末窗帧时间 P75 6.1ms / P95 8.6ms（>25ms 卡顿帧 5/8192）；资源全程几何 24、纹理 11 恒定，JS 堆 12.3→15.0MB（正常 GC 区间，无增长趋势）。60fps 目标大幅超出且无换档振荡。完整时间线在 `integration-29-quality.json`。

### 6. 默认/近景/至少三个旋转视角、竖屏和文字层对照，素材授权记录和故障恢复证据齐全，含新美术下重制的静态后备与加载静帧

状态：通过。

- 对照集：`baselines/integration-29/`（default、near、az90、az180、az270、portrait、reduced-motion）——默认/近景/三个旋转/竖屏齐备，确定性可复现。
- 文字层对照：`evidence/interface-20-card-open.png`、`interface-20-epilogue.png`（interface 套件每次全量运行自动重采，随最终集成刷新）；开场字幕段对照见 `baselines/opening-28/`（t0/t3/t6/t9/t13 + 竖屏三帧）。
- 素材授权：`docs/visual-direction/ASSETS.md`——两张 WebP 密度图（内置 imagegen 原创生成）、环境音（程序化合成）、本票补录的 entry-still-v1.jpg（本项目自身场景捕获，SOURCE.txt 记录来源场景版本）。
- 故障恢复证据：`evidence/fallback-webgl-unavailable.png`、`fallback-context-lost.png` 已按新美术静帧重制（内容核验：同一静帧底 + 可读的重试入口）；行为证据见 `resilient-entry.spec.ts`。
- 静帧：`public/materials/entry-still-v1.jpg` 重制自 01/02 后场景（commit d601df1），加载遮罩与静态后备共用。

### 7. 产品文档与最终实现一致，逐项映射验收；人眼/手机项目明确交给最终验收票

状态：通过。

- README：能力清单补齐（每日天空、环境音、今晚的 Mira）、目录说明更新（lib 纯函数 seam 清单、unit 套件范围）、术语清单与 CONTEXT.md 对齐、静态后备素材提及。命令表与 package.json 一致；Live URL 与部署说明与 ADR-0002 一致。
- 逐项映射：本文件各节即映射。
- 交给 #30（ready-for-human，不由 CI 或 agent 代签）：
  1. 最终美术观感确认（对照集 integration-29 与各档画面气质）；
  2. iPhone 14 Pro Max 实机：进入、拖动/缩放、信息卡开关、声音开关、保存取得图片、横竖屏与安全区域（对象：本票合入后的生产部署）；
  3. 真实网络下的加载体感（本票冷启动数字为局域网 vite preview + headless 软渲读数：中位首帧 203ms/主包 440KB，仅供工程参照，不外推为移动端结论）。

## verify-baseline 间歇失败收口（#24/#26 移交项）

#24/#26 遗留的"verify-baseline 间歇失败（default ~614px/max10、az90 ~4780px/max147 两种固定签名）"在本票调查并加固：

- **复现与定位**：一次性诊断脚本（已删除）复刻 verify 的采集形状——被比较的两帧 default 之间隔着约 40 秒的 az90 采集时，满载后必现 614px/max10；差异定位在 **Mira A 星盘内部 38×44 像素的一块**（x783-821, y466-510），不在任何 DOM 覆盖层。与 #26 调查结论一致：场景图之下（SwiftShader/合成层）的负载相关不确定性，uniforms/变换逐对象比对全等，非代码回归信号。
- **加固一（覆盖层稳定等待）**：`baseline-harness.mjs` 新增 `waitForOverlaySettle`——tail-hint/interaction-hint 等 JS 动画入场（FREEZE_CSS 冻不住）需连续三次读数一致才截图；覆盖层永不稳定时**采集直接失败**（不吞错）。读数作为状态指纹写入 manifest（#24 要求的"逐 run 状态指纹"）——`baselines/integration-29/manifest.json` 七个视角均记录 `1.000,1.000,absent,absent`。
- **加固二（相邻比对）**：`verify-baseline.mjs` 从"整轮 A vs 整轮 B"改为**逐视角背靠背比对**（A(default)→B(default)→A(az90)→B(az90)）。它检验的语义不变——同代码渲染同像素——但不再让被比较的两帧隔着整轮机器搅动。default 签名自此未再出现；az90 的 bloom 光晕签名仅在紧贴满载的首次尝试出现过一次，安静窗口稳定全绿。
- **断言口径不变**：仍为逐字节相等，不加阈值、不静默重试；最终基线采集遵循 #24 既定的低负载窗口协议。
- 验证：满载后首试 az90 曾现旧签名（如实记录），随后连续两次 PASS + 静置一分钟后 PASS——**安静窗口 3/3 全绿**。

## 门槛数字（本分支）

| 门槛 | 结果 |
| --- | --- |
| `npm run build` | 通过（仅有既有的 >500 kB chunk 提示） |
| `npm run lint` | 通过 |
| `npx playwright test`（全量，chromium 84 + unit 201，含新增旅程 e2e） | 285 passed（6.2 分钟，安静环境；一次满载后运行中 daily-sky 逐字节用例出现已知负载签名，单独复跑与后续全量均绿） |
| `node experiments/verify-baseline.mjs` | 安静窗口 PASS（default/az90 逐字节一致；见上节加固记录） |
| `node experiments/measure-quality.mjs integration-29` | 真实 GPU 全协议完成，0 非预期换档（本文件第 5 节） |
| `node experiments/measure-cold-start.mjs` | 生产构建 5 次冷载，中位首帧 203ms（环境见第 7 节交给项 3） |

## 边界与诚实备注

- 旅程 e2e 为单条长测试（本地约 45s，CI 软渲更长，单测超时放宽到 180s）；若未来 CI 时间预算吃紧，优先压缩的是 cinematic-scale 而不是断言。
- `baselines/after/` 等 #19 时代基线有意保留未重捕：它们是 #19 的历史证据；当前美术的权威对照集是 `integration-29/`。
- 冷启动与 GPU 数字均为本机（RTX 4060 Laptop / 165Hz）读数，作为工程证据；跨设备观感与真机项归 #30。
