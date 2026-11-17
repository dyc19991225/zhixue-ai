import Link from "@/components/link";
export function SiteFooter() {
  return (
    <footer className="site-footer wrap">
      <div>
        <strong>知学 AI</strong>
        <p>让学习有方向，让成长有迹可循。</p>
        <small>本地学习平台 · 课程以实际发布内容为准</small>
      </div>
      <nav aria-label="页脚导航">
        <Link href="/trial">试学与反馈</Link>
        <Link href="/about">关于知学</Link>
        <Link href="/privacy">隐私说明</Link>
        <Link href="/terms">使用说明</Link>
      </nav>
    </footer>
  );
}
