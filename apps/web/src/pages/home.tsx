import Link from "@/components/link";
import { Arrow } from "@/components/icons";
import { CourseExplorer } from "@/features/courses/course-explorer";
import { LearningEntryHero } from "@/features/courses/learning-entry-hero";
import "./learning-entry.css";

export default function Home() {
  return (
    <div className="learning-entry">
      <LearningEntryHero
        variant="home"
        image="/images/study-studio.webp"
        headline={
          <>
            学懂一课，
            <br />
            练会一道题。
          </>
        }
        description="从一节课开始，做配套练习，再回到错题本复练。"
      >
        <Link href="#subjects" className="button primary">
          探索学科课程 <Arrow />
        </Link>
        <Link href="/study" className="learning-entry-link">
          进入同步学习
        </Link>
      </LearningEntryHero>
      <nav
        id="platform"
        className="wrap home-study-links"
        aria-label="快速开始"
      >
        <Link href="/dashboard">
          学习中心 <Arrow />
        </Link>
        <Link href="/practice?mode=wrong">
          我的错题本 <Arrow />
        </Link>
        <Link href="/photo-question">
          拍照识题 <Arrow />
        </Link>
      </nav>

      <section
        className="wrap entry-catalog"
        id="subjects"
        aria-labelledby="home-course-heading"
      >
        <div className="entry-section-heading">
          <div>
            <h2 id="home-course-heading">按年级找课程</h2>
            <p>切换年级，查看各学科有多少课可学。</p>
          </div>
          <Link href="/courses" className="text-link">
            全部学科 <Arrow />
          </Link>
        </div>
        <CourseExplorer compact />
      </section>
    </div>
  );
}
