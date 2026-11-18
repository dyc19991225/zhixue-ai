import { useEffect, useState } from "react";
import { Alert, Button, Empty, Input, Pagination, Select, Spin } from "antd";
import { Link, useSearchParams } from "react-router-dom";
import type {
  AttemptView,
  PageData,
  QuestionView,
  WrongQuestionView,
} from "@zhixue/shared";
import {
  difficultyOptions,
  gradeOptions,
  subjectOptions,
} from "@zhixue/shared";
import { useApiData } from "@/hooks/use-api-data";
import { Arrow } from "@/components/icons";
import Image from "@/components/image";
import { useAuth } from "@/auth/auth-provider";
import { AttemptResult, QuestionCard } from "@/features/practice/question-card";
import { QuestionDiagram } from "@/features/practice/question-diagram";
import { LessonPractice } from "@/features/practice/lesson-practice";
import "./learning-entry.css";
import "./practice-workspace.css";

export default function Practice() {
  const [query] = useSearchParams();
  const { user, loading } = useAuth();
  const courseId = query.get("courseId");
  const lessonId = query.get("lessonId");
  if (
    query.get("mode") === "history" ||
    (!query.has("courseId") && !query.has("lessonId"))
  )
    return <PracticeCenter />;
  if (!courseId || !lessonId)
    return (
      <section className="wrap practice-page">
        <Alert
          type="error"
          showIcon
          title="课时练习链接不完整。"
          action={<Link to="/practice">返回练习中心</Link>}
        />
      </section>
    );
  const mode = query.get("mode") === "wrong" ? "wrong" : "questions";
  const state = query.get("state") === "resolved" ? "resolved" : "active";
  const roundId =
    mode === "wrong" ? (query.get("roundId") ?? undefined) : undefined;
  const requestedPage = Number(query.get("page"));
  const page =
    Number.isInteger(requestedPage) &&
    requestedPage >= 1 &&
    requestedPage <= 10000
      ? requestedPage
      : 1;
  return (
    <LessonPractice
      key={JSON.stringify([
        user?.id,
        courseId,
        lessonId,
        mode,
        state,
        page,
        roundId,
      ])}
      courseId={courseId}
      lessonId={lessonId}
      mode={mode}
      state={state}
      page={page}
      roundId={roundId}
      canLoad={!!user}
      authLoading={loading}
    />
  );
}

type Mode = "questions" | "wrong" | "history";

const pages = [
  {
    key: "questions",
    label: "挑选练习",
    title: "练习中心",
    description: "按年级和学科找题，答完再看解析。",
  },
  {
    key: "wrong",
    label: "我的错题本",
    title: "我的错题本",
    description: "把错题再做一遍，答对后移到「已答对」。",
  },
  {
    key: "history",
    label: "作答记录",
    title: "作答记录",
    description: "回看每次作答的选项、结果和解析。",
  },
] as const;

function PracticeCenter() {
  const [query, setQuery] = useSearchParams();
  const { user, loading: authLoading } = useAuth();
  const mode: Mode =
    query.get("mode") === "wrong"
      ? "wrong"
      : query.get("mode") === "history"
        ? "history"
        : "questions";
  const current = pages.find((tab) => tab.key === mode)!;
  const grade =
    gradeOptions.find((item) => item.value === query.get("grade"))?.value ??
    user?.grade ??
    "G7";
  const subject = subjectOptions.find(
    (item) => item.value === query.get("subject"),
  )?.value;
  const difficulty = difficultyOptions.find(
    (item) => item.value === query.get("difficulty"),
  )?.value;
  const state = query.get("state") === "resolved" ? "resolved" : "active";
  const search = (query.get("q") ?? "").trim();
  const requestedPage = Number(query.get("page"));
  const page =
    Number.isInteger(requestedPage) &&
    requestedPage >= 1 &&
    requestedPage <= 10000
      ? requestedPage
      : 1;
  const [searchDraft, setSearchDraft] = useState(search);
  const [searchError, setSearchError] = useState("");
  const [refresh, setRefresh] = useState(0);
  const [authPending, loginRequired] = [
    mode !== "questions" && authLoading,
    mode !== "questions" && !user,
  ];
  const scope = new URLSearchParams({ grade, ...(subject ? { subject } : {}) });

  useEffect(() => {
    setSearchDraft(search);
    setSearchError("");
  }, [search, mode]);

  function setFilter(key: string, value?: string) {
    setQuery((previous) => {
      const next = new URLSearchParams(previous);
      if (value) next.set(key, value);
      else next.delete(key);
      if (key !== "page") next.delete("page");
      return next;
    });
  }

  function tabHref(tab: Mode, resolved = false) {
    const params = new URLSearchParams(scope);
    if (tab !== "questions") params.set("mode", tab);
    if (tab === "wrong" && resolved) params.set("state", "resolved");
    return `/practice?${params}`;
  }

  function searchQuestions(value: string) {
    const keyword = value.trim();
    if (keyword.length === 1) {
      setSearchError("请输入至少两个字或字符。");
      return;
    }
    setSearchError("");
    setFilter("q", keyword || undefined);
  }

  const params = new URLSearchParams({ page: String(page) });
  if (mode !== "history") {
    params.set("grade", grade);
    if (subject) params.set("subject", subject);
  }
  if (mode === "questions") {
    if (search) params.set("q", search);
    if (difficulty) params.set("difficulty", difficulty);
  }
  if (mode === "wrong") params.set("state", state);
  const resource =
    mode === "questions"
      ? "questions"
      : mode === "wrong"
        ? "wrong-questions"
        : "attempts";
  const requestPath = `/api/practice/${resource}?${params}`;
  const { data, loading, error } = useApiData<
    PageData<QuestionView | WrongQuestionView | AttemptView>
  >(loginRequired || authPending ? null : requestPath, refresh);
  const login = `/login?next=${encodeURIComponent("/practice?" + query.toString())}`;
  const refreshList = () => setRefresh((value) => value + 1);
  const resultsKey = JSON.stringify([requestPath, user?.id, refresh]);

  return (
    <div className="learning-entry practice-workspace">
      <section
        className="wrap entry-hero entry-hero--practice"
        aria-labelledby="practice-title"
      >
        <div className="entry-hero-copy">
          <h1 id="practice-title">{current.title}</h1>
          <p>{current.description}</p>
          <div className="entry-hero-actions">
            {mode === "wrong" && user?.role === "STUDENT" && (
              <Link className="button primary" to="/dashboard?tab=review">
                按课时复练 <Arrow />
              </Link>
            )}
            <Link className="learning-entry-link" to={`/study?${scope}`}>
              ← 回到同步学习
            </Link>
            {user?.role === "ADMIN" && (
              <Link className="learning-entry-link" to="/admin/questions">
                管理题库
              </Link>
            )}
          </div>
        </div>
        <div className="entry-hero-photo">
          <Image
            src="/images/practice-notebook.webp"
            width={960}
            height={640}
            alt=""
            priority
          />
        </div>
      </section>

      <section className="wrap practice-body" aria-label={current.label}>
        <nav className="practice-mode-nav" aria-label="练习栏目">
          {pages.map((tab) => (
            <Link
              key={tab.key}
              to={tabHref(tab.key)}
              aria-current={mode === tab.key ? "page" : undefined}
            >
              {tab.label}
            </Link>
          ))}
        </nav>

        {mode !== "history" && !loginRequired && !authPending && (
          <div className="practice-controls" role="group" aria-label="筛选题目">
            {mode === "questions" && (
              <div className="practice-control practice-search">
                <span id="practice-search-label">按题干查找</span>
                <Input.Search
                  aria-labelledby="practice-search-label"
                  aria-describedby={
                    searchError ? "practice-search-error" : undefined
                  }
                  status={searchError ? "error" : undefined}
                  maxLength={120}
                  value={searchDraft}
                  onChange={(event) => {
                    setSearchDraft(event.target.value);
                    setSearchError("");
                  }}
                  allowClear
                  enterButton="查找"
                  placeholder="输入连续关键词，至少 2 个字符"
                  onSearch={searchQuestions}
                />
                {searchError && (
                  <span
                    className="practice-search-error"
                    id="practice-search-error"
                    role="alert"
                  >
                    {searchError}
                  </span>
                )}
              </div>
            )}
            <>
              <div className="practice-control">
                <span>年级</span>
                <Select
                  aria-label="选择年级"
                  value={grade}
                  options={gradeOptions}
                  onChange={(value) => setFilter("grade", value)}
                />
              </div>
              <div className="practice-control">
                <span>学科</span>
                <Select
                  aria-label="选择学科"
                  placeholder="全部学科"
                  allowClear
                  value={subject}
                  options={subjectOptions}
                  onChange={(value) => setFilter("subject", value)}
                />
              </div>
            </>
            {mode === "questions" && (
              <div className="practice-control">
                <span>难度</span>
                <Select
                  aria-label="选择难度"
                  placeholder="全部难度"
                  value={difficulty}
                  options={difficultyOptions}
                  allowClear
                  onChange={(value) => setFilter("difficulty", value)}
                />
              </div>
            )}
            {mode === "questions" && (
              <Button className="practice-refresh" onClick={refreshList}>
                刷新列表
              </Button>
            )}
          </div>
        )}

        {mode === "wrong" && !loginRequired && !authPending && (
          <div className="practice-wrong-bar">
            <nav className="practice-wrong-nav" aria-label="错题状态">
              <Link
                to={tabHref("wrong")}
                aria-current={state === "active" ? "page" : undefined}
              >
                待复练
              </Link>
              <Link
                to={tabHref("wrong", true)}
                aria-current={state === "resolved" ? "page" : undefined}
              >
                已答对
              </Link>
            </nav>
            <Button onClick={refreshList}>刷新列表</Button>
          </div>
        )}
        {mode === "history" && !loginRequired && !authPending && (
          <div className="practice-history-tools">
            <Button onClick={refreshList}>刷新列表</Button>
          </div>
        )}

        {authPending ? (
          <div className="practice-pending" role="status">
            <Spin /> 正在确认登录状态…
          </div>
        ) : loginRequired ? (
          <Empty
            className="practice-empty"
            image={Empty.PRESENTED_IMAGE_SIMPLE}
            description="登录后查看自己的错题和作答记录。"
          >
            <Link className="button primary" to={login}>
              去登录
            </Link>
          </Empty>
        ) : loading ? (
          <div className="practice-pending" role="status">
            <Spin /> 正在加载…
          </div>
        ) : error ? (
          <Alert
            type="error"
            showIcon
            title={error}
            action={<Button onClick={refreshList}>重试</Button>}
          />
        ) : (
          data && (
            <>
              <p className="practice-result-count" aria-live="polite">
                共 <strong>{data.total}</strong>{" "}
                {mode === "history" ? "次作答" : "道题"}
              </p>
              {data.items.length ? (
                <div key={resultsKey} className="practice-results">
                  {mode === "questions"
                    ? (data.items as QuestionView[]).map((question) => (
                        <QuestionCard
                          key={`${question.id}-${question.updatedAt}`}
                          question={question}
                          reviewAction={() => (
                            <Link className="text-link" to={tabHref("wrong")}>
                              查看我的错题
                            </Link>
                          )}
                        />
                      ))
                    : mode === "wrong"
                      ? (data.items as WrongQuestionView[]).map((wrong) => (
                          <QuestionCard
                            key={wrong.id}
                            question={wrong.question}
                            wrongCount={wrong.wrongCount}
                            reviewAction={(attempt) => (
                              <Link
                                className="text-link"
                                to={tabHref("wrong", attempt.correct)}
                                aria-label={
                                  attempt.correct
                                    ? "查看已答对的错题"
                                    : "查看待复练的错题"
                                }
                              >
                                {attempt.correct ? "查看已答对" : "查看待复练"}
                              </Link>
                            )}
                          />
                        ))
                      : (data.items as AttemptView[]).map((attempt) => (
                          <article key={attempt.id} className="question-card">
                            <p className="question-meta">
                              <time dateTime={attempt.createdAt}>
                                {new Date(attempt.createdAt).toLocaleString(
                                  "zh-CN",
                                )}
                              </time>
                            </p>
                            <h2 className="question-text">
                              {attempt.snapshot.title}
                            </h2>
                            <QuestionDiagram
                              diagram={attempt.snapshot.diagram}
                            />
                            <ol className="history-options" type="A">
                              {attempt.snapshot.options.map((option, index) => (
                                <li key={index}>{option}</li>
                              ))}
                            </ol>
                            <AttemptResult attempt={attempt} />
                          </article>
                        ))}
                </div>
              ) : (
                <Empty
                  className="practice-empty"
                  image={Empty.PRESENTED_IMAGE_SIMPLE}
                  description={
                    data.total > 0
                      ? "这一页没有题目。"
                      : mode === "questions"
                        ? "这个范围还没有发布练习，换个年级或学科看看。"
                        : mode === "wrong"
                          ? state === "active"
                            ? "所选范围暂无待复练错题。"
                            : "所选范围暂无已答对的错题。"
                          : "还没有作答记录，从一道练习开始吧。"
                  }
                >
                  {data.total > 0 ? (
                    <Button onClick={() => setFilter("page")}>
                      回到第一页
                    </Button>
                  ) : (
                    mode !== "questions" && (
                      <Link className="text-link" to={tabHref("questions")}>
                        去挑选练习
                      </Link>
                    )
                  )}
                </Empty>
              )}
              {data.total > data.pageSize && data.items.length > 0 && (
                <Pagination
                  aria-label="练习分页"
                  current={page}
                  pageSize={data.pageSize}
                  total={data.total}
                  showSizeChanger={false}
                  onChange={(value) =>
                    setFilter("page", value > 1 ? String(value) : undefined)
                  }
                />
              )}
            </>
          )
        )}
      </section>
    </div>
  );
}
