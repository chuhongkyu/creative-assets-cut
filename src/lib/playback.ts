import { paint } from "./transform";
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

/** 조각 하나를 캔버스에 그린다. 미리보기·편집·내보내기가 모두 같은 paint를 통과한다. */
export function drawClip(canvas: HTMLCanvasElement, clip: Clip, blur = 12) {
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
}
