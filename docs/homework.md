# 作业 V1

已实现：教师/管理员按班级创建、编辑草稿、发布和归档；学生提交文本答案；所属教师/管理员批改；学生查看个人成绩反馈。入口/homework，个人中心和班级行均有入口；新页面位于apps/web/src/pages/shared/homework，后端按modules/homework六层文件组织。

## API

成功响应{code:0,message:"ok",data}。列表data为{page,pageSize,total,list}，page默认1、pageSize默认10且最大100。

| 方法/路径 | 权限 | Request |
| --- | --- | --- |
| GET /api/homework | ADMIN/TEACHER/STUDENT | query:page,pageSize,classId? |
| POST /api/homework | ADMIN/所属教师 | {classId,title,instructions,maxScore,dueAt:ISO字符串} |
| GET /api/homework/:id | 管理者/已分配学生 | data:{homework,submission:本人提交或null} |
| PUT /api/homework/:id | 管理者 | {title,instructions,maxScore,dueAt,updatedAt}，仅草稿 |
| PATCH /api/homework/:id/status | 管理者 | {status:DRAFT或PUBLISHED或ARCHIVED,updatedAt} |
| POST /api/homework/:id/submissions | 已分配学生 | {answerText,requestId:UUID} |
| GET /api/homework/:id/submissions | 管理者 | query:page,pageSize；data另含recipientCount、gradedCount |
| POST /api/homework/:id/submissions/:submissionId/grade | 管理者 | {score,feedback,updatedAt,requestId:UUID} |

日期选择器按浏览器本地时间显示，写接口发送ISO时间，后端按服务端当前时间判定截止；数据库截止/提交/批改时间用timestamptz。满分1至1000整数，得分0至满分，正文/作答最多30000字符，反馈最多12000字符；以纯文本显示。

## 边界与历史

- 草稿只对管理员和所属教师可见。教师不能操作别人的班级或作业；家长不开放作业接口。
- 发布时要求截止时间在未来且班级有有效学生，原子保存当时名单。发布后不能改题、截止时间、满分或退回草稿；后加入学生不自动看到以前作业。归档后不恢复、不再收新作答或新批改。
- 学生需要名单中的分配记录和当前有效班级成员资格才能首次提交，且仅在截止前接收。移出/停用/角色变更后不得新增提交；已提交的学生仍可查看自己的历史作答与反馈，即使班级或作业已归档。不会因此看到全班提交或其他学生答案。
- 本版一次最终提交、一次批改，不支持重交、改分、附件、图片上传、自动评分或分题评分。提交界面有锁定说明和二次确认。需要改题请新建作业，避免改写历史。
- 提交和批改requestId由客户端生成，重试同一请求复用；同ID异内容返回409。已经接收的同内容提交在截止后仍可幂等查询原结果。并发提交只保留一份记录；冲突返回409，不将数据库异常直接暴露为500。
- 草稿编辑/发布/批改使用updatedAt拒绝过期覆盖。事务按账号、班级、作业顺序检查当前权限并锁定资源。发布/归档/批改记录审计，提交与成绩历史保持不变。
- 作业并非考试模块；家长完整学情/作业汇总尚未接入。

## 验证

增量迁移20261105142000_homework_foundation创建homework/homework_recipients/homework_submissions及枚举，保留原数据。迁移前备份：work/backups/zhixue-2026-11-05T13-58-52-412Z.dump。新增dayjs为前端直接依赖，版本沿用原安装的1.11.23，锁文件已同步。

npm.cmd run verify全部通过，共68项测试，含10项作业测试：权限、草稿、发布时间与名单快照、输入校验、历史不可变、幂等/并发提交、0分及满分限制、版本冲突、截止、归档与角色变化。数据库/Redis就绪接口已核对homework-foundation。

浏览器采用localhost独立会话和随机合成教师/学生账号，完整操作创建草稿（含日期选择器）、发布、学生作答确认、教师评分反馈、学生重新登录查看10/10及反馈。390px宽度无文档横向溢出，视口已恢复。教师批改和学生反馈截图为合成验收内容，全部合成账号、班级、作业、作答、名单及审计已清理，临时凭据文件已删除；127.0.0.1原用户会话保留。

原6课15题及6题补充包已重新读库逐项对比一致，全部DRAFT。未发布正式课程、部署、配置支付或启用真实AI。

```powershell
Set-Location E:\projects\zhixue-ai
npm.cmd run db:deploy
npm.cmd run db:generate
npm.cmd run verify
```

本机已执行迁移，无需reset数据库。
