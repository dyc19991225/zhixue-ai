import { useEffect, useRef, useState } from "react";
import {
  Alert,
  Button,
  Card,
  Checkbox,
  Image as PhotoPreview,
  Input,
  Progress,
  Space,
} from "antd";
import type { Worker } from "tesseract.js";
import { cropRectangle, fullCrop, type CropBox } from "./crop-geometry";
import { PhotoSearch } from "./photo-search";
import { prepareModelImage } from "./prepare-model-image";
import { correctPhoto } from "./photo-correction";

export function PhotoQuestion({
  onUse,
  imagesEnabled = false,
  locked = false,
  onImageChange,
  onBusyChange,
}: {
  onUse: (text: string, image?: string) => void;
  imagesEnabled?: boolean;
  locked?: boolean;
  onImageChange?: () => void;
  onBusyChange?: (busy: boolean) => void;
}) {
  const [attachImage, setAttachImage] = useState(false);
  const [image, setImage] = useState<string>();
  const [angle, setAngle] = useState(0);
  const [enhance, setEnhance] = useState(false);
  const camera = useRef<HTMLInputElement>(null);
  const original = useRef<string>();
  const [crop, setCrop] = useState<CropBox>(fullCrop);
  const [text, setText] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    onBusyChange?.(busy);
  }, [busy, onBusyChange]);
  const [progress, setProgress] = useState(0);
  const [notice, setNotice] = useState("");
  const worker = useRef<Worker>();
  const version = useRef(0);
  const timer = useRef<ReturnType<typeof setTimeout>>();
  const input = useRef<HTMLInputElement>(null);
  const pendingCrop =
    crop.left !== 0 ||
    crop.top !== 0 ||
    crop.right !== 100 ||
    crop.bottom !== 100;
  const pendingCorrection = angle !== 0 || enhance;
  function invalidate() {
    onImageChange?.();
    setText("");
    setNotice("");
    setProgress(0);
  }
  function cancel() {
    version.current++;
    clearTimeout(timer.current);
    void worker.current?.terminate().catch(() => {});
    worker.current = undefined;
    setBusy(false);
  }
  useEffect(
    () => () => {
      version.current++;
      clearTimeout(timer.current);
      void worker.current?.terminate().catch(() => {});
    },
    [],
  );
  async function choose(file?: File) {
    cancel();
    onImageChange?.();
    setNotice("");
    setAttachImage(false);
    setAngle(0);
    setEnhance(false);
    const id = version.current;
    setImage(undefined);
    original.current = undefined;
    setCrop(fullCrop);
    setText("");
    setError("");
    setProgress(0);
    if (!file) return;
    if (
      !["image/jpeg", "image/png", "image/webp"].includes(file.type) ||
      file.size > 8 * 1024 * 1024
    ) {
      setError("请选择不超过8MB的JPG、PNG或WebP照片。");
      return;
    }
    setBusy(true);
    try {
      const bitmap = await createImageBitmap(file, {
        imageOrientation: "from-image",
      });
      if (id !== version.current) {
        bitmap.close();
        return;
      }
      if (bitmap.width * bitmap.height > 20000000) {
        bitmap.close();
        throw new Error("图片尺寸过大，请裁剪到单道题后重试。");
      }
      const scale = Math.min(1, 1800 / Math.max(bitmap.width, bitmap.height));
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.round(bitmap.width * scale));
      canvas.height = Math.max(1, Math.round(bitmap.height * scale));
      const context = canvas.getContext("2d");
      if (!context) {
        bitmap.close();
        throw new Error("浏览器无法读取图片，请更换浏览器。");
      }
      context.fillStyle = "white";
      context.fillRect(0, 0, canvas.width, canvas.height);
      context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
      bitmap.close();
      const prepared = canvas.toDataURL("image/jpeg", 0.9);
      original.current = prepared;
      setImage(prepared);
    } catch (cause) {
      if (id === version.current)
        setError(cause instanceof Error ? cause.message : "图片读取失败。");
    } finally {
      if (id === version.current) setBusy(false);
    }
  }
  async function editImage(rotate: boolean) {
    if (!image) return;
    cancel();
    onImageChange?.();
    setNotice("");
    const id = version.current;
    setBusy(true);
    setText("");
    setError("");
    setProgress(0);
    try {
      const img = new Image();
      img.src = image;
      await img.decode();
      if (id !== version.current) return;
      const rect = cropRectangle(
        img.naturalWidth,
        img.naturalHeight,
        rotate ? fullCrop : crop,
      );
      const canvas = document.createElement("canvas");
      canvas.width = rotate ? img.naturalHeight : rect.width;
      canvas.height = rotate ? img.naturalWidth : rect.height;
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("无法处理图片。");
      if (rotate) {
        ctx.translate(canvas.width, 0);
        ctx.rotate(Math.PI / 2);
        ctx.drawImage(img, 0, 0);
      } else
        ctx.drawImage(
          img,
          rect.x,
          rect.y,
          rect.width,
          rect.height,
          0,
          0,
          canvas.width,
          canvas.height,
        );
      setImage(canvas.toDataURL("image/jpeg", 0.95));
      setCrop(fullCrop);
    } catch {
      if (id === version.current) setError("图片处理失败，请重新选择照片。");
    } finally {
      if (id === version.current) setBusy(false);
    }
  }
  async function recognize() {
    if (!image) return;
    cancel();
    const id = version.current;
    setBusy(true);
    setError("");
    setText("");
    setProgress(0);
    timer.current = setTimeout(() => {
      if (id === version.current) {
        cancel();
        setError("识别超时，请裁剪单道清晰题目后重试。");
      }
    }, 90000);
    try {
      const { createWorker, OEM } = await import("tesseract.js");
      if (id !== version.current) return;
      const current = await createWorker(["chi_sim", "eng"], OEM.LSTM_ONLY, {
        workerPath: "/ocr/worker.min.js",
        corePath: "/ocr/core",
        langPath: "/ocr/lang",
        workerBlobURL: false,
        cacheMethod: "none",
        logger: (event) => {
          if (id === version.current && event.status === "recognizing text")
            setProgress(Math.round(event.progress * 100));
        },
      });
      if (id !== version.current) {
        await current.terminate();
        return;
      }
      worker.current = current;
      const result = await current.recognize(image);
      if (id !== version.current) return;
      const recognized = result.data.text.trim();
      if (!recognized)
        throw new Error("没有识别到文字，请拍清楚、摆正并裁剪到单道题。");
      setText(recognized.slice(0, 2000));
      setNotice(
        result.data.confidence < 65
          ? "这张照片的文字识别把握较低，请逐字校对；图形或复杂公式可选择附上照片。"
          : "识别完成，请核对数字、符号和单位。文字识别结果不包含几何关系判断。",
      );
      if (recognized.length > 2000)
        setError("文字超过2000字，只保留前2000字，请裁剪题目或手动补全。");
    } catch {
      if (id === version.current)
        setError(
          "识别未完成，请检查本站识别资源、照片清晰度后重试；也可以手动输入题目。",
        );
    } finally {
      if (id === version.current) cancel();
    }
  }
  async function applyCorrection() {
    if (!image || !pendingCorrection || pendingCrop) return;
    cancel();
    invalidate();
    const id = version.current;
    setBusy(true);
    setError("");
    try {
      const corrected = await correctPhoto(image, angle, enhance);
      if (id !== version.current) return;
      setImage(corrected);
      setAngle(0);
      setEnhance(false);
      setNotice(
        "照片微调已应用，请放大检查题干和图形标注；不清楚时可恢复原图。",
      );
    } catch (cause) {
      if (id === version.current)
        setError(cause instanceof Error ? cause.message : "照片微调失败。");
    } finally {
      if (id === version.current) setBusy(false);
    }
  }
  async function fillQuestion() {
    const id = version.current;
    setBusy(true);
    setError("");
    try {
      const attachment =
        attachImage && imagesEnabled && image
          ? await prepareModelImage(image)
          : undefined;
      if (id !== version.current) return;
      onUse(
        text.trim() ||
          "请分析照片中的这道题，先确认题意和已知条件，再给出提示、解题步骤与检验；信息不清楚时请指出需要补充的内容。",
        attachment,
      );
      setNotice(
        attachment
          ? "照片已在本机压缩并填入下方，请核对附件预览，再点击提问。"
          : "题干已填入下方，请核对后提问。",
      );
    } catch (cause) {
      if (id === version.current)
        setError(
          cause instanceof Error ? cause.message : "准备照片失败，请重新选择。",
        );
    } finally {
      if (id === version.current) setBusy(false);
    }
  }
  return (
    <Card title="拍照识题 · 先识别，再校对" className="photo-question">
      <fieldset
        disabled={locked}
        className="photo-fieldset"
        aria-busy={busy || locked}
      >
        <p>
          支持中英文印刷体文字。可在下方裁剪、旋转到单道题，去掉姓名和学校；手写、分式、根号和几何图可能识别不准。
        </p>
        <label className="photo-picker">
          选择照片或拍摄
          <input
            ref={input}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            disabled={busy}
            onChange={(event) => {
              void choose(event.target.files?.[0]);
              event.target.value = "";
            }}
          />
        </label>
        <input
          ref={camera}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          capture="environment"
          hidden
          disabled={busy || locked}
          onChange={(event) => {
            if (event.target.files?.[0]) void choose(event.target.files[0]);
            event.target.value = "";
          }}
        />
        <Button disabled={busy} onClick={() => camera.current?.click()}>
          用后置摄像头拍照
        </Button>
        <p className="muted">
          手机浏览器支持时会打开相机；电脑或不支持的浏览器会显示文件选择。
        </p>
        {image && (
          <>
            <div className="crop-stage">
              <PhotoPreview
                rootClassName="photo-preview-wrap"
                width="100%"
                className="photo-preview"
                src={image}
                alt="待识别的题目照片"
              />
              <div
                className="crop-overlay"
                style={{
                  left: `${crop.left}%`,
                  top: `${crop.top}%`,
                  width: `${crop.right - crop.left}%`,
                  height: `${crop.bottom - crop.top}%`,
                }}
              />
            </div>
            <p className="muted">
              调整四个边界，再点击“应用裁剪”；滑杆支持方向键微调。
            </p>
            <div className="crop-controls">
              {(["left", "top", "right", "bottom"] as const).map((edge) => (
                <label key={edge}>
                  {
                    {
                      left: "左边界",
                      top: "上边界",
                      right: "右边界",
                      bottom: "下边界",
                    }[edge]
                  }{" "}
                  {crop[edge]}%
                  <input
                    type="range"
                    min={
                      edge === "right"
                        ? crop.left + 5
                        : edge === "bottom"
                          ? crop.top + 5
                          : 0
                    }
                    max={
                      edge === "left"
                        ? crop.right - 5
                        : edge === "top"
                          ? crop.bottom - 5
                          : 100
                    }
                    value={crop[edge]}
                    disabled={busy || pendingCorrection}
                    onChange={(event) => {
                      onImageChange?.();
                      setNotice("");
                      setCrop((previous) => ({
                        ...previous,
                        [edge]: Number(event.target.value),
                      }));
                      setText("");
                      setProgress(0);
                    }}
                  />
                </label>
              ))}
            </div>
            <Space wrap>
              <Button
                disabled={busy || pendingCorrection}
                onClick={() => void editImage(false)}
              >
                应用裁剪
              </Button>
              <Button
                disabled={busy || pendingCrop || pendingCorrection}
                onClick={() => void editImage(true)}
              >
                顺时针旋转90°
              </Button>
              <Button
                disabled={busy}
                onClick={() => {
                  cancel();
                  onImageChange?.();
                  setNotice("");
                  setImage(original.current);
                  setCrop(fullCrop);
                  setText("");
                  setError("");
                  setProgress(0);
                  setAngle(0);
                  setEnhance(false);
                }}
              >
                恢复原图
              </Button>
            </Space>
            <div className="photo-correction">
              <label>
                倾斜微调 {angle}°（应用后生效）
                <input
                  type="range"
                  min={-15}
                  max={15}
                  step={1}
                  value={angle}
                  disabled={busy || pendingCrop}
                  onChange={(event) => {
                    invalidate();
                    setAngle(Number(event.target.value));
                  }}
                />
              </label>
              <Checkbox
                checked={enhance}
                disabled={busy || pendingCrop}
                onChange={(event) => {
                  invalidate();
                  setEnhance(event.target.checked);
                }}
              >
                增强黑白文字对比（彩色标注会变灰）
              </Checkbox>
              <Space wrap>
                <Button
                  disabled={busy || pendingCrop || !pendingCorrection}
                  onClick={() => void applyCorrection()}
                >
                  应用照片微调
                </Button>
                <Button
                  disabled={busy || !pendingCorrection}
                  onClick={() => {
                    setAngle(0);
                    setEnhance(false);
                  }}
                >
                  取消微调
                </Button>
              </Space>
              <p className="muted">
                点击照片可放大检查，放大窗口仅供查看。先应用裁剪或微调，再识别、附图；倾斜微调不能校正透视变形。
              </p>
            </div>
          </>
        )}
        <Space wrap className="lesson-actions">
          <Button
            type="primary"
            disabled={!image || busy || pendingCrop || pendingCorrection}
            onClick={() => void recognize()}
          >
            识别照片文字
          </Button>
          {busy && <Button onClick={cancel}>取消处理</Button>}
          <Button
            onClick={() => {
              cancel();
              onImageChange?.();
              setAttachImage(false);
              setAngle(0);
              setEnhance(false);
              setNotice("");
              setImage(undefined);
              original.current = undefined;
              setCrop(fullCrop);
              setText("");
              setError("");
              setProgress(0);
            }}
          >
            清除照片和文字
          </Button>
        </Space>
        {busy && (
          <Progress
            percent={progress}
            status="active"
            aria-label="照片处理进度"
          />
        )}
        {error && <Alert type="warning" showIcon title={error} />}
        {notice && (
          <p role="status" className="muted">
            {notice}
          </p>
        )}
        <label className="photo-editor">
          校对题干（可手动输入）
          <Input.TextArea
            rows={5}
            maxLength={2000}
            showCount
            value={text}
            disabled={busy}
            onChange={(event) => setText(event.target.value)}
            placeholder="逐字检查数字、正负号、单位和选项。识别文字不等于已解答。"
          />
        </label>
        {imagesEnabled && (
          <Checkbox
            checked={attachImage}
            disabled={busy || !image || pendingCrop || pendingCorrection}
            onChange={(event) => setAttachImage(event.target.checked)}
          >
            同时附上当前照片供模型分析（提问时会发送图片，请先裁掉个人信息）
          </Checkbox>
        )}
        <Button
          disabled={
            busy ||
            pendingCrop ||
            pendingCorrection ||
            (text.trim().length < 2 && !(attachImage && imagesEnabled && image))
          }
          onClick={() => void fillQuestion()}
        >
          {attachImage && imagesEnabled
            ? "将题干与照片填入提问框"
            : "将校对后的文字填入提问框"}
        </Button>
        <PhotoSearch text={text} disabled={busy} />
        <p className="muted">
          裁剪和文字识别在浏览器内完成。查找题目仅发送关键词；只有勾选附上照片并点击提问，才会将当前照片和题干经本站发送给配置的模型。本站不保存照片文件，模型服务的数据处理规则另行适用。刷新或离开页面后需重新选择照片。
        </p>
      </fieldset>
    </Card>
  );
}
