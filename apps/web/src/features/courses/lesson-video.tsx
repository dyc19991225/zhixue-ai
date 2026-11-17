import { useEffect, useRef, useState } from "react";
import { Alert, Button } from "antd";
import { api } from "@/lib/api";
export function LessonVideo({
  courseId,
  lessonId,
  position = 0,
}: {
  courseId: string;
  lessonId: string;
  position?: number;
}) {
  const [src, setSrc] = useState(""),
    [error, setError] = useState(""),
    [saved, setSaved] = useState(false);
  const lastSave = useRef(0),
    video = useRef<HTMLVideoElement>(null);
  async function load() {
    setError("");
    try {
      const data = await api<{ url: string }>(
        `/api/learning/${courseId}/lessons/${lessonId}/playback`,
        "POST",
      );
      setSrc(data.url + "?v=" + Date.now());
    } catch (e) {
      setError((e as Error).message);
    }
  }
  useEffect(() => {
    void load();
  }, [courseId, lessonId]);
  async function save(force = false) {
    const node = video.current;
    if (
      !node ||
      !Number.isFinite(node.currentTime) ||
      (!force && Date.now() - lastSave.current < 15000)
    )
      return;
    lastSave.current = Date.now();
    try {
      await api(
        `/api/learning/${courseId}/lessons/${lessonId}/position`,
        "PUT",
        { positionSeconds: node.currentTime },
      );
      setSaved(true);
    } catch {
      setError("播放位置未能保存，暂停后可再次尝试。");
    }
  }
  return (
    <div className="lesson-video">
      {error && <Alert type="warning" title={error} />}
      <video
        ref={video}
        src={src || undefined}
        controls
        playsInline
        preload="metadata"
        aria-label="课程视频"
        onError={() =>
          setError(
            "视频暂时无法播放。请重新加载；上传文件须使用浏览器支持的 MP4 编码。",
          )
        }
        onLoadedMetadata={() => {
          if (video.current && position < video.current.duration)
            video.current.currentTime = position;
        }}
        onTimeUpdate={() => void save()}
        onPause={() => void save(true)}
        onEnded={() => void save(true)}
      />
      <div className="lesson-actions">
        <Button onClick={() => void load()}>重新加载视频</Button>
        <span className="muted" aria-live="polite">
          {saved ? "播放位置已保存" : "播放中每 15 秒及暂停时保存位置"}
        </span>
      </div>
    </div>
  );
}
