import Link from "@/components/link";
import { Arrow, BookMark } from "@/components/icons";
import { CourseExplorer } from "@/features/courses/course-explorer";
import { MidmapKnowledgeBoard } from "@/features/courses/midmap-knowledge-board";
import "./learning-entry.css";

const intentCards = [
  {
    tag: "Information · 结构化讲义",
    title: "把厚课本拆成清晰节点",
    desc: "按年级、学科与章节层级串联核心概念，一眼看清前后知识点的推导关系，不再盲目死记硬背。",
    href: "/study",
    cta: "浏览同步看板",
    glyph: "node",
  },
  {
    tag: "Question · Ask 启发答疑",
    title: "顺着你的思路点拨下一步",
    desc: "遇到卡壳题可在任意节点发起 Ask 追问，或本机拍照裁剪校对题干，由 AI 老师引导你找到突破口。",
    href: "/ai-teacher",
    cta: "向 AI 老师提问",
    glyph: "ask",
  },
  {
    tag: "Command · Run 靶向清零",
    title: "每次作答与错题尽在掌控",
    desc: "配备随题手写草稿纸，提交即看详尽解析；做错自动归入错题节点，复练答对后审阅归档。",
    href: "/practice?mode=wrong",
    cta: "进入错题复练",
    glyph: "run",
  },
] as const;

export default function Home() {
  return (
    <div className="mm-landing">
      {/* Midmap Hero Fold */}
      <section className="mm-hero wrap" aria-labelledby="mm-hero-title">
        <div className="mm-hero-icon" aria-hidden="true">
          <BookMark size={48} />
        </div>
        <h1 id="mm-hero-title">知学 AI</h1>
        <p className="mm-hero-slogan">
          用于与 <span className="headline-accent">AI 老师</span>{" "}
          协同推演的学生知识信息板
        </p>
        <div className="mm-hero-actions">
          <Link href="#organize" className="mm-primary-cta">
            开启知识看板 <Arrow />
          </Link>
          <Link href="/study" className="mm-secondary-cta">
            进入同步学习
          </Link>
        </div>
        <p className="mm-hero-caption">
          同步章节导图 · 随堂练习与草稿板 · 错题复练清零 · 本地隐私识题
        </p>
      </section>

      {/* Section 1: Turn Information Into Clarity (Conversation + Live Board Stage) */}
      <section
        id="organize"
        className="mm-section wrap"
        aria-labelledby="mm-organize-title"
      >
        <div className="mm-section-header">
          <h2 id="mm-organize-title">
            把零散知识点化作 <span className="headline-accent">清晰脉络</span>
          </h2>
          <p>
            像浏览思维导图一样切换年级与学科，点击节点即可跳转课时学习、随堂闯关或向
            AI 老师追问。
          </p>
        </div>

        <div className="mm-organize-stage">
          <aside className="mm-conv-card" aria-label="AI 协同学习示意">
            <div className="mm-conv-badge">
              <span className="mm-conv-dot" /> IN STUDY SESSION
            </div>
            <h3>疑问、公式、错因、课后推导与章节重点……</h3>
            <div className="mm-conv-lines" aria-hidden="true">
              <span style={{ width: "92%" }} />
              <span style={{ width: "76%" }} />
              <span style={{ width: "84%" }} />
              <span className="accent" style={{ width: "62%" }} />
              <span style={{ width: "88%" }} />
              <span style={{ width: "70%" }} />
            </div>
            <Link href="/ai-teacher" className="mm-floating-prompt">
              <span>在 /知学看板 中梳理思路</span>
              <span className="mm-prompt-arrow">→</span>
            </Link>
          </aside>

          <MidmapKnowledgeBoard showDrawerDefault={false} />
        </div>
      </section>

      {/* Section 2: 3-Column Midmap Intent Cards (Information / Question / Command) */}
      <section
        id="platform"
        className="mm-section wrap"
        aria-labelledby="mm-intent-title"
      >
        <div className="mm-section-header">
          <h2 id="mm-intent-title">
            让 AI 顺着你的节奏，
            <span className="headline-accent">全程掌控学习闭环</span>
          </h2>
          <p>不跳步、不代写答案，每一次提问、练习与错题重做都清晰可追溯。</p>
        </div>

        <div className="mm-intent-grid">
          {intentCards.map((card) => (
            <Link key={card.href} href={card.href} className="mm-intent-card">
              <div
                className="mm-intent-art"
                data-glyph={card.glyph}
                aria-hidden="true"
              >
                <div className="mm-art-mini-node">
                  <span className="mm-art-pill">
                    {card.tag.split(" · ")[0]}
                  </span>
                  <div className="mm-art-bars">
                    <i />
                    <i />
                  </div>
                </div>
              </div>
              <div className="mm-intent-body">
                <span className="mm-intent-tag">{card.tag}</span>
                <h3>{card.title}</h3>
                <p>{card.desc}</p>
                <span className="mm-intent-link">
                  {card.cta} <Arrow />
                </span>
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* Section 3: Full Grade & Subject Course Explorer */}
      <section
        className="mm-section wrap entry-catalog"
        id="subjects"
        aria-labelledby="home-course-heading"
      >
        <div className="entry-section-heading">
          <div>
            <span className="section-pill">课程与题库目录</span>
            <h2 id="home-course-heading">
              按年级探索 <span className="headline-accent">全部开放课程</span>
            </h2>
            <p>
              真实同步线上已发布课程与开放课时，点击卡片即可开启阅读与随堂练习。
            </p>
          </div>
          <Link href="/courses" className="text-link">
            查看完整课程库 <Arrow />
          </Link>
        </div>
        <CourseExplorer compact />
      </section>
    </div>
  );
}
