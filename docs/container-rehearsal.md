# 独立容器上线前演练

Windows PowerShell 在项目目录执行：

```powershell
Set-Location 'E:\projects\zhixue-ai'
npm.cmd run verify:containers
```

需要已运行的Docker Desktop和可用的镜像/依赖下载连接。该命令会构建当前源码，第一次运行可能耗时数分钟。它不加入日常verify，以免每次业务验证都构建镜像和创建容器。

## 本次验证的边界

每次生成新的 `zhixue-rehearsal-<随机值>` Compose项目，使用独立PostgreSQL/Redis、媒体卷和证书卷。没有读取根 `.env`，没有挂载原数据库或 `.local-media`，不连接VPS、不调整域名或启动公网服务。仅在127.0.0.1发布一个随机HTTPS端口；API、数据库、Redis均不发布宿主机端口。

生产模式API使用临时随机JWT密钥和数据库密码，AI关闭；密码特意含URL特殊字符，并经URL编码组成数据库连接串。凭据通过子进程环境传入，不写进报告或模板。Compose的env-file是空模板，以隔离根目录配置。构建上下文继续排除真实配置、视频、备份及work目录。

OpenSSL生成一天有效的本地测试证书，HTTPS客户端只对本次请求显式信任该证书，正常验证主机名和证书；不关闭证书验证、不修改系统信任库。本证书不能用于正式网站。Nginx TLS设置参考[官方HTTPS配置](https://nginx.org/en/docs/http/configuring_https_servers.html)，健康等待参考[Docker Compose up文档](https://docs.docker.com/reference/cli/docker/compose/up/)。

## 验收项

1. 全新数据库应用真实迁移，生产模式API的ready检查确认数据库和Redis连接。
2. HTTPS证书验证、Nginx反向代理、SPA深层路由可访问。
3. 实际检查Docker端口映射，只允许web的127.0.0.1 HTTPS入口；AI状态为关闭。
4. 合成学生注册及独立登录、本人资料/空学习库读取、管理员接口拒绝访问。
5. Cookie包含Secure/HttpOnly/SameSite=Strict，刷新轮换后注销，原会话访问被拒绝。
6. 检查API进程UID非0，向媒体卷写入标记，重启后仍可读取；不操作真实视频。
7. pg_dump备份演练库，恢复到另一个临时库，确认合成账号数据存在。

脚本最后只对自己生成并通过格式校验的项目执行down/删除卷，清理临时CA文件和env模板，并尝试移除本次镜像标签。构建缓存可能保留供后续运行复用，不清理其他项目或全局缓存。

## 报告和失败处理

脱敏日志及JSON报告位于 `work/zhixue-rehearsal-<随机值>/`。报告包含检查项、通过状态、清理状态和 `publicDeployment=false`、`productionDataUsed=false`；失败返回非零退出码，不能仅根据部分“通过”文字判断整轮成功。

如果进程被强制终止，finally可能未完成，请依据日志中的精确项目名检查遗留资源；不要用不带项目名的down、全局prune或删除现有生产/本地数据卷。镜像构建与恢复演练不等于完成VPS部署、真实数据迁移、全站压测、自动备份排期或告警监控；这些仍需后续实施。媒体卷重启保留也不等于已有异地视频备份。
