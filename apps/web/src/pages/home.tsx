import Link from "@/components/link";
import { Arrow } from "@/components/icons";
import { CourseExplorer } from "@/features/courses/course-explorer";
import { LearningEntryHero } from "@/features/courses/learning-entry-hero";
import "./learning-entry.css";

const studentQuickCards = [
  {
    href: "/dashboard",
    icon: "📚",
    tone: "indigo",
    title: "我的学习书桌",
    desc: "查看待交作业、考试安排与选课进度",
  },
  {
    href: "/practice?mode=wrong",
    icon: "🎯",
    tone: "amber",
    title: "错题清零本",
    desc: "把做错的题再练一遍，答对自动归档",
  },
  {
    href: "/photo-question",
    icon: "📸",
    tone: "emerald",
    title: "本地拍照识题",
    desc: "拍下纸质题目，本机裁剪校对快速查题",
  },
  {
    href: "/ai-teacher",
    icon: "✨",
    tone: "violet",
    title: "AI 启发老师",
    desc: "卡壳时不直接抄答案，一步步理清思路",
  },
] as const;

export default function Home() {
  return (
    <div className="learning-entry">
      <LearningEntryHero
        variant="home"
        badge="✨ 中学同步学习 · 讲练结合更轻松"
        image="/images/study-studio.webp"
        headline={
          <>
            学懂一课，
            <br />
            练会一道题。
          </>
        }
        description="从一节好懂的同步课开始，配合随堂闯关练习、草稿演算纸与错题复练，让每一次努力都看得见进步。"
      >
        <Link href="#subjects" className="button primary">
          探索学科课程 <Arrow />
        </Link>
        <Link href="/study" className="learning-entry-link">
          进入同步学习 →
        </Link>
      </LearningEntryHero>

      <nav id="platform" className="wrap home-bento-grid" aria-label="快速开始">
        {studentQuickCards.map((card) => (
          <Link
            key={card.href}
            href={card.href}
            className={`home-bento-card tone-${card.tone}`}
          >
            <span className="home-bento-icon" aria-hidden="true">
              {card.icon}
            </span>
            <div className="home-bento-copy">
              <strong>
                {card.title} <Arrow />
              </strong>
              <small>{card.desc}</small>
            </div>
          </Link>
        ))}
      </nav>

      <section
        className="wrap entry-catalog"
        id="subjects"
        aria-labelledby="home-course-heading"
      >
        <div className="entry-section-heading">
          <div>
            <span className="section-pill">全科同步导航</span>
            <h2 id="home-course-heading">按年级找正在学的课程</h2>
            <p>切换所在年级，直观查看各学科已开放的学习课程。</p>
          </div>
          <Link href="/courses" className="text-link">
            查看全部学科 <Arrow />
          </Link>
        </div>
        <CourseExplorer compact />
      </section>
    </div>
  );
}
