import { useState } from "react";
import { gradeOptions } from "@zhixue/shared";
import Link from "@/components/link";
import { useCatalog } from "@/hooks/use-catalog";
import { grades, parseGrade, type Grade } from "./catalog";
import { usePublishedCourses } from "./published-courses";

const subjectTopics: Record<string, { badge: string; bullets: string[] }> = {
  math: {
    badge: "逻辑主干",
    bullets: ["数与代数方程推演", "平面几何图形性质", "函数关系与数据分析"],
  },
  chinese: {
    badge: "阅读表达",
    bullets: ["现代文精读与主旨", "文言诗词字词梳理", "议论与叙事结构拆解"],
  },
  english: {
    badge: "语感积累",
    bullets: ["核心语境词汇搭配", "长难句语法结构图", "阅读篇章信息定位"],
  },
  physics: {
    badge: "现象模型",
    bullets: ["声光热现象与规律", "受力分析与运动过程", "电路连接与实验探究"],
  },
  chemistry: {
    badge: "微观反应",
    bullets: ["物质组成与化学用语", "常见反应现象对比", "实验制取与检验流程"],
  },
  biology: {
    badge: "生命系统",
    bullets: ["细胞结构与能量转换", "人体生理循环脉络", "遗传规律与生态平衡"],
  },
};

export function MidmapKnowledgeBoard({
  initialGrade = "七年级",
  showDrawerDefault = true,
}: {
  initialGrade?: Grade;
  showDrawerDefault?: boolean;
}) {
  const [grade, setGrade] = useState<Grade>(parseGrade(initialGrade));
  const [activeSubject, setActiveSubject] = useState<string>("math");
  const [verticalLayout, setVerticalLayout] = useState(false);
  const [zoom, setZoom] = useState(100);
  const [showDrawer, setShowDrawer] = useState(showDrawerDefault);

  const gradeCode =
    gradeOptions.find((item) => item.label === grade)?.value ?? "G7";
  const catalog = useCatalog(grade);
  const published = usePublishedCourses(gradeCode, undefined, { pageSize: 12 });

  const currentSubject =
    catalog.subjects.find((s) => s.id === activeSubject) ?? catalog.subjects[0];
  const currentSubjectId = currentSubject?.id ?? "math";
  const subjectCourses = published.items.filter(
    (c) => c.subject === currentSubjectId,
  );
  const topicMeta = subjectTopics[currentSubjectId] ?? {
    badge: "同步模块",
    bullets: ["章节核心概念拆解", "配套练习与错题复盘"],
  };

  const scopeQuery = new URLSearchParams({
    grade: gradeCode,
    subject: currentSubjectId,
  }).toString();

  const askHref = `/ai-teacher?topic=${encodeURIComponent(`${grade}${currentSubject?.name ?? "学科"}`)}`;

  return (
    <div className="mm-board-window" aria-label="知学交互式知识信息板">
      {/* Midmap Top Canvas Bar */}
      <div className="mm-board-topbar">
        <div className="mm-board-grades" role="group" aria-label="切换看板年级">
          {grades.map((g) => (
            <button
              key={g}
              type="button"
              className={`mm-grade-chip ${grade === g ? "is-active" : ""}`}
              aria-pressed={grade === g}
              onClick={() => setGrade(g)}
            >
              {g}
            </button>
          ))}
        </div>

        <div
          className="mm-board-toolbar"
          role="toolbar"
          aria-label="画布视图工具"
        >
          <button
            type="button"
            className={!verticalLayout ? "is-active" : ""}
            title="横向思维导图布局"
            onClick={() => setVerticalLayout(false)}
          >
            横向导图
          </button>
          <button
            type="button"
            className={verticalLayout ? "is-active" : ""}
            title="纵向层级树布局"
            onClick={() => setVerticalLayout(true)}
          >
            纵向树图
          </button>
          <span className="mm-toolbar-divider" />
          <button
            type="button"
            aria-label="缩小画布"
            onClick={() => setZoom((z) => Math.max(85, z - 5))}
          >
            −
          </button>
          <span className="mm-zoom-label">{zoom}%</span>
          <button
            type="button"
            aria-label="放大画布"
            onClick={() => setZoom((z) => Math.min(115, z + 5))}
          >
            +
          </button>
          <button
            type="button"
            className={showDrawer ? "is-active" : ""}
            onClick={() => setShowDrawer((v) => !v)}
          >
            {showDrawer ? "收起批注" : "协同批注"}
          </button>
        </div>

        <div className="mm-agent-pill">
          <span className="mm-agent-avatar">AI</span>
          <span>
            <strong>知学看板</strong>
            <small>
              {published.loading ? "同步中…" : `已开放 ${published.total} 门课`}
            </small>
          </span>
        </div>
      </div>

      {/* Main Spatial Canvas Stage */}
      <div className={`mm-board-body ${showDrawer ? "with-drawer" : ""}`}>
        <div
          className={`mm-canvas-viewport ${verticalLayout ? "is-vertical" : ""}`}
          style={{ fontSize: `${zoom}%` }}
        >
          {/* Column 1: Root Grade Node */}
          <div className="mm-tree-root-col">
            <div className="mm-node mm-node-root is-selected">
              <div className="mm-node-head">
                <span className="mm-todo-ring is-done" aria-hidden="true" />
                <span className="mm-node-marker emerald">当前看板</span>
              </div>
              <h3>{grade} · 知识信息板</h3>
              <p>
                点击任意学科节点展开已开放课程，直接在节点旁发起 <b>Ask 追问</b>{" "}
                或 <b>Run 随堂练题</b>。
              </p>
            </div>
          </div>

          {/* Column 2: Subject Nodes with Orthogonal Connectors */}
          <div className="mm-tree-branch-col" role="list" aria-label="学科节点">
            {catalog.subjects.map((sub) => {
              const count = published.subjectCounts[sub.id] ?? 0;
              const selected = sub.id === currentSubjectId;
              return (
                <button
                  key={sub.id}
                  type="button"
                  role="listitem"
                  className={`mm-node mm-node-branch ${selected ? "is-selected" : ""}`}
                  onClick={() => setActiveSubject(sub.id)}
                >
                  <div className="mm-node-head">
                    <span
                      className={`mm-todo-ring ${count > 0 ? "is-done" : ""}`}
                      aria-hidden="true"
                    />
                    <span
                      className={`mm-node-marker ${count > 0 ? "emerald" : "muted"}`}
                    >
                      {count > 0 ? `${count} 门可学` : "同步目录"}
                    </span>
                  </div>
                  <h4>
                    {grade}
                    {sub.name}
                  </h4>
                  <small>{subjectTopics[sub.id]?.badge ?? "核心脉络"}</small>
                </button>
              );
            })}
          </div>

          {/* Column 3: Active Subject Detail + Published Courses + Floating Action Pills */}
          <div className="mm-tree-leaf-col">
            <div className="mm-leaf-with-actions">
              <div className="mm-node mm-node-detail is-selected">
                <div className="mm-node-head">
                  <span className="mm-todo-ring is-done" aria-hidden="true" />
                  <span className="mm-node-marker amber">
                    {topicMeta.badge}
                  </span>
                </div>
                <h3>
                  {grade}
                  {currentSubject?.name} · 核心脉络
                </h3>
                <ul className="mm-node-bullets">
                  {topicMeta.bullets.map((line) => (
                    <li key={line}>{line}</li>
                  ))}
                </ul>

                {subjectCourses.length > 0 ? (
                  <div className="mm-subnodes">
                    <span className="mm-subnodes-label">
                      已发布课程节点（点击进入课时）
                    </span>
                    {subjectCourses.slice(0, 4).map((course) => (
                      <Link
                        key={course.id}
                        href={`/course/${course.id}`}
                        className="mm-course-subnode"
                      >
                        <div>
                          <strong>{course.title}</strong>
                          <small>
                            {course.textbookEdition ?? "通用同步"} ·{" "}
                            {course.access === "FREE" ? "免费开放" : "会员权益"}
                          </small>
                        </div>
                        <span className="mm-subnode-arrow">→</span>
                      </Link>
                    ))}
                  </div>
                ) : (
                  <div className="mm-subnodes-empty">
                    当前筛选暂无已发布课程，可直接开启该学科练习或向 AI
                    老师提问。
                  </div>
                )}
              </div>

              {/* Midmap Signature Contextual Node Action Pills (Ask / Run / Review) */}
              <div className="mm-node-actions" aria-label="节点快捷协作动作">
                <Link href={askHref} className="mm-action-pill ask">
                  <span className="mm-pill-dot" /> Ask · 问 AI
                </Link>
                <Link
                  href={`/practice?${scopeQuery}`}
                  className="mm-action-pill run"
                >
                  <span className="mm-pill-dot" /> Run · 随堂练
                </Link>
                <Link
                  href={`/practice?${scopeQuery}&mode=wrong`}
                  className="mm-action-pill neutral"
                >
                  错题复练
                </Link>
                <Link
                  href={`/study?${scopeQuery}#sync-courses`}
                  className="mm-action-pill neutral"
                >
                  更多课程
                </Link>
              </div>
            </div>
          </div>
        </div>

        {/* Midmap Right Floating "Unread / Action Feed" Drawer */}
        {showDrawer && (
          <aside className="mm-unread-drawer" aria-label="学习协同建议">
            <div className="mm-drawer-header">
              <span>✉ 学习协同流</span>
              <small>实时联动</small>
            </div>
            <div className="mm-drawer-list">
              <Link href={askHref} className="mm-drawer-item">
                <div className="mm-drawer-tags">
                  <span className="mm-tag-ask">Ask · 启发</span>
                  <time>刚刚</time>
                </div>
                <p>
                  卡在 {grade}
                  {currentSubject?.name} 某一步？把你的思路发给 AI
                  老师逐步拆解。
                </p>
                <small>目标节点：{currentSubject?.name}核心脉络</small>
              </Link>

              <Link href={`/practice?${scopeQuery}`} className="mm-drawer-item">
                <div className="mm-drawer-tags">
                  <span className="mm-tag-run">Run · 闯关</span>
                  <time>推荐</time>
                </div>
                <p>
                  打开随题点阵草稿纸，独立完成一组 {currentSubject?.name}{" "}
                  精选练习题。
                </p>
                <small>练习中心 · 即时核对解析</small>
              </Link>

              <Link href="/photo-question" className="mm-drawer-item">
                <div className="mm-drawer-tags">
                  <span className="mm-tag-run">OCR · 本机识题</span>
                  <time>隐私保护</time>
                </div>
                <p>拍下作业本上的难题，在浏览器本地裁剪识别并检索同型题。</p>
                <small>照片不自动上传</small>
              </Link>
            </div>
          </aside>
        )}
      </div>
    </div>
  );
}
