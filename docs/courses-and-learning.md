> 更新：课程发布现在必须通过当前内容版本审核，见[课程审核与发布](course-review.md)。旧直接发布示例需先补送审和独立审批步骤。

# 课程管理与文本学习（本地开发版本）

后续已完成独立单选题练习和错题本，见 [练习与错题本](practice-and-wrongbook.md)。下文保留课程阶段的实现与验收记录。

本阶段已接通 PostgreSQL 真实数据：管理员创建课程草稿、维护章节与纯文本课时、发布或归档；学生加入免费课程、阅读课时、标记完成，在学习中心继续学习。没有添加正式教学内容，也没有接入视频、支付或 AI。

## 本机启动与检查（PowerShell）

```powershell
Set-Location E:\projects\zhixue-ai
docker compose up -d db
npm.cmd run db:check
npm.cmd run dev
```

保持终端运行，打开 http://127.0.0.1:3000/courses 。如本地服务已经运行，无须重复启动。此次复用了现有课程、选课和进度表，没有新增数据库迁移，没有重置数据库或账号。

管理员必须使用已有注册账号；不会创建默认管理员。要将你自己的本地账号设为管理员，在另一个 PowerShell 终端运行（替换尖括号占位符）：

```powershell
Set-Location E:\projects\zhixue-ai
npm.cmd run user:promote -- --username <你自己的学习账号>
```

随后刷新个人中心。普通学生访问 `/admin/courses` 会被拒绝，后端同样检查管理员角色。

## 手动验收顺序

1. 管理员打开 `/admin/courses`，创建课程，填写名称、唯一英文标识、年级、学科、权限与简介。
2. 添加章节、课时名称和正文，保存草稿。草稿不会出现在公开课程列表。
3. 点击发布并确认；简介为空、没有章节、空章节或任何空正文都会阻止发布。
4. 打开 `/courses` 选择对应年级，或从对应学科页进入真实课程详情。
5. 学生登录后点击“加入课程，开始学习”；阅读后标记完成。
6. 刷新页面或打开 `/dashboard`，确认完成比例和“继续学习”入口；再次标记完成不会创建重复进度。
7. 将课程转为草稿才能编辑；归档或转为草稿后，学生无法读取正文。再次发布后，保留课时 ID 的完成记录仍存在。

删除章节或课时再保存，会级联删除对应进度；界面已提示。课程使用归档下架，没有提供永久删除课程按钮。修改正文保留原课时完成标记，不自动要求学生重学。

## 路由与接口

| 用途                                  | 地址                                                     |
| ------------------------------------- | -------------------------------------------------------- |
| 真实课程详情                          | `/course/:id`                                            |
| 文本课时                              | `/learn/:id/:lessonId`                                   |
| 管理员课程编辑                        | `/admin/courses`                                         |
| 公开列表，可选 grade=G7、subject=math | `GET /api/published-courses`                             |
| 公开大纲，不含正文                    | `GET /api/course/:id`                                    |
| 加入免费课程                          | `POST /api/course/:id/enroll`                            |
| 自己的课程进度列表 / 单课进度         | `GET /api/learning` / `GET /api/learning/:id`            |
| 已选课程正文                          | `GET /api/learning/:id/lessons/:lessonId`                |
| 标记完成，请求体 `{}`                 | `PUT /api/learning/:id/lessons/:lessonId/completion`     |
| 管理员课程列表 / 含正文详情           | `GET /api/admin/courses` / `GET /api/admin/courses/:id`  |
| 创建 / 保存草稿                       | `POST /api/admin/courses` / `PUT /api/admin/courses/:id` |
| 发布、转草稿、归档                    | `PATCH /api/admin/courses/:id/status`                    |

管理员保存接口是完整草稿替换：省略的章节、课时会被删除，保留的必须携带原 ID。接口验证章节属于课程、课时属于章节并拒绝重复或外来 ID。事务保证内容更新完整；并发冲突返回错误后应刷新再重试。当前不提供多管理员编辑合并。

正文仅以 React 文本节点展示，不解析 HTML。服务端验证登录、选课归属、课程发布状态和 FREE 访问级别；即使已有会员课选课记录也不能访问会员正文。写请求沿用来源检查，未知字段被拒绝。单次 JSON 限制 1MB，每课正文最多 30000 字符，最多 30 章、每章 50 课时；超限显示错误。管理员课程列表支持服务端分页：GET /api/admin/courses?page=1&pageSize=10，返回{page,pageSize,total,list}，pageSize为1至100；前端已对齐。公开课程列表仍有100门上限。正文没有教材、版权和教研审核自动化能力，发布者须自行核对内容。

## 自动验证

```powershell
Set-Location E:\projects\zhixue-ai
npm.cmd run typecheck
npm.cmd run lint
npm.cmd test
npm.cmd run test:auth
npm.cmd run test:learning
npm.cmd run build
```

课程测试使用本机 PostgreSQL，生成随机合成账号和课程，仅按确切 ID 清理自身数据。测试覆盖草稿不可见、发布校验、管理员权限、未选课拒绝、跨用户与跨课程拒绝、会员课拒绝、重复选课与完成的幂等性、改稿保留进度、归档不可读。

浏览器已实际验证：学生管理页被拒绝；临时课程加入后可阅读，标记完成显示 1/2，重新打开学习中心仍显示 50% 并指向第二课。桌面与 390px 手机布局已截图检查，手机文档无横向溢出。临时课及其关联选课与进度已清理，原有账号与课程保留。截图展示的是已清理的临时验收内容。

## 尚未完成

真实课程与教材配置、视频上传/存储/播放、练习与错题、Redis 限流、内容版本及审计、会员资格业务、AI 老师、部署与运营准备。当前没有支付通道或默认会员授权。此次不采购、不部署、不操作域名，不假定任何运营主体或教育许可。

数据库验收前备份位于被 Git 忽略的 `work/backups/before-course-qa.dump`，不会放入源码包；`.env` 同样不入库。后续请使用你自己有权使用的正式内容做验收。

## 进度与分页修复（2026-11-05）

先保存视频位置再完成课时，现在会写入完成时间，保留播放位置。并发及重复完成不改变首次完成时间。管理员分页使用稳定的updatedAt/id排序，输入由zod中间件校验；回归测试使用101条合成课程验证全部可达与权限边界。完整verify通过，共37项测试。
