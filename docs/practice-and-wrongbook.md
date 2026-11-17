# 练习与错题本（本地开发版本）

已完成独立单选题库、服务端判题、作答快照、个人错题本及重新练习。当前只有四选一单选题，没有多选、填空、主观题、试卷考试或自动生成题目。题库与课程暂未关联，题目均免费，不接入会员与支付。

## 当前电脑的操作（PowerShell）

```powershell
Set-Location E:\projects\zhixue-ai
docker compose up -d db
npm.cmd run db:check
npm.cmd run dev
```

本机已应用 `20261105102825_practice_foundation`，不必重复迁移或初始化数据。服务已运行时直接访问 http://127.0.0.1:3000/practice ，不要重复启动同一端口。新电脑恢复源码时，先按 windows-setup.md 配置 `.env` 与数据库，再运行：

```powershell
npm.cmd ci
npm.cmd run db:deploy
npm.cmd run db:generate
npm.cmd run dev
```

## 手动验收

1. 管理员进入 `/admin/questions` 创建单选题，填写题干、年级、学科、难度、知识点、A–D 四个不同选项、正确答案和解析。保存后默认为草稿。
2. 发布前核对内容。解析为空不能发布，学生看不到草稿与已归档题目。普通账号无法进入管理页，也无法调用管理接口。
3. 学生进入 `/practice`，按年级、学科、难度筛选，选择一个答案后点击“确认答案”。未登录可浏览题目，登录后才能提交。
4. 提交后查看判题结果和解析。答错会自动加入“我的错题本”。
5. 从错题本重新答对后，刷新列表，题目从“待复习”移至“已答对”。再次答错会重新进入待复习，并增加累计错误次数。
6. “作答记录”展示当前账号各次提交时的原始题干、选项、答案和解析快照，包括后来已归档的题目。其他账号看不到这些记录。

管理员账号沿用已有机制，没有默认账号或默认密码。如有需要，使用你自己注册的本地账号运行 `npm.cmd run user:promote -- --username <你的账号>`，之后刷新个人中心。

## 数据和一致性

- 新增 Question、QuestionAttempt、WrongQuestion 三张表与索引、外键；没有重置或清空原有账号、课程。
- 题目只有 DRAFT / PUBLISHED / ARCHIVED 状态。题干最多 6000 字符、每选项最多 1000、解析最多 12000；知识点最多 80。内容以纯文本展示，不执行 HTML。
- 公开列表只选择题干、选项和筛选元数据，未作答时不返回答案或解析。答案由服务端从数据库读取，不接受客户端传入的判题结果。
- 提交字段仅为 `selected`（0–3）、`requestId`（UUID）、`updatedAt`（题目版本时间）。未知字段拒绝，包括 userId、correct。用户身份只取已验证会话。
- 每个用户的 requestId 唯一；并发重复提交只保存一次，也只更新一次错题。相同标识却改变题目或选项会返回 409。网络失败时前端保留该标识以支持重试。
- 提交、更新错题和写入快照处于一个事务。题目行锁使判题与编辑/状态变更顺序执行。题目被改动时，旧版本提交返回 409，需刷新再作答。
- 已经有人作答的题目不允许改写正文、选项与答案。勘误时归档旧题、创建新题；原作答快照保留。未作答题可先转草稿再编辑。编辑和改状态带 updatedAt，避免覆盖他人修改。
- 错题本仅显示当前仍发布的题目；归档后暂时隐藏，重新发布后恢复相应分类。快照历史不因此删除。没有提供永久删除题目或手动删除个人作答按钮。
- 所有列表使用服务端分页，每页 12 条。作答限流目前为每 IP 每分钟 120 次，存储在进程内；Redis 分布式限流尚未接入。

## REST API

| 功能 | 地址 |
| --- | --- |
| 公开练习列表 | `GET /api/practice/questions` |
| 提交答案 | `POST /api/practice/questions/:id/attempts` |
| 当前用户错题 | `GET /api/practice/wrong-questions?state=active` |
| 已答对错题 | `GET /api/practice/wrong-questions?state=resolved` |
| 当前用户作答历史 | `GET /api/practice/attempts?page=1` |
| 管理员题库（含答案） | `GET /api/admin/questions?page=1` |
| 创建草稿 | `POST /api/admin/questions` |
| 更新未作答草稿 | `PUT /api/admin/questions/:id` |
| 发布、转草稿、归档 | `PATCH /api/admin/questions/:id/status` |

练习列表支持 grade=G7、subject=math、difficulty=EASY、knowledgePoint（包含匹配）、page；当前界面提供年级、学科、难度筛选。错题列表支持 grade、subject、state、page，历史只接受 page。管理列表使用与练习相同的筛选参数，界面目前只提供分页。所有 API 沿用 `{ code, message, data }`，写请求沿用来源与身份检查。

## 本次验证

```powershell
Set-Location E:\projects\zhixue-ai
npm.cmd run db:validate
npm.cmd run typecheck
npm.cmd run lint
npm.cmd test
npm.cmd run test:auth
npm.cmd run test:learning
npm.cmd run test:practice
npm.cmd run build
```

上述检查按顺序执行；typecheck 与 build 都会重新生成 Prisma Client，不要在 Windows 上同时运行，避免生成目录被占用。本次最终类型检查、lint、模型验证、构建和全部测试均通过，`/api/ready` 已检查账号表与新题目表。

真实 PostgreSQL 练习集成测试含 5 组场景，Node 计数 6（包含父测试）；覆盖草稿不可见、管理权限、严格输入、答案不泄露、服务端判题、并发幂等、用户隔离、错题复习/重开、版本冲突、归档和快照保留。测试只清理随机合成账号及其确切题目 ID。

浏览器已验证临时题答错显示解析、错题本累计错误、重新答对、刷新后从待复习移除、在已答对分类可见；390px 手机文档无横向溢出，桌面与手机截图已查看。验收题及其关联作答、错题记录已按确切 ID 清理，原账号与其他数据保留。此次沿用学生会话，没有切换为管理员；管理表单未通过管理员浏览器逐项验收，管理读写接口已通过数据库集成测试。

本次迁移前的数据库备份位于忽略目录 `work/backups/before-practice.dump`。源码包不含 `.env`、数据库备份、学生数据、依赖与生成代码。

## 仍需准备

你需要添加有权使用且经核对的正式题目与解析。当前没有真实教材题库，也不自动声称题目覆盖某教材或考试范围。视频、媒体存储、Redis、AI、正式运营与部署继续留到后续阶段；本次没有购买服务、操作域名、配置支付或部署。
