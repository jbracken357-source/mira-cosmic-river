# Issue #25 验收证据（工程侧）：双星与来流形成统一质感

对应工单：docs/design-audit-2026-09-17/tickets/02-binary.md。本文件按验收标准逐条给出工程证据；最终观感确认属于观看者（#30），不以本文件代替。

**AI 参与声明**：本变更及其证据描述由 AI 辅助完成。

## 改动内容

新增纯函数标定模块 `src/lib/binaryLighting.ts`（沿用 `riverLighting.ts` 的纯函数 + GLSL 镜像 + 奇偶守卫模式；镜像由 `tests/unit/shaderParity.spec.ts` 守护，数学由 `tests/unit/binaryLighting.spec.ts` 覆盖，17 例）：

- **巨星 Mira A（`src/shaders/miraA.ts`）**：`surfaceDetailStrength(region, limb)` 让高频颗粒感集中在大尺度斑块内、并向临边衰减（地板 0.25，不再满表面同强度）；密度贴图对比度与热斑高光项同乘该系数；最终颜色过 `highlightShoulder`（膝点 0.85、上限 1.35 的软肩），亮核保留色相而不再削成死白。
- **白矮星 Mira B（`src/components/Scene/MiraB.tsx`、`src/shaders/miraA.ts` 的 `MIRA_B_CORONA`）**：核心着色器同样过 `highlightShoulder`，平坦强度 0.85 → 0.72；corona 壳收紧（opacity 0.26 → 0.16、falloff 1.7 → 2.2），白珠感消退，星体与吸积弧都可辨认。
- **吸积弧（`src/shaders/accretionDisk.ts`）**：弧包络改用镜像的 `arcEnvelope`（撞击弧宽 0.85、余波偏移 2.35/宽 0.6/增益 0.38、轨道底迹 0.05，原完整圆环底迹 0.08 且弧更宽）并乘 `arcClump`（地板 0.25 的断续团块）；热斑用 `hotSpotProfile` 镜像，仍由 `uImpactAngle` 逐帧对准 Mira A 方向。硬边完整椭圆环消失。
- **来流（`src/components/Scene/MaterialStream.tsx`）**：每帧按 `streamClump(t, seed)` 调制每粒子亮度（加色混合下即透明度）——中段成断续团块（地板 0.12），两端锚定全亮，离开巨星与抵达热斑都不断开；端点仍取两星实时位置，粒子数不变。

未动：Bloom 参数、粒子数、相机/轨道几何、UI 文案、capture 模式本身。

## 逐条验收标准

### 1. 近景和远景均能辨别双星，核心无大片死白，巨星避免满表面同强度高频纹理

状态：通过（默认远景一项见下方诚实备注）。

- 对照捕获：`baselines/binary-before/`（adb59b5）→ `baselines/binary-after/`（1a653d3），同 epoch 2026-09-12、同相位、同机位。
- 死白的量化证据（全图三通道均 >240 的像素数，逐视图 before → after）：az90 **366 → 1**、az180 **20 → 0**、az270 **116 → 0**、portrait **7 → 1**、default/near/reduced-motion **0 → 0**。死白簇心均在白矮星及其硬环处（如 az90 质心 (1062,621)），改动后消失。
- 巨星表面：`binary-after/near.png` 与 `az270.png` 可见大尺度明暗斑块与平滑区交替，临边颗粒感收敛；`binary-before/near.png` 为满表面同强度高频颗粒。
- 双星可辨：az90 / az180 / az270 / portrait 四视图中两星清楚可辨（before/after 同相位同机位）。
- **诚实备注（待 #30 观看者确认）**：在冻结相位（轨道角 4 rad）下，default 与 near 机位里伴星恰在巨星临边内侧的雾中，只有两个机位都几乎不可辨（蓝色主导像素仅约 18–22 px，before/after 完全一致，非本次回归）；实时观看中公转持续把伴星带离临边。几何未改，是否在捕获机位上进一步拉开属于美术决策。

### 2. 吸积流为柔软断续弧，来流与热斑随两星运动保持连接，无明显硬质完整圆环

状态：通过。

- `binary-before/az90.png`、`az180.png` 中白矮星为白珠加硬边完整椭圆环；`binary-after` 同视图中环消失，只余来流一侧的柔软弧与团块（az180 局部对照最明显）。
- 连接：热斑角度仍每帧由 `positionsRef` 的 A→B 矢量解算（`MiraB.tsx` 未改该路径）；来流两端锚定全亮（`streamClump(0)=streamClump(1)=1`，有单测），az180/az270 捕获中可见来流自始至终连接两星。
- 断续：`arcClump` 与 `streamClump` 的地板/间隙行为由 `tests/unit/binaryLighting.spec.ts` 固定（弧内最小值 < 地板+0.15、最大值 > 0.85；来流中段有真实间隙）。

### 3. 时间绑定、信息卡、自由旋转和减少动态效果不回归

状态：通过。行为回归全部走既有套件，见下方门槛数字：`npx playwright test` 197/197（含 real-time 绑定、信息卡键盘路径、自由旋转、减少动态效果、闲置接管、保存、声音等 e2e）。reduced-motion 捕获视图（`binary-after/reduced-motion.png`）与 default 同构图正常。

### 4. 同日期/相位的桌面近远景、旋转及竖屏对照和行为回归齐全

状态：通过。

- `baselines/binary-before/` 与 `baselines/binary-after/` 各 7 视图（default、near、az90、az180、az270、portrait、reduced-motion），manifest 记录同一 epoch 与相位。
- 无贴图路径：`experiments/capture-fallback-check.mjs` 重采 `baselines/fallback/default.png`——程序化表面与尾巴仍然可见，场景为可辨认的完整画面（该视图中伴星本就在巨星后方，与贴图路径的 default 一致）。
- `node experiments/verify-baseline.mjs`：PASS（default、az90 两次重采逐字节一致）。

## 门槛数字（本分支 1a653d3）

| 门槛 | 结果 |
| --- | --- |
| `npm run build` | 通过（仅有既有的 >500 kB chunk 提示） |
| `npm run lint` | 通过 |
| `npx playwright test --project=unit` | 147 passed |
| `npx playwright test`（全量） | 197 passed |
| `node experiments/verify-baseline.mjs` | PASS |

## TDD 记录

- RED：d08f16e 先提交 `tests/unit/binaryLighting.spec.ts` 与 shaderParity 扩展——模块不存在时运行报 `Cannot find module .../src/lib/binaryLighting`；实现纯函数后 17 例数学测试转绿、4 例 GLSL 镜像测试仍红（着色器未改）；着色器镜像落地后 147/147 全绿。
- 视觉迭代用捕获而非单测验证：binary-wip1（表面 + 弧 + 来流）→ binary-wip2（白矮星核心软肩）→ binary-wip3（corona 收紧），wip 标签已清理，最终态即 `binary-after`。

## 提交

- `7d3ae81` Capture binary-before baselines for #25
- `d08f16e` Add failing binary lighting calibration specs for #25
- `1a653d3` Unify binary and inflow texture: patchy giant, soft accretion arcs (#25)
- 本证据文件与 binary-after/fallback 基线随后续提交入库。

最终美术验收（去塑料感目标样张 `docs/visual-direction/wayfinder/no-plastic-target-v1.png` 的整体气质）属于观看者，见 #30。
