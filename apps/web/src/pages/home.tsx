import Image from "@/components/image";
import Link from "@/components/link";
import { CourseExplorer } from "@/features/courses/course-explorer";
import { Arrow } from "@/components/icons";

export default function Home() {
  return (
    <>
      <section className="campaign-hero">
        <div className="campaign-inner">
          <div className="hero-content">
            <p className="hero-category">知学 AI · 初高中学习平台</p>
            <h1>
              让每一份努力，
              <br />
              更有方向。
            </h1>
            <p className="hero-description">
              从初一到高三，探索适合自己的学习路径。
              <br />
              把今天的好奇，变成明天的底气。
            </p>
            <div className="campaign-actions">
              <Link href="#subjects" className="button campaign-cta">
                探索学科课程 <Arrow />
              </Link>
              <Link href="#platform" className="campaign-learn">
                了解知学 <Arrow />
              </Link>
            </div>
            <p className="campaign-stage">选择已发布课程，开始学习与练习</p>
          </div>
        </div>
        <figure className="campaign-art">
          <Image
            src="/images/campaign-student.webp"
            alt="知学宣传视觉：明亮的学习空间里，一位学生微笑着坐在书桌前"
            fill
            sizes="(max-width: 760px) 100vw, 70vw"
            priority
          />
        </figure>
      </section>

      <div className="wrap campaign-highlights" aria-label="平台方向">
        <span>
          <b>初中到高中</b> 六个年级入口
        </span>
        <span>
          <b>多学科探索</b> 按年级找方向
        </span>
        <Link href="/ai-teacher">
          <b>AI 老师</b> 第二阶段筹备中
        </Link>
      </div>

      <section className="wrap home-catalog" id="subjects">
        <div className="home-heading">
          <div>
            <h2>今天，从哪一科开始？</h2>
            <p>选择年级，看看你感兴趣的学科。</p>
          </div>
          <Link href="/courses" className="text-link">
            全部学科 <Arrow />
          </Link>
        </div>
        <CourseExplorer compact />
        <p className="prototype-note">
          可学习课程按实际发布状态展示，适用年级与教材范围请查看课程说明。
        </p>
      </section>

      <section className="wrap science-section">
        <div className="science-photo">
          <Image
            src="/images/chemistry.jpg"
            alt="实验台上的烧瓶和玻璃实验仪器"
            fill
            sizes="(max-width: 760px) 100vw, 45vw"
          />
        </div>
        <div className="science-content">
          <span className="science-tag">换个角度看课本</span>
          <h2>
            为什么会这样？
            <br />
            从一个问题，走近科学。
          </h2>
          <p>
            物质怎么变化，力如何作用，生命怎样生长。
            <br />
            课本之外，还有很多值得好奇的事。
          </p>
          <div className="science-links">
            <Link href="/courses/physics?grade=高一">
              物理 <Arrow />
            </Link>
            <Link href="/courses/chemistry?grade=高一">
              化学 <Arrow />
            </Link>
            <Link href="/courses/biology?grade=高一">
              生物 <Arrow />
            </Link>
          </div>
        </div>
      </section>

      <section className="wrap home-shortcuts" id="platform">
        <div>
          <h2>把学过的，慢慢变成自己的。</h2>
          <p>记录学习进度，练习后回看解析与错题。</p>
        </div>
        <Link href="/dashboard">
          <span className="shortcut-icon" aria-hidden="true">
            ↗
          </span>
          <strong>我的学习</strong>
          <span>看看学习中心</span>
        </Link>
        <Link href="/practice">
          <span className="shortcut-icon" aria-hidden="true">
            ↗
          </span>
          <strong>练习中心</strong>
          <span>进入练习与错题复习</span>
        </Link>
      </section>
    </>
  );
}
