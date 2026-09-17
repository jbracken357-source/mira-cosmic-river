# Issue #19 验收证据汇总（工程侧）

对应工单：docs/design-audit-2026-09-17/tickets/01-river.md。本文件按验收标准逐条给出工程证据。

**重要说明**：以下截图与测试是工程证据，证明路径可复现、可回归、资源可管理；最终美学确认属于观看者（#30），不以本文件代替。

**AI 参与声明**：本变更及其证据描述由 AI 辅助完成。

## 逐条验收标准

### 1. 默认与至少三个旋转视角具有真实视差，无矩形边缘、重复亮圈或明显接缝；自由探索不受新限制

状态：工程证据齐备，待观看者确认（#30）。

- 同基线四视角对照：`baselines/after/{default,az90,az180,az270}.png` 对 `baselines/before/` 同名文件，另有 `near.png` 近景。同一 epoch、相机位姿与动画相位（见各 `manifest.json`）。
- 视差来源：光河是分布在弯曲三维中心线上的多层网格（`src/components/Scene/RiverVeil.tsx` 的 `createLayer`），旋转视角下层间遮挡关系真实变化。
- 无矩形边缘：顶点着色器只让每层截面朝向观察者（"Only its cross-section faces the viewer"），配合 UV 四边渐隐（fragment 中 `edge` 项），避免侧视卡片与硬边。
- 无重复亮圈：fragment 中 lane 项让亮料沿尾部走向集中，而非把源图的闭合涡流逐个点亮（代码注释明确此意图）。
- 自由探索：未改 OrbitControls 配置，无新交互限制。

### 2. 亮部有细节、暗部有结构，光河方向清楚，不靠全局 bloom 或单纯加粒子数

状态：工程证据齐备，待观看者确认（#30）。

- 受光模型为纯函数 `src/lib/riverLighting.ts`：双星衰减（`starLightFalloff`）、暗部保结构（亮度下限 .75，`veilLightResponse`）、天空亮度/色温耦合（`skyRiverGain`）、分层权重（`veilLayerWeight`）。
- 单元测试 `tests/unit/riverLighting.spec.ts`（17 例）覆盖：衰减单调且无硬截断（"never cuts off sharply"）、暗部不为黑、受光单调、金色高光只在主星近旁、accent 层权重低于体积层。
- 未调整全局 bloom 参数，未增加粒子数；粒子密度反而通过 `tailBaseOpacity` 在低档位补偿单点亮度。
- 视觉对照见 `baselines/before/` 与 `baselines/after/` 同名视图（比较口径见 README 的 cross-change caveat：同代码像素级一致，跨代码按图像判断）。

### 3. 桌面与竖屏/减少动态效果路径可展示；贴图失败有确实可见的程序化回退

状态：通过。

- 竖屏：`baselines/after/portrait.png`（390×844，fov 自动放宽，见 manifest）。
- 减少动态效果：`baselines/after/reduced-motion.png`。
- 贴图失败回退：`baselines/fallback/default.png`（`experiments/capture-fallback-check.mjs` 强制 `materials/*.webp` 404，程序化尾部仍确实可见）；e2e `tests/e2e/river-material.spec.ts` 第二例（缺图移动端场景可用，无横向滚动、无控制台错误）通过。
- 回退亮度保障由单测覆盖："the procedural fallback stays visibly brighter than the textured path"。

### 4. 记录素材来源、使用权和用途，资源可释放；提供相同基线的前后对照

状态：通过。

- 来源/用途/使用权：`docs/visual-direction/ASSETS.md`。全部素材为 2026-09-12 内置 imagegen AI 生成（非实拍、不含第三方版权素材），逐文件记录用途与体积；slice 3 补充了明确的使用权条款与外部参考（NASA/ESO 等仅形态研究、未嵌入）的许可说明。
- 资源可释放：`RiverVeil.tsx` effect 清理中 `texture.dispose()`（手动加载的 river-density 纹理）并逐层 `geometry.dispose()`/`material.dispose()`；`MiraTail.tsx` 两个 effect 分别释放粒子几何体与材质。slice 3 复核确认无遗漏，未新增代码。
- 前后对照：`baselines/before/`（基线引入时，commit 53d36a0）与 `baselines/after/`（切片 2 校准后，manifest 记录 403c371，即 2b7beed 修订前同一内容），同 epoch、同位姿、同相位。

### 5. 交付可复现的截图基线方法：固定日期、随机种子、相机与动画相位，冻结星空闪烁

状态：通过。

- 方法文档：`baselines/README.md`；实现：`src/lib/captureMode.ts`（dev-only，PROD 不受影响）、`experiments/baseline-harness.mjs`、`experiments/capture-baseline.mjs`。
- 固定项：epoch `2026-09-12T00:00:00Z`；种子 StarField `mulberry32(0x5eed1a)`、尾部 LCG 17、MaterialStream 索引哈希；相机预设逐帧重放、自动旋转与阻尼关闭；全部时间 uniform 停在 `CAPTURE_TIME=8`（含星空闪烁）；质量档钉在 high；DOM 动画冻结。
- 可复现性验证：`node experiments/verify-baseline.mjs` 连续两轮捕获像素级一致（max per-pixel channel diff 0，byte-identical，exit 0）。
- 每套基线附 `manifest.json` 记录上述全部参数与捕获时 commit。

### 6. 工程 build/lint 与相关回归通过；这是可运行的视觉切片，不交付孤立素材文件

状态：通过（2026-09-17，slice 3 全量复跑）。

- `npm run build`：通过（tsc -b + vite build，1017 modules；仅有既有的 >500 kB chunk 提示）。
- `npm run lint`：通过，0 错误。
- `npx playwright test` 全量：59 passed / 0 failed（22 chromium e2e + 37 node unit，约 2.0 分钟）。
- `node experiments/verify-baseline.mjs`：PASS，exit 0。
- 素材经 `public/materials/` 随生产构建复制，由运行时代码加载，非孤立交付。

## 本轮发现并修复的 flake（未静默任何测试）

- `tests/e2e/phase-readout.spec.ts:53`：全量套件中稳定失败、单独运行通过。根因：测试在固定屏幕坐标点击 Mira A，而探索态相机自动旋转（Scene.tsx autoRotate 0.3）；软件渲染下第二次导航后相机已漂移，点击落空（证据：`info-card` 15s 未出现，页面快照显示探索 UI 正常）。修复：测试内 `page.emulateMedia({ reducedMotion: 'reduce' })`（与应用内 reduceMotion 关闭自动旋转的行为对齐，先例见 river-material.spec.ts:29），断言内容不变。修复后全量套件 59/59 通过。
- `verify-baseline.mjs` 首轮偶发 FAIL（az90，11154/1296000 像素差异，max 164/255）：紧随全量套件运行、机器负载高时，贴图/着色器首次就绪可能超过 10s 探针，截图落入静默降级分支。修复：`baseline-harness.mjs` 的 `sceneResourcesReady` 在降级前重试一次探针。修复后连跑两轮均 byte-identical PASS。

## 遗留事项

- 最终美学验收（视角 1、2 条的"可信/清楚"判断）由观看者在 #30 完成。
- `after/manifest.json` 的 gitCommit 指向修订前的 403c371（内容与 2b7beed 相同）；如需严格对应可重捕获，不影响同基线对照有效性。
