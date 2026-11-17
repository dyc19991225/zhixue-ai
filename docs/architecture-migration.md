# 前后端分离里程碑（2026-11-05）

> 这是架构迁移阶段的记录。数据库、注册登录、JWT/bcrypt、个人设置及管理员权限现已实现，最新范围见 `accounts-and-permissions.md`。下方“当前边界”描述迁移刚完成时的状态。

## 本次落实

前端改为 React 18.3.1、TypeScript、Ant Design 6.7、React Router 6.30.6，使用 Vite 构建。蓝黄宣传首页、生成的宣传图、学科目录、原有占位页面和大屏布局修复已迁移。

后端改为独立 Express 5 + TypeScript 服务，Prisma/PostgreSQL 仅在后端使用。原 Next.js 依赖与应用结构已退出当前构建。

目录使用 npm workspaces，根目录只保留一份锁文件：

```text
apps/web/
  src/pages/          页面
  src/components/     导航、页脚、站内链接、图片组件
  src/features/       课程展示与筛选
  src/hooks/          后端目录读取
  public/images/      已保存的摄影素材与宣传图
apps/api/
  src/routes/         HTTP 路由
  src/controllers/    参数接收与响应
  src/services/       目录与年级规则
  src/repositories/   真实课程只读查询
  src/lib/            数据库客户端、统一响应、错误类型
  src/middleware/     统一错误处理
  src/generated/      Prisma 自动生成，不提交
packages/shared/src/  共用年级、学科、接口类型及站内链接验证
prisma/               PostgreSQL 模型与后续迁移
scripts/              数据库验证
```

Ant Design 已用于全局主题、中文界面、移动菜单按钮、课程搜索和服务异常提示；宣传页的定制按钮与版式保留。

## API 协议

成功返回 `{ code: 0, message: "ok", data: ... }`。

失败使用对应 HTTP 状态，同时返回 `{ code: HTTP状态码, message: 对用户可读的说明, data: null }`。不返回堆栈和数据库凭据。

| 接口                        | 行为                                                     |
| --------------------------- | -------------------------------------------------------- |
| GET /api/health             | 应用存活；明确 database=not-checked、redis=not-connected |
| GET /api/catalog?grade=高一 | 返回 mode=preview 的学科导航元数据，不冒充正式课程       |
| GET /api/courses?grade=高一 | 查询已发布课程元数据；未配置数据库返回 503               |
| 无效年级 / 重复年级参数     | 400，不静默改成年级默认值                                |
| 未知接口 / 未实现的登录接口 | JSON 404                                                 |

前端同源请求 `/api`，由 Vite 开发/预览代理转发到 127.0.0.1:4000。没有跨域放行策略或生产代理部署。

## 当前边界

- 学科目录通过后端读取；接口暂不可用时，显示提示并保留标明为示例的本地目录。
- `/api/courses` 不返回未发布正文，也没有用户写接口。
- 前端使用 BrowserRouter 的声明式客户端路由；未知页面显示 404 内容，但静态服务器的 SPA 回退通常返回 HTTP 200。API 未知路由仍返回真正的 HTTP 404。
- 未连接数据库，未执行真实迁移，未创建用户、管理员或正式课程。
- JWT access/refresh、bcrypt、Redis、OSS/七牛、Docker 应用镜像和 Nginx 反代尚未实现；现有 compose 仅用于可选的本地 PostgreSQL。
- 未部署、未购买服务、未配置支付、未推送远程仓库。

## 依赖审计与兼容性

原架构迁移阶段保留了 React Router v6；项目现在已升级至 7.18.5。原审计记录的两条中危告警均自 v7.18.0 起修复：

- 站外重定向：https://github.com/advisories/GHSA-wrjc-x8rr-h8h6
- SSR hydration：https://github.com/advisories/GHSA-337j-9hxr-rhxg

本项目不使用 SSR/hydration；所有站内 Link 统一拒绝外部 URL、协议相对 URL、反斜杠及编码绕过，并有测试。此限制不等于消除了依赖审计记录。没有擅自把用户要求的 Router v6 改为 v7；正式上线前应重新评估版本选择与上游补丁。

## 恢复与后续

原版源码备份在本机 `work/before-split-source.zip`，原 Next 文件位于 `work/legacy-next/`；两者均被 Git 忽略，不进入新源码包，不包含真实凭据。

下一里程碑：先启动本地 PostgreSQL并验证空库迁移；再实现账户与服务端权限。refresh token 轮换/撤销、登录限流、角色授权与用户隔离应作为同一业务闭环验收，之后再接课程编辑与学习记录。
