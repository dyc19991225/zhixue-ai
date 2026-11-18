import { useEffect, useRef, useState } from "react";
import { useLocation } from "react-router-dom";
import { roleLabels } from "@zhixue/shared";
import Link from "@/components/link";
import { useAuth } from "@/auth/auth-provider";
import { BookMark, NavGlyph } from "./icons";
import { studyLinks, workspaceLinks, workspaces } from "./workspace-navigation";

const FOCUS_SECONDS = 25 * 60;

function Brand({ onClick }: { onClick?: () => void }) {
  return (
    <Link
      href="/"
      className="mm-brand"
      aria-label="知学 AI 首页"
      onClick={onClick}
    >
      <span className="mm-brand-mark">
        <BookMark size={20} />
      </span>
      <span className="mm-brand-title">
        知学<span>AI</span>
      </span>
    </Link>
  );
}

export function SiteHeader() {
  const { user } = useAuth();
  const location = useLocation();
  const [scrolled, setScrolled] = useState(false);
  const [menuKey, setMenuKey] = useState<string>();
  const [workOpen, setWorkOpen] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(FOCUS_SECONDS);
  const [focusRunning, setFocusRunning] = useState(false);

  const toggle = useRef<HTMLButtonElement>(null);
  const open = menuKey === location.key;
  const close = () => {
    setMenuKey(undefined);
    setWorkOpen(false);
  };
  const dashboard = user ? "/dashboard" : "/login";
  const group = user ? workspaces[user.role] : "工作区";
  const work = user
    ? [{ href: dashboard, label: group }, ...workspaceLinks(user.role)]
    : [];
  const viewer = new URLSearchParams(location.search);
  const { pathname } = location;

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 18);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    setWorkOpen(false);
  }, [location.key]);

  useEffect(() => {
    if (!focusRunning) return;
    const timer = window.setInterval(() => {
      setSecondsLeft((prev) => {
        if (prev <= 1) {
          setFocusRunning(false);
          return FOCUS_SECONDS;
        }
        return prev - 1;
      });
    }, 1000);
    return () => window.clearInterval(timer);
  }, [focusRunning]);

  useEffect(() => {
    if (!open && !workOpen) return;
    const escape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setMenuKey(undefined);
        setWorkOpen(false);
        toggle.current?.focus();
      }
    };
    document.addEventListener("keydown", escape);
    return () => document.removeEventListener("keydown", escape);
  }, [open, workOpen]);

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

  const mins = String(Math.floor(secondsLeft / 60)).padStart(2, "0");
  const secs = String(secondsLeft % 60).padStart(2, "0");

  return (
    <>
      <header
        className={`mm-header ${scrolled || pathname !== "/" ? "is-floating" : ""}`}
      >
        <div className="mm-header-inner">
          <div className="mm-header-left">
            <Brand onClick={close} />
          </div>

          <nav className="mm-header-nav" aria-label="学习导航">
            {studyLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                onClick={close}
                aria-current={active(link.href) ? "page" : undefined}
              >
                {link.label === "同步学习" ? "知识看板" : link.label}
              </Link>
            ))}

            {work.length > 0 && (
              <div className="mm-work-dropdown">
                <button
                  type="button"
                  className="mm-work-trigger"
                  aria-expanded={workOpen}
                  onClick={() => setWorkOpen((v) => !v)}
                >
                  {group} ▾
                </button>
                {workOpen && (
                  <div className="mm-work-popover" role="menu">
                    {work.map((link) => (
                      <Link
                        key={link.href}
                        href={link.href}
                        onClick={close}
                        aria-current={active(link.href) ? "page" : undefined}
                      >
                        {link.label}
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            )}
          </nav>

          <div className="mm-header-right">
            <button
              type="button"
              className={`mm-focus-chip ${focusRunning ? "is-running" : ""}`}
              title="点击开启或暂停 25 分钟番茄专注计时"
              onClick={() => setFocusRunning((v) => !v)}
            >
              <span className="mm-focus-dot" />
              <span>
                {focusRunning || secondsLeft < FOCUS_SECONDS
                  ? `${mins}:${secs}`
                  : "专注 25m"}
              </span>
            </button>

            <Link
              href={dashboard}
              className="mm-cta-pill"
              aria-label={
                user
                  ? `${user.displayName} (${roleLabels[user.role]})`
                  : "登录或注册"
              }
            >
              <span>{user ? user.displayName : "进入学习"}</span>
              <svg
                width="15"
                height="15"
                viewBox="0 0 24 24"
                fill="none"
                aria-hidden="true"
              >
                <path
                  d="M5 12h14m-5-5 5 5-5 5"
                  stroke="currentColor"
                  strokeWidth="2.1"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </Link>

            <button
              ref={toggle}
              className="mm-mobile-toggle"
              type="button"
              aria-expanded={open}
              aria-controls="shell-mobile-menu"
              onClick={() => setMenuKey(open ? undefined : location.key)}
            >
              {open ? "收起" : "菜单"}
            </button>
          </div>
        </div>

        <div id="shell-mobile-menu" className="mm-mobile-drawer" hidden={!open}>
          <nav aria-label="更多学习入口">
            {[...studyLinks, { href: "/membership", label: "学习权益" }].map(
              (link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  onClick={close}
                  aria-current={active(link.href) ? "page" : undefined}
                >
                  <NavGlyph kind={link.href} />
                  <span>{link.label}</span>
                </Link>
              ),
            )}
          </nav>
          {work.length > 0 && (
            <nav aria-label={group}>
              {work.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  onClick={close}
                  aria-current={active(link.href) ? "page" : undefined}
                >
                  <NavGlyph kind={link.href} />
                  <span>{link.label}</span>
                </Link>
              ))}
            </nav>
          )}
        </div>
      </header>

      <nav className="shell-bottom-nav" aria-label="移动端主导航">
        {[
          { href: "/", label: "首页" },
          { href: "/study", label: "看板" },
          { href: "/practice", label: "练习" },
          { href: dashboard, label: user ? "我的" : "登录" },
        ].map((link) => (
          <Link
            key={link.href}
            href={link.href}
            onClick={close}
            aria-current={active(link.href, false) ? "page" : undefined}
          >
            <NavGlyph kind={link.href} />
            <span>{link.label}</span>
          </Link>
        ))}
      </nav>
    </>
  );
}
