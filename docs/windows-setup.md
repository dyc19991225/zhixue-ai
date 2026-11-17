# Windows 启动与验证（账户、课程与练习版本）

最新图形题包含两个增量迁移，新电脑需 `npm.cmd run db:deploy`；本机已经应用。使用方式见 [图形题与课时配套练习](diagram-lesson-practice.md)。

最新启动、视频、权益、AI、Redis 与备份流程以 [本地基础版本交接](local-foundation-handoff.md) 为准。当前还需启动本地缓存：`docker compose --profile cache up -d db redis`；统一验证 `npm.cmd run verify`。下面保留前几个里程碑的说明。

最新单选题库、错题与作答记录见 [练习与错题本](practice-and-wrongbook.md)。新增管理员页面 `/admin/questions`，学生页面 `/practice`。本机 `practice_foundation` 迁移已应用；其他电脑运行 `npm.cmd run db:deploy`，集成验证命令为 `npm.cmd run test:practice`。

最新课程管理和文本学习流程见 [课程与学习](courses-and-learning.md)。新增管理员页面 `/admin/courses`；集成验证命令 `npm.cmd run test:learning`。此次无需新增数据库迁移。

项目：`E:\projects\zhixue-ai`。Node.js 24 与 npm 11 已安装。本机数据库已启动、迁移已应用，.env 已生成且不进入源码包。

## 当前电脑

前后端运行时直接打开 http://127.0.0.1:3000 ，不要重复启动同一端口。

后续重启：

```powershell
Set-Location 'E:\projects\zhixue-ai'
docker desktop start --detach
docker compose up -d db
npm.cmd run dev
```

网站3000、API4000、PostgreSQL5433均只绑定本机。结束开发服务用 Ctrl+C；暂停数据库用 `docker compose stop db`，保留数据卷。

## 从源码包首次恢复

```powershell
Set-Location 'E:\projects\zhixue-ai'
npm.cmd ci
npm.cmd run setup:local
docker desktop start --detach
docker compose up -d db
docker compose ps
# 状态 healthy 后应用已有迁移：
npm.cmd run db:deploy
npm.cmd run db:check
npm.cmd run dev
```

setup:local 为新环境生成随机数据库密码和两份 JWT 密钥，不打印它们。无需先复制空值 .env.example。已有自定义 .env 时不会覆盖数据库地址；地址缺失时会停止并提示检查。

沿用已初始化的数据卷时务必保留原 .env。重新生成密码不会自动更改旧数据库密码，不要因此删除数据卷。

## 使用账号

1. 在 /login 注册学习账号、昵称、年级和至少12位密码，仅使用测试资料。
2. 保存只显示一次的恢复码，再进入学习中心。
3. 在“个人设置”修改昵称和年级，在“账号安全”修改密码或退出会话。
4. 测试管理功能时，先注册账号，再运行以下命令，退出并重新登录：

```powershell
npm.cmd run user:promote -- --username 你的已注册账号
```

没有默认管理员或默认密码。找回密码使用已保存的恢复码，不发送短信或邮件。

## 检查

```powershell
npm.cmd run db:validate
npm.cmd run typecheck
npm.cmd run lint
npm.cmd test
# 需本地数据库，会创建并自动清理合成测试账号：
npm.cmd run test:auth
npm.cmd run build
Invoke-RestMethod 'http://127.0.0.1:3000/api/ready'
```

ready 应返回 code=0、database=connected。health 只代表应用存活。

本地验证生产构建时，先停止自己的开发服务，再在两个终端分别运行 `npm.cmd run start:api` 和 `npm.cmd run preview`。这不会部署到云端。

## 备份

先在容器写备份，再复制到 work/backups，避免 PowerShell 二进制重定向损坏：

```powershell
Set-Location 'E:\projects\zhixue-ai'
New-Item -ItemType Directory -Path 'work\backups' -Force
docker compose exec -T db pg_dump -U zhixue -d zhixue -Fc -f /tmp/zhixue-backup.dump
$backupName = 'zhixue-' + (Get-Date -Format 'yyyyMMdd-HHmmss') + '.dump'
docker cp 'zhixue-ai-local-db-1:/tmp/zhixue-backup.dump' (Join-Path (Get-Location) "work\backups\$backupName")
```

恢复先在新建的独立测试库验证，不覆盖业务库。本次已完成独立库恢复测试。生产备份周期和恢复演练在部署阶段完善。

## 配置

- 根 .env 只供后端与 Prisma 使用。禁止将 JWT、数据库和存储密钥写进 VITE_ 变量。
- 依赖使用一份根 package-lock.json；从根目录执行 npm ci。
- .env、work、dist、node_modules 和生成代码均不提交。
- 端口占用时先确认原服务，不结束未知程序。更改 API_PORT 时需同步 Vite 的两处 /api 代理目标。
- 浏览器 Ctrl+0 恢复正常缩放，页面已检查手机与大屏布局。

完整范围与接口见 [账户与权限](accounts-and-permissions.md)，原架构迁移阶段见 [迁移记录](architecture-migration.md)。
