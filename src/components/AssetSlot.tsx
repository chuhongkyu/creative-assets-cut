"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { computeDrawRect, willUpscale, type FitMode, type Focus } from "@/lib/crop";
import { renderImage, download } from "@/lib/exportImage";
import { renderVideo, isVideoExportSupported } from "@/lib/exportVideo";
import { ratioLabel, type Preset } from "@/lib/presets";

interface Loaded {
  element: HTMLImageElement | HTMLVideoElement;
  isVideo: boolean;
  width: number;
  height: number;
  duration: number;
  name: string;
}

/**
 * 규격 하나를 통째로 담당한다. 업로드·미리보기·설정·내보내기가 한 덩어리다.
 *
 * 규격마다 쓰고 싶은 소재가 다르기 때문에(헤더는 분위기, 검색은 한눈에 알아볼 장면)
 * 하나의 원본을 셋으로 나누는 대신 자리마다 따로 올리게 했다.
 */
export default function AssetSlot({ preset }: { preset: Preset }) {
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [over, setOver] = useState(false);
  const [mode, setMode] = useState<FitMode>("cover");
  const [focus, setFocus] = useState<Focus>("center");
  const [start, setStart] = useState(0);
  const [duration, setDuration] = useState(8);
  const [fps, setFps] = useState(30);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const accept = useCallback(async (file: File) => {
    setError(null);
    const url = URL.createObjectURL(file);
    const name = file.name.replace(/\.[^.]+$/, "");

    if (file.type.startsWith("video/")) {
      const video = document.createElement("video");
      video.src = url;
      video.muted = true;
      video.playsInline = true;

      await new Promise<void>((resolve) => {
        video.addEventListener("loadeddata", () => resolve(), { once: true });
      });
      // 첫 프레임이 그려져야 미리보기가 검은 화면으로 나오지 않는다.
      video.currentTime = 0.1;
      await new Promise<void>((resolve) => {
        video.addEventListener("seeked", () => resolve(), { once: true });
      });

      setLoaded({
        element: video,
        isVideo: true,
        width: video.videoWidth,
        height: video.videoHeight,
        duration: video.duration,
        name,
      });
      setDuration(Math.min(8, Math.max(1, Math.floor(video.duration))));
      return;
    }

    const image = new Image();
    image.src = url;
    await image.decode();
    setLoaded({ element: image, isVideo: false, width: image.width, height: image.height, duration: 0, name });
  }, []);

  // 미리보기는 실제 규격의 축소판이다. 내보내기와 같은 계산을 써서 결과가 어긋나지 않는다.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !loaded) return;

    const scale = 560 / preset.width;
    canvas.width = Math.round(preset.width * scale);
    canvas.height = Math.round(preset.height * scale);

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const size = { width: loaded.width, height: loaded.height };
    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    if (mode === "contain") {
      const fill = computeDrawRect(size, canvas.width, canvas.height, "cover", "center");
      ctx.filter = "blur(10px)";
      ctx.drawImage(loaded.element, fill.sx, fill.sy, fill.sw, fill.sh, -10, -10, canvas.width + 20, canvas.height + 20);
      ctx.filter = "none";
    }

    const r = computeDrawRect(size, canvas.width, canvas.height, mode, focus);
    ctx.drawImage(loaded.element, r.sx, r.sy, r.sw, r.sh, r.dx, r.dy, r.dw, r.dh);
  }, [loaded, mode, focus, preset.width, preset.height, start]);

  async function handleExport() {
    if (!loaded) return;
    setError(null);
    setBusy(true);
    setProgress(0);

    try {
      const base = `${loaded.name}_${preset.id}_${preset.width}x${preset.height}`;

      if (loaded.isVideo) {
        const blob = await renderVideo(loaded.element as HTMLVideoElement, preset.width, preset.height, {
          startSeconds: start,
          durationSeconds: duration,
          fps,
          mode,
          focus,
          onProgress: setProgress,
        });
        download(blob, `${base}.mp4`);
      } else {
        const size = { width: loaded.width, height: loaded.height };
        const blob = await renderImage(loaded.element, size, preset.width, preset.height, mode, focus);
        download(blob, `${base}.jpg`);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  const upscales = loaded && willUpscale({ width: loaded.width, height: loaded.height }, preset.width, preset.height);
  const aspect = `${preset.width} / ${preset.height}`;

  return (
    <section className="slot">
      <div className="slot-head">
        <h2>{preset.label}</h2>
        <p className="slot-meta">
          <b>
            {preset.width} × {preset.height}
          </b>
          <span>{ratioLabel(preset.width, preset.height)}</span>
        </p>
        <p className="slot-note">{preset.note}</p>
      </div>

      <div
        className={over ? "frame over" : "frame"}
        style={{ aspectRatio: aspect }}
        onClick={() => !loaded && inputRef.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          setOver(true);
        }}
        onDragLeave={() => setOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setOver(false);
          const file = e.dataTransfer.files[0];
          if (file) void accept(file);
        }}
      >
        {loaded ? (
          <canvas ref={canvasRef} className="frame-canvas" />
        ) : (
          <div className="frame-empty">
            <strong>여기에 끌어다 놓기</strong>
            <span>mp4 · mov · png · jpg</span>
          </div>
        )}
        <input
          ref={inputRef}
          type="file"
          accept="video/mp4,video/quicktime,image/png,image/jpeg"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) void accept(file);
          }}
        />
      </div>

      {loaded && (
        <div className="slot-body">
          <p className="slot-source">
            <b>{loaded.name}</b>
            <span>
              {loaded.width} × {loaded.height}
            </span>
            {loaded.isVideo && <span>{loaded.duration.toFixed(1)}초</span>}
            <button className="link" onClick={() => inputRef.current?.click()}>
              바꾸기
            </button>
          </p>

          <div className="controls">
            <label>
              맞춤
              <select value={mode} onChange={(e) => setMode(e.target.value as FitMode)}>
                <option value="cover">잘라서 채우기</option>
                <option value="contain">전체 담기</option>
              </select>
            </label>

            {mode === "cover" && (
              <label>
                세로 기준
                <select value={focus} onChange={(e) => setFocus(e.target.value as Focus)}>
                  <option value="center">가운데</option>
                  <option value="top">위쪽</option>
                  <option value="bottom">아래쪽</option>
                </select>
              </label>
            )}

            {loaded.isVideo && (
              <>
                <label>
                  시작(초)
                  <input
                    type="number"
                    min={0}
                    max={Math.max(0, loaded.duration - 1)}
                    step={0.5}
                    value={start}
                    onChange={(e) => setStart(Number(e.target.value))}
                  />
                </label>
                <label>
                  길이(초)
                  <input
                    type="number"
                    min={1}
                    max={30}
                    value={duration}
                    onChange={(e) => setDuration(Number(e.target.value))}
                  />
                </label>
                <label>
                  fps
                  <select value={fps} onChange={(e) => setFps(Number(e.target.value))}>
                    <option value={24}>24</option>
                    <option value={30}>30</option>
                  </select>
                </label>
              </>
            )}
          </div>

          {upscales && (
            <p className="warn">
              원본({loaded.width}×{loaded.height})이 규격보다 작아 확대됩니다. 흐려집니다.
            </p>
          )}
          {loaded.isVideo && !isVideoExportSupported() && (
            <p className="warn">이 브라우저는 영상 내보내기를 지원하지 않습니다. Chrome이나 Safari 16.4+를 쓰세요.</p>
          )}
          {error && <p className="warn">{error}</p>}

          <button onClick={handleExport} disabled={busy}>
            {busy
              ? loaded.isVideo
                ? `인코딩 ${Math.round(progress * 100)}%`
                : "내보내는 중…"
              : loaded.isVideo
                ? "MP4 내보내기"
                : "JPG 내보내기"}
          </button>
        </div>
      )}
    </section>
  );
}
