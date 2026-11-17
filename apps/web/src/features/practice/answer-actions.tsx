import { useState } from "react";
import { Button, Space } from "antd";

export function AnswerActions({
  question,
  answer,
  onRevise,
  disabled = false,
}: {
  question: string;
  answer: string;
  onRevise: () => void;
  disabled?: boolean;
}) {
  const [notice, setNotice] = useState("");
  const text = `题目：\n${question}\n\n解题思路：\n${answer}\n\nAI回答可能有误，请结合题干和老师意见核对。`;
  return (
    <>
      <Space wrap>
        <Button
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(text);
              setNotice("题目和解题思路已复制。");
            } catch {
              setNotice("浏览器未允许复制，请手动选择文字，或下载解题记录。");
            }
          }}
        >
          复制解题思路
        </Button>
        <Button
          onClick={() => {
            const url = URL.createObjectURL(
              new Blob(["\uFEFF" + text], { type: "text/plain;charset=utf-8" }),
            );
            const link = document.createElement("a");
            link.href = url;
            link.download = `知学-解题记录-${new Date().toISOString().slice(0, 10)}.txt`;
            link.click();
            setTimeout(() => URL.revokeObjectURL(url), 1000);
            setNotice("解题记录已生成，仅下载到本机，不包含照片。");
          }}
        >
          下载解题记录
        </Button>
        <Button disabled={disabled} onClick={onRevise}>
          校对这道题
        </Button>
      </Space>
      {notice && (
        <p role="status" className="muted">
          {notice}
        </p>
      )}
    </>
  );
}
