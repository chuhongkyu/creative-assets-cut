"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { seek, type Clip } from "@/lib/clips";
import {
  clampTransform,
  computePlacement,
  coverScale,
  MAX_ZOOM,
  MIN_ZOOM,
  type Transform,
} from "@/lib/transform";
import type { Preset } from "@/lib/presets";

const VIEWPORT_WIDTH = 760;
const VIEWPORT_HEIGHT = 460;

/**
 * 끌어서 위치를 잡는 크롭 창.
 *
 * 규격 틀은 가운데 고정이고 원본이 그 아래에서 움직인다.
 * 틀 밖도 흐리게 보여줘서, 지금 무엇이 잘려 나가는지 눈으로 확인하면서 맞출 수 있다.
 */
export default function CropEditor({
  clip,
  preset,
  onChange,
  onClose,
}: {
  clip: Clip;
  preset: Preset;
  onChange: (transform: Transform) => void;
  onClose: () => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const dragRef = useRef<{ x: number; y: number; start: Transform } | null>(null);
  const [transform, setTransform] = useState<Transform>(clip.transform);
  const [time, setTime] = useState(clip.start);

  // 틀을 뷰포트 안에 최대한 크게, 비율은 그대로.
  const frameScale = Math.min(VIEWPORT_WIDTH * 0.68 / preset.width, VIEWPORT_HEIGHT * 0.72 / preset.height);
  const frameW = preset.width * frameScale;
  const frameH = preset.height * frameScale;
  const frameLeft = (VIEWPORT_WIDTH - frameW) / 2;
  const frameTop = (VIEWPORT_HEIGHT - frameH) / 2;

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.clearRect(0, 0, VIEWPORT_WIDTH, VIEWPORT_HEIGHT);

    // 규격 좌표로 계산한 뒤 화면 배율만 곱한다. 내보내기와 같은 수식을 쓴다.
    const size = { width: clip.width, height: clip.height };
    const p = computePlacement(size, preset.width, preset.height, transform);

    ctx.drawImage(
      clip.element,
      frameLeft + p.dx * frameScale,
      frameTop + p.dy * frameScale,
      p.dw * frameScale,
      p.dh * frameScale
    );
  }, [clip, preset.width, preset.height, transform, frameScale, frameLeft, frameTop]);

  useEffect(() => {
    draw();
  }, [draw]);

  // 영상은 원하는 장면을 보면서 위치를 잡아야 한다.
  useEffect(() => {
    if (!clip.isVideo) return;
    let cancelled = false;
    void (async () => {
      await seek(clip.element as HTMLVideoElement, time);
      if (!cancelled) draw();
    })();
    return () => {
      cancelled = true;
    };
  }, [time, clip, draw]);

  function apply(next: Transform) {
    const clamped = clampTransform({ width: clip.width, height: clip.height }, preset.width, preset.height, next);
    setTransform(clamped);
  }

  function onPointerDown(e: React.PointerEvent) {
    e.currentTarget.setPointerCapture(e.pointerId);
    dragRef.current = { x: e.clientX, y: e.clientY, start: transform };
  }

  function onPointerMove(e: React.PointerEvent) {
    const drag = dragRef.current;
    if (!drag) return;

    // 화면에서 끈 거리를 원본 픽셀로 되돌린다.
    const scale = coverScale({ width: clip.width, height: clip.height }, preset.width, preset.height)
      * drag.start.zoom * frameScale;

    apply({
      zoom: drag.start.zoom,
      offsetX: drag.start.offsetX + (e.clientX - drag.x) / scale,
      offsetY: drag.start.offsetY + (e.clientY - drag.y) / scale,
    });
  }

  function onPointerUp(e: React.PointerEvent) {
    e.currentTarget.releasePointerCapture(e.pointerId);
    dragRef.current = null;
  }

  function finish() {
    onChange(transform);
    onClose();
  }

  // Esc로 닫는다. 전체 화면을 덮는 창이라 빠져나갈 길이 분명해야 한다.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="modal" onClick={onClose}>
      <div className="modal-panel" onClick={(e) => e.stopPropagation()}>
        <header className="modal-head">
          <div>
            <h3>{preset.label}</h3>
            <p>
              {preset.width} × {preset.height} · {clip.name}
            </p>
          </div>
          <button className="icon" onClick={onClose}>
            ✕
          </button>
        </header>

        <div
          className="stage"
          style={{ width: VIEWPORT_WIDTH, height: VIEWPORT_HEIGHT }}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
        >
          <canvas ref={canvasRef} width={VIEWPORT_WIDTH} height={VIEWPORT_HEIGHT} />
          {/* 틀 바깥을 덮는 그늘. 잘려 나갈 부분이 어디인지 보인다. */}
          <div
            className="frame-mask"
            style={{ left: frameLeft, top: frameTop, width: frameW, height: frameH }}
          />
        </div>

        <p className="hint">끌어서 위치를 잡으세요. 어두운 바깥쪽은 잘려 나갑니다.</p>

        <div className="modal-controls">
          <label>
            크기
            <input
              type="range"
              min={MIN_ZOOM}
              max={MAX_ZOOM}
              step={0.01}
              value={transform.zoom}
              onChange={(e) => apply({ ...transform, zoom: Number(e.target.value) })}
            />
            <span className="num">{transform.zoom.toFixed(2)}×</span>
          </label>

          {clip.isVideo && (
            <label>
              장면
              <input
                type="range"
                min={0}
                max={Math.max(0.1, clip.sourceDuration)}
                step={0.1}
                value={time}
                onChange={(e) => setTime(Number(e.target.value))}
              />
              <span className="num">{time.toFixed(1)}초</span>
            </label>
          )}
        </div>

        <div className="modal-actions">
          <button className="ghost" onClick={() => apply({ zoom: 1, offsetX: 0, offsetY: 0 })}>
            처음으로
          </button>
          <button onClick={finish}>적용</button>
        </div>
      </div>
    </div>
  );
}
