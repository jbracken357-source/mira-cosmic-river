# 光河接入记录

2026-09-13；基于已同步的 master `ff8261f`，工作分支 `codex/hybrid-river`。本地实现，未推送、未部署。

## 实现

正式 R3F 场景增加 RiverVeil：5/3/2 层对应 high/mid/low，一张 2172×724 灰度图共用。各层中心线在三维空间内，横截面朝向观看方向，允许保留既有自由旋转；这是面向视角的曲面技术，不是完整体积模拟。UV 小幅扰动使气流变化，边缘遮罩压掉黑底和裁切边。光河 WebP 约 78 KB，解码后含 mipmap 的理论 RGBA 存储约 8 MiB；各层共享，不按层重复上传。实际设备显存未测。

MiraTail 原先创建了 materialRef 但未绑定，导致 uOpacity 始终为零。本轮改为从实际 points ref 更新材质，粒子恢复可见；随机种子固定。贴图加载成功时粒子只作细碎点缀，失败时提升粒子透明度，主场景仍可使用。每帧时间依赖 delta，减少动态效果时新增气流和粒子扰动停止。纹理、几何、材质卸载时释放。

星体增加独立灰度密度图，明暗与颜色仍由 shader 计算；图像接缝及两极与程序化细节混合，缺图时保留程序化星体。大气更收敛，吸积盘降低过曝并加入剪切结构。物质流从巨星表面弯向伴星，修复整体旋转使端点脱节的问题，减少每帧向量分配；流粒子由 5000 减到高档 600、中档 300、低档 150。可见公转放慢，星体与物质流尊重 reduced-motion，移除常驻轨道示意线。

窄屏原先沿用桌面垂直视野，导致双星被裁出屏幕。本轮按 aspect 调整 FOV，并为竖屏添加斜向场景与对应相机预设；横竖切换还原构图。桌面远景展示主要光河，结语镜头缓慢拉远。修复开场结束后 OrbitControls 目标与镜头目标不一致的问题。开场文案缩为三句相伴叙述，使用单一 AnimatePresence 等待淡出，避免文字重叠。

正式资源采用浏览器原生 WebP 导出（quality 0.92，保持像素尺寸），两张合计 661906 bytes，比原始 PNG 的 4248173 bytes 减少约 84.4%。原图在 experiments/assets 中保留，发布构建仅带两张 WebP。PNG 到 WebP 是分发格式导出，原始生成图未覆盖。

## 验证

- `npm run build`：通过；仍有主包大于 500 kB 的构建提示，未在本轮扩展拆包。
- `npm run lint`：通过。
- `npx playwright test --reporter=list`：V1—V3 与 WebP 接入后 42 项通过，包括新增双素材加载/缺图回退用例。
- 最后的文案与近景调整后，direct-entry、mira-cosmic、language-test 首次复测 9 项通过、2 项因仍匹配旧开场文案失败；同步文案断言后，direct-entry 与 mobile 共 7 项全部通过。build/lint 再次通过。
- `experiments/capture-integration.mjs`：默认高档、3 个旋转视角、390×844 中档、缺图低档均没有捕获到 pageerror；挂载资源确认分别 5/3/2 层；成功路径纹理 ready=1，失败路径 ready=0 且无纹理。详见 [资源读数](evidence/integration-resources.json)。
- 人工查看截图：光河连续、无矩形黑底，多角度可见；缺图时有稀疏粒子回退。窄屏已能完整显示双星主体。
- 原工具 agent-browser 不可用，使用仓库已安装 Playwright 完成浏览器验证。
- `experiments/capture-opening.mjs` 检查实际生产构建：两张 WebP 均 HTTP 200，完整开场能结束并交给探索，390×844 与 844×390 切换无 JS 错误/横向溢出。见 [生产读数](evidence/production-check.json)。

## 画面对照与边界

- [接入前](evidence/integration-before.png) / [接入后低档](evidence/integration-after.png)：相同视口、相同真实时钟 pin；装饰轨道截帧时刻不同，不能当逐像素差异证据。
- [当前高档](evidence/integration-high.png)、[旋转 1](evidence/integration-orbit-1.png)、[旋转 3](evidence/integration-orbit-3.png)、[手机](evidence/integration-mobile.png)、[缺图回退](evidence/integration-fallback.png)。

第一轮 V1 接入时星体扁平、吸积盘过白的截图留在历史提交中；当前首版已经改善这些问题并完成构图。当前效果仍是实时网页对概念图的艺术转译，不等同于预渲染电影画质，最终美术认可仍由观看者给出。测试依赖桌面 Chromium，真实手机性能、发热与触控尚未验证；V4 的真机验收不能标完成。未承诺全部自由视角都达到最终美术标准。

生产截图：[近景](evidence/opening-near.png)、[拉远](evidence/opening-pullback.png)、[探索远景](evidence/opening-far.png)、[竖屏](evidence/production-portrait.png)、[横屏](evidence/production-landscape.png)。截图采样受软件渲染耗时影响，是镜头阶段示例，不是逐帧性能证据。

本地开发：`npm run dev -- --host 127.0.0.1 --port 5186 --strictPort`。生产预览：构建后 `npm run preview -- --host 127.0.0.1 --port 5187 --strictPort`。experiments/river-study.html 仍保留为早期材质实验，不是正式产品页。
