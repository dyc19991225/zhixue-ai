import Link from "@/components/link";
export function PlaceholderPage({
  title,
  description,
  status = "功能筹备中",
  items,
  children,
}: {
  title: string;
  description: string;
  status?: string;
  items: string[];
  children?: React.ReactNode;
}) {
  return (
    <section className="wrap placeholder section">
      <Link className="text-link" href="/">
        ← 返回首页
      </Link>
      <span className="badge status">{status}</span>
      <h1>{title}</h1>
      <p className="intro">{description}</p>
      <div className="placeholder-panel">
        <h2>接下来的体验</h2>
        <ul>
          {items.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
        {children}
      </div>
      <Link className="button primary" href="/courses">
        浏览示例目录
      </Link>
    </section>
  );
}
