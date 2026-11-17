# 教师草稿改稿

教师进入“我的教学课程 → 修改草稿”，可编辑管理员已分配给自己的草稿：课程名称、简介、地区/教材版本/学期说明、现有章节及课时名称、课时正文。

保存后仍为DRAFT，不自动送审或发布。前往“审核 / 记录”提交已保存的新版本。内容指纹变化后，旧审核不能用于发布；旧快照与意见保留。

## 权限和版本

- 仅当前有效归属教师可写；管理员使用原有课程管理编辑器。学生、家长、其他教师、已撤销归属或已降级账号不能调用教师改稿接口。
- 仅草稿可改。已发布/归档课程须管理员先转为草稿；教师不能自行发布、变更访问权限或课程归属。
- updatedAt是乐观版本，账号与课程在同一事务内加锁；两个基于同一版本的保存最多一个成功，另一个409。冲突时保留编辑器内未保存内容，请复制需要保留的文字，再关闭并重新载入课程后核对。
- 全部章节与课时ID必须保留，不接受增删、跨课时注入或重复ID。请求数组顺序不会更改原课程顺序。视频引用、课时ID和已有学习记录保持原值；结构增删、排序、视频维护仍由管理员操作。
- 保存成功写入`COURSE_TEXT_REVISE:<courseId>`审计事件；完整正文版本快照由后续送审留存，不是每次编辑的独立历史版本。
- 关闭有未保存修改的编辑器时，提示继续编辑或放弃；网络/版本错误不会自动关闭编辑器。

## API

`PUT /api/teacher/courses/:id/content`，同源认证、TEACHER角色、当前归属与DRAFT检查。

Request:

```ts
{
  updatedAt: string;
  title: string;
  description: string;
  region?: string | null;
  textbookEdition?: string | null;
  term?: string | null;
  chapters: {
    id: string;
    title: string;
    lessons: { id: string; title: string; content: string }[];
  }[];
}
```

Response：`{code:0,message:"ok",data:TeacherCourseDetail}`。类型在shared/relations定义，DTO用Zod与validate中间件校验；权限及归属规则在service、数据库更新在repository。输入不接收status、access、ownerTeacherId、mediaId或章节顺序字段。

## 验证（2026-11-06）

```powershell
Set-Location E:\projects\zhixue-ai
npm.cmd run test:teacher-edit
npm.cmd run verify
```

- 专项6项（含父测试）通过：角色/归属、严格字段、ID集合、并发冲突、保留媒体及学习记录、审核失效、状态与角色撤销。
- 全量119项测试无失败/跳过，类型检查、lint、模型验证、前后端构建通过。
- 浏览器独立localhost合成教师会话验证改正文、关闭保护、继续编辑、保存、送审；数据库确认新正文已写入PENDING审核快照，改稿审计仅一条，课程仍为草稿。
- 390px无水平溢出。合成账号、课程、审核及审计按确切ID清理；3份原稿保持DRAFT并与源文件一致。

本轮没有更改数据库结构、发布真实课程、代做真实教研审核或部署。
