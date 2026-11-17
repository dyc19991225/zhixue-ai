# 知学 AI 全项目分析

日期：2026-11-05。项目：`E:\projects\zhixue-ai`。

结论：已有本地可运行的账户、课程、学习、单选练习基础闭环；尚未达到四角色、考试、作业、学情分析的目标。最新规范与现有工程有多处差异。本轮只分析、复现和验证，未重构目录、改动业务代码、部署或发布课程。

## 后续修复进展

2026-11-05：视频进度后标记完成的问题已修复，保留首次完成时间与播放位置；管理员课程列表已改服务端分页；首页与导航过期提示已更新。新增超过100条分页回归、并发完成和重复完成断言。最新verify全部通过，共37项测试。下文问题描述保留初次分析证据，前述三项不再是未修复项；公开课程/素材列表上限、四角色与结构迁移仍待处理。

## 实际完成度

| 目标模块 | 当前实际实现 | 主要缺口 |
| --- | --- | --- |
| auth | 注册登录、JWT轮换、会话撤销、密码更改/恢复、Redis限流 | 通用四角色RBAC；现有仅ADMIN/STUDENT |
| user | 本人资料、管理员用户列表、停用恢复、状态审计 | 教师/家长档案、家长学生绑定、班级归属、按角色的数据范围 |
| course | 章节课时编辑、草稿发布归档、选课、文本学习、本地MP4与进度、会员访问检查 | 教师课程归属、审核/版本、批量管理、云存储；另有已复现的完成状态缺陷 |
| exam | 现有单选题库/作答/解析/错题快照可复用 | 没有Exam/ExamAttempt等独立模型、组卷、限时、自动交卷、考试成绩与主观评分 |
| homework | 无完整模块 | 班级、作业发布、提交、截止时间、教师批改、反馈与重交 |
| analytics | 已存课时进度、答题记录、错题次数 | 没有独立学情分析模块、知识点掌握度、班级汇总和家长授权视图 |

额外已有：三种受控SVG题图模板；内容包校验/草稿导入/关联/预览；手动会员权益；AI单轮适配、配额与历史基础（真实AI关闭）。题库练习不能算考试模块，学习记录不能算完整学情分析。

## 与最新目录/编码约定的差异

| 规范 | 现状 | 建议 |
| --- | --- | --- |
| server/src/modules 与 client/src/pages/角色/功能 | 实际为apps/api、apps/web；多数按技术层组织 | 先做行为保持的结构迁移，整体更新workspace/import/build/Docker路径，不重复生成第二套项目 |
| Controller/Service/Repository分层 | 只有部分controller/repository；learning-router等直接查库、做事务与业务判断 | 路由只组合中间件/controller，业务移service，查询移repository；在同一事务上下文完成业务检查和写入 |
| Service不接req/res | media-service中的uploadMedia、streamMedia以及issuePlayback接收HTTP对象 | 拆开HTTP流与cookie处理、存储与授权逻辑，保持上传大小和播放权限检查 |
| zod DTO + validate中间件 | zod已有，但多在service/router内parseInput，课程schema直接放service | 输入形状/格式校验集中dto与中间件；资源归属、状态迁移、会员权限仍须在服务层检查，不能仅靠zod替代 |
| rbac(roles) | requireAuth + requireAdmin；Prisma和shared类型均仅两角色 | 增加TEACHER/PARENT后同步DB、DTO、token用户视图、路由和前端；还需所有权/家长绑定/班级范围校验 |
| AppError | 当前HttpError + 全局errorHandler已工作 | 可兼容迁移统一命名，保留HTTP状态和既有错误响应 |
| {page,pageSize,total,list} | 当前多用items；课程/素材列表存在take上限而无完整分页 | 前后端、shared DTO、测试一起改，不只替换单个字段 |
| DB snake_case | Prisma数据库表/列当前为大小写混合及camelCase，未用@map/@@map | 通过保留数据的显式重命名迁移处理；同步现有原始SQL中的Course/Question引用，不删库重建 |
| Zustand与按模块API | 认证使用Context/订阅；API集中apps/web/src/lib/api.ts，未安装Zustand | 按新规范拆模块；迁移认证时保留单次刷新与并发请求重试行为 |
| TS strict / 禁any | strict已开启；本轮扫描业务TS/TSX未找到显式any；eslint通过 | 隐式依赖库类型不能等同于全项目无any传播；共享类型仍需持续约束 |

## 已确认的问题

### P2：视频课先记录进度后无法标记完成

位置：`apps/api/src/routes/learning-router.ts:255`，尤其264行`update: {}`；进度预先写入位置在`apps/api/src/routes/media-router.ts:79`。

复现：隔离学生选课 → PUT position保存30秒 → PUT completion → HTTP 200，但completedAt=null、completedIds不包含该课时，播放位置仍为30。因为position已创建LessonProgress，completion走upsert的空update分支，只在create分支设置完成时间。

建议：完成接口为已有且未完成记录写入completedAt，保留播放进度，并确保重复完成请求不重置首次完成时间。增加“先记录播放位置→完成→重复完成”回归用例。

证据：`work/project-review/completion-repro.json`。本轮用临时合成账号、课程和素材记录调用真实Express/Prisma链路复现，已按精确ID清理。没有读取或更改真实用户和草稿内容。缺陷未修复。

### P2：课程列表超过100条后无翻页入口

位置：`apps/api/src/routes/learning-router.ts:107`，后台课程固定take:100；`apps/web/src/pages/admin-courses.tsx`仅在取回数据上做本地Table分页。管理员无法通过现有列表翻到第101条。公开课程和素材也有类似上限，扩充内容后会暴露。

建议：统一服务端page/pageSize/count，前端使用服务端total。不是数据库记录被删除，而是列表检索范围不足。

### P2：生产依赖存在2项moderate审计告警

本轮执行`npm.cmd audit --omit=dev`：moderate=2，high=0，critical=0。涉及react-router与react-router-dom依赖链，公告包括反斜杠跳转与SSR错误反序列化。

已有跳转过滤测试；当前客户端SPA并不等于SSR漏洞在本站已可利用。审计告警不能直接当漏洞利用证明，也不能因测试通过就忽略。先检查React Router v6范围内兼容修复方案，再确定是否需要版本迁移；未运行强制修复。

### P3：界面提示落后于实际能力

`apps/web/src/pages/home.tsx:111`仍显示学习记录与练习正在准备，`apps/web/src/components/site-header.tsx:11`仍标练习筹备中，但功能已存在。会让用户误以为只有展示页。正式课程待审的提示仍应保留。

### P3：维护与运营基础不足

当前Git状态显示项目源码大面积未跟踪，缺可追溯开发基线。errorHandler隐藏内部异常符合要求，但该处理器没有结构化服务端错误日志；后续需补请求ID与脱敏诊断。未见完整CI/E2E自动化，Docker存在打包配置不等于生产验收已完成。docs/verification.md是多阶段历史，旧段落还保留Next.js/未实现账户等描述，阅读时须以最新主交接及代码为准。

## 内容与运行实查

- 当前数据库与Redis均连接，/api/ready返回ready及diagram-lesson-foundation。
- 重新读取数据库：基础课6课15题、补充课1课6题，正文/答案/解析/图形/课时关联与内容包逐条一致，全部DRAFT。
- 课程内容只覆盖一个数学示范主题及补充练习，不是初高中完整教材；教师审核、版本匹配、其他学科仍缺。
- npm.cmd run verify完整通过：Prisma校验、类型、lint、7组共36项测试及前后端构建。视频完成顺序缺陷为额外复现，说明36项测试并未穷尽所有操作组合。
- 未开展本轮全站视觉回归、压力测试、渗透测试、真实云存储、真实模型或生产部署验收。

## 建议实施顺序与验收边界

1. 修复完成状态缺陷，补回归测试；统一过期界面提示、服务端分页，建立可追溯源码基线。
2. 结构迁移与通用DTO/AppError/validate/RBAC基础；保留旧接口兼容或一次对齐前端，所有现有权限/历史快照测试仍通过。DB重命名独立迁移，先备份和验证恢复。
3. 四角色与关系模型：教师课程归属、班级师生、家长学生绑定。验收教师不能改他人课程、家长不能查看未绑定学生、学生不能提升角色。
4. 作业闭环：教师布置→学生提交→教师批改→学生查看反馈；覆盖截止时间、重复提交和班级范围。
5. 考试闭环：组卷→服务端时间控制→作答保存/提交→评分→成绩；保留试卷题目快照和幂等提交，不从实时题库反推历史成绩。
6. 学情分析：以真实学习、作业、考试记录计算；学生看自己、家长看已绑定学生、教师看授权班级。
7. 完成一个教材单元的内容/教师审核及小范围验收，再单独安排真实AI质量、云存储和正式运行工作。

所有新角色/模块均需要API与数据库权限测试；不能只增加导航菜单或角色枚举便标记完成。商业支付和部署不在本轮操作范围。
