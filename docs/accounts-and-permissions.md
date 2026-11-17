# 数据库、账户与权限

2026-11-05 本地开发里程碑。尚未完成正式内容、监护人流程和对外运营准备。

## 已完成

- 启动现有 Docker Desktop，以 PostgreSQL 17 运行本项目数据库，仅绑定 127.0.0.1:5433。
- 创建并应用 account_foundation 迁移，真实读写验证通过；没有导入正式用户或课程。
- 学习账号注册、密码登录、退出、退出全部会话、刷新后恢复登录、昵称与年级设置。
- bcrypt 成本 12；新密码至少12字符，UTF-8 最多72字节。数据库不保存明文密码。
- access JWT 有效期15分钟；refresh JWT 对应会话最长7天，使用不同随机密钥和 audience。
- access token 只存前端内存；refresh token 放 HttpOnly、SameSite=Strict、/api/auth 路径 Cookie。数据库只保存 refresh token 的 SHA-256 哈希。
- refresh 每次轮换；旧令牌再次使用时撤销同一会话。数据库条件更新保证只能有一个轮换成功，前端通过 Web Locks 协调同源页面刷新。
- 受保护请求检查数据库里的用户、会话和状态；退出、改密、恢复或停用后，旧 access JWT 也失效。
- 注册固定创建学生，不能提交额外 role/status/userId 提升权限。个人设置和会话操作只针对认证用户自己。
- 管理页分页查看用户、停用和恢复账号；不能停用自己，状态变更记录审计日志。网页不开放管理员授权。
- 本地找回密码使用一次性恢复码，注册时只显示一次。重设后旧恢复码失效，生成新的恢复码并撤销旧会话。

## 页面和管理员

| 页面       | 能力                                     |
| ---------- | ---------------------------------------- |
| /login     | 登录、注册、恢复码重设                   |
| /dashboard | 本人资料、改密、会话管理；学习记录仍为空 |
| /admin     | 管理员用户列表与账号停用/恢复            |

没有默认管理员或默认密码。先在页面注册自己的本地测试账号，再执行：

```powershell
Set-Location 'E:\projects\zhixue-ai'
npm.cmd run user:promote -- --username 你的已注册账号
```

退出再登录后进入“用户管理”。命令只修改已存在的可用账号，并记录本地授权，不需要把密码放在命令行。

## API

统一返回 `{ code, message, data }`。成功 code=0，失败使用对应 HTTP 状态和 code，data=null。认证响应 no-store，不返回 refresh JWT、密码哈希、恢复码哈希或堆栈。

| 方法与路径                        | 行为                                                   |
| --------------------------------- | ------------------------------------------------------ |
| POST /api/auth/register           | username、passphrase、displayName、grade；固定学生角色 |
| POST /api/auth/login              | username、passphrase                                   |
| POST /api/auth/refresh            | Cookie 刷新；无 Cookie 时返回匿名状态                  |
| POST /api/auth/logout             | 撤销当前会话，清除 Cookie                              |
| POST /api/auth/logout-all         | 认证后撤销本人全部会话                                 |
| POST /api/auth/credentials/change | 认证后提交 currentPassword、newPassword                |
| POST /api/auth/recover            | username、一次性 recoveryCode、newPassword             |
| GET /api/auth/sessions            | 本人会话元数据                                         |
| DELETE /api/auth/sessions/:id     | 仅能撤销本人会话                                       |
| GET /api/users/me                 | 本人资料                                               |
| PATCH /api/users/me               | 仅 displayName、grade                                  |
| GET /api/admin/users?page=1       | 管理员；每页20条                                       |
| PATCH /api/admin/users/:id/status | 管理员；ACTIVE / DISABLED                              |
| GET /api/ready                    | 检查数据库及 User 表可查询                             |

保护接口使用 Bearer access JWT。写请求另需同源 Origin 与 `X-Zhixue-Client: web`；没有开放跨域 CORS。注册、登录、刷新、恢复和改密分别限流。

## 数据与验收

数据库备份保存在本机项目 `work/backups/accounts-foundation-20261105.dump`，已恢复到新建的独立临时数据库并查询验证，随后删除临时库。原数据库未清空、未重置。

6项基础测试与8组真实 PostgreSQL 认证场景通过，覆盖跨账号访问、令牌重放、停用、改密、恢复、退出及限流。浏览器验证登录、刷新保持登录、昵称保存、学生403及管理员停用/恢复。UI使用临时合成账号，检查后清理，不留下默认管理员。

## 仍需完善

- 当前限流为单进程内存，多实例部署需迁入 Redis。
- 恢复码不是短信/邮件方案；码丢失且忘记密码时，当前没有人工身份核验通道。请仅使用测试资料并妥善保存恢复码。
- 未实现短信、邮箱、监护人关系、账号注销、生产告警和正式数据保留策略。
- 本地 HTTP 使用非 Secure Cookie；对外部署须 HTTPS、Secure Cookie、准确 APP_ORIGIN 和可信反代配置。
- 课程管理、正式学习记录、会员、支付、AI、OSS/七牛和生产部署仍是后续步骤。

实现参考：[OWASP 密码存储](https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html)、[OWASP 会话管理](https://cheatsheetseries.owasp.org/cheatsheets/Session_Management_Cheat_Sheet.html)。
