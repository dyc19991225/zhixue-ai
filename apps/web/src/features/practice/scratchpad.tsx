import { useEffect, useRef, useState, type PointerEvent } from "react";

const PEN_COLORS = [
  { label: "深空黑", value: "#1e293b" },
  { label: "演算蓝", value: "#2563eb" },
  { label: "批注红", value: "#e11d48" },
] as const;

export function QuestionScratchpad() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const lastPt = useRef<{ x: number; y: number } | null>(null);
  const [penColor, setPenColor] = useState<string>(PEN_COLORS[1].value);
  const [eraser, setEraser] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const rect = canvas.getBoundingClientRect();
    const width = Math.max(280, Math.floor(rect.width));
    const height = 210;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    const ctx = canvas.getContext("2d");
    if (ctx) {
      ctx.scale(dpr, dpr);
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
    }
  }, []);

  function pointFromEvent(event: PointerEvent<HTMLCanvasElement>) {
    const rect = event.currentTarget.getBoundingClientRect();
    return {
      x: event.clientX - rect.left,
      y: event.clientY - rect.top,
    };
  }

  function onPointerDown(event: PointerEvent<HTMLCanvasElement>) {
    event.currentTarget.setPointerCapture(event.pointerId);
    drawing.current = true;
    lastPt.current = pointFromEvent(event);
  }

  function onPointerMove(event: PointerEvent<HTMLCanvasElement>) {
    if (!drawing.current || !lastPt.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!ctx) return;
    const next = pointFromEvent(event);
    ctx.save();
    if (eraser) {
      ctx.globalCompositeOperation = "destination-out";
      ctx.lineWidth = 18;
    } else {
      ctx.globalCompositeOperation = "source-over";
      ctx.strokeStyle = penColor;
      ctx.lineWidth = 2.4;
    }
    ctx.beginPath();
    ctx.moveTo(lastPt.current.x, lastPt.current.y);
    ctx.lineTo(next.x, next.y);
    ctx.stroke();
    ctx.restore();
    lastPt.current = next;
  }

  function stopDrawing() {
    drawing.current = false;
    lastPt.current = null;
  }

  function clearCanvas() {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.restore();
  }

  return (
    <div className="student-scratchpad" aria-label="随题演算草稿纸">
      <div className="scratchpad-toolbar">
        <span className="scratchpad-title">
          ✏️ 随题演算草稿纸（仅本页临时手写）
        </span>
        <div className="scratchpad-actions">
          {PEN_COLORS.map((item) => (
            <button
              key={item.value}
              type="button"
              className={`scratchpad-swatch ${!eraser && penColor === item.value ? "active" : ""}`}
              style={{ "--swatch": item.value } as React.CSSProperties}
              aria-label={item.label}
              title={item.label}
              onClick={() => {
                setEraser(false);
                setPenColor(item.value);
              }}
            />
          ))}
          <button
            type="button"
            className={`scratchpad-tool-btn ${eraser ? "active" : ""}`}
            aria-pressed={eraser}
            onClick={() => setEraser((value) => !value)}
          >
            橡皮擦
          </button>
          <button
            type="button"
            className="scratchpad-tool-btn"
            onClick={clearCanvas}
          >
            清空草稿
          </button>
        </div>
      </div>
      <canvas
        ref={canvasRef}
        className="scratchpad-canvas"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={stopDrawing}
        onPointerCancel={stopDrawing}
      />
    </div>
  );
}
