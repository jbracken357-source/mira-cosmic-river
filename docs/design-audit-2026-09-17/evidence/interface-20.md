# Issue #20 验收证据（工程侧）：界面清楚可读且可键盘触控操作

对应工单：docs/design-audit-2026-09-17/tickets/04-interface.md。本文件按验收标准逐条给出工程证据；最终观感确认属于观看者（#30），不以本文件代替。

**AI 参与声明**：本变更及其证据描述由 AI 辅助完成。

## 字体方案（票面要求的第一个外部依赖）

- **正文/控件中文**：Noto Serif SC（思源宋体）可变字重（wght 200–900 保留）子集，自托管 woff2，142 KB / 721 字形 → `public/fonts/mira-serif-sc.woff2`。
- **结语（epilogue）**：LXGW WenKai（霞鹜文楷）Regular 子集，自托管 woff2，66 KB / 494 字形 → `public/fonts/mira-wenkai.woff2`。
- **英文**：系统字体栈（Georgia / 'Times New Roman' serif 方向）；数字读数用系统等宽栈。Cinzel/Inter/JetBrains Mono 的 Google Fonts 外链已从 index.html 移除，改为本地 preload 两个 woff2。
- **font-family 命名**：`Mira Serif SC` / `Mira WenKai` 自定义名（src/index.css:6,14），不触碰 OFL 保留名称条款。
- **授权**：两款均为 SIL OFL 1.1，许可全文随字体入库（`public/fonts/OFL-NotoSerifSC.txt`、`public/fonts/OFL-LXGWWenKai.txt`）。LXGW 上游许可显式允许"子集化/格式转换后仅作 web font 交付"。来源、版本、日期、子集命令记录于 `public/fonts/SOURCE.txt`。
- **子集方法**：`experiments/build-font-subset.mjs` 从 `src/constants/translations.ts` 提取全部 en/ch 文案字符 + 可打印 ASCII + 界面直接渲染的少量字符（×、中文/EN、·、…），生成 `public/fonts/subset-glyphs.txt`（311 个唯一字符），pyftsubset（fontTools 4.63.0）`--flavor=woff2 --layout-features='*' --no-hinting --desubroutinize`。
- **加载策略**：`font-display: swap` + `<link rel="preload">`（index.html）；回退栈完整，字体未到时系统 serif 接管，不阻塞渲染。

## 逐条验收标准

### 1. 中英文标题、正文、结语采用实际可用的字体/回退；页面语言与完整开场进入按钮随选择同步

状态：通过。

- 字体令牌：`--font-display` / `--font-body` = Georgia, 'Times New Roman', 'Mira Serif SC', serif（拉丁走系统 serif，中文落到自托管子集）；`--font-epilogue` = 'Mira WenKai' 优先（src/index.css:37-41）。结语的硬编码 `fontFamily: 'Caveat', 'Cinzel'` 已改走令牌（src/components/UI/ClosingMessage.tsx，`font-epilogue` 类）。
- 页面语言同步：`App.tsx:44-48` 的 effect 把 `<html lang>` 同步为 `zh-CN` / `en`（此前 index.html 硬编码 `en`，与默认中文文案不符）。
- 完整开场的提前进入按钮：新增翻译键 `enterEarly`（en "Enter early" / ch "提前进入"，translations.ts:36,108），替换 CinematicOverlay.tsx:59 的硬编码 "Skip"；标识符遵守领域语言（直达/提前进入），存量 testid `skip-cinematic` 未改名。
- e2e：interface.spec.ts "the document language follows the copy, in explore and during the opening" —— 切换语言后 html lang 与按钮文案同步，重进完整开场后提前进入按钮文案跟随。
- 字形覆盖守卫：`tests/unit/fontSubset.spec.ts` 断言 translations 全部字符 ⊆ subset-glyphs.txt，且 woff2 存在且保持子集体积；文案新增字符而忘记重建子集时该测试先红。

### 2. 主要控件点击区域约 44px，有可访问名称、焦点态和清晰对比；滑杆有关联标签

状态：通过。

- 44px：`replay-opening`、`language-toggle`、`skip-cinematic`、`tail-hint`、`info-card-close`、`interaction-hint-recall`、两个星体键盘触发点均补 `min-h-11 min-w-11`（return-to-view、pause-toggle、ambient-toggle、tonight-save 存量已有）；header 按钮行补 `flex-wrap`，窄屏换行不溢出。
- 可访问名称：skip-cinematic `aria-label={t.enterEarly}`、replay-opening `aria-label={t.replayOpening}`、pause-toggle `aria-label` 跟随播放态、tail-hint `aria-label={t.tailHint}`、info-card-close `aria-label={t.tonightClose}`；其余按钮以可见文本命名。
- 焦点态：元素级统一焦点环（src/index.css:118-124，`button/input/[role=button]:focus-visible` 用 nebula-violet 2px outline），不再逐按钮堆类。
- 滑杆：timeSpeed 的 `<span>` 改为 `<label htmlFor="tail-time-speed">`（InfoCards.tsx:158,164），e2e 用 `getByLabel('时间速度')` 验证关联。
- e2e：interface.spec.ts "the main explore controls keep a 44px target on a phone-sized viewport"（390×844 下 7 个控件 boundingBox ≥44）、"the direct-entry button keeps a 44px target during the opening"、"tabbing to a control shows the shared focus ring"。

### 3. 键盘可访问星体信息，Esc 关闭并恢复到合理入口；桌面非模态卡不无故锁焦点

状态：通过。

- 键盘入口：canvas 不可聚焦，ExploreUI footer 新增 `star-trigger-miraA` / `star-trigger-miraB`（CinematicOverlay.tsx:202-218），`sr-only focus-within:not-sr-only`——屏幕阅读器与 Tab 可达，聚焦时现形；尾巴沿用常驻的 tail-hint。
- Esc 与焦点：InfoCards.tsx:45-72——打开时记住 `document.activeElement` 并把焦点移上卡片（`tabIndex={-1}`），关闭后焦点回到触发元素；Esc 监听器仅在卡片打开时挂在 window。卡片为非模态 `role="region"` + `aria-label`（InfoCards.tsx:99-100），不锁焦点。
- e2e：interface.spec.ts "a star trigger opens its card; Esc closes it and focus returns to the trigger"（断言 `toBeFocused` 双向）、"the close control has an accessible name and closes with the keyboard"。

### 4. 320/390/430px、横屏与安全区域可用；卡片不遮住必要关闭操作

状态：通过。

- 安全区 padding 沿用既有 `env(safe-area-inset-*)` 先例（header/footer/卡片均带）。
- e2e 四档：320×568、390×844、430×932、844×390 横屏（interface.spec.ts 末段参数化）——pause/replay/language/tail-hint 可见，卡片打开后关闭按钮可见且可点。截图：
  - `evidence/interface-20-320x568.png`（控件换行两行，不溢出）
  - `evidence/interface-20-390x844.png`
  - `evidence/interface-20-430x932.png`
  - `evidence/interface-20-844x390-landscape.png`

### 5. 信息卡进入约 180–240ms、退出约 120–180ms，减少动态即时或短淡变，不作位移动画；操作提示退场后可重新发现

状态：通过。

- 时长提成命名常量 `INFO_CARD = { ENTER: 0.21, EXIT: 0.15 }`（constants/animation.ts:106-109），InfoCards 进出分别引用；`tests/unit/animationTiming.spec.ts` 把 180–240/120–180 窗口钉死。
- 减少动态：`riseEnter`/`riseExit` 在 `useReducedMotion` 下为 0 且时长为 0——即时淡入，无任何位移（InfoCards.tsx:26-29）；e2e "reduced motion opens the card without any displacement" 断言 computed transform 无位移。
- 操作提示：interactionHint/interactionHintMobile 在观看者首次操作场景后淡出退场——监听落在 canvas 上的 pointerdown/wheel/touchstart（UI 按钮上的点击不算场景操作，CinematicOverlay.tsx:131-148）；退场后 footer 留常驻低透明 `interaction-hint-recall` 小按钮（44px，aria-label 为提示文案）可唤回。MilestoneHint 一次性逻辑未动。
- e2e："the first scene manipulation retires the hint; a quiet entry brings it back"。

## 回归与门禁

- `tests/e2e/interface.spec.ts`：13 例全过（键盘 3、触控/焦点 2、语言 2、提示 1、动效 1、viewport 4）。
- `tests/unit/fontSubset.spec.ts` + `animationTiming.spec.ts`：5 例全过。
- 全量 `npx playwright test`：见下方门禁输出。
- `node experiments/verify-baseline.mjs`：PASS——default/az90 两视图 byte-identical（基线为 3D 场景视图，UI 文字不入画，字体变更无影响，无需重捕基线）。
- `npm run build` / `npm run lint`：通过（build 仅有存量 chunk 体积提示）。
