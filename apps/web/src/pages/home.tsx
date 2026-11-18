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
        image="/images/learning-together.webp"
        headline={
          <>
            学懂一课，
            <br />
            再前进一步。
          </>
        }
        description="按年级选课，做配套练习，把易错的题再练一遍。"
      >
        <Link href="#subjects" className="button primary">
          探索学科课程 <Arrow />
        </Link>
        <Link href="/study" className="learning-entry-link">
          进入同步学习
        </Link>
      </LearningEntryHero>

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

      <section
        className="wrap entry-shortcuts"
        id="platform"
        aria-labelledby="home-shortcuts-heading"
      >
        <h2 id="home-shortcuts-heading">从上次学到的地方继续</h2>
        <ul>
          <li>
            <Link href="/dashboard">
              <span>
                <strong>学习中心</strong>
                <small>继续课时，查看本人的学习进度。</small>
              </span>
              <Arrow />
            </Link>
          </li>
          <li>
            <Link href="/practice">
              <span>
                <strong>练习中心</strong>
                <small>选题作答，回看解析和错题。</small>
              </span>
              <Arrow />
            </Link>
          </li>
          <li>
            <Link href="/photo-question">
              <span>
                <strong>拍照识题</strong>
                <small>把照片里的题目识别成文字。</small>
              </span>
              <Arrow />
            </Link>
          </li>
        </ul>
      </section>
    </div>
  );
}
