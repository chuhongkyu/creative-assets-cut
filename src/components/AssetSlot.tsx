"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { computeDrawRect, willUpscale, type FitMode, type Focus } from "@/lib/crop";
import { renderImage, download } from "@/lib/exportImage";
import { renderSequence, isVideoExportSupported } from "@/lib/exportVideo";
import { createClip, totalLength, type Clip } from "@/lib/clips";
import { ratioLabel, type Preset } from "@/lib/presets";

/**
 * 규격 하나를 통째로 담당한다. 업로드·순서·미리보기·내보내기가 한 덩어리다.
 *
 * 규격마다 쓰고 싶은 소재가 다르기 때문에(헤더는 분위기, 검색은 한눈에 알아볼 장면)
 * 하나의 원본을 셋으로 나누는 대신 자리마다 따로 올리게 했다.
 *
 * 조각을 여러 개 올리면 순서대로 이어 붙여 하나의 mp4가 된다. 이미지와 영상을 섞을 수 있다.
 */
export default function AssetSlot({ preset }: { preset: Preset }) {
  const [clips, setClips] = useState<Clip[]>([]);
  const [active, setActive] = useState(0);
  const [over, setOver] = useState(false);
  const [mode, setMode] = useState<FitMode>("cover");
  const [focus, setFocus] = useState<Focus>("center");
  const [fps, setFps] = useState(30);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const addFiles = useCallback(async (files: FileList | File[]) => {
    setError(null);
    const list = Array.from(files).filter(
      (f) => f.type.startsWith("video/") || f.type.startsWith("image/")
    );
    if (list.length === 0) {
      setError("영상이나 이미지만 올릴 수 있습니다.");
      return;
    }

    try {
      // 고른 순서를 그대로 유지하려고 하나씩 처리한다.
      const made: Clip[] = [];
      for (const file of list) made.push(await createClip(file));
      setClips((prev) => [...prev, ...made]);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }, []);

  const current = clips[Math.min(active, clips.length - 1)] ?? null;

  // 미리보기는 실제 규격의 축소판이다. 내보내기와 같은 계산을 써서 결과가 어긋나지 않는다.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !current) return;

    const scale = 560 / preset.width;
    canvas.width = Math.round(preset.width * scale);
    canvas.height = Math.round(preset.height * scale);

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const size = { width: current.width, height: current.height };
    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    if (mode === "contain") {
      const fill = computeDrawRect(size, canvas.width, canvas.height, "cover", "center");
      ctx.filter = "blur(10px)";
      ctx.drawImage(current.element, fill.sx, fill.sy, fill.sw, fill.sh, -10, -10, canvas.width + 20, canvas.height + 20);
      ctx.filter = "none";
    }

    const r = computeDrawRect(size, canvas.width, canvas.height, mode, focus);
    ctx.drawImage(current.element, r.sx, r.sy, r.sw, r.sh, r.dx, r.dy, r.dw, r.dh);
  }, [current, mode, focus, preset.width, preset.height]);

  function update(id: string, patch: Partial<Clip>) {
    setClips((prev) => prev.map((c) => (c.id === id ? { ...c, ...patch } : c)));
  }

  function move(index: number, delta: number) {
    setClips((prev) => {
      const next = [...prev];
      const to = index + delta;
      if (to < 0 || to >= next.length) return prev;
      [next[index], next[to]] = [next[to], next[index]];
      return next;
    });
  }

  function remove(id: string) {
    setClips((prev) => prev.filter((c) => c.id !== id));
  }

  async function handleExport() {
    if (clips.length === 0) return;
    setError(null);
    setBusy(true);
    setProgress(0);

    try {
      const base = `${clips[0].name}_${preset.id}_${preset.width}x${preset.height}`;
      const stillOnly = clips.length === 1 && !clips[0].isVideo;

      if (stillOnly) {
        const clip = clips[0];
        const blob = await renderImage(
          clip.element,
          { width: clip.width, height: clip.height },
          preset.width,
          preset.height,
          mode,
          focus
        );
        download(blob, `${base}.jpg`);
      } else {
        const blob = await renderSequence(clips, preset.width, preset.height, {
          fps,
          mode,
          focus,
          onProgress: setProgress,
        });
        download(blob, `${base}.mp4`);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  const upscaling = clips.filter((c) => willUpscale({ width: c.width, height: c.height }, preset.width, preset.height));
  const stillOnly = clips.length === 1 && !clips[0].isVideo;
  const seconds = totalLength(clips);

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
        style={{ aspectRatio: `${preset.width} / ${preset.height}` }}
        onClick={() => clips.length === 0 && inputRef.current?.click()}
        onDragEnter={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setOver(true);
        }}
        onDragOver={(e) => {
          // 이걸 막지 않으면 브라우저가 파일을 그냥 열어버리고 드롭이 오지 않는다.
          e.preventDefault();
          e.stopPropagation();
          e.dataTransfer.dropEffect = "copy";
          setOver(true);
        }}
        onDragLeave={(e) => {
          // 자식 위로 지나갈 때도 leave가 오므로, 틀 밖으로 나간 경우만 끈다.
          if (e.currentTarget.contains(e.relatedTarget as Node)) return;
          setOver(false);
        }}
        onDrop={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setOver(false);
          if (e.dataTransfer.files.length > 0) void addFiles(e.dataTransfer.files);
        }}
      >
        {current ? (
          <canvas ref={canvasRef} className="frame-canvas" />
        ) : (
          <div className="frame-empty">
            <strong>여기에 끌어다 놓기</strong>
            <span>여러 개를 한 번에 올릴 수 있습니다</span>
            <span>mp4 · mov · png · jpg</span>
          </div>
        )}
        <input
          ref={inputRef}
          type="file"
          multiple
          accept="video/mp4,video/quicktime,image/png,image/jpeg"
          onChange={(e) => {
            if (e.target.files?.length) void addFiles(e.target.files);
            e.target.value = "";
          }}
        />
      </div>

      {clips.length > 0 && (
        <div className="slot-body">
          <p className="clip-summary">
            <b>{clips.length}개</b>
            <span>{stillOnly ? "이미지 한 장 → JPG" : `${seconds.toFixed(1)}초 → MP4`}</span>
            <button className="link" onClick={() => inputRef.current?.click()}>
              추가
            </button>
          </p>

          <ol className="clips">
            {clips.map((clip, index) => (
              <li
                key={clip.id}
                className={index === Math.min(active, clips.length - 1) ? "clip on" : "clip"}
                onClick={() => setActive(index)}
              >
                <span className="clip-index">{index + 1}</span>
                <span className="clip-kind">{clip.isVideo ? "영상" : "이미지"}</span>
                <span className="clip-name" title={clip.name}>
                  {clip.name}
                </span>

                {clip.isVideo && (
                  <label>
                    시작
                    <input
                      type="number"
                      min={0}
                      max={Math.max(0, clip.sourceDuration - 0.5)}
                      step={0.5}
                      value={clip.start}
                      onClick={(e) => e.stopPropagation()}
                      onChange={(e) => update(clip.id, { start: Number(e.target.value) })}
                    />
                  </label>
                )}

                <label>
                  길이
                  <input
                    type="number"
                    min={0.5}
                    max={30}
                    step={0.5}
                    value={clip.length}
                    onClick={(e) => e.stopPropagation()}
                    onChange={(e) => update(clip.id, { length: Number(e.target.value) })}
                  />
                </label>

                <span className="clip-actions">
                  <button className="icon" onClick={(e) => { e.stopPropagation(); move(index, -1); }} disabled={index === 0}>
                    ↑
                  </button>
                  <button
                    className="icon"
                    onClick={(e) => { e.stopPropagation(); move(index, 1); }}
                    disabled={index === clips.length - 1}
                  >
                    ↓
                  </button>
                  <button className="icon" onClick={(e) => { e.stopPropagation(); remove(clip.id); }}>
                    ✕
                  </button>
                </span>
              </li>
            ))}
          </ol>

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

            {!stillOnly && (
              <label>
                fps
                <select value={fps} onChange={(e) => setFps(Number(e.target.value))}>
                  <option value={24}>24</option>
                  <option value={30}>30</option>
                </select>
              </label>
            )}
          </div>

          {upscaling.length > 0 && (
            <p className="warn">
              {upscaling.map((c) => c.name).join(", ")} 이(가) 규격보다 작아 확대됩니다. 흐려집니다.
            </p>
          )}
          {!stillOnly && !isVideoExportSupported() && (
            <p className="warn">이 브라우저는 영상 내보내기를 지원하지 않습니다. Chrome이나 Safari 16.4+를 쓰세요.</p>
          )}
          {error && <p className="warn">{error}</p>}

          <button onClick={handleExport} disabled={busy}>
            {busy
              ? stillOnly
                ? "내보내는 중…"
                : `인코딩 ${Math.round(progress * 100)}%`
              : stillOnly
                ? "JPG 내보내기"
                : "MP4 내보내기"}
          </button>
        </div>
      )}
    </section>
  );
}
