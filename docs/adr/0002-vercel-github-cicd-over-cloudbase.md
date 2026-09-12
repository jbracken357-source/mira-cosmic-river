# 部署走 Vercel + GitHub CI/CD，CloudBase 缓行

2026-09-12 决定：静态托管用 Vercel，CI/CD 挂 GitHub Actions（push 即部署），腾讯 CloudBase 静态托管保留为后续备选。主人虽在国内、有现成 CloudBase 环境且国内访问更快，但本产品是本人反复访问的高频入口，优先要"push 自动上线"的零摩擦迭代回路；若日后国内访问速度实测成为问题，再迁 CloudBase（纯静态产物，迁移成本低）。
