import Link from "@/components/link";
import { useLocation } from "react-router-dom";
import { useState } from "react";
import { Button } from "antd";
import { Arrow, BookMark } from "./icons";
import { useAuth } from "@/auth/auth-provider";

const links = [
  { href: "/", label: "首页", note: "发现知学" },
  { href: "/study", label: "同步学习", note: "课程、练习与错题复习" },
  { href: "/practice", label: "练习中心", note: "学科练习与错题复习" },
  { href: "/ai-teacher", label: "AI 老师", note: "第二阶段筹备中" },
  { href: "/membership", label: "会员计划", note: "了解服务规划" },
];

export function SiteHeader() {
  const { user } = useAuth();
  const pathname = useLocation().pathname;
  const [menuPath, setMenuPath] = useState<string | null>(null);
  const open = menuPath === pathname;
  const isActive = (href: string) =>
    href === "/"
      ? pathname === "/"
      : pathname === href || pathname.startsWith(href + "/");
  return (
    <header className="site-header">
      <div className="wrap header-inner">
        <Link
          href="/"
          className="brand"
          aria-label="知学 AI 首页"
          onClick={() => setMenuPath(null)}
        >
          <span className="brand-icon">
            <BookMark />
            <span className="brand-spark" aria-hidden="true" />
          </span>
          <span className="brand-wordmark">
            <span>
              知学 <b>AI</b>
            </span>
            <small>让学习更有方向</small>
          </span>
        </Link>
        <nav className="desktop-nav" aria-label="主导航">
          {links.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              aria-current={isActive(l.href) ? "page" : undefined}
            >
              {l.label}
            </Link>
          ))}
        </nav>
        <div className="header-actions">
          <Link className="login-link" href={user ? "/dashboard" : "/login"}>
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              aria-hidden="true"
            >
              <circle
                cx="12"
                cy="8"
                r="3.5"
                stroke="currentColor"
                strokeWidth="1.7"
              />
              <path
                d="M5 21v-2a7 7 0 0 1 14 0v2"
                stroke="currentColor"
                strokeWidth="1.7"
                strokeLinecap="round"
              />
            </svg>
            <span className="login-label-desktop">
              {user ? "个人中心" : "登录 / 注册"}
            </span>
            <span className="login-label-mobile">{user ? "我的" : "登录"}</span>
            <span className="login-arrow">
              <Arrow />
            </span>
          </Link>
          <Button
            className="menu-button"
            type="text"
            aria-label={open ? "收起导航菜单" : "展开导航菜单"}
            aria-expanded={open}
            aria-controls="mobile-nav"
            onClick={() => setMenuPath(open ? null : pathname)}
          >
            <svg
              width="21"
              height="21"
              viewBox="0 0 24 24"
              fill="none"
              aria-hidden="true"
            >
              {open ? (
                <path
                  d="m6 6 12 12M18 6 6 18"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                />
              ) : (
                <path
                  d="M4 7h16M4 12h16M4 17h10"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                />
              )}
            </svg>
          </Button>
        </div>
      </div>
      {open && (
        <nav
          id="mobile-nav"
          className="mobile-nav wrap"
          aria-label="移动端主导航"
        >
          {links.map((l) => (
            <Link
              href={l.href}
              key={l.href}
              onClick={() => setMenuPath(null)}
              aria-current={isActive(l.href) ? "page" : undefined}
            >
              <span>
                <strong>{l.label}</strong>
                <small>{l.note}</small>
              </span>
              <Arrow />
            </Link>
          ))}
        </nav>
      )}
    </header>
  );
}
