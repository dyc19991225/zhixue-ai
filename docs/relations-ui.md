# 教师、班级与家长界面

新增页面：
- /teacher/courses：教师所属课程列表及课时正文审阅。
- /classes：管理员/教师创建班级、维护名单、软归档；学生仅查看所属班级。
- /parent/students：已绑定学生列表和真实基础统计。
- /admin/relations：管理员查找家长/学生、建立及解除绑定、分页查看有效关系。

个人中心按角色展示入口，用户管理页增加班级/家长绑定入口，课程管理增加教师归属表单。管理员账号选择器支持按账号/昵称查找，只列当前指定角色的有效账号，每次最多20个；匹配过多提示继续输入。老师按完整学习账号加学生，不开放全平台学生目录。

本轮为现有workspace接入页面；新页面按角色放在apps/web/src/pages/{teacher,parent,admin,shared}，API调用集中src/api/relations.ts，未将整个项目迁移到client/server或更换状态管理依赖。

共享加载hook在路径或账号变化时立即屏蔽上一份数据，并忽略过期请求响应。新表单沿用Ant Design、可见标签、提交反馈、确认弹窗与错误重试；长表格在容器内横向滚动，手机表单单列。

配套新增API：
- GET /api/admin/user-options?role=TEACHER&q=账号或昵称&id=可选ID。仅ADMIN，返回{page:1,pageSize:20,total,list:[{id,username,displayName,role}]}。
- GET /api/admin/parent-links?page=1&pageSize=10&parentId=可选&studentId=可选。仅ADMIN，返回PageResult<ParentLinkView>。
- POST /api/classes/:id/students，Request:{username:string}，Response:{code:0,message:"ok",data:null}。仅ADMIN/所属教师；输入规范化为小写，查验有效学生并记录审计；重复添加不重复写审计。

验证：完整verify通过，58项测试及类型/lint/前后端构建通过。新增后台账号选择与绑定列表权限/字段检查；原班级用例补充按账号添加的权限和无效账号检查。

浏览器使用localhost独立Cookie会话及四个随机合成账号，保留127.0.0.1原用户会话。实际验证教师课程正文、创建班级、添加学生；管理员绑定提交、列表刷新、已分配教师显示与保存；家长绑定学生概览；学生班级只读及教师页403。家长与学生页390px DOM宽度检查无横向溢出，视口已恢复。截图为桌面合成验收内容，未生成手机截图。

本轮合成账号、课程、班级和审计已按精确ID清理，临时凭据文件已删除；原有六课15题及六题补充包重新读取逐项一致，仍为草稿。截图中的验收学生/课程并非正式上线内容。

教师课程编辑、作业、考试、完整学情分析仍待后续开发。未部署、发布课程、配置支付或启用真实AI。
