import { useEffect, useRef, useState } from "react";
import { useLocation } from "react-router-dom";
import { gradeOptions, roleLabels } from "@zhixue/shared";
import Link from "@/components/link";
import { useAuth } from "@/auth/auth-provider";
import { Arrow, BookMark, NavGlyph } from "./icons";
import { studyLinks, workspaceLinks, workspaces } from "./workspace-navigation";

function Brand({ onClick }: { onClick?: () => void }) {
  return (
    <Link
      href="/"
      className="shell-brand"
      aria-label="知学 AI 首页"
      onClick={onClick}
    >
      <span className="shell-brand-mark">
        <BookMark />
      </span>
      <span className="shell-brand-text">
        <span>
          知学 <b>AI</b>
        </span>
        <small>中学同步学习伙伴</small>
      </span>
    </Link>
  );
}

export function SiteHeader() {
  const { user } = useAuth();
  const location = useLocation();
  const [menuKey, setMenuKey] = useState<string>();
  const toggle = useRef<HTMLButtonElement>(null);
  const open = menuKey === location.key;
  const close = () => setMenuKey(undefined);
  const dashboard = user ? "/dashboard" : "/login";
  const group = user ? workspaces[user.role] : "工作区";
  const work = user
    ? [{ href: dashboard, label: group }, ...workspaceLinks(user.role)]
    : [];
  const viewer = new URLSearchParams(location.search);
  const { pathname } = location;

  useEffect(() => {
    if (!open) return;
    const escape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setMenuKey(undefined);
        toggle.current?.focus();
      }
    };
    document.addEventListener("keydown", escape);
    return () => document.removeEventListener("keydown", escape);
  }, [open]);

  function active(href: string, exact = true) {
    const [path, query] = href.split("?");
    if (query) return pathname === path && viewer.get("tab") === "review";
    if (path === "/study")
      return ["/study", "/courses", "/course", "/learn"].some(
        (route) => pathname === route || pathname.startsWith(route + "/"),
      );
    if (path === "/dashboard")
      return pathname === path && (!exact || viewer.get("tab") !== "review");
    if (path === "/exams")
      return pathname === path || pathname.startsWith(path + "/");
    return pathname === path;
  }

  function item(
    link: { href: string; label: string },
    exact = true,
    withIcon = true,
  ) {
    return (
      <Link
        key={link.href}
        href={link.href}
        onClick={close}
        aria-current={active(link.href, exact) ? "page" : undefined}
      >
        {withIcon && <NavGlyph kind={link.href} />}
        <span>{link.label}</span>
      </Link>
    );
  }

  const gradeLabel = user?.grade
    ? gradeOptions.find((g) => g.value === user.grade)?.label
    : undefined;

  return (
    <>
      <aside className="shell-sidebar" aria-label="站点导航">
        <Brand />
        <nav className="shell-rail-links" aria-label="学习导航">
          <p>日常学习</p>
          {studyLinks.map((link) => item(link))}
        </nav>
        {work.length > 0 && (
          <nav className="shell-rail-links" aria-label={group}>
            <p>{group}</p>
            {work.map((link) => item(link))}
          </nav>
        )}
        <div className="shell-account">
          <Link href={dashboard}>
            <span className="shell-avatar" aria-hidden="true">
              {(user && Array.from(user.displayName)[0]) || "学"}
            </span>
            <span>
              <strong>{user?.displayName ?? "登录 / 注册"}</strong>
              <small>
                {user
                  ? `${gradeLabel ? `${gradeLabel} · ` : ""}${roleLabels[user.role]}`
                  : "同步记录错题与进度"}
              </small>
            </span>
            <Arrow />
          </Link>
        </div>
      </aside>
      <header className="shell-mobile-header">
        <Brand onClick={close} />
        <button
          ref={toggle}
          className="shell-menu-button"
          type="button"
          aria-expanded={open}
          aria-controls="shell-mobile-menu"
          onClick={() => setMenuKey(open ? undefined : location.key)}
        >
          {open ? "收起菜单" : "导航菜单"}
        </button>
        <div
          id="shell-mobile-menu"
          className="shell-mobile-menu"
          hidden={!open}
        >
          <nav aria-label="更多学习入口">
            {[...studyLinks, { href: "/membership", label: "学习权益" }].map(
              (link) => item(link),
            )}
          </nav>
          {work.length > 0 && (
            <nav aria-label={group}>{work.map((link) => item(link))}</nav>
          )}
        </div>
      </header>
      <nav className="shell-bottom-nav" aria-label="移动端主导航">
        {[
          { href: "/", label: "首页" },
          { href: "/study", label: "学习" },
          { href: "/practice", label: "练习" },
          { href: dashboard, label: user ? "我的" : "登录" },
        ].map((link) => item(link, false, true))}
      </nav>
    </>
  );
}
