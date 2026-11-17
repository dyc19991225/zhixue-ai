# 公网入口、WorkBuddy AI 与课程发布

正式地址：https://zhixue.dycxy.shop ，无需SSH隧道。DNS已指向192.74.249.13，Caddy托管HTTPS证书和续期，HTTP跳转HTTPS（实查308）。现有其他站点配置保留，追加独立站点；配置前备份位于VPS /opt/zhixue-ai/backups/public-20261108-080608。

## 公网与AI

APP_ORIGIN已改为https://zhixue.dycxy.shop，生产Secure/HttpOnly Cookie保持；公网浏览器的合成账号登录、刷新仍保持会话、退出通过。旧localhost:18300隧道仅调试用途，不再作为登录入口。

网页走127.0.0.1:18180，/api直接代理127.0.0.1:18400，以保持单层代理和真实客户端IP；PG15433/Redis16389仍只监听回环。就绪检查显示数据库/Redis连接。

用户已明确选择继续使用VPS现有WorkBuddy。鉴权配置在服务器内从既有WorkBuddy设置读取，只写入root可读的runtime.env，不输出、下载或写入前端。模型为deepseek-v4.1-flash。生产API仅允许HTTPS模型地址，因此新增/_internal-ai/转接到127.0.0.1:8788，按真实连接来源仅允许127.0.0.1、::1和服务器自身IP；公网请求实测404。AI经有效HTTPS证书连接该入口，不关闭TLS验证，不放宽生产端点规则。

AI_ENABLED和AI_IMAGE_ENABLED已开启，沿用用户主动附图机制，每用户每日20次、本站每日100次。模型目录已鉴权验证。小张合成方程PNG经上游读出3x + 2 = 11，x=3；公网/api/ai/questions也返回正确步骤与检验。相同requestId重放返回同一条记录，错误Origin拒绝；只证明该合成样例和链路可用，不代表复杂几何/手写准确率通过。合成账号、AI记录及个人测试计数已精确删除，实际调用的全局计数保留。

## 用户授权直接发布现有课程

用户明确指令：“把课程都直接发 不用我审核”。本次仅作用于VPS当时的12门现有DRAFT课程及其50课时，检查简介、章节、课时正文/媒体完整性，先做完整数据库备份和内容快照，再以事务锁与updatedAt版本条件发布课程并开放课时。

备份/授权/前后结果记录在VPS：/opt/zhixue-ai/backups/direct-publish-20261108T081313Z。authorization.json明确标为USER_DIRECT_PUBLISH_EXISTING_COURSES、independent_teacher_review=false；没有伪造提交人/审核人、独立教研勾选或APPROVED记录，也没有永久移除后台审核机制。

当前线上15门课程全部PUBLISHED、60个开放课时；公开目录实查七年级11门、八年级2门、九年级2门，全部课程详情返回200。原3门公开课保留。130道配套题仍未发布，本次课程发布不等于题库上线。来源、许可证、正文与待审阅标签保留，不将直接发布描述为独立教研通过。

本地数据库快照仍可能保留旧草稿状态；未来升级不得用本地旧整库备份覆盖线上，避免回退本次发布与新产生的用户记录。

## 用户授权发布现有配套练习

用户随后明确指令：“配套练习题也全部直接发布吧，不用我审核”。本次仅发布捕获快照中的130道现有DRAFT题目，事务内锁定题目/关联与课程课时表，校验updatedAt一致；只改status/updatedAt，不改题干、选项、正确答案、解析、图形、关联或原作答。

备份与操作记录位于VPS /opt/zhixue-ai/backups/question-release-20261108T081749Z，包括完整before.dump、题目快照questions.json、实际questionSchema和受控图形schema验证报告、用户授权authorization.json与结果/状态回退SQL。记录标为用户直接发布，不伪造独立教研审核结论。

130题全部通过现有入库schema、非空解析、四个不同选项/答案范围及关联开放课时检查，含5道图形题。线上当前PUBLISHED=130、DRAFT=0、ARCHIVED=0；年级分布G7=98、G8=16、G9=16。公开接口逐页验证130个唯一ID与快照完全一致，答案和解析在作答前不返回；浏览器练习页实际显示七年级98题。

合成学生账号实测答错入错题本、答对解除、选课后课时配套题可见；验收账号、作答、错题与选课记录通过精确账号ID清理。未删除或改写真实用户记录。线上发布状态优先，本地旧草稿备份不能用于覆盖线上。
