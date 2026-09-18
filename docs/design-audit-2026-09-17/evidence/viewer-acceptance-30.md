# Issue #30 验收记录：观看者美术确认与发布收尾

对应工单：docs/design-audit-2026-09-17/tickets/12-viewer-acceptance.md。本票属观看者本人；以下按票面第 4 条把**工程完成、视觉认可、真机证明、发布状态**四层分开记录，不以自动化结果代签任何人工项。

**AI 参与声明**：验收记录整理、生产冒烟与版本核对由 AI 辅助完成；视觉认可与关闭决定来自观看者本人的明确表态。

## 四层状态

### 1. 工程完成（#19–#29）

全部合入 master（最终提交 b10948d），每票有独立证据文档与门槛记录：

| 票 | 证据 |
| --- | --- |
| #19 光河体积 / #25 双星质感 / #28 完整开场 / #26 画质后台 / #27 每日天空 / #29 集成收口 | `baselines/EVIDENCE-19.md`、`evidence/binary-25.md`、`baselines/opening-28/`+`evidence/opening-28.md`、`evidence/quality-26.md`+`quality-26.json`、`evidence/daily-sky-27.md`+`baselines/daily-sky-27/`、`evidence/integration-29.md`+`integration-29-quality.json`+`baselines/integration-29/` |
| #20 界面 / #21 闲置运镜 / #22 环境音 / #23 今晚静帧 / #24 进入恢复 | `evidence/interface-20.md`、`evidence/`（viewer-control/ambient-sound/tonight-save/resilient-entry 套件与证据图） |

master CI（lint + build + e2e）在 b10948d 上绿（8m27s，2026-09-18T12:39Z 起）。

### 2. 视觉认可（观看者本人）

**观看者原话（2026-09-18，关闭 #30 的指示）**："可以，先验收，然后票和issue 先收尾，我大概看过了一眼目前还算满意。"

这是一次**总览性的认可**：观看者看过当前成果并表态满意，据此指示收尾。未逐项区分默认/近景/旋转/开场/结语五个画面分别确认，环境音也未单独记录试听结论——按观看者意愿以总览认可收尾，如实记录，不拆分代签。后续若有观感反馈，走新票修正。

### 3. 真机证明（iPhone 14 Pro Max）

**未做逐项实机检查**（进入/拖动缩放/读卡/声音/取得图片）。已有的替代性证据与边界：

- 生产冒烟（见下节）覆盖移动视口（iPhone UA + 触屏模拟）的进入、直达、声音开关、保存面板与预览、触屏 tap，零页面错误——但这是**桌面浏览器模拟，不是真机**；
- 工程侧行为回归（Playwright 全量 285 例）覆盖同一批能力的逻辑路径。

观看者在知悉未做逐项实机的情况下选择收尾。若日后真机出现问题，走新票。

### 4. 发布状态（真实部署核对）

- 生产 URL：https://mira-cosmic-river.vercel.app （HTTP 200）。
- **版本核对（票面第 5 条）**：本地从 b10948d 构建产物为 `assets/index-Dq13toWt.js` + `assets/index-B0wMVUQk.css`（Vite 内容哈希命名）；生产 index.html 引用的资源名**完全一致**，且 bundle 可取（200）——生产运行的就是 b10948d。部署经 Vercel 自动完成（ADR-0002），无手动步骤。
- 预览部署存在 SSO 门禁（见 integration-29.md 第 4 节），不影响生产可访问性。

## 生产冒烟（2026-09-18，b10948d）

`node experiments/smoke-production.mjs`（本票转正为常驻部署核对工具）：

- 桌面 1440×900 首访：完整开场播放 → 进入场景，canvas 可见，**0 pageerror / 0 console error**。
- 移动视口 390×844（iPhone UA、触屏）回访：直达（无开场）、canvas 可见、环境音开关切至 `aria-pressed="true"`、今晚的 Mira 面板打开且预览锁定、触屏 tap 无异常，**0 错误**。

结果：PRODUCTION SMOKE: PASS。

## 结论

按观看者 2026-09-18 的明确指示，#30 以"总览性视觉认可 + 工程与发布证据齐全 + 真机项知情缓办"收尾。本轮设计审计（#18 总 Spec，子票 #19–#30）至此全部交付。
