# 考试 V1 本地交接

入口：http://127.0.0.1:3000/exams 。从个人中心进入班级考试；教师先在班级空间选择自己的班级，再组卷。管理员可管理，学生只能参加发布名单内的考试，家长无考试作答权限。现有账号、课程与历史记录保留；验收合成账号、班级与试卷已清理。

## 已实现

- 手工单选题或题库选题组卷，1–50题，每题四选一、1–1000分，限时1–180分钟。
- 题库仅允许同年级、已发布且免费公开可见的题目；复制题干、选项、答案、解析、来源许可与受控题图，不绕过草稿或会员权限。
- 草稿可编辑；发布时冻结试卷、时间、分值及班级学生名单。后加入学生不获得历史考试资格；结束或归档后不能重新开放。
- 服务端计时，一次考试一次作答；刷新不重置时间。实际截止为个人限时与全卷截止中的较早者。
- 自动保存采用 revision + requestId；拒绝陈旧覆盖及外来题目。冲突返回409，页面要求重新载入服务器答案。交卷只批改服务器已保存的答案。
- 个人交卷后，全卷结束或教师主动结束前仍隐藏分数、正确答案和解析，避免提前泄题。
- 教师查看名单、开始/提交人数、平均/最高/最低分、逐题作答及正确统计。
- 关系失效后禁止新写入；已开始或提交的个人历史仍可读。后台处理过期作答、结束/归档考试、失效班级与角色等情形。仅退班的作答在请求时检查，后台最迟按原到期时间结算。

## 定时结算

API 启动时及每5秒扫描，单批最多50条，事务锁与幂等判分防止重复结算。关闭时停止扫描。状态存于PostgreSQL，API重启后继续处理；这不是Redis持久队列，API停止期间不运行。学生读取、保存、交卷请求也检查到期；教师读取成绩最多补结算50条，其余由后续周期处理。大规模并发仍需压测与专用队列设计。

## API

统一成功响应 `{ code: 0, message, data }`；失败HTTP状态与code一致，data=null。列表为 `{ page, pageSize, total, list }`。共享请求/响应定义：`packages/shared/src/exam.ts`；输入校验：`apps/api/src/modules/exam/exam.dto.ts`。

| 方法 | 路径 | 用途 |
| --- | --- | --- |
| GET | /api/exams/question-options?classId&page&pageSize&q | 可用题库 |
| GET | /api/exams?page&pageSize&classId | 考试列表 |
| POST | /api/exams | 创建草稿，ExamCreateInput |
| GET | /api/exams/:id | 角色过滤后的试卷 |
| PUT | /api/exams/:id | 更新草稿，ExamUpdateInput，含updatedAt |
| PATCH | /api/exams/:id/status | status及updatedAt |
| POST | /api/exams/:id/attempt/start | 开始或恢复，body={} |
| GET | /api/exams/:id/attempt | 自身答卷与服务端时间 |
| PUT | /api/exams/:id/attempt/answers | revision、requestId、answers: [{questionId,selected}] |
| POST | /api/exams/:id/attempt/submit | revision、requestId |
| GET | /api/exams/:id/results?page&pageSize | 教师/管理员成绩统计 |

## 验收证据

- `npm.cmd run verify`：Prisma校验、TypeScript、lint、80项测试、前后端构建通过，其中考试新增12项。
- 浏览器实测：教师手工+题库组卷、发布；学生快速连续改选后保存、刷新恢复且倒计时不重置；提交后隐藏成绩；教师结束后学生得分3/3并可见解析，教师逐题统计正确。
- 390px视口结果页无横向溢出。截图为合成测试内容，不是正式已上线课程。
- 独立后台探针：只在DB创建过期作答，未调用交卷/读取答卷/结算函数；运行中的API自动写入TIMEOUT及2分，证据见交付目录exam-worker-verification.json。
- 原内容包6课时15题及补充1课时6题保持DRAFT并与源包一致。

迁移：`prisma/migrations/20261105142054_exam_foundation/migration.sql`。迁移前备份：`work/backups/zhixue-2026-11-05T14-20-50-329Z.dump`，仅本地保留，不进入源码包。

## Windows 启动与测试

```powershell
Set-Location E:\projects\zhixue-ai
npm.cmd run dev
# 另一终端
(Invoke-RestMethod http://127.0.0.1:4000/api/ready).data | ConvertTo-Json
npm.cmd run test:exam
# 全量检查（不要与build/typecheck并行，避免Prisma生成文件锁）
npm.cmd run verify
```

新机器安装、环境变量和PostgreSQL/Redis准备沿用windows-setup.md；只复制.env.example并自行填写本地配置，禁止提交.env。新库应用迁移用`npm.cmd run db:deploy`。

## 范围边界

目前仅单选自动判分；未实现多选、主观题、补考、重考、监考或防作弊保证。真实AI仍关闭；支付、云存储、正式部署及课程规模化审核未完成。项目仍使用apps/web与apps/api，完整client/server迁移及Zustand未完成。本里程碑不代表整个商业平台完成。
