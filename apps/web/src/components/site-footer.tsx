import Link from "@/components/link";

export function SiteFooter() {
  return (
    <footer className="shell-footer wrap">
      <Link className="shell-footer-brand" href="/">
        知学 AI
      </Link>
      <nav aria-label="页脚导航">
        <Link href="/membership">学习权益</Link>
        <Link href="/trial">试学与反馈</Link>
        <Link href="/about">关于知学</Link>
        <Link href="/privacy">隐私说明</Link>
        <Link href="/terms">使用说明</Link>
      </nav>
    </footer>
  );
}
