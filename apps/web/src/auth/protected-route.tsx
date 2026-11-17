import { Navigate, useLocation } from "react-router-dom";
import { Button, Result, Spin } from "antd";
import { useAuth } from "./auth-provider";
import type { ReactNode } from "react";
import type { Role } from "@zhixue/shared";
export function ProtectedRoute({
  children,
  admin = false,
  allowedRoles,
}: {
  children: ReactNode;
  admin?: boolean;
  allowedRoles?: readonly Role[];
}) {
  const { user, loading } = useAuth();
  const location = useLocation();
  if (loading)
    return (
      <div className="account-loading">
        <Spin description="正在验证登录状态…">
          <div style={{ height: 100 }} />
        </Spin>
      </div>
    );
  if (!user)
    return (
      <Navigate
        to={`/login?next=${encodeURIComponent(location.pathname + location.search)}`}
        replace
      />
    );
  if (
    (admin && user.role !== "ADMIN") ||
    (allowedRoles && !allowedRoles.includes(user.role))
  )
    return (
      <Result
        status="403"
        title="当前账号没有管理权限"
        subTitle="学习功能可在个人中心继续使用。"
        extra={
          <Button type="primary" href="/dashboard">
            返回学习中心
          </Button>
        }
      />
    );
  return children;
}
