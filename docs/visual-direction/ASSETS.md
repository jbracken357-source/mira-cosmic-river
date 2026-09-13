# 素材与复现

2026-09-12，全部由内置 imagegen 生成，非望远镜实拍。

| 文件 | 用途 | 当前状态 |
|---|---|---|
| dreamlike.png | 已选色彩与气质参考 | 仅概念图 |
| epic.png | 已选纵深与尺度参考 | 仅概念图 |
| ../../experiments/assets/river-density-v1.png | 单层灰度气流密度；亮度→透明度，着色交给 shader | 2172×724 PNG，990285 bytes；实验可用，尚未做交付压缩 |
| ../../public/materials/river-density-v1.png | 同一素材的正式场景副本 | 本地 V1 已接入；随生产构建复制 |

密度图生成约束：纯黑底；单条水平银白薄雾，右窄左宽；细丝与涡流；四边柔和淡出；无星星、双星、文字、颜色或光源；用于弯曲网格的局部纹理。原始文件保持不变。无需假设 PNG 有 alpha，shader 直接读取灰度。

这张图不是无缝纹理，不可直接 RepeatWrapping 做无限滚动。实验使用小幅正弦 UV 扰动及独立边缘渐隐。后续若需方向明确的持续输运，应设计流场/平铺素材并单独检查接缝。

原始概念生成记录位于当前任务的 imagegen 输出。外部天文参考在前期用于形态研究，未直接嵌入本实验：

- https://science.nasa.gov/photojournal/mira-soars-through-the-sky/
- https://www.solarsystemscope.com/textures/
- https://www.eso.org/public/copyright/

## 检查复现

在项目根启动 `npm run dev -- --host 127.0.0.1 --port 5186 --strictPort`，随后运行：

```
node experiments/verify-river.mjs
npx tsc --ignoreConfig --noEmit --target es2023 --module esnext --moduleResolution bundler --skipLibCheck experiments/river-study.ts
npx eslint experiments/river-study.ts
```

agent-browser CLI 在本机不可用，因此本轮浏览器验证使用仓库已安装的 Playwright。检查脚本不会覆盖正式项目用例。截图只是有限视角可行性证据，不能表示与概念图等质或真实手机性能通过。
