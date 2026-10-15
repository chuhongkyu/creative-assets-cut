import { paint } from "./transform";
import { drawOverlays, type Overlay } from "./overlays";
import { drawFade } from "./transitions";
import { type Clip } from "./clips";

/** 타임라인 위의 한 지점이 어느 조각의 어느 시각인지. */
export interface Position {
  index: number;
  clip: Clip;
  localTime: number;
}

export function locate(clips: Clip[], time: number): Position | null {
  let acc = 0;
  for (let i = 0; i < clips.length; i++) {
    const clip = clips[i];
    if (time < acc + clip.length || i === clips.length - 1) {
      return { index: i, clip, localTime: Math.max(0, Math.min(clip.length, time - acc)) };
    }
    acc += clip.length;
  }
  return null;
}

export function startOf(clips: Clip[], index: number) {
  return clips.slice(0, index).reduce((sum, c) => sum + c.length, 0);
}

/** 조각 하나와 그 위의 오버레이를 캔버스에 그린다. 미리보기·편집·내보내기가 같은 경로를 쓴다. */
export function drawClip(
  canvas: HTMLCanvasElement,
  clip: Clip,
  overlays: Overlay[] = [],
  time = 0,
  total = 0,
  blur = 12,
  /** 전환으로 덮을 검정의 진하기. 0이면 덮지 않는다. */
  dim = 0
) {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  paint(
    ctx,
    clip.element,
    { width: clip.width, height: clip.height },
    canvas.width,
    canvas.height,
    clip.transform,
    blur
  );

  drawOverlays(ctx, overlays, canvas.width, canvas.height, time, total);

  // 전환은 맨 위에 올린다. 장면이 어두워지는데 그 위의 글자만 밝게 남으면 어색하다.
  drawFade(ctx, canvas.width, canvas.height, dim);
}
