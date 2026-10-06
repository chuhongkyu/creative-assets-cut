"use client";

import { useEffect, useRef, useState } from "react";
import { computeDrawRect, willUpscale, type FitMode, type Focus } from "@/lib/crop";
import { renderImage, download } from "@/lib/exportImage";
import { renderVideo, isVideoExportSupported } from "@/lib/exportVideo";
import type { Preset } from "@/lib/presets";

interface Props {
  preset: Preset;
  media: HTMLImageElement | HTMLVideoElement | null;
  isVideo: boolean;
  sourceSize: { width: number; height: number };
  baseName: string;
  mode: FitMode;
  focus: Focus;
  startSeconds: number;
  durationSeconds: number;
  fps: number;
}

export default function PresetCard(props: Props) {
  const { preset, media, isVideo, sourceSize, baseName, mode, focus } = props;
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);

  // 미리보기는 실제 규격의 축소판이다. 내보내기와 같은 계산을 쓰므로 결과가 어긋나지 않는다.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !media) return;

    const scale = 360 / preset.width;
    canvas.width = Math.round(preset.width * scale);
    canvas.height = Math.round(preset.height * scale);

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    if (mode === "contain") {
      const fill = computeDrawRect(sourceSize, canvas.width, canvas.height, "cover", "center");
      ctx.filter = "blur(10px)";
      ctx.drawImage(media, fill.sx, fill.sy, fill.sw, fill.sh, -10, -10, canvas.width + 20, canvas.height + 20);
      ctx.filter = "none";
    }

    const r = computeDrawRect(sourceSize, canvas.width, canvas.height, mode, focus);
    ctx.drawImage(media, r.sx, r.sy, r.sw, r.sh, r.dx, r.dy, r.dw, r.dh);
  }, [media, mode, focus, preset.width, preset.height, sourceSize, props.startSeconds]);

  const upscales = willUpscale(sourceSize, preset.width, preset.height);
  const videoBlocked = isVideo && !preset.allowsVideo;

  async function handleExport() {
    if (!media) return;
    setError(null);
    setBusy(true);
    setProgress(0);

    try {
      if (isVideo && preset.allowsVideo) {
        const blob = await renderVideo(media as HTMLVideoElement, preset.width, preset.height, {
          startSeconds: props.startSeconds,
          durationSeconds: props.durationSeconds,
          fps: props.fps,
          mode,
          focus,
          onProgress: setProgress,
        });
        download(blob, `${baseName}_${preset.id}_${preset.width}x${preset.height}.mp4`);
      } else {
        const blob = await renderImage(media, sourceSize, preset.width, preset.height, mode, focus);
        download(blob, `${baseName}_${preset.id}_${preset.width}x${preset.height}.jpg`);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="card">
      <header>
        <h3>{preset.label}</h3>
        <span className="dim">
          {preset.width} × {preset.height}
        </span>
      </header>

      <canvas ref={canvasRef} className="preview" />

      {preset.note && <p className="note">{preset.note}</p>}

      {upscales && (
        <p className="warn">
          원본({sourceSize.width}×{sourceSize.height})이 작아 확대됩니다. 흐려집니다.
        </p>
      )}
      {videoBlocked && <p className="warn">이 자리는 이미지만 받습니다. 현재 프레임이 저장됩니다.</p>}
      {isVideo && preset.allowsVideo && !isVideoExportSupported() && (
        <p className="warn">이 브라우저는 영상 내보내기를 지원하지 않습니다. Chrome이나 Safari 16.4+를 쓰세요.</p>
      )}
      {error && <p className="warn">{error}</p>}

      <button onClick={handleExport} disabled={!media || busy}>
        {busy
          ? isVideo && preset.allowsVideo
            ? `인코딩 ${Math.round(progress * 100)}%`
            : "내보내는 중…"
          : isVideo && preset.allowsVideo
            ? "MP4 내보내기"
            : "JPG 내보내기"}
      </button>
    </div>
  );
}
