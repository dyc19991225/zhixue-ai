> 更新：教师课程归属、班级成员和家长绑定的后端已实现，见[关系接口](teaching-relations.md)。本页早期“关系未实现”描述为上一阶段记录。

# 四角色权限基础

已实现ADMIN/TEACHER/STUDENT/PARENT共享类型、Prisma枚举增量迁移、rbac(roles)路由中间件。注册仍只能创建学生，不能通过注册或资料修改设置角色。角色取自数据库；不信任前端或JWT中的自报角色。

管理员用户页可分配角色。接口：

PATCH /api/admin/users/:id/role
Request: { role: "ADMIN" | "TEACHER" | "STUDENT" | "PARENT", updatedAt: string }
Response: { code: 0, message: "ok", data: AuthUser }

updatedAt来自用户列表或当前用户响应。未知字段/角色被zod拒绝；过期版本返回409。仅管理员可调用；不能更改自己的角色。实际角色变化在同一Serializable事务中更新角色、撤销目标用户所有会话、记录USER_ROLE_原角色_TO_新角色；未变化不撤销会话、不重复审计。变更后目标需重新登录。并发管理员互相降权时只能一个成功，冲突返回409。未改动现有真实用户角色。

新增后端模块位于apps/api/src/modules/user，含controller/service/repository/routes/dto/types；旧模块及apps/web布局仍保留，未声称已完成全目录迁移。AppError作为统一错误类，HttpError是兼容导出。前端ProtectedRoute支持allowedRoles，原admin参数继续兼容。

当前管理员功能仍仅ADMIN可用，TEACHER/PARENT不会继承管理员权限。现有本人学习/个人设置接口保持原有requireAuth行为，不自动获得任何他人的资料。教师课程归属、班级、家长绑定、作业、考试和学情授权业务仍待实现；角色枚举不等于这些功能已完成。

迁移前已保存work/backups/zhixue-2026-11-05T13-06-26-215Z.dump。当前本地数据库已应用迁移；新环境使用npm.cmd run db:deploy，再运行npm.cmd run db:generate，不能reset数据库。

验证：npm.cmd run verify全部通过，共43项测试。新增test:rbac包含角色矩阵、输入提权拒绝、角色变化与会话失效、审计、过期版本、无变化重试、停用账户和并发降权。测试只清理精确ID的合成账号/审计。未启用真实AI、部署、支付或云服务。本轮前端已通过类型检查和构建，未做浏览器交互验收。
