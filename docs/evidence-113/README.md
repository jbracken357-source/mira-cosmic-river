# #113 的证据帧（小字底线与信息卡焦点框）

配方与 e2e 一致（`?quality=low&epoch=2026-09-12`，直达 + learned-controls；AFTER 帧由
text-floor.spec 的 evidence captures 常驻测试每次全量跑重渲）。before-*.png 取自 #111
基线（0308911），after-*.png 为 #113 落地后同口径帧。

- 桌面对（`desktop-1280x720-explore` / `-info-card` / `-tonight-panel`）— 操作提示、
  键盘触发器、相位方向、今晚面板标题/选项从 10–11px / 45% 提到 12px / 55%；信息卡
  键盘打开后不再有浏览器默认焦点框（卡片自有边框表示所在）。
- 390×844 对（`mobile-390x844-bar` / `-more-panel` / `-info-card`）— compact 顶栏中文
  12px（compact-label 的 zh 档），「更多」面板按钮 12px，底部 sheet 信息卡正文 12px。

## 顶栏 12px × #111 单行（张力实测）

毕业后 + 离开主视角（主视角、今晚的 Mira、环境音、更多 全上）的 compact 行实测
（e2e `text-floor.spec › compact 顶栏在 12px 中文下仍是一行`）：

| 帧 | 语言 | 行高 | 单行 |
| --- | --- | --- | --- |
| 390×844 | zh | 76px（与安静第一眼同高） | 是 |
| 320×568 | zh | 76px | 是 |
| 390×844 | en | 76px | 是（#111 既有钉） |
| 320×568 | en | 128px | 否 — #111 基线（10px）即两行，非 #113 回归 |

zh 满行实测宽度（12px）：今晚的 Mira 69px、环境音 52px、主视角/更多 44px（min）。
en 在 12px 下无法单行：「Ambient sound」一词就有 103px，390 满行需 ~318px > 可用
~303px。故 compact-label 按语言分档：zh 12px（底线），en 保留 #111 调好的 10px
（320 单行余量按它调的）。
