"use client";

import { useCallback, useEffect, useRef } from "react";
import { clampTransform, computePlacement, coverScale, type Transform } from "@/lib/transform";
import { drawOverlays, isVisibleAt, type Overlay } from "@/lib/overlays";
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
  overlays,
  selectedOverlayId,
  onOverlayMove,
  time,
  total,
}: {
  clip: Clip | null;
  preset: Preset;
  width: number;
  height: number;
  onTransform: (transform: Transform) => void;
  /** 재생 중에는 틀 안쪽만 그린다. 그 캔버스를 바깥에서 넘겨받는다. */
  playbackRef: React.RefObject<HTMLCanvasElement>;
  playing: boolean;
  overlays: Overlay[];
  /** 고른 오버레이가 있으면 끌었을 때 조각 대신 그것이 움직인다. */
  selectedOverlayId: string | null;
  onOverlayMove: (id: string, x: number, y: number) => void;
  /** 재생 머리 위치. 그 시각에 보이는 오버레이만 그린다. */
  time: number;
  total: number;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const dragRef = useRef<{ x: number; y: number; start: Transform } | null>(null);
  const overlayDragRef = useRef<{ x: number; y: number; startX: number; startY: number } | null>(null);

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

    // 오버레이는 틀 안쪽에만 그린다. 결과물에 담기는 범위가 거기까지다.
    ctx.save();
    ctx.beginPath();
    ctx.rect(frameLeft, frameTop, frameW, frameH);
    ctx.clip();
    ctx.translate(frameLeft, frameTop);

    // 그 시각에 보이는 것만 그린다.
    // 다만 고른 것은 구간 밖이어도 보여준다. 안 보이면 위치를 잡을 수가 없다.
    drawOverlays(
      ctx,
      overlays.filter((o) => isVisibleAt(o, time) || o.id === selectedOverlayId),
      frameW,
      frameH,
      time,
      total
    );
    ctx.restore();
  }, [clip, preset.width, preset.height, frameScale, frameLeft, frameTop, frameW, frameH, width, height, overlays, selectedOverlayId, time, total]);

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
    // 오버레이를 고른 상태면 조각이 아니라 그것을 옮긴다.
    if (selectedOverlayId) {
      const overlay = overlays.find((o) => o.id === selectedOverlayId);
      if (overlay) {
        e.currentTarget.setPointerCapture(e.pointerId);
        overlayDragRef.current = { x: e.clientX, y: e.clientY, startX: overlay.x, startY: overlay.y };
        return;
      }
    }

    if (!clip) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    dragRef.current = { x: e.clientX, y: e.clientY, start: clip.transform };
  }

  function onPointerMove(e: React.PointerEvent) {
    const overlayDrag = overlayDragRef.current;
    if (overlayDrag && selectedOverlayId) {
      onOverlayMove(
        selectedOverlayId,
        Math.min(1, Math.max(0, overlayDrag.startX + (e.clientX - overlayDrag.x) / frameW)),
        Math.min(1, Math.max(0, overlayDrag.startY + (e.clientY - overlayDrag.y) / frameH))
      );
      return;
    }

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
    overlayDragRef.current = null;
  }

  return (
    <div
      className={`stage${clip ? "" : " empty"}${playing ? " playing" : ""}${selectedOverlayId ? " overlay-mode" : ""}`}
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
