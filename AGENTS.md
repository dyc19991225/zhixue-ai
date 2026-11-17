# 知学 AI 开发约定

- 用户后续已明确授权配套练习题全部直接发布，线上130题现为PUBLISHED（G7=98/G8=16/G9=16，含5图形），不是旧说明中的0公开题。备份/授权/版本检查与公开分页及合成作答闭环见docs/public-vps-and-course-release.md；不得回退到旧草稿或用本地旧整库覆盖线上。该授权针对现有捕获题目，不伪造独立教研审核结论，不自动改写已有作答题。

- 最新线上状态见docs/public-vps-and-course-release.md：用户明确授权现有课程无需逐门审核而直接发布，VPS现为15门PUBLISHED、60开放课时，原3课状态不得回退；课程授权不自动扩展为题库发布。记录为用户直接发布，不伪造独立审核。公网HTTPS及VPS WorkBuddy文字/图片AI已启用，旧AI关闭/隧道-only描述已过时。本地旧快照不得覆盖线上。升级前保留服务端备份，密钥仅服务器runtime.env；内部AI转接必须拒绝公网访问。

- VPS部署见docs/vps-deployment.md：用户已授权目标vps及故障重启，已完成隧道预览；API为npm run build:vps生成的独立ESM与Linux bcrypt，不依赖VPS残缺node_modules。服务/卷隔离，原站Caddy配置保留。域名未定、服务器AI关闭；不能把本机WorkBuddy凭据或地址直接用于公网。保留实际内容状态，升级先备份。磁盘IO曾异常，75000原参数已还原，不能把当前可用声称为存储故障根治。

- 管理员文字检索见docs/admin-question-search.md。搜索须保留课时/状态并归第一页，文字重置与全部清空区分；URL恢复、查询异步隔离和当前页预览清除保留。管理员题干/知识点SQL通配符按字面；公开接口不接受管理字段。变更跑test:admin-question-search、test:question-search及相关练习/权限回归，不自动发布真实题。

- 当前页逐题预览见docs/question-review-sequence.md：捕获本页ID顺序，不跨页自动推进；逐题读取并清空核对，发布后列表变化不得使序列跳题。编辑回填最新版本，已发布/已有作答/失效题禁止预览直改。序列不持久保存或替代人工审核，筛选和身份改变要清除，不批量自动发布。

- 题目预览见docs/question-review-preview.md。管理员只读详情不得暴露课时正文/账号字段，公开练习不得返回答案。预览选择不提交作答；人工核对勾选仅本次页面状态，不冒充独立教研审计。发布用最新预览版本，409/404后须刷新重查；缺解析等基础问题不能从弹窗发布。变更跑test:question-review、test:practice、test:diagrams、test:auth，不自动审核或发布真实题。

- 逐课配套检查见docs/lesson-practice-readiness.md。只列已发布课程的开放课时，按关联题真实状态统计；管理员lessonId/status题库筛选不得加入公开练习参数。课时选项includeId有权限与上限，未验证课时不得静默新建成无关联题。保留身份/筛选异步隔离、版本与人工发布确认；变更跑test:lesson-readiness、test:practice、test:diagrams、test:auth，不自动发布真实草稿。

- 内容准备度见docs/content-readiness.md，管理员只读接口和页面不得成为发布捷径。复用未登录questionVisibility口径区分已发布题/公开题；开放课时配套仅认已发布关联题，共享题不重复计数，归档资源不充数。数量不是教材覆盖率或人工教研结论；变更跑test:readiness、test:auth与相关目录/练习检查，不修改真实课程发布状态。

- 试用反馈闭环见docs/trial-feedback.md；旧文档“仅下载”已过时。下载仍不提交，登录后必须主动点击才写入本站；本人/管理员隔离、来源与角色检查、提交幂等、revision防覆盖及同事务变更记录须保留，变更跑test:feedback、test:auth。不得自动代用户提交反馈、回复真实用户或标记问题解决；测试只用合成账号/记录，按确切ID清理。

- 用户已授权本机WorkBuddy接入，详见docs/workbuddy-images.md。AI已启用DeepSeek V4.1 Flash及显式附图，旧文档中AI关闭/照片一律不上传已过时；OCR仍本地，禁止自动发送照片。图片须明确勾选、填入、预览并点击提问；只存SHA256指纹，不存图片文件，不对外共享订阅。保留额度/鉴权/幂等与历史投影，图片变更跑test:ai-images、test:foundation及前端检查。真实小图请求已成功，不能据此声称复杂几何准确率通过。

- 裁剪查题与英语内容见docs/photo-crop-search-english.md。范围未应用时不得识别；编辑图像清旧文字/结果，保留原图仅内存恢复。查题q为2..120字连续题干查询，SQL通配符按字面，不泄答案/草稿/受限题；隐私说明区分图片不上传与主动搜索文字发本站。变更跑test:crop、test:question-search、test:practice、test:diagrams及OCR/构建。英语草稿保留CC来源/原创标注，需教师审阅，不自动发布。

- 九年级二次方程/概率草稿见docs/open-g9-math-content.md，保留课程与来源许可，不自动发布。二次方程明确a≠0/实数域/全体根及实际约束；概率核对等可能、独立和放回条件，频率不是确定概率。变更跑content:check、test:content并刷新content:coverage。

- 八年级勾股/一次函数课包见docs/open-g8-math-content.md，保留两门草稿及来源许可，不自动发布。勾股须明确直角/斜边/正根，逆定理检查三角形；一次函数采用k≠0初中口径，不混用含常值的宽定义。变更跑content:check、test:content并刷新content:coverage。

- 拍照/试用及统计课见docs/photo-trial-readiness.md。OCR仅浏览器本地处理，worker/core/lang必须本站提供，不上传照片或自动提交AI；更换身份/离页清理任务、取消结果不回填，保留校对入口与公式/手写限制。试用反馈只下载，不伪称已发送/受理；coverage从真实库统计，不用草稿当上线覆盖。变更跑test:ocr、前端构建、lint；统计课跑test:content，仍保持草稿。

- 不等式/二元方程组开放课包见docs/open-inequalities-systems-content.md，保留新草稿及CC BY-SA 4.0署名/来源/修改说明，不自动发布。解集检查须包含严格边界、负数变向和整数条件；二元解须同时代回两个原方程，不能复用一元方程校验伪认证；变更跑content:check与test:content。

- 整式/几何基础开放课包见docs/open-algebra-geometry-content.md，新增两门草稿需保留；来源固定版本和CC BY-SA 4.0随正文/解析保留。不要照录来源次数错误；题图仅现有受控模板，几何条件写清，变更跑content:check、test:content和test:diagrams。不得自动审核发布。

- 有理数开放课包见docs/open-rational-content.md与content/courses/g7-wikibooks-rational.v1.json，保留新草稿，不作测试删除或自动发布。每课/题保留CC BY-SA 4.0来源、作者历史、修改说明和同许可共享，不能改成独占内容或指定教材同步课；变更运行content:check与test:content。

- 产品按作业帮/猿辅导的同步学、练习、错题、学情方向推进，见docs/synchronous-learning.md。/study复用已发布目录，不虚构教材覆盖或OCR/AI能力；练习年级/学科URL需支持刷新与返回，课时题目授权不变；变更跑前端构建、lint、test:practice及test:catalog。

- 网站巡检见docs/site-monitoring.md，ops:check为单次只读检查，不安装计划任务或发送消息。ready必须确认数据库和Redis，不把health当依赖正常；正常验证TLS、拒绝跳转、超时与正文大小有限制，报告不存正文/凭据。变更跑test:ops及verify:containers，故障注入仅独立演练Redis。

- 联合备份见docs/backup-bundle.md，backup:bundle不读取.env、不自动停服、不覆盖目录，仅接受已退出API与完整容器ID。完整性校验不是数字签名；全部写入者须由运维停止。恢复只到独立临时库/目录，禁止对真实库覆盖验收；变更跑verify:containers。

- 独立容器演练见docs/container-rehearsal.md，npm run verify:containers使用专用Compose项目/空env模板/随机凭据与证书，只发布127.0.0.1。禁止改用根.env、真实数据卷或VPS完成测试；清理必须校验精确演练项目名。报告须区分容器验证与正式上线，不能把媒体持久化当作完整备份或将本地证书用于公网。

- 我的选课记录见docs/learning-library.md，test:library纳入verify。仅本人数据，开放课时聚合/分页、0课时不可判完成；会员失效保留摘要但不提供学习目标。继续学习优先最近未完成开放课时；公开/学习导航不得包含未开放课时，旧进度只过滤不删除。变更跑test:learning、test:foundation、test:catalog。

- 课程目录筛选见docs/course-catalog-filters.md，test:catalog纳入verify。搜索/分页在数据库执行，total和学科数量不得用当前页长度代替；元数据选项仅来自当前年级已发布课程，未知版本不推断。URL保存筛选与页码；公开目录仅返元数据/标题，不返正文/视频/审核记录，会员鉴权保留。

- 管理员审核队列见docs/course-review-queue.md，test:review-queue纳入verify。每门草稿仅最新PENDING入队，旧待审不能在新决定后复现；内容失效/本人提交仍显示但不可审核。摘要与审核决定分离，决定端必须再次核对指纹、版本和独立审核人；不得自动审批真实课程或发布。

- 家长只读待办沿用docs/study-tasks.md，变更跑test:tasks与test:relations。每次请求在事务内核验有效绑定及双方角色，不能自报学生ID获得权限；只展示任务摘要，禁止学生答题/提交入口。孩子选择须从当前账号最新绑定列表派生，切换身份/分页不得残留上一孩子的数据。

- 教师教学待办见 docs/teacher-tasks.md，test:teacher-tasks 纳入verify。待批改仅当前教师作业与当前所属有效班级，已截止作业仍可批改，归档不计入；提交列表未批优先。课程草稿是入口而非送审结论，摘要只读不得自动批改/送审/发布；变更同时跑test:homework。

- 学生学习待办见 docs/study-tasks.md，test:tasks 已纳入 verify。仅当前学生、有效班级/教师/发布名单、未提交且未截止的任务；个人考试计时结束后不得继续列为可答。接口只读且禁止返回答案/成绩，作业深链只打开详情，考试深链不得自动开始。

- 最新运行状态：用户已自行送审并发布3份原课程，现为PUBLISHED；早期要求“保持DRAFT”指当时状态，不得据此回退用户发布结果。work/verify-audited-content.ts里的DRAFT断言已过时，不再作为当前状态检查。首页/课程目录按公开课程接口展示实际列表和学科数量，不能写死“内容筹备中”；教材及题库是否已审核发布仍分别判断。

- 项目采用用户指定的前后端分离架构：React 18、TypeScript、Ant Design、React Router v7；Node.js、Express、Prisma/PostgreSQL。
- `apps/web` 放前端页面、组件和样式；`apps/api` 按 routes/controllers/services/repositories/lib/middleware 分层；`packages/shared` 放双方共用的类型与目录元数据。
- Prisma 模型保存在根目录 `prisma/`，生成代码仅位于后端且不提交。浏览器不得导入 Prisma 或任何服务端配置。
- 未经用户明确要求，不部署、不购买服务、不操作域名或交易；认证基础已实现，Redis、OSS 和部署按后续里程碑实施。
- 原型目录不等于已上线课程。登录、会员、练习和 AI 不得虚构完成状态。
- 所有 API 使用 `{ code, message, data }`，成功 code=0；失败保持 HTTP 状态和 code 一致，data=null。不要把堆栈、连接字符串和内部错误返回浏览器。
- 实现业务写接口前必须补齐认证、资源归属、角色/会员权限检查；不要仅靠前端隐藏按钮。
- `.env`、密钥、真实学生数据、node_modules、dist 和生成代码不得提交；只提交无真实凭据的 `.env.example`。
- 依赖变更同步根 package-lock.json。不要盲目运行 audit fix --force。
- 按需运行 lint、typecheck、test、build；Prisma 模型变更须 db:validate。认证和权限变更还需 test:auth（使用本地 PostgreSQL，自动清理合成账号）。后端测试要覆盖真正的协议和验证行为。
- 当前课程与学习闭环见 docs/courses-and-learning.md；账户见 docs/accounts-and-permissions.md；架构迁移见 docs/architecture-migration.md，Windows 启动见 docs/windows-setup.md。
- 最新单选题库与错题闭环见 docs/practice-and-wrongbook.md；相关变更还需运行 test:practice。已作答的题目不允许原地改写，保留历史快照；不要清空真实题库或作答记录。
- 当前主交接见 docs/local-foundation-handoff.md。媒体/会员/Redis/AI 变更运行 test:foundation，统一验收用 verify（串行生成 Prisma）。AI 默认关闭，不得为测试打开真实外部调用；使用独立本地模拟服务与隔离的额度命名空间。视频、.env 和备份不得进入源码包或 Docker 上下文。
- 内容包位于 content/，编写和草稿导入见 docs/content-authoring.md；变更运行 test:content。自编示范课程已作为 DRAFT 保留，不要当测试数据清理，不自动发布或覆盖人工修订。AI 质量评测文件不等于模型已经通过。
- 题图仅使用 shared/diagram 受控模板，禁止接收原始 SVG/HTML。课时关联与访问边界见 docs/diagram-lesson-practice.md，变更运行 test:diagrams。删课时不能令原受限题目变成公开题，历史快照必须保存原图。

- 四角色RBAC基础见 docs/four-role-rbac.md。注册默认学生；角色变更仅管理员且事务撤销会话/写审计，角色和权限变更运行test:rbac（已纳入verify）。教师/家长关系业务未实现，不得把角色名称当作资源授权。新增用户模块在apps/api/src/modules/user；旧目录尚未整体迁移。

- 教师归属、班级/家长关系见docs/teaching-relations.md；新增关系接口及角色变更清理逻辑运行test:relations（已纳入verify）。家长绑定仅管理员维护，不得允许自报学生ID认领；教师只看自身课程/管理自身班级，所有概览必须检查有效绑定。

- 作业V1见docs/homework.md，发布名单快照、一次提交/一次批改、请求幂等及历史记录不得破坏。作业变更运行test:homework（纳入verify），不得把作业当作考试或自动批改已完成。

- 考试V1见docs/exam.md；变更运行test:exam（纳入verify）。保留发布名单/试题快照、服务端截止、revision幂等保存与全卷结束前成绩保密；不得借用真实账号/课程做破坏性验收。后台扫描依赖运行中的API，不能称为持久队列。

- 学情V1见docs/analytics.md；变更运行test:analytics（纳入verify）。家长须有效绑定、教师仅所属班级测评，禁止泄露学生私人练习或未公布考试分数；null不能当0分，累计正确率不得称为知识点掌握度。

- 学情趋势按Asia/Shanghai日界，旧timestamp字段按UTC解释，新timestamptz直接换算。只接受7/30天，数据库聚合，不加载全部历史；教师班级趋势不得包含私人练习/课时。退班/归档会改变当前可见汇总，不称为历史快照。

- 趋势CSV导出必须重新做当前授权，不从前端缓存绕过解绑/角色检查。保留BOM、CRLF、空正确率与0%的区别；当前只导出固定表头/日期/数字，增加自由文本时须处理电子表格公式注入。导出不得包含私人作答或未公布分数。

- 湖北多版本教材来源元数据在content/sources/hubei-textbooks，说明见docs/hubei-textbook-sources.md。省价格目录不等于市校实际选用；全国平台版本不等于湖北全部采用，公开阅读不代表可商用转载。来源JSON不是课程包，不直接导入或自动发布。

- 七上方程映射见docs/g7-equation-alignment.md与content/alignments；人教目录已查、北师大正文需登录，保留未核验字段，不混用旧新版标题。原创应用补充包g7-math-equation-models.v1.json（3课时9题）已导入DRAFT，保留原稿；变更跑test:content，勿当作临时数据删除或自动发布。

- 单元测评在content/assessments，见docs/g7-equation-unit-assessment.md。变更运行assessment:check、test:content（均纳入verify）；assessment:preview生成含答案的审阅页与未绑定模板。20道单选100分、5道书面练习另计50分（含往返及先做后合作），不得混计或自动批改主观题；未授权具体班级/时间不得自动创建发布考试。

- 跨模块合成验收见docs/student-journey.md，test:journey纳入verify；随机账号/课程副本串联学习、错题、作业、考试、学情及CSV，按确切ID清理。不得改用真实学生数据或将模拟人工评分当作教研审核；本测试不要求预先导入原稿。

- 测评模板导入见docs/exam-template-import.md。仅教师/管理员可校验未绑定JSON模板，复用手工题及受控图形schema；导入只替换编辑器标题/时长/题目，保存和发布分离，变更跑test:exam。模板含答案，不向学生发放。

- 课程审核见docs/course-review.md，test:review纳入verify。当前归属教师/管理员送审，另一管理员审批；正文/元数据/视频编号快照指纹一致且最新审核通过才允许发布。改内容需重新审核，历史保留；原稿不自动送审。题库、考试和视频正文不在此快照范围，勿称为已完成人工教研。

- 教师改稿见docs/teacher-course-revision.md，test:teacher-edit纳入verify。仅归属教师可改DRAFT现有正文和说明，保留章节/课时ID、顺序、视频与学习进度；不允许教师增删结构或发布。保存使用updatedAt防覆盖，内容变化使旧审核失效，不自动送审原稿。




