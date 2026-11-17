import { useEffect, useState } from "react";
import { Alert, Button, Empty, Input, Spin } from "antd";
import { Link } from "react-router-dom";
import type { PageData, QuestionView } from "@zhixue/shared";
import { useApiData } from "@/hooks/use-api-data";

export function PhotoSearch({
  text,
  disabled,
}: {
  text: string;
  disabled: boolean;
}) {
  const [keyword, setKeyword] = useState("");
  const [search, setSearch] = useState("");
  useEffect(() => {
    setKeyword(text.replace(/\s+/g, " ").slice(0, 120));
    setSearch("");
  }, [text]);
  const result = useApiData<PageData<QuestionView>>(
    search
      ? `/api/practice/questions?${new URLSearchParams({ q: search })}`
      : null,
  );
  return (
    <section className="photo-search" aria-labelledby="photo-search-title">
      <h3 id="photo-search-title">查找公开练习题</h3>
      <label className="photo-editor">
        查找关键词（可删去多余文字）
        <Input
          maxLength={120}
          value={keyword}
          disabled={disabled}
          onChange={(event) => {
            setKeyword(event.target.value);
            setSearch("");
          }}
          placeholder="保留题干中的连续关键短句，至少2个字"
        />
      </label>
      <Button
        disabled={disabled || keyword.trim().length < 2}
        onClick={() => {
          if (search === keyword.trim()) result.reload();
          else setSearch(keyword.trim());
        }}
      >
        用关键词查找
      </Button>
      <p className="muted">
        点击查找会把关键词发送至本站，仅按题干文字查询公开题，不保证原题匹配，也不会识别图片里的几何关系。
      </p>
      {search &&
        (result.loading ? (
          <Spin />
        ) : result.error ? (
          <Alert
            type="error"
            title={result.error}
            action={<Button onClick={result.reload}>重试</Button>}
          />
        ) : !result.data?.items.length ? (
          <Empty description="未找到可公开练习的题目。可缩短关键词再试，或将校对后的文字填入提问框。" />
        ) : (
          <>
            <p>找到 {result.data.total} 道公开题，先显示前5道。</p>
            <ul>
              {result.data.items.slice(0, 5).map((item) => (
                <li key={item.id}>
                  <Link
                    className="text-link"
                    to={`/practice?${new URLSearchParams({ grade: item.grade, subject: item.subject, q: search })}`}
                  >
                    {item.title}
                  </Link>
                </li>
              ))}
            </ul>
          </>
        ))}
    </section>
  );
}
