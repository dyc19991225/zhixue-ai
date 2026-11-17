import { Input, InputNumber, Select } from "antd";
import type { QuestionDiagram as Diagram } from "@zhixue/shared";
import { QuestionDiagram } from "./question-diagram";
const defaults: Record<string, Diagram> = {
  rectangle: {
    kind: "rectangle",
    widthLabel: "x 厘米",
    heightLabel: "6 厘米",
    note: "周长 30 厘米；示意图不按比例",
    alt: "长方形的长为x厘米，宽为6厘米，周长30厘米。",
  },
  segment: {
    kind: "segment",
    leftLabel: "x",
    rightLabel: "4",
    totalLabel: "总长 12",
    note: "单位相同；示意图不按比例",
    alt: "一条线段分成两部分，长度分别为x和4，总长12。",
  },
  "adjacent-angles": {
    kind: "adjacent-angles",
    knownAngle: 60,
    unknownLabel: "x°",
    note: "两个相邻角组成平角，总和180°",
    alt: "一条直线上一点引出射线，构成60度角和x度角，两角之和为180度。",
  },
};
export function DiagramEditor({
  value,
  onChange,
}: {
  value?: Diagram | null;
  onChange?: (value: Diagram | null) => void;
}) {
  function field(key: string, label: string) {
    return (
      <label key={key}>
        {label}
        <Input
          value={String(
            (value as unknown as Record<string, unknown>)?.[key] ?? "",
          )}
          maxLength={key === "alt" ? 400 : key === "note" ? 60 : 35}
          onChange={(e) =>
            value && onChange?.({ ...value, [key]: e.target.value })
          }
        />
      </label>
    );
  }
  return (
    <div className="diagram-editor">
      <Select
        aria-label="题图类型"
        value={value?.kind ?? "none"}
        options={[
          { value: "none", label: "不使用题图" },
          { value: "rectangle", label: "矩形图" },
          { value: "segment", label: "线段分段图" },
          { value: "adjacent-angles", label: "邻补角图" },
        ]}
        onChange={(kind) =>
          onChange?.(kind === "none" ? null : structuredClone(defaults[kind]))
        }
      />
      {value && (
        <>
          <div className="editor-grid">
            {value.kind === "rectangle" && (
              <>
                {field("widthLabel", "长的标注")}
                {field("heightLabel", "宽的标注")}
              </>
            )}
            {value.kind === "segment" && (
              <>
                {field("leftLabel", "左段标注")}
                {field("rightLabel", "右段标注")}
                {field("totalLabel", "总长标注")}
              </>
            )}
            {value.kind === "adjacent-angles" && (
              <>
                <label>
                  已知角（10–170度）
                  <InputNumber
                    min={10}
                    max={170}
                    value={value.knownAngle}
                    onChange={(angle) =>
                      angle !== null &&
                      onChange?.({ ...value, knownAngle: angle })
                    }
                  />
                </label>
                {field("unknownLabel", "未知角标注")}
              </>
            )}
            {field("note", "图下注记")}
            {field("alt", "无障碍图形描述（含全部已知条件）")}
          </div>
          <QuestionDiagram diagram={value} />
        </>
      )}
    </div>
  );
}
