import { useEffect, useState } from "react";
import { Alert, Select } from "antd";
import type { AccountOption, PageResult, Role } from "@zhixue/shared";
import { useApiData } from "@/hooks/use-api-data";
export function UserPicker({
  role,
  value,
  onChange,
  id,
  disabled,
}: {
  role: Role;
  value?: string;
  onChange?: (value: string | undefined) => void;
  id?: string;
  disabled?: boolean;
}) {
  const [search, setSearch] = useState(""),
    [query, setQuery] = useState("");
  useEffect(() => {
    const timer = setTimeout(() => setQuery(search), 250);
    return () => clearTimeout(timer);
  }, [search]);
  const result = useApiData<PageResult<AccountOption>>(
    `/api/admin/user-options?${new URLSearchParams({ role, q: query })}`,
  );
  const selected = useApiData<PageResult<AccountOption>>(
    value
      ? `/api/admin/user-options?${new URLSearchParams({ role, id: value })}`
      : null,
  );
  const choices = [
    ...new Map(
      [...(selected.data?.list ?? []), ...(result.data?.list ?? [])].map(
        (u) => [u.id, u],
      ),
    ).values(),
  ];
  return (
    <div>
      <Select
        id={id}
        style={{ width: "100%" }}
        showSearch
        filterOption={false}
        allowClear
        value={value}
        disabled={disabled}
        onChange={onChange}
        onSearch={setSearch}
        loading={result.loading}
        placeholder="输入账号或昵称查找"
        notFoundContent={result.loading ? "正在查找…" : "没有匹配的有效账号"}
        options={choices.map((u) => ({
          value: u.id,
          label: `${u.displayName}（${u.username}）`,
        }))}
      />
      {!!result.data && result.data.total > 20 && (
        <small>匹配{result.data.total}个账号，请继续输入缩小范围。</small>
      )}
      {(result.error || selected.error) && (
        <Alert type="error" title={result.error || selected.error} />
      )}
    </div>
  );
}
