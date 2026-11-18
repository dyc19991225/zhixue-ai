import { useEffect, useState } from "react";
import {
  Alert,
  Button,
  Empty,
  Input,
  Pagination,
  Select,
  Space,
  Spin,
  Tabs,
} from "antd";
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
import { api } from "@/lib/api";
import { useAuth } from "@/auth/auth-provider";
import { AttemptResult, QuestionCard } from "@/features/practice/question-card";
import { QuestionDiagram } from "@/features/practice/question-diagram";
import { LessonPractice } from "@/features/practice/lesson-practice";
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

function PracticeCenter() {
  const [query, setQuery] = useSearchParams(),
    { user } = useAuth();
  const mode = ["wrong", "history"].includes(query.get("mode") ?? "")
    ? query.get("mode")!
    : "questions";
  const grade =
    gradeOptions.find((item) => item.value === query.get("grade"))?.value ??
    user?.grade ??
    "G7";
  const subject = subjectOptions.find(
    (item) => item.value === query.get("subject"),
  )?.value;
  const search = (query.get("q") ?? "").trim();
  const [searchDraft, setSearchDraft] = useState(search);
  useEffect(() => setSearchDraft(search), [search]);
  function changeScope(key: string, value?: string) {
    setQuery((previous) => {
      const next = new URLSearchParams(previous);
      if (value) next.set(key, value);
      else next.delete(key);
      return next;
    });
    setPage(1);
  }
  const [difficulty, setDifficulty] = useState<string>(),
    [state, setState] = useState("active"),
    [page, setPage] = useState(1),
    [refresh, setRefresh] = useState(0);
  const [questions, setQuestions] = useState<QuestionView[]>([]),
    [wrongs, setWrongs] = useState<WrongQuestionView[]>([]),
    [history, setHistory] = useState<AttemptView[]>([]),
    [total, setTotal] = useState(0),
    [loading, setLoading] = useState(true),
    [error, setError] = useState("");
  useEffect(() => {
    setPage(1);
  }, [mode, grade, subject, search]);
  useEffect(() => {
    let active = true;
    setLoading(true);
    setError("");
    if (mode !== "questions" && !user) {
      setLoading(false);
      return;
    }
    const params = new URLSearchParams({ page: String(page) });
    if (mode === "questions" && search) params.set("q", search);
    if (mode !== "history") {
      params.set("grade", grade);
      if (subject) params.set("subject", subject);
    }
    if (mode === "questions" && difficulty)
      params.set("difficulty", difficulty);
    if (mode === "wrong") params.set("state", state);
    const path =
      mode === "questions"
        ? "questions"
        : mode === "wrong"
          ? "wrong-questions"
          : "attempts";
    api<PageData<QuestionView | WrongQuestionView | AttemptView>>(
      `/api/practice/${path}?${params}`,
    )
      .then((data) => {
        if (!active) return;
        setTotal(data.total);
        if (mode === "questions") setQuestions(data.items as QuestionView[]);
        else if (mode === "wrong") setWrongs(data.items as WrongQuestionView[]);
        else setHistory(data.items as AttemptView[]);
      })
      .catch((e) => {
        if (active) setError(e.message);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [mode, user, grade, subject, difficulty, state, page, refresh, search]);
  const count =
    mode === "questions"
      ? questions.length
      : mode === "wrong"
        ? wrongs.length
        : history.length;
  return (
    <section className="wrap practice-page">
      <div className="practice-banner">
        <div>
          <p>练习中心</p>
          <h1>
            把每一次卡住，
            <br />
            变成下一次会做。
          </h1>
          <p>选一道题认真想一想，答完再看解析。</p>
          <Space wrap>
            <Link
              className="button primary"
              to={`/study?${new URLSearchParams({ grade, ...(subject ? { subject } : {}) })}`}
            >
              回到同步学习
            </Link>
            {user?.role === "ADMIN" && (
              <Link className="text-link" to="/admin/questions">
                管理题库
              </Link>
            )}
          </Space>
        </div>
        <img src="/images/math.jpg" alt="黑板上的数学推导" />
      </div>
      <Tabs
        activeKey={mode}
        onChange={(value) => {
          setQuery({
            grade,
            ...(subject ? { subject } : {}),
            ...(value === "questions" ? {} : { mode: value }),
          });
          setPage(1);
        }}
        items={[
          { key: "questions", label: "挑选练习" },
          { key: "wrong", label: "我的错题本" },
          { key: "history", label: "作答记录" },
        ]}
      />
      <div className="practice-toolbar">
        {mode === "questions" && (
          <label className="practice-search">
            按题干查找
            <Input.Search
              maxLength={120}
              value={searchDraft}
              onChange={(event) => setSearchDraft(event.target.value)}
              allowClear
              enterButton="查找"
              placeholder="输入连续关键词，至少2个字"
              onSearch={(value) => {
                if (!value.trim() || value.trim().length >= 2)
                  changeScope("q", value.trim() || undefined);
              }}
            />
          </label>
        )}
        <Space wrap>
          {mode !== "history" && (
            <>
              <Select
                aria-label="选择年级"
                value={grade}
                options={gradeOptions}
                onChange={(v) => {
                  changeScope("grade", v);
                  setPage(1);
                }}
              />
              <Select
                aria-label="选择学科"
                placeholder="全部学科"
                allowClear
                value={subject}
                options={subjectOptions}
                onChange={(v) => {
                  changeScope("subject", v);
                  setPage(1);
                }}
              />
            </>
          )}
          {mode === "questions" && (
            <Select
              aria-label="选择难度"
              placeholder="全部难度"
              value={difficulty}
              options={difficultyOptions}
              allowClear
              onChange={(v) => {
                setDifficulty(v);
                setPage(1);
              }}
            />
          )}
          {mode === "wrong" && (
            <Select
              aria-label="错题状态"
              value={state}
              options={[
                { value: "active", label: "待复习" },
                { value: "resolved", label: "已答对" },
              ]}
              onChange={(v) => {
                setState(v);
                setPage(1);
              }}
            />
          )}
        </Space>
        <Button onClick={() => setRefresh((v) => v + 1)}>刷新列表</Button>
      </div>
      {mode !== "questions" && !user ? (
        <Empty description={"登录后查看自己的错题和作答记录"}>
          <Link
            className="button primary"
            to={`/login?next=${encodeURIComponent("/practice?" + query.toString())}`}
          >
            去登录
          </Link>
        </Empty>
      ) : loading ? (
        <div className="account-loading">
          <Spin />
        </div>
      ) : error ? (
        <Alert
          type="error"
          showIcon
          title={error}
          action={
            <Button onClick={() => setRefresh((v) => v + 1)}>重试</Button>
          }
        />
      ) : (
        <>
          {!count ? (
            <Empty
              description={
                mode === "questions"
                  ? "这个范围还没有发布练习，换个年级或学科看看。"
                  : mode === "wrong"
                    ? "这个范围没有错题，答错的题会自动出现在这里。"
                    : "还没有作答记录，从一道练习开始吧。"
              }
            />
          ) : (
            <>
              <p className="muted">
                共 {total} {mode === "history" ? "次作答" : "道题"}
                {mode === "wrong"
                  ? " · 重新答对后进入“已答对”，再次答错会回到“待复习”。"
                  : ""}
              </p>
              {mode === "questions"
                ? questions.map((q) => (
                    <QuestionCard
                      key={`${q.id}-${q.updatedAt}-${refresh}`}
                      question={q}
                    />
                  ))
                : mode === "wrong"
                  ? wrongs.map((w) => (
                      <QuestionCard
                        key={`${w.id}-${refresh}`}
                        question={w.question}
                        wrongCount={w.wrongCount}
                      />
                    ))
                  : history.map((a) => (
                      <article key={a.id} className="question-card">
                        <p className="muted">
                          {new Date(a.createdAt).toLocaleString("zh-CN")}
                        </p>
                        <h2 className="question-text">{a.snapshot.title}</h2>
                        <QuestionDiagram diagram={a.snapshot.diagram} />
                        <ol className="history-options" type="A">
                          {a.snapshot.options.map((o, i) => (
                            <li key={i}>{o}</li>
                          ))}
                        </ol>
                        <AttemptResult attempt={a} />
                      </article>
                    ))}
              <Pagination
                current={page}
                pageSize={12}
                total={total}
                showSizeChanger={false}
                onChange={setPage}
              />
            </>
          )}
        </>
      )}
    </section>
  );
}
