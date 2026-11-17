> 最新状态：公网HTTPS https://zhixue.dycxy.shop 已配置，服务器WorkBuddy文字/图片AI已接通；按用户明确授权现有15门课程全部发布、60课时开放。旧隧道/AI关闭/3门发布描述为历史阶段，以public-vps-and-course-release.md为准。

# 知学 AI VPS 部署交接

已部署到 SSH 别名vps（192.74.249.13:22491），以SSH隧道供本机预览。尚未配置公网域名/HTTPS，AI在服务器端关闭。

## 访问和运行

- 预览：http://localhost:18300 。这是本机SSH隧道地址，实际网页、API、数据库和Redis均运行在VPS。
- 隧道当前已启动。重新连接时，在项目根目录运行start-vps-preview.cmd，保留连接窗口；原有SSH别名/密钥配置继续使用，不在项目中保存SSH凭据。
- VPS目录：/opt/zhixue-ai；版本目录：releases/20261108。
- systemd服务zhixue-api、zhixue-web已开启自启，API由非root用户zhixue运行；Docker项目zhixue-vps含独立PG18及Redis8，使用独立卷，不复用其他业务数据库。
- 网页18180、API18400、PG15433、Redis16389均仅绑定127.0.0.1。
- runtime.env仅root可读，使用独立生成的服务器配置，不复制本机凭据。APP_ORIGIN=http://localhost:18300，生产Secure/HttpOnly Cookie保留并已在浏览器验证刷新会话。
- 原/etc/caddy/Caddyfile与原站域名配置未修改。新增独立Caddy进程只监听本机。

## 内容和验证

源快照为work/backups/zhixue-2026-11-08T05-44-49-759Z.dump；VPS上backups/initial-20261108.dump。仅向隔离空库恢复，核对15门课程/3门已发布、130道题/0道已发布。未自动审核发布草稿，媒体目录当时为空。

API使用npm run build:vps生成的独立ESM文件server.mjs（约8.8MB）和Linux x64 glibc bcrypt预编译模块；不依赖服务器上未完成的node_modules安装。脚本位于scripts/build-vps-standalone.mjs。本机需先npm ci，前端使用npm run build生成的apps/web/dist。现有Node24运行环境继续使用。升级前保留当前发布目录/配置和数据库备份，不在原目录盲目覆盖。

已验证：本地Linux容器连接PG/Redis；原生bcrypt注册、会话与Secure/HttpOnly Cookie刷新、学生拒绝管理员接口、课程查询。VPS实际接口再次通过，3门公开课程与0公开题符合源快照。浏览器实测VPS登录、刷新仍保持会话和退出；合成账号已按精确ID删除，临时QA容器和凭据文件已清理。systemd API重启后ready检查也已通过，不能用进程active替代就绪检查。

资源上限：API320MB（V8堆224MB）、web96MB、PG256MB、Redis64MB；CPU亦有限制，不保证多人并发容量。实际查询时API约170MB、PG44MB、Redis5MB、web8MB。

## 运行命令

在VPS：systemctl status zhixue-api zhixue-web；journalctl -u zhixue-api --since '10 minutes ago'；curl --fail http://127.0.0.1:18180/api/ready 。Docker操作须在/opt/zhixue-ai使用docker compose --env-file runtime.env，禁止带-v删除真实卷。

域名确定后：配置DNS和HTTPS入口、调整APP_ORIGIN，重新验证登录/刷新/代理链；然后再开放公网。服务器AI需单独选定可用模型与凭据并验证，不能把本机127.0.0.1:3425直接搬到VPS。

## 本次故障

安装依赖/创建容器时曾出现rq_qos_wait及XFS fdatasync阻塞，用户明确同意重启；重启成功后Docker恢复很慢，期间原站502。随后原有容器恢复、原站健康接口200。独立API打包减少服务器上的小文件安装和加载。临时wbt_lat_usec已从0还原为原值75000并确认；没有永久磁盘参数规则。磁盘等待仍有波动，应继续观察，未证明宿主机存储问题已根治。详情见vps-deployment-progress.md，诊断文件位于聊天outputs目录；未提交服务商工单，未重装或清空磁盘。


