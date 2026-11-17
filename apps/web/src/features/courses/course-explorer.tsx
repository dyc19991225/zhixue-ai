import Image from "@/components/image";
import Link from "@/components/link";
import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Alert, Button, Input, Pagination, Select } from "antd";
import { grades, parseGrade } from "./catalog";
import { useCatalog } from "@/hooks/use-catalog";
import type { Grade } from "./catalog";
import { Arrow } from "@/components/icons";
import { PublishedCourseList, usePublishedCourses } from "./published-courses";
import { gradeOptions } from "@zhixue/shared";

const subjectMedia: Record<
  string,
  { image: string; title: string; topics: string; label: string }
> = {
  chinese: {
    image: "reading",
    title: "读懂文字里的意思",
    topics: "阅读理解 / 古诗文 / 写作",
    label: "阅读与表达",
  },
  math: {
    image: "math",
    title: "把解题思路理清楚",
    topics: "数与代数 / 几何 / 数学思维",
    label: "逻辑与思考",
  },
  english: {
    image: "library",
    title: "让词句变成自己的表达",
    topics: "词汇 / 阅读 / 语言运用",
    label: "语言与交流",
  },
  physics: {
    image: "math",
    title: "用规律解释身边的现象",
    topics: "现象观察 / 规律 / 实验",
    label: "观察与推理",
  },
  chemistry: {
    image: "chemistry",
    title: "看见物质变化的过程",
    topics: "物质 / 反应 / 实验探究",
    label: "发现与实验",
  },
  biology: {
    image: "chemistry",
    title: "探索生命的联系",
    topics: "生命现象 / 结构 / 生态",
    label: "生命与自然",
  },
};

export function CourseExplorer({
  compact = false,
  initialGrade = "七年级",
  catalogPath = "/courses",
}: {
  compact?: boolean;
  initialGrade?: Grade;
  catalogPath?: "/courses" | "/study";
}) {
  const [params, setParams] = useSearchParams();
  const [localGrade, setLocalGrade] = useState<Grade>(parseGrade(initialGrade));
  const grade = compact
    ? localGrade
    : ((gradeOptions.find((g) => g.value === params.get("grade"))?.label ??
        parseGrade(initialGrade)) as Grade);
  const gradeCode = gradeOptions.find((g) => g.label === grade)!.value;
  const [query, setQuery] = useState(compact ? "" : (params.get("q") ?? ""));
  const search = compact ? "" : (params.get("q") ?? "");
  useEffect(() => {
    if (!compact) setQuery(search);
  }, [search, compact]);
  const catalog = useCatalog(grade);
  const selectedSubject = compact
    ? undefined
    : (params.get("subject") ?? undefined);
  const pageValue = Number(params.get("page") ?? 1);
  const page =
    Number.isInteger(pageValue) && pageValue > 0 && pageValue <= 10000
      ? pageValue
      : 1;
  const filters = compact
    ? { pageSize: 3 }
    : {
        page,
        pageSize: 9,
        q: search,
        region: params.get("region") ?? undefined,
        textbookEdition: params.get("textbookEdition") ?? undefined,
        term: params.get("term") ?? undefined,
        access: params.get("access") ?? undefined,
      };
  const published = usePublishedCourses(gradeCode, selectedSubject, filters);
  function update(values: Record<string, string | undefined>) {
    setParams((previous) => {
      const next = new URLSearchParams(previous);
      next.delete("page");
      next.set("grade", gradeCode);
      for (const [key, value] of Object.entries(values)) {
        if (value) next.set(key, value);
        else next.delete(key);
      }
      return next;
    });
  }
  function setGrade(value: Grade) {
    setQuery("");
    if (compact) setLocalGrade(value);
    else
      setParams({ grade: gradeOptions.find((g) => g.label === value)!.value });
  }
  function subjectHref(subject: string) {
    const next = new URLSearchParams(compact ? undefined : params);
    next.set("grade", gradeCode);
    next.set("subject", subject);
    next.delete("page");
    return `${catalogPath}?${next}`;
  }
  const subjects = catalog.subjects.filter(
    (s) =>
      (!selectedSubject || s.id === selectedSubject) &&
      (!search ||
        s.name.includes(search) ||
        (published.subjectCounts[s.id] ?? 0) > 0),
  );
  return (
    <div className="visual-catalog">
      <div className="catalog-controls">
        <div className="grade-options" role="group" aria-label="选择年级">
          {grades.map((g) => (
            <button
              type="button"
              key={g}
              aria-pressed={grade === g}
              onClick={() => setGrade(g)}
            >
              {g}
            </button>
          ))}
        </div>
        {!compact && (
          <label className="search-label" htmlFor="catalog-search">
            查找学科或课程
            <Input.Search
              id="catalog-search"
              className="subject-search"
              allowClear
              enterButton="搜索"
              placeholder="例如：数学、一元一次方程"
              maxLength={120}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onSearch={(value) => update({ q: value.trim() })}
            />
          </label>
        )}
      </div>
      {!compact && (
        <div className="catalog-filter-panel">
          <div className="catalog-filter-grid">
            <label>
              学科
              <Select
                aria-label="筛选学科"
                allowClear
                placeholder="全部学科"
                value={selectedSubject}
                options={catalog.subjects.map((s) => ({
                  value: s.id,
                  label: s.name,
                }))}
                onChange={(value) => update({ subject: value })}
              />
            </label>
            <label>
              适用地区
              <Select
                aria-label="筛选适用地区"
                allowClear
                showSearch
                optionFilterProp="label"
                placeholder="全部地区"
                value={filters.region}
                options={
                  published.facets?.regions.map((value) => ({
                    value,
                    label: value,
                  })) ?? []
                }
                onChange={(value) => update({ region: value })}
              />
            </label>
            <label>
              教材版本
              <Select
                aria-label="筛选教材版本"
                allowClear
                showSearch
                optionFilterProp="label"
                placeholder="全部版本"
                value={filters.textbookEdition}
                options={
                  published.facets?.textbookEditions.map((value) => ({
                    value,
                    label: value,
                  })) ?? []
                }
                onChange={(value) => update({ textbookEdition: value })}
              />
            </label>
            <label>
              学期
              <Select
                aria-label="筛选学期"
                allowClear
                placeholder="全部学期"
                value={filters.term}
                options={
                  published.facets?.terms.map((value) => ({
                    value,
                    label: value,
                  })) ?? []
                }
                onChange={(value) => update({ term: value })}
              />
            </label>
            <label>
              课程权益
              <Select
                aria-label="筛选课程权益"
                allowClear
                placeholder="全部课程"
                value={filters.access}
                options={[
                  { value: "FREE", label: "免费学习" },
                  { value: "MEMBER", label: "需要会员权益" },
                ]}
                onChange={(value) => update({ access: value })}
              />
            </label>
            <Button
              onClick={() => {
                setQuery("");
                setParams({ grade: gradeCode });
              }}
            >
              清空筛选
            </Button>
          </div>
          <p className="muted">
            地区、版本和学期来自已发布课程的填写信息，请结合课程说明核对是否适用。
          </p>
        </div>
      )}
      {catalog.failed && (
        <Alert
          type="warning"
          showIcon
          title="学科目录暂时未能刷新，请稍后再试。"
        />
      )}
      <p className="catalog-selection" aria-live="polite">
        {grade}
        <span>
          {published.loading
            ? "正在查询课程"
            : published.error
              ? "课程暂未能刷新"
              : `符合条件 ${published.total} 门课程`}
        </span>
      </p>
      <PublishedCourseList
        {...published}
        items={published.items}
        compact={compact}
      />
      {!compact && !published.error && (
        <Pagination
          current={page}
          pageSize={9}
          total={published.total}
          showSizeChanger={false}
          hideOnSinglePage
          className="relation-pagination"
          onChange={(value) => update({ page: String(value) })}
        />
      )}
      <div className="photo-course-grid">
        {(compact ? subjects.slice(0, 3) : subjects).map((s) => {
          const media = subjectMedia[s.id] ?? {
            image: "reading",
            title: s.name,
            topics: "学科知识 / 章节学习",
            label: "人文与思考",
          };
          return (
            <Link className="photo-course" key={s.id} href={subjectHref(s.id)}>
              <div className={`course-photo course-photo-${media.image}`}>
                <Image
                  src={`/images/${media.image}.jpg`}
                  alt=""
                  fill
                  sizes="(max-width: 600px) 100vw, (max-width: 950px) 50vw, 33vw"
                />
                <span className="course-photo-label">{media.label}</span>
                <span className="course-open" aria-hidden="true">
                  <Arrow />
                </span>
              </div>
              <div className="course-caption">
                <div className="course-caption-top">
                  <span>
                    {grade} / {s.name}
                  </span>
                  <span>
                    {published.loading
                      ? "查询中"
                      : published.error
                        ? "暂不可用"
                        : (published.subjectCounts[s.id] ?? 0) > 0
                          ? `${published.subjectCounts[s.id]}门可学习课程`
                          : "暂无已发布课程"}
                  </span>
                </div>
                <h3>{media.title}</h3>
                <p>{media.topics}</p>
              </div>
            </Link>
          );
        })}
      </div>
      {!compact && (
        <p className="prototype-note">
          课程按实际发布状态展示，筛选结果可通过当前网址分享。未填写的版本信息不代表已完成教材适配。
        </p>
      )}
      {subjects.length === 0 && (
        <div className="empty-state" role="status">
          没有找到匹配的学科或课程，试试“数学”或清空搜索。
        </div>
      )}
    </div>
  );
}
