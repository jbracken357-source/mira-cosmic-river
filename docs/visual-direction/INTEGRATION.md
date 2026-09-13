# 光河接入记录

2026-09-13；基于已同步的 master `ff8261f`，工作分支 `codex/hybrid-river`。本地实现，未推送、未部署。

## 实现

正式 R3F 场景增加 RiverVeil：5/3/2 层对应 high/mid/low，一张 2172×724 灰度图共用。各层中心线在三维空间内，横截面朝向观看方向，允许保留既有自由旋转；这是面向视角的曲面技术，不是完整体积模拟。UV 小幅扰动使气流变化，边缘遮罩压掉黑底和裁切边。密度图约 0.99 MB，纹理含 mipmap 的理论 RGBA 存储约 8 MiB；各层共享，不按层重复上传。实际设备显存未测。

MiraTail 原先创建了 materialRef 但未绑定，导致 uOpacity 始终为零。本轮改为从实际 points ref 更新材质，粒子恢复可见；随机种子固定。贴图加载成功时粒子只作细碎点缀，失败时提升粒子透明度，主场景仍可使用。每帧时间依赖 delta，减少动态效果时新增气流和粒子扰动停止。纹理、几何、材质卸载时释放。

窄屏原先沿用桌面垂直视野，导致双星被裁出屏幕。本轮保留相机位置和交互方式，按 aspect 调整 FOV；窗口变宽/旋转可还原，结语相机的 FOV 同步转换。此项是构图修复，不是完整的 V3 镜头创作。

## 验证

- `npm run build`：通过；仍有主包大于 500 kB 的构建提示，未在本轮扩展拆包。
- `npm run lint`：通过。
- `npx playwright test --reporter=list`：42 项通过，包括新增素材加载/回退用例。
- 最后增加窄屏 FOV 修正后，重跑 mobile、direct-entry、river-material：9 项通过，build/lint 再次通过。
- `experiments/capture-integration.mjs`：默认高档、3 个旋转视角、390×844 中档、缺图低档均没有捕获到 pageerror；挂载资源确认分别 5/3/2 层；成功路径纹理 ready=1，失败路径 ready=0 且无纹理。详见 [资源读数](evidence/integration-resources.json)。
- 人工查看截图：光河连续、无矩形黑底，多角度可见；缺图时有稀疏粒子回退。窄屏已能完整显示双星主体。
- 原工具 agent-browser 不可用，使用仓库已安装 Playwright 完成浏览器验证。

## 画面对照与边界

- [接入前](evidence/integration-before.png) / [接入后低档](evidence/integration-after.png)：相同视口、相同真实时钟 pin；装饰轨道截帧时刻不同，不能当逐像素差异证据。
- [当前高档](evidence/integration-high.png)、[旋转 1](evidence/integration-orbit-1.png)、[旋转 3](evidence/integration-orbit-3.png)、[手机](evidence/integration-mobile.png)、[缺图回退](evidence/integration-fallback.png)。

当前不是最终美术：原星体仍显扁平，吸积盘与物质流偏白，默认镜头较近、光河远端会延伸到画外。接下来按 V2 调整双星与光流，再按 V3 创作拉远与竖屏构图；不要把单纯接入素材称为达到梦幻/震撼样张。测试依赖桌面 Chromium，真实手机性能、发热与触控尚未验证。未承诺全部自由视角都达到最终美术标准。

本地预览：启动 `npm run dev -- --host 127.0.0.1 --port 5186 --strictPort` 后访问根路径；experiments/river-study.html 仍保留为早期材质实验，不是正式产品页。
