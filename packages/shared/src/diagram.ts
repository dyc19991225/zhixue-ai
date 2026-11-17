export type QuestionDiagram =
  | {
      kind: "rectangle";
      alt: string;
      widthLabel: string;
      heightLabel: string;
      note: string;
    }
  | {
      kind: "segment";
      alt: string;
      leftLabel: string;
      rightLabel: string;
      totalLabel: string;
      note: string;
    }
  | {
      kind: "adjacent-angles";
      alt: string;
      knownAngle: number;
      unknownLabel: string;
      note: string;
    };
const escape = (s: string) =>
  s
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
export function renderDiagramSvg(d: QuestionDiagram) {
  const text = (x: number, y: number, s: string) =>
    `<text x="${x}" y="${y}" text-anchor="middle" fill="#192c48" stroke="none" font-size="19">${escape(s)}</text>`;
  let body = "";
  if (d.kind === "rectangle")
    body = `<rect x="120" y="45" width="260" height="130" rx="2" fill="#edf4ff"/>${text(250, 205, d.widthLabel)}${text(65, 115, d.heightLabel)}`;
  else if (d.kind === "segment")
    body = `<path d="M60 105H440 M60 94V116 M280 94V116 M440 94V116 M60 165V180H440V165"/>${text(170, 85, d.leftLabel)}${text(360, 85, d.rightLabel)}${text(250, 210, d.totalLabel)}`;
  else {
    const radians = ((180 - d.knownAngle) * Math.PI) / 180,
      x = 250 + 125 * Math.cos(radians),
      y = 170 - 125 * Math.sin(radians);
    const known = ((180 - d.knownAngle / 2) * Math.PI) / 180,
      unknown = radians / 2;
    body = `<path d="M65 170H435 M250 170L${x.toFixed(3)} ${y.toFixed(3)}"/>${text(250 + 65 * Math.cos(known), 160 - 65 * Math.sin(known), d.knownAngle + "°")}${text(250 + 80 * Math.cos(unknown), 160 - 80 * Math.sin(unknown), d.unknownLabel)}${text(250, 200, "O")}`;
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 500 255" role="img" aria-label="${escape(d.alt)}"><g stroke="#23559a" stroke-width="3" fill="none" font-family="Microsoft YaHei, Arial, sans-serif">${body}${text(250, 245, d.note)}</g></svg>`;
}
