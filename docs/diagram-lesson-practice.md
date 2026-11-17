# 图形题与课时配套练习

已接通三类受控 SVG 题图：矩形、线段分段、邻补角。管理员通过表单填写标注与完整图形描述，页面自动生成矢量图，不接收任意 SVG、HTML、路径、脚本或外部图片 URL。图形描述会显示为文字，方便小屏阅读和辅助技术获取全部已知条件。

本次为一元一次方程示范稿增加3道图形题，总题数由12变为15；矩形求长、线段分段求长、由平角关系求角度，均可转化为一元一次方程。课程仍是3章6课时，课程与15题全部保留 DRAFT，没有发布为正式内容。

## 管理员操作

1. `/admin/questions` 创建或编辑未作答的草稿题，在“题图”选择矩形、线段或邻补角，填写标注和完整无障碍描述，可直接看到预览。
2. 在“配套课时”选择一个或多个课时，填写选项、答案和解析，保存草稿；核对后再决定是否发布。
3. 课程与课时也必须发布，学生加入课程后，在课时页点击“本课配套练习”。会员课还要求有效会员权益。
4. 作答、解析、错题本沿用原流程；作答历史保存提交时的图形快照，后来题目下架或课时删除仍保留本人已产生的历史记录。

未关联课时的题目发布后作为公共练习；关联题随课时开放。关联到公开免费课的已发布题可在公共题库出现；仅关联会员课的题须从已选且有有效权益的课时进入。若关联课时被删除，题目不会因此自动变成公共题，需管理员明确重新关联或改为独立练习。

已有作答的题目仍不允许改写，包括题图和关联。勘误时归档旧题并创建新题。管理员课时选择器当前最多展示300个课时，正式规模还需增加搜索和服务端分页。

## 预览与内容包

图形题审阅页：
http://127.0.0.1:4174/zhixue-g7-math-linear-v1-diagrams.html

完整课程审阅页：
http://127.0.0.1:4174/zhixue-g7-math-linear-v1.html

```powershell
Set-Location E:\projects\zhixue-ai
npm.cmd run content:check -- content/courses/g7-math-linear-equations.v1.json
npm.cmd run content:import -- content/courses/g7-math-linear-equations.v1.json
npm.cmd run content:link -- content/courses/g7-math-linear-equations.v1.json
npm.cmd run content:preview -- content/courses/g7-math-linear-equations.v1.json
npm.cmd run content:diagram-preview -- content/courses/g7-math-linear-equations.v1.json
```

本机已经导入新增3题，并补齐全部15题与对应课时的关联。import 跳过已有正文；link 只为未作答的草稿课程/题目添加内容包中声明的关联，重复执行不新增重复链接，不改写既有题干、图形或解析，不删除已有链接。需要改动已有图形时使用管理员编辑页或独立修订包，不依赖重复导入覆盖。

内容包使用 diagram 对象声明受控图形，lessonKeys 引用本包课时标识；在线管理员接口使用 lessonIds。示意图需根据文字已知条件计算，矩形和线段不按实际比例。数字答案的精确校验针对标准化方程与选项，不能替代人工审阅图形标注和题干是否一致。

## 接口与数据

- 新增 Question.diagram、Question.restrictToLessons 和 LessonQuestion 关系表。
- 管理员题目接口新增可选 diagram、lessonIds；普通用户不能写入。
- `GET /api/admin/lesson-options` 提供管理员课时选项。
- `GET /api/learning/:courseId/lessons/:lessonId/questions?page=1` 提供本课已发布题目，不返回答案或解析；服务端检查选课归属、课时属于课程、发布状态与会员权益。
- 公共题库、判题和错题本统一检查题目关联课程是否开放；历史接口继续只返回本人原始快照。不会通过伪造 courseId/lessonId 绕过权限。

增量迁移 `20261105114929_diagram_lesson_practice` 和 `20261105115046_question_lesson_scope` 已在本机应用，没有重置或清空数据。新电脑恢复源码后运行 `npm.cmd run db:deploy`。迁移前备份为 work/backups/zhixue-2026-11-05T11-49-25-107Z.dump。

## 验收

```powershell
npm.cmd run test:diagrams
npm.cmd run verify
```

图形专项测试覆盖标签转义、拒绝任意 SVG/外链字段、课时关联校验、跨课程访问、未选课/会员限制、公共列表和错题隔离、删除课时后不意外公开，以及作答历史图形快照保留。

浏览器已用 localhost 独立临时管理员创建矩形题、关联课时并发布，再切换临时学生，从课时入口进入并答题，错题本与作答历史都显示图形；390px 文档无横向溢出。验收只发布临时合成内容，临时账号、课程、题目及关联作答已按确切 ID 清理，原有账号和保留的示范草稿不改动。

目前仅支持三种图形模板和四选一判题，不包括任意几何作图、交互拖拽、多选/填空/证明、上传图片识题或真实 AI 自动出图。AI 仍默认关闭，正式教材适配、云存储和运营准备仍待完成。
