export const grades = [
  "七年级",
  "八年级",
  "九年级",
  "高一",
  "高二",
  "高三",
] as const;
export type Grade = (typeof grades)[number];
const definitions = [
  {
    id: "chinese",
    name: "语文",
    line: "读懂文字，也读懂世界。",
    symbol: "文",
    tone: "jade",
  },
  {
    id: "math",
    name: "数学",
    line: "从一个问题，找到思考路径。",
    symbol: "π",
    tone: "blue",
  },
  {
    id: "english",
    name: "英语",
    line: "在词句之间，打开新的表达。",
    symbol: "Aa",
    tone: "ochre",
  },
  {
    id: "physics",
    name: "物理",
    line: "用规律解释身边的现象。",
    symbol: "F",
    tone: "blue",
  },
  {
    id: "chemistry",
    name: "化学",
    line: "探索物质变化背后的奥秘。",
    symbol: "H₂",
    tone: "jade",
  },
  {
    id: "biology",
    name: "生物",
    line: "发现生命的联系与秩序。",
    symbol: "生",
    tone: "ochre",
  },
  {
    id: "history",
    name: "历史",
    line: "在时间里理解过去与当下。",
    symbol: "史",
    tone: "ochre",
  },
  {
    id: "geography",
    name: "地理",
    line: "建立认识世界的坐标。",
    symbol: "地",
    tone: "blue",
  },
  {
    id: "civics",
    name: "道德与法治",
    line: "在生活中理解责任与规则。",
    symbol: "法",
    tone: "jade",
  },
  {
    id: "politics",
    name: "思想政治",
    line: "联系现实，形成理性认识。",
    symbol: "思",
    tone: "jade",
  },
] as const;
// 只展示学科入口，不断言各省份、教材版本的实际开课年级。
export function subjectsForGrade(grade: Grade) {
  return definitions.filter((s) =>
    grade.startsWith("高") ? s.id !== "civics" : s.id !== "politics",
  );
}
export function parseGrade(value: unknown): Grade {
  return grades.includes(value as Grade) ? (value as Grade) : "七年级";
}
export function findSubject(id: string) {
  return definitions.find((s) => s.id === id);
}
