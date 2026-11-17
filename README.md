# 知学 AI · 前后端分离基础版本

拍照页已支持本地裁剪、旋转、恢复与关键词查公开题；新增七年级英语词句/阅读草稿。详见[裁剪查题与英语扩充](docs/photo-crop-search-english.md)，当前仍需审阅发布配套题才能正式查题练习。

本地拍照文字识别：`/photo-question`（中英文印刷体，需校对，不自动解答）；试学清单与本地反馈下载：`/trial`。`npm run content:coverage`盘点真实课程与题库覆盖。当前范围、运营待填事项和验收见[拍照与试用准备](docs/photo-trial-readiness.md)。

同步学习入口：`/study`，按教材版本找课程，再进入课时与配套练习；年级/学科可带入练习和错题本。产品方向及验证边界见[同步学习](docs/synchronous-learning.md)。

运行巡检：`npm run ops:check -- https://你的域名 work/新报告.json`，检查页面、API和数据库/缓存就绪状态，失败返回非零退出码。见[网站巡检](docs/site-monitoring.md)，当前未安装定时任务或外部告警。

联合备份工具：`npm run backup:bundle -- create ...` 保存数据库和媒体，`verify` 校验完整性。必须先停止全部应用写入，详见[备份与恢复流程](docs/backup-bundle.md)。

上线前可执行 `npm.cmd run verify:containers` 做独立容器演练：生产模式、HTTPS登录与会话、端口隔离、媒体卷持久化和临时库恢复。使用全新测试数据，结束后清理容器/卷；操作边界与报告见 [容器演练](docs/container-rehearsal.md)。本命令不部署VPS。

初高中学习平台本地原型。React 18 + Ant Design + React Router v7 前端，Express + TypeScript 后端，Prisma/PostgreSQL 数据层。

当前主交接文档：[本地基础版本交接](docs/local-foundation-handoff.md)。已接通本地视频上传/播放与进度恢复、手动会员权益、Redis 限流，以及默认关闭的 AI 接口与记录。统一验收 `npm.cmd run verify`，备份 `npm.cmd run db:backup`。Docker/Nginx 仅构建与验证配置，未部署；真实模型、云存储与正式内容仍需配置准备。下方旧里程碑描述仅供历史参考。

管理员界面已完成独立浏览器验收，详见 [管理员界面验收](docs/admin-ui-verification.md)。视频素材保留原始文件名，权益授予提供成功反馈。

已准备一门“一元一次方程”自编示范草稿（3章6课时、12题），附可重复导入的内容包、独立审阅稿与8道待执行的 AI 质量评测题。内容仍待人工审核，见 [内容编写与导入](docs/content-authoring.md)。

最新加入矩形、线段、邻补角图形题与课时配套练习；示范稿现为15题（含3道图形题），全部关联到对应课时且仍保持草稿。实现与操作见 [图形题与课时练习](docs/diagram-lesson-practice.md)。

```powershell
Set-Location 'E:\projects\zhixue-ai'
npm.cmd ci
npm.cmd run dev
```

当前依赖已安装时可直接 `npm.cmd run dev`。网站 http://127.0.0.1:3000 ，API http://127.0.0.1:4000/api/health 。本地目录预览不要求数据库连接。

## 目录

```text
apps/web/            React 前端与宣传素材
apps/api/            Express 后端与 Prisma Client
packages/shared/     共享年级、学科和接口类型
prisma/              PostgreSQL 模型
scripts/             数据库验证
docs/                启动、迁移说明与验收
compose.yaml         可选本地 PostgreSQL
```

接口统一返回 `{ code, message, data }`。成功 code=0；错误使用对应 HTTP 状态码，data=null。

验证：`npm.cmd run lint`、`npm.cmd run typecheck`、`npm.cmd test`、`npm.cmd run build`。

已完成本地 PostgreSQL 迁移、注册登录、bcrypt、access/refresh JWT、会话轮换与撤销、个人设置及管理员用户状态管理。详见 [账户与权限](docs/accounts-and-permissions.md)。

已加入管理员课程草稿与章节课时编辑、发布与归档、免费课程选课、纯文本阅读、完成记录与继续学习。操作与验收见 [课程与学习](docs/courses-and-learning.md)，数据库集成测试运行 `npm.cmd run test:learning`。正式课程内容、视频、Redis、OSS/七牛、会员业务、AI、应用 Docker/Nginx 部署尚未实现。

最新完成单选题管理、服务端判题、个人错题本、重新练习与作答快照。详见 [练习与错题本](docs/practice-and-wrongbook.md)，集成测试运行 `npm.cmd run test:practice`。正式题库内容待准备；本地增量迁移已应用。

本机服务已启动时直接访问网站。从源码包首次恢复时，运行 `npm.cmd run setup:local` 生成本地配置，再执行 `docker compose up -d db`、`npm.cmd run db:deploy`。账户集成测试：`npm.cmd run test:auth`。

[Windows 操作手册](docs/windows-setup.md) · [架构与当前范围](docs/architecture-migration.md) · [第一期计划](docs/phase-one.md) · [验收记录](docs/verification.md)
