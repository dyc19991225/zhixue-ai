# 知学 AI：题源筛选与完整示范课审核

审核日期：2026-11-05。对象是现有“一元一次方程”3章6课、15题（含3图），以及新增的6道开放来源补充题。这里的“完整”是这套示范课全量审核，不代表初高中全教材已制作或审核。

## 结论与实际修改

现有题目的选项答案未发现算错。逐课阅读定义、步骤、检验、练习和解析后，修订5个课时正文及1道重复图题；已精确同步到原DRAFT课程。原课程ID和课时ID保留。新增独立补充课程1课时6题，全部导入DRAFT，未发布。

| 课时 | 审核内容与结论 | 已处理 |
| --- | --- | --- |
| 1 方程与解 | 区分式子/等式/方程；x+5=12解为7；3x-2=10代入4成立；排除二次、多元、未知数在分母 | 增加有理数运算/分配律等先修知识；说明ax=b时a不能为0；补充抵消后无解、任意实数均满足的边界例子 |
| 2 等式性质 | 同加减、同乘、除以非零数；乘0会丢失等价性；-2x=8解为-4；练习x-3=9解为12、3x=-12解为-4 | 数学表述和计算可保留，无改写 |
| 3 移项合并 | 2x-3=7解为5；5x+2=2x+14解为4；4x-1=x+8解为3；代入检验成立 | 补上两段线段长度相加的建模讲解，避免配图题缺对应教学 |
| 4 去括号 | 分配律含负号；3(x-2)=9解为5；2(x+3)-x=10解为4；5-(x-2)=3解为4；2(x-1)+3=9解为4 | 给负括号例题补代入检验；给离课展开练习补参考答案 |
| 5 去分母 | 原有例题解分别为9、9，练习解为5；乘最小公倍数必须覆盖常数项 | 将含混的“分数方程”改为“含分数系数的一元一次方程”；增加分数前负号例题，解为5并验算 |
| 6 应用 | 练习本7元、长方形长9厘米、计费路程8千米；检查单位和正整数条件 | 补上相邻两角组成平角的方程例题；明确相邻不一定互补 |

图题核对：长方形题原来与文字题数据完全重复，改为周长24厘米、宽5厘米、长7厘米，题干/选项/解析/检验/无障碍说明/图注同步修改。线段题x=8；角度题x=120。三图均以条件计算，不能量图求解；角度图左侧60°、右侧x°与图形方向相符。图题关联的课时现在均有对应说明。

## 网页上有哪些题可以导入

不是所有公开可见页面都允许复制到商业学习平台。本次核对官方仓库/官方许可页，未绕过付费或访问限制。

| 来源 | 官方证据与适配判断 | 本次处理 |
| --- | --- | --- |
| OpenAI GSM8K | [官方数据说明](https://github.com/openai/grade-school-math)、[MIT许可](https://github.com/openai/grade-school-math/blob/3101c7d5072418e28b9008a6636bde82a006892c/LICENSE)；官方仓库公开包含数据文件，未见数据另列限制；需保留版权和许可全文 | 选6题，中文翻译改编、增加四选一和方程解法，已导入草稿。不是国内教材同步题 |
| CK-12 | [官方商用说明](https://help.ck12.org/hc/en-us/articles/53032403416219-Can-I-Use-CK-12-Content-to-Make-Money)：未授权不能将内容用于商业产品 | 未导入 |
| WeBWorK OPL | [题库许可](https://github.com/openwebwork/webwork-open-problem-library/blob/main/OPL_LICENSE)：默认CC BY-NC-SA 3.0，个别题可能另有许可；程序许可不等于全库题目商用许可 | 未导入默认非商用内容 |
| OpenStax 当前网页 | [当前书籍许可页脚](https://openstax.org/books/elementary-algebra-2e/pages/index)：当前页面列BY-NC-SA及商业使用/生成式AI使用限制；历史部分PDF标注不同，不混用版本 | 未导入当前网页内容 |
| Math23K | [公开仓库](https://github.com/SCNU203/Math23k)：本次未核实到覆盖题目内容的明确商业复用授权；研究下载不能直接等同于商业转载许可 | 未导入 |

可以直接用现有导入器读取的是本次转换后的JSON包。上游GSM8K为英文question/answer JSONL，并不能不经转换就当成平台的四选一题库。

固定来源提交：`3101c7d5072418e28b9008a6636bde82a006892c`，`grade_school_math/data/test.jsonl`。选取从0计数13、24、25、28、33、46，共6题。

题目范围：连续售出与剩余、折扣原价、购物总价、分段路程、数量差、便签补充。保留原题数值与美元/英里单位；对部分人物名本地化，将开放作答改为四选一，并自行补充方程解析与干扰项。没有导入原数据的模型生成解答文件。六题答案与原始数据最终答案逐项一致，并独立代入原始数量关系复算。

来源追踪：`content/sources/gsm8k/manifest.json`含原始六条记录、行号、固定版本URL、源文件SHA256、变更说明；同目录LICENSE保留MIT全文。每题解析也带固定来源、修改说明和MIT全文，因此当前已有的解析/作答快照机制能保留这些信息。当前没有单独的结构化数据库版权字段，后续后台改写解析或导出题目时必须保留该许可段。

## 所有题目的审核答案

以下为修订后的答案，图形长方形题已改数据。

| 资源键 | 选项 | 正确值/表达式 |
| --- | --- | --- |
| recognize | A | 2x + 3 = 7 |
| addition | A | 7 |
| negative | B | -4 |
| two-steps | B | 5 |
| both-sides | C | 4 |
| distribute | C | 5 |
| combine | B | 4 |
| fraction-one | C | 9 |
| fraction-two | C | 9 |
| notebooks | C | 7 |
| rectangle | B | 9 |
| coefficient-sign | A | -4 |
| figure-rectangle | B | 7 |
| figure-segment | C | 8 |
| figure-adjacent | C | 120 |
| gsm8k-test-0013 | C | 18 |
| gsm8k-test-0024 | B | 26 |
| gsm8k-test-0025 | B | 2 |
| gsm8k-test-0028 | B | 25 |
| gsm8k-test-0033 | C | 70 |
| gsm8k-test-0046 | C | 163 |

## 验证与数据安全

- 现有15题中14道数值题、新增6道数值题，使用原有BigInt有理数检查选项；另有独立的原始表达式/情境关系测试，防止只相信手写的标准化系数。概念题按定义逐项核对。
- 数据库逐条读取比对：原6课15题及补充1课6题，与审核后的来源JSON一致；共21条课时题目关联，所有题仍受课时访问限制且为DRAFT。
- 补充包连续导入两次：第一次创建1课6题，第二次创建0、跳过6，验证幂等性。
- 备份在`work/backups/zhixue-2026-11-05T12-15-40-328Z.dump`，未放入交付压缩包。
- 对原课程的本次同步采用事务、原文逐项比较、DRAFT/未发布课时/题目未作答条件检查；有人工修改或状态冲突即回滚。没有重置数据库，没有改历史作答。
- schema、TypeScript、lint、7组共36项测试、前后端build分项通过。新增版权完整性断言初次遇到Windows换行与尾换行差异，统一换行比较后3项内容测试通过；其余组未因此改动。
- 网页检查更新图题和新增题目的可见正文、展开答案、来源许可。静态审阅网页含答案，仅用于审阅，不能作为学生练习入口。

## Windows / PowerShell 复核

在已有项目环境中执行（不包含凭据，不需要购买服务）：

```powershell
Set-Location E:\projects\zhixue-ai
npm.cmd run content:check -- content/courses/g7-math-linear-equations.v1.json
npm.cmd run content:check -- content/courses/g7-gsm8k-applications.v1.json
npm.cmd run test:content
npm.cmd run content:preview -- content/courses/g7-math-linear-equations.v1.json
npm.cmd run content:preview -- content/courses/g7-gsm8k-applications.v1.json
# 需要在另一个本地环境导入补充草稿时；数据库已配置并已迁移后执行：
npm.cmd run content:import -- content/courses/g7-gsm8k-applications.v1.json
```

本机已经导入，无需重复操作。原包导入器只创建缺少资源，不覆盖已有正文；不要以为重新import原包即可把审阅更正同步到已有课程。本次已做针对性安全同步，其他环境需要另行比对原内容，不能直接覆盖人工编辑。

若4174预览服务未运行，可另开PowerShell：

```powershell
Set-Location E:\projects\zhixue-ai
python -m http.server 4174 --bind 127.0.0.1 --directory work/content-preview
```

本地审阅链接：

- [完整六课与15题](http://127.0.0.1:4174/zhixue-g7-math-linear-v1.html)
- [三道图形题](http://127.0.0.1:4174/zhixue-g7-math-linear-v1-diagrams.html)
- [六道开放来源补充题](http://127.0.0.1:4174/zhixue-g7-gsm8k-applications-v1.html)

## 仍需完成的教研工作

当前可作为一元一次方程基础示范，不宜称为某版教材的完整单元。尚未核对具体教材版本/学期/地区、课标条目和教学顺序；没有覆盖全套行程、工程、配套、利润等综合应用，也没有单元诊断卷、分层题量和主观解题步骤评分。

建议先确定教材版本，再由数学教师复核定义表述、例题梯度、难度标签和每课容量；这次是AI辅助数学与编辑审核，不是教师签审或教材认证。新增外文数据改编题适合补充练习，不能替代国内中考题库。两套内容均保留待审，不自动发布，不触发真实AI服务。
