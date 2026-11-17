> 更新：归属教师可修改DRAFT课程现有正文和说明，见[教师改稿](teacher-course-revision.md)；下方教师只读描述是前阶段记录，教师仍不能发布或调整结构/视频。

> 更新：教师/班级/家长/管理员界面已接入，见[界面验收](relations-ui.md)。下文未接页面的描述属于前一阶段。

# 教师、班级与家长关系接口

本轮完成后端与共享类型；未增加前端页面。新模块在apps/api/src/modules/relations，沿用当前workspace，按controller/service/repository/routes/dto/types分层。教师课程为只读归属查询，尚未开放教师改稿或发布。

## API

所有响应为{code,message,data}，成功code=0。列表data统一{page,pageSize,total,list}；page默认1，pageSize默认10、范围1–100。以下ID都是平台记录ID。

| 方法/路径                                           | 权限                  | 请求                                                             |
| --------------------------------------------------- | --------------------- | ---------------------------------------------------------------- |
| PUT /api/admin/courses/:id/teacher                  | ADMIN                 | {teacherId:string或null,updatedAt:ISO字符串}                     |
| GET /api/teacher/courses                            | TEACHER               | query: page,pageSize                                             |
| GET /api/teacher/courses/:id                        | TEACHER               | 仅归属自己的课程，含课时文本                                     |
| POST /api/classes                                   | ADMIN/TEACHER         | {name,grade,teacherId?}；管理员必须指定教师，教师只能指定自己    |
| GET /api/classes                                    | ADMIN/TEACHER/STUDENT | query: page,pageSize；分别全部有效班级/本人授课班级/本人加入班级 |
| GET /api/classes/:id/students                       | ADMIN/所属教师        | query: page,pageSize                                             |
| PUT /api/classes/:id/students/:studentId            | ADMIN/所属教师        | {}                                                               |
| DELETE /api/classes/:id/students/:studentId         | ADMIN/所属教师        | 无body；软移除                                                   |
| DELETE /api/classes/:id                             | ADMIN/所属教师        | 无body；软归档                                                   |
| POST /api/admin/parent-links                        | ADMIN                 | {parentId,studentId}                                             |
| DELETE /api/admin/parent-links/:parentId/:studentId | ADMIN                 | 无body；撤销绑定                                                 |
| GET /api/parent/students                            | PARENT                | query: page,pageSize；仅本人绑定且有效的学生                     |
| GET /api/parent/students/:studentId/overview        | PARENT                | 仅有效绑定学生                                                   |

家长概览data为{student:{id,displayName,grade},courses,completedLessons,attempts,correctAttempts,unresolvedWrongQuestions}。课程和完成课时统计限定已发布课程/课时；作答与错题为该学生自己的历史累计，不表示掌握度评分。不会返回题目答案、课时正文、AI对话、密码、恢复码或其他学生资料。名单仅返回id/displayName/grade。共享类型见packages/shared/src/relations.ts及PageResult<T>。

## 权限与状态

- 只有管理员分配/解除课程教师，且教师必须ACTIVE/TEACHER；updatedAt防止覆盖新版本。教师不能自行认领课程。
- 教师只管理自己班级；学生不能自行加入、移除或查看全班名单。班级成员可重复添加/移除，关系和审计不重复创建。
- 家长不能自报学生ID完成绑定。管理员在平台外核对关系后手动绑定；当前没有实现身份或监护关系自动核验，不应把管理员录入当成已核验认证。
- 绑定不授予会员、选课或课时访问权限。家长撤绑后概览立即不可访问，学习记录保留。
- 有效角色和账号状态在事务中重新检查；关联写操作锁定涉及账号和资源，冲突返回409。新写入均使用来源检查和zod校验。
- 退出TEACHER角色会清除课程归属、归档其班级；退出STUDENT会撤销班级成员及家长关联；退出PARENT会撤销家长关联。与角色变化/会话撤销/审计在同一事务完成。恢复原角色不会自动恢复旧关系。
- 账号停用时访问被拒绝，学生名单/家长列表排除停用或角色不符的学生。当前恢复账号不会自动撤销原有有效绑定；角色退出则已明确撤销。
- 班级归档保留历史成员记录。尚未提供班级恢复/教师转班操作，避免自动重新授权。

## 数据与验证

增量迁移20261105141000_teaching_relations添加课程owner_teacher_id及school_classes/class_students/parent_student_links三表，新表字段为snake_case；原表名与数据未重命名或重建。迁移前备份：work/backups/zhixue-2026-11-05T13-13-27-050Z.dump。

关系回归test:relations已纳入verify。13项关系测试覆盖教师归属转移、跨教师/跨家长隔离、班级增删与软归档、真实汇总、角色变化后的关系撤销、停用目标、幂等操作及并发分配。仅按精确ID清理合成测试数据。

```powershell
Set-Location E:\projects\zhixue-ai
npm.cmd run db:deploy
npm.cmd run db:generate
npm.cmd run verify
```

本地迁移已执行，无需reset。页面管理、教师出题改稿、作业考试、完整班级学情仍是后续工作。本轮未发布草稿、修改真实用户关系、调用真实AI或部署服务。
