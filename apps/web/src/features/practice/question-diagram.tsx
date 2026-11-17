import {
  renderDiagramSvg,
  type QuestionDiagram as Diagram,
} from "@zhixue/shared";
export function QuestionDiagram({ diagram }: { diagram?: Diagram | null }) {
  if (!diagram) return null;
  return (
    <figure className="question-diagram">
      <img
        src={
          "data:image/svg+xml;charset=utf-8," +
          encodeURIComponent(renderDiagramSvg(diagram))
        }
        alt={diagram.alt}
      />
      <figcaption>{diagram.alt}</figcaption>
    </figure>
  );
}
