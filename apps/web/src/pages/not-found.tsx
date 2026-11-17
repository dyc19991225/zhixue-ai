import Link from "@/components/link";
export default function NotFound() {
  return (
    <section className="wrap section placeholder">
      <p className="eyebrow">404</p>
      <h1>这一页还没有写好。</h1>
      <p className="intro">页面不存在，或该年级暂未设置这个学科入口。</p>
      <Link className="button primary" href="/courses">
        回到学科目录
      </Link>
    </section>
  );
}
