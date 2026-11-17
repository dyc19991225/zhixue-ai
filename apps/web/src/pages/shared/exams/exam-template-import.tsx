import { useState } from "react";
import {
  Alert,
  App,
  Button,
  Collapse,
  Input,
  Modal,
  Space,
  Tag,
  Upload,
} from "antd";
import type { ExamTemplatePayload, ExamTemplatePreview } from "@zhixue/shared";
import { examApi } from "@/api/exam";
import { QuestionDiagram } from "@/features/practice/question-diagram";

const maxBytes = 512 * 1024;
export function ExamTemplateImport({
  onApply,
  disabled,
}: {
  onApply: (payload: ExamTemplatePayload) => void;
  disabled: boolean;
}) {
  const { message } = App.useApp();
  const [open, setOpen] = useState(false),
    [text, setText] = useState(""),
    [preview, setPreview] = useState<ExamTemplatePreview | null>(null),
    [loading, setLoading] = useState(false),
    [error, setError] = useState("");
  async function loadFile(file: File) {
    setError("");
    setPreview(null);
    setLoading(true);
    try {
      if (file.size > maxBytes) throw new Error("模板不能超过512KB。");
      setText(await file.text());
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "文件读取失败。");
    } finally {
      setLoading(false);
    }
  }
  async function validate() {
    setError("");
    setPreview(null);
    setLoading(true);
    try {
      if (new Blob([text]).size > maxBytes)
        throw new Error("模板不能超过512KB。");
      const parsed: unknown = JSON.parse(text.replace(/^\uFEFF/, ""));
      setPreview(await examApi.previewTemplate(parsed));
    } catch (cause) {
      setError(
        cause instanceof SyntaxError
          ? "JSON格式不正确，请检查文件内容。"
          : cause instanceof Error
            ? cause.message
            : "模板校验失败。",
      );
    } finally {
      setLoading(false);
    }
  }
  return (
    <>
      <Button disabled={disabled} onClick={() => setOpen(true)}>
        导入测评模板
      </Button>
      <Modal
        title="导入测评模板"
        open={open}
        width={850}
        centered
        styles={{ body: { maxHeight: "65vh", overflowY: "auto" } }}
        destroyOnHidden
        onCancel={() => {
          if (!loading) setOpen(false);
        }}
        footer={
          <Space wrap>
            <Button disabled={loading} onClick={() => setOpen(false)}>
              取消
            </Button>
            <Button
              loading={loading}
              disabled={!text.trim()}
              onClick={() => void validate()}
            >
              校验并预览
            </Button>
            <Button
              type="primary"
              disabled={!preview || loading}
              onClick={() => {
                if (!preview) return;
                onApply({
                  title: preview.title,
                  durationMinutes: preview.durationMinutes,
                  questions: preview.questions,
                });
                setOpen(false);
                setText("");
                setPreview(null);
                message.success("已载入编辑器，请核对后保存草稿。");
              }}
            >
              载入编辑器（替换题目）
            </Button>
          </Space>
        }
      >
        <Space orientation="vertical" style={{ width: "100%" }} size="middle">
          <Alert
            type="info"
            title="载入将替换当前标题、时长与全部题目，班级和时间保持当前设置。"
            description="仅支持未绑定班级的单选JSON模板；载入后仍需核对题目并保存草稿，发布另行操作。"
          />
          <Upload
            accept=".json,application/json"
            maxCount={1}
            showUploadList={false}
            disabled={loading}
            beforeUpload={(file) => {
              void loadFile(file);
              return false;
            }}
          >
            <Button disabled={loading}>选择JSON文件（最多512KB）</Button>
          </Upload>
          <details open={!preview} style={{ width: "100%" }}>
            <summary>测评模板JSON（展开编辑）</summary>
            <label htmlFor="exam-template-json">测评模板JSON</label>
            <Input.TextArea
              id="exam-template-json"
              aria-label="测评模板JSON"
              value={text}
              rows={6}
              disabled={loading}
              placeholder="也可以粘贴未绑定测评模板JSON"
              onChange={(event) => {
                setText(event.target.value);
                setPreview(null);
                setError("");
              }}
            />
          </details>
          {error && <Alert type="error" title={error} />}
          {preview && (
            <>
              <h3>{preview.title}</h3>
              <Space wrap>
                <Tag>{preview.questions.length}道单选</Tag>
                <Tag>满分{preview.totalPoints}分</Tag>
                <Tag>{preview.durationMinutes}分钟</Tag>
                <Tag>
                  {preview.questions.filter((q) => q.diagram).length}张题图
                </Tag>
              </Space>
              <div style={{ width: "100%" }}>
                <Collapse
                  items={preview.questions.map((q, index) => ({
                    key: String(index),
                    label: `第${index + 1}题 · ${q.points}分 · ${q.title}`,
                    children: (
                      <>
                        {q.diagram && <QuestionDiagram diagram={q.diagram} />}
                        {q.options.map((option, i) => (
                          <p key={i}>
                            {String.fromCharCode(65 + i)}. {option}
                          </p>
                        ))}
                        <p>答案：{String.fromCharCode(65 + q.answer)}</p>
                        <p>{q.explanation}</p>
                      </>
                    ),
                  }))}
                />
              </div>
            </>
          )}
        </Space>
      </Modal>
    </>
  );
}
