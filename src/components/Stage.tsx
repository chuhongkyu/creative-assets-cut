"use client";

import { useCallback, useEffect, useRef } from "react";
import { clampTransform, computePlacement, coverScale, type Transform } from "@/lib/transform";
import type { Clip } from "@/lib/clips";
import type { Preset } from "@/lib/presets";

/**
 * 규격 틀 안에서 끌어 위치를 잡는 화면.
 *
 * 틀은 가운데 고정이고 원본이 그 아래에서 움직인다. 틀 밖도 그려서
 * 지금 무엇이 잘려 나가는지 보면서 맞출 수 있게 했다.
 */
export default function Stage({
  clip,
  preset,
  width,
  height,
  onTransform,
  playbackRef,
  playing,
}: {
  clip: Clip | null;
  preset: Preset;
  width: number;
  height: number;
  onTransform: (transform: Transform) => void;
  /** 재생 중에는 틀 안쪽만 그린다. 그 캔버스를 바깥에서 넘겨받는다. */
  playbackRef: React.RefObject<HTMLCanvasElement>;
  playing: boolean;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const dragRef = useRef<{ x: number; y: number; start: Transform } | null>(null);

  const frameScale = Math.min((width * 0.74) / preset.width, (height * 0.78) / preset.height);
  const frameW = preset.width * frameScale;
  const frameH = preset.height * frameScale;
  const frameLeft = (width - frameW) / 2;
  const frameTop = (height - frameH) / 2;

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.clearRect(0, 0, width, height);
    if (!clip) return;

    // 규격 좌표로 계산한 뒤 화면 배율만 곱한다. 내보내기와 같은 수식이다.
    const p = computePlacement({ width: clip.width, height: clip.height }, preset.width, preset.height, clip.transform);

    ctx.drawImage(
      clip.element,
      frameLeft + p.dx * frameScale,
      frameTop + p.dy * frameScale,
      p.dw * frameScale,
      p.dh * frameScale
    );
  }, [clip, preset.width, preset.height, frameScale, frameLeft, frameTop, width, height]);

  useEffect(() => {
    if (!playing) draw();
  });

  // 재생용 캔버스는 틀과 같은 크기여야 결과물과 같은 그림이 나온다.
  useEffect(() => {
    const canvas = playbackRef.current;
    if (!canvas) return;
    canvas.width = Math.round(frameW);
    canvas.height = Math.round(frameH);
  }, [playbackRef, frameW, frameH]);

  function onPointerDown(e: React.PointerEvent) {
    if (!clip) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    dragRef.current = { x: e.clientX, y: e.clientY, start: clip.transform };
  }

  function onPointerMove(e: React.PointerEvent) {
    const drag = dragRef.current;
    if (!drag || !clip) return;

    // 화면에서 끈 거리를 원본 픽셀로 되돌린다.
    const scale =
      coverScale({ width: clip.width, height: clip.height }, preset.width, preset.height) *
      drag.start.zoom *
      frameScale;

    onTransform(
      clampTransform({ width: clip.width, height: clip.height }, preset.width, preset.height, {
        zoom: drag.start.zoom,
        offsetX: drag.start.offsetX + (e.clientX - drag.x) / scale,
        offsetY: drag.start.offsetY + (e.clientY - drag.y) / scale,
      })
    );
  }

  function onPointerUp(e: React.PointerEvent) {
    e.currentTarget.releasePointerCapture(e.pointerId);
    dragRef.current = null;
  }

  return (
    <div
      className={`stage${clip ? "" : " empty"}${playing ? " playing" : ""}`}
      style={{ width, height }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
    >
      <canvas ref={canvasRef} width={width} height={height} className="stage-canvas" />

      <canvas
        ref={playbackRef}
        className="play-canvas"
        style={{ left: frameLeft, top: frameTop, width: frameW, height: frameH }}
      />

      <div className="frame-mask" style={{ left: frameLeft, top: frameTop, width: frameW, height: frameH }} />
      {!clip && <p className="stage-hint">소재를 올리면 여기에 나옵니다</p>}
    </div>
  );
}
