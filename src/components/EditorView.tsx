"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import Stage from "./Stage";
import Timeline from "./Timeline";
import OverlayPanel from "./OverlayPanel";
import { usePlayback } from "@/hooks/usePlayback";
import { createClip, totalLength, type Clip } from "@/lib/clips";
import { renderImage, download } from "@/lib/exportImage";
import { renderSequence, isVideoExportSupported } from "@/lib/exportVideo";
import { clampTransform, MAX_ZOOM, MIN_ZOOM, willUpscale, type Transform } from "@/lib/transform";
import { createImageOverlay, createTextOverlay, type Overlay } from "@/lib/overlays";
import { ratioLabel, type Preset } from "@/lib/presets";

const STAGE_WIDTH = 820;
const STAGE_HEIGHT = 440;

export default function EditorView({
  preset,
  clips,
  onClips,
  overlays,
  onOverlays,
  onBack,
}: {
  preset: Preset;
  clips: Clip[];
  onClips: (clips: Clip[]) => void;
  overlays: Overlay[];
  onOverlays: (overlays: Overlay[]) => void;
  onBack: () => void;
}) {
  const [selectedId, setSelectedId] = useState<string | null>(clips[0]?.id ?? null);
  const [selectedOverlayId, setSelectedOverlayId] = useState<string | null>(null);
  const [fps, setFps] = useState(30);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [over, setOver] = useState(false);

  const playbackRef = useRef<HTMLCanvasElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const { playing, time, total, muted, setMuted, toggle, seekTo } = usePlayback(clips, overlays, playbackRef);
  const overlayInputRef = useRef<HTMLInputElement>(null);

  const selected = useMemo(
    () => clips.find((c) => c.id === selectedId) ?? clips[0] ?? null,
    [clips, selectedId]
  );

  const addFiles = useCallback(
    async (files: FileList | File[]) => {
      setError(null);
      const list = Array.from(files).filter((f) => f.type.startsWith("video/") || f.type.startsWith("image/"));
      if (list.length === 0) {
        setError("영상이나 이미지만 올릴 수 있습니다.");
        return;
      }

      try {
        // 고른 순서를 그대로 유지하려고 하나씩 처리한다.
        const made: Clip[] = [];
        for (const file of list) made.push(await createClip(file));
        onClips([...clips, ...made]);
        if (!selectedId && made[0]) setSelectedId(made[0].id);
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      }
    },
    [clips, onClips, selectedId]
  );

  function patch(id: string, next: Partial<Clip>) {
    onClips(clips.map((c) => (c.id === id ? { ...c, ...next } : c)));
  }

  function setTransform(transform: Transform) {
    if (selected) patch(selected.id, { transform });
  }

  function patchOverlay(id: string, next: Partial<Overlay>) {
    onOverlays(overlays.map((o) => (o.id === id ? { ...o, ...next } : o)));
  }

  function addText() {
    const overlay = createTextOverlay();
    onOverlays([...overlays, overlay]);
    setSelectedOverlayId(overlay.id);
  }

  async function addImages(files: FileList) {
    try {
      const made: Overlay[] = [];
      for (const file of Array.from(files)) {
        if (file.type.startsWith("image/")) made.push(await createImageOverlay(file));
      }
      if (made.length === 0) return;
      onOverlays([...overlays, ...made]);
      setSelectedOverlayId(made[made.length - 1].id);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
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
          clip.transform,
          overlays
        );
        download(blob, `${base}.jpg`);
      } else {
        const blob = await renderSequence(clips, preset.width, preset.height, {
          fps,
          overlays,
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

  const stillOnly = clips.length === 1 && !clips[0].isVideo;
  const upscaling = clips.filter((c) =>
    willUpscale({ width: c.width, height: c.height }, preset.width, preset.height, c.transform)
  );

  return (
    <div
      className="editor"
      onDragEnter={(e) => {
        e.preventDefault();
        setOver(true);
      }}
      onDragOver={(e) => {
        // 이걸 막지 않으면 브라우저가 파일을 그냥 열어버리고 드롭이 오지 않는다.
        e.preventDefault();
        e.dataTransfer.dropEffect = "copy";
        setOver(true);
      }}
      onDragLeave={(e) => {
        if (e.currentTarget.contains(e.relatedTarget as Node)) return;
        setOver(false);
      }}
      onDrop={(e) => {
        e.preventDefault();
        setOver(false);
        if (e.dataTransfer.files.length > 0) void addFiles(e.dataTransfer.files);
      }}
    >
      <header className="editor-head">
        <button className="ghost" onClick={onBack}>
          ← 규격 목록
        </button>
        <div>
          <h2>{preset.label}</h2>
          <p>
            {preset.width} × {preset.height} · {ratioLabel(preset.width, preset.height)}
          </p>
        </div>
        <button onClick={() => inputRef.current?.click()}>소재 추가</button>
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
      </header>

      <div className={over ? "editor-stage over" : "editor-stage"}>
        <Stage
          clip={selected}
          preset={preset}
          width={STAGE_WIDTH}
          height={STAGE_HEIGHT}
          onTransform={setTransform}
          playbackRef={playbackRef}
          playing={playing}
          overlays={overlays}
          selectedOverlayId={selectedOverlayId}
          onOverlayMove={(id, x, y) => patchOverlay(id, { x, y })}
        />
      </div>

      {selected && (
        <div className="stage-tools">
          <span className="tool-label">{playing ? "재생 중" : `선택: ${selected.name}`}</span>
          <label>
            크기
            <input
              type="range"
              min={MIN_ZOOM}
              max={MAX_ZOOM}
              step={0.01}
              value={selected.transform.zoom}
              onChange={(e) =>
                setTransform(
                  clampTransform({ width: selected.width, height: selected.height }, preset.width, preset.height, {
                    ...selected.transform,
                    zoom: Number(e.target.value),
                  })
                )
              }
            />
            <span className="num">{selected.transform.zoom.toFixed(2)}×</span>
          </label>
          <button
            className="ghost"
            onClick={() => setTransform({ zoom: 1, offsetX: 0, offsetY: 0 })}
          >
            위치 초기화
          </button>
        </div>
      )}

      {clips.length > 0 && (
        <>
          <div className="transport">
            <button className="play" onClick={toggle} disabled={total <= 0}>
              {playing ? "❚❚" : "▶"}
            </button>
            <input
              type="range"
              min={0}
              max={Math.max(0.1, total)}
              step={0.05}
              value={time}
              onChange={(e) => seekTo(Number(e.target.value))}
            />
            <span className="num">
              {time.toFixed(1)} / {total.toFixed(1)}초
            </span>
            <button
              className="ghost mute"
              onClick={() => setMuted(!muted)}
              title={muted ? "소리 켜기" : "소리 끄기"}
            >
              {muted ? "🔇" : "🔊"}
            </button>
          </div>

          <Timeline
            clips={clips}
            selectedId={selected?.id ?? null}
            time={time}
            onSelect={setSelectedId}
            onReorder={onClips}
            onPatch={patch}
            onRemove={(id) => onClips(clips.filter((c) => c.id !== id))}
            onSeek={seekTo}
          />

          <OverlayPanel
            overlays={overlays}
            selectedId={selectedOverlayId}
            onSelect={setSelectedOverlayId}
            onPatch={patchOverlay}
            onRemove={(id) => {
              onOverlays(overlays.filter((o) => o.id !== id));
              if (selectedOverlayId === id) setSelectedOverlayId(null);
            }}
            onAddText={addText}
            onAddImage={() => overlayInputRef.current?.click()}
            total={total}
          />
          <input
            ref={overlayInputRef}
            type="file"
            multiple
            accept="image/png,image/jpeg"
            style={{ display: "none" }}
            onChange={(e) => {
              if (e.target.files?.length) void addImages(e.target.files);
              e.target.value = "";
            }}
          />

          {selected?.isVideo && (
            <div className="controls">
              <label>
                이 조각의 시작 지점
                <input
                  type="number"
                  min={0}
                  max={Math.max(0, selected.sourceDuration - 0.5)}
                  step={0.5}
                  value={selected.start}
                  onChange={(e) => {
                    // 시작을 뒤로 밀면 남은 원본보다 길어질 수 있다. 길이를 같이 줄인다.
                    const start = Number(e.target.value);
                    const room = Math.max(0.5, selected.sourceDuration - start);
                    patch(selected.id, { start, length: Math.min(selected.length, room) });
                  }}
                />
                <span className="num">원본 {selected.sourceDuration.toFixed(1)}초</span>
              </label>
            </div>
          )}

          <div className="editor-foot">
            {!stillOnly && (
              <label>
                fps
                <select value={fps} onChange={(e) => setFps(Number(e.target.value))}>
                  <option value={24}>24</option>
                  <option value={30}>30</option>
                </select>
              </label>
            )}
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
        </>
      )}

      {upscaling.length > 0 && (
        <p className="warn">
          {upscaling.map((c) => c.name).join(", ")} 이(가) 규격보다 작아 확대됩니다. 흐려집니다.
        </p>
      )}
      {!stillOnly && clips.length > 0 && !isVideoExportSupported() && (
        <p className="warn">이 브라우저는 영상 내보내기를 지원하지 않습니다. Chrome이나 Safari 16.4+를 쓰세요.</p>
      )}
      {error && <p className="warn">{error}</p>}
    </div>
  );
}
