# 测评模板导入

教师或管理员进入“班级空间 → 班级考试 → 创建试卷 → 导入测评模板”。也可以在未发布草稿的编辑器中使用。

1. 选择JSON文件，或粘贴JSON，点击“校验并预览”。文件最多512KB。
2. 核对题数、总分、时长，展开各题查看选项、答案、解析与受控题图。
3. 点击“载入编辑器（替换题目）”，替换当前标题、作答时长与全部题目；当前班级、开始/结束时间保持不变。
4. 在编辑器中核对时间、题目与分值，点击“保存草稿”。发布仍需单独确认，不会由导入触发。

模板包含答案和解析，供教师审阅，勿作为无答案学生试卷发放。当前仅支持1至50道单选自编题（MANUAL），不接受BANK引用、原始SVG/HTML题图或绑定班级/时间的已发布数据。5道书面任务仍走独立作业人工批阅，不混入单选100分。

## 生成现有单元模板

```powershell
Set-Location E:\projects\zhixue-ai
npm.cmd run assessment:check
npm.cmd run assessment:preview
```

文件：`E:\projects\zhixue-ai\work\content-preview\zhixue-g7-math-linear-unit-v1-exam-template.json`。

包络格式固定：

```json
{
  "status": "UNBOUND_DRAFT_TEMPLATE",
  "requiredBeforeUse": ["classId", "opensAt", "closesAt"],
  "payload": {
    "title": "示例草稿",
    "durationMinutes": 40,
    "questions": [
      {
        "source": "MANUAL",
        "title": "解方程x+1=3，x等于多少？",
        "options": ["1", "2", "3", "4"],
        "answer": 1,
        "explanation": "两边同减1，得x=2。",
        "points": 5,
        "diagram": null
      }
    ]
  }
}
```

## API

`POST /api/exams/template-preview`，仅ADMIN/TEACHER，同源认证请求。Request为上述包络。Response为统一`{code:0,message:"ok",data:{title,durationMinutes,questions,totalPoints}}`。复用考试手工题Zod校验及受控图形schema，预览不写数据库。

## 本轮验证（2026-11-06）

- 全量verify共105项测试通过，无失败/跳过，含考试13项。覆盖未登录/学生/家长拒绝、管理员/教师允许、非法图形、答案越界、重复选项、空题/超量、BANK引用及额外绑定字段拒绝；预览不创建考试。
- 浏览器用独立localhost合成教师会话：错误JSON提示、文件选择、20题/100分/3题图预览、展开答案解析、载入编辑器、保持原时间、保存草稿均验证；持久化题目与模板逐项一致。
- 默认窗口与390px检查，手机无水平溢出。最终预览窗增加固定可滚动内容区，底部操作保持可达；最后布局修改后前端类型检查及构建通过。
- 合成账号、班级与草稿按确切ID清理。3份原始课程仍为DRAFT，课时、题目和关联与源文件一致。无正式班级考试发布或真实学生评分。

自动验证不替代人工教研审核，教材版本与真实试学仍待确认。
