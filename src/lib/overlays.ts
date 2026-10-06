/**
 * 영상 위에 얹는 글자와 이미지.
 *
 * 조각이 아니라 규격 단위로 둔다. 로고나 제목은 보통 한 장면이 아니라
 * 소재 전체에 걸쳐 있기 때문이다. 특정 구간에만 띄우고 싶으면 start/end를 좁히면 된다.
 *
 * 위치와 크기는 규격 대비 비율(0~1)로 저장한다. 미리보기는 작고 결과물은 크지만
 * 같은 값으로 양쪽을 그릴 수 있어야 보이는 대로 나온다.
 */
export type OverlayKind = "text" | "image";

/** 등장·퇴장 움직임. */
export type MotionKind = "none" | "fade" | "rise" | "drop" | "scale";

export const MOTION_LABEL: Record<MotionKind, string> = {
  none: "없음",
  fade: "서서히",
  rise: "아래서 위로",
  drop: "위에서 아래로",
  scale: "커지며",
};

export interface Overlay {
  id: string;
  kind: OverlayKind;
  /** 글자 내용. kind가 text일 때만 쓴다. */
  text: string;
  /** 이미지 소재. kind가 image일 때만 쓴다. */
  element: HTMLImageElement | null;
  name: string;
  /** 규격 기준 중심 위치. 0.5, 0.5면 한가운데. */
  x: number;
  y: number;
  /** 글자는 규격 높이 대비 글자 크기, 이미지는 규격 너비 대비 가로 폭. */
  size: number;
  color: string;
  /** 보이는 구간(초). end가 null이면 끝까지. */
  start: number;
  end: number | null;
  opacity: number;
  /** 들어올 때와 나갈 때의 움직임. */
  enter: MotionKind;
  exit: MotionKind;
  /** 움직임 한 번에 걸리는 시간(초). 들어올 때와 나갈 때 모두 같은 값을 쓴다. */
  motionSeconds: number;
}

export const TEXT_DEFAULT_SIZE = 0.12;
export const IMAGE_DEFAULT_SIZE = 0.28;

function makeId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function createTextOverlay(text = "텍스트"): Overlay {
  return {
    id: makeId(),
    kind: "text",
    text,
    element: null,
    name: text,
    x: 0.5,
    y: 0.5,
    size: TEXT_DEFAULT_SIZE,
    color: "#ffffff",
    start: 0,
    end: null,
    opacity: 1,
    enter: "fade",
    exit: "fade",
    motionSeconds: 0.5,
  };
}

export async function createImageOverlay(file: File): Promise<Overlay> {
  const image = new Image();
  image.src = URL.createObjectURL(file);
  await image.decode();

  return {
    id: makeId(),
    kind: "image",
    text: "",
    element: image,
    name: file.name.replace(/\.[^.]+$/, ""),
    x: 0.5,
    y: 0.5,
    size: IMAGE_DEFAULT_SIZE,
    color: "#ffffff",
    start: 0,
    end: null,
    opacity: 1,
    enter: "fade",
    exit: "fade",
    motionSeconds: 0.5,
  };
}

export function isVisibleAt(overlay: Overlay, time: number) {
  if (time < overlay.start) return false;

  return overlay.end === null || time <= overlay.end;
}

/** 들어올 때는 끝에서 느려지고, 나갈 때는 처음이 느리다. 선형이면 뚝뚝 끊겨 보인다. */
function easeOut(t: number) {
  return 1 - Math.pow(1 - t, 3);
}

interface MotionState {
  alpha: number;
  dy: number;
  scale: number;
}

/**
 * 그 시각에 오버레이가 어떤 상태인지.
 *
 * progress 0이 화면 밖, 1이 제자리다. 들어올 때는 0에서 1로, 나갈 때는 1에서 0으로 간다.
 * 움직임 종류가 달라도 이 한 값으로 표현하면 등장과 퇴장을 같은 식으로 다룰 수 있다.
 */
function applyMotion(kind: MotionKind, progress: number, height: number, state: MotionState) {
  const eased = easeOut(Math.min(1, Math.max(0, progress)));

  if (kind === "none") return;

  // 어떤 움직임이든 투명도는 같이 간다. 위치만 움직이면 갑자기 튀어나온 것처럼 보인다.
  state.alpha *= eased;

  // 화면 밖에서 들어오는 거리. 규격 높이에 비례해야 어느 크기에서나 같은 느낌이 난다.
  const travel = height * 0.14;

  if (kind === "rise") state.dy += travel * (1 - eased);
  else if (kind === "drop") state.dy -= travel * (1 - eased);
  else if (kind === "scale") state.scale *= 0.82 + 0.18 * eased;
}

function motionAt(overlay: Overlay, time: number, total: number, height: number): MotionState {
  const state: MotionState = { alpha: overlay.opacity, dy: 0, scale: 1 };
  const span = Math.max(0.01, overlay.motionSeconds);
  const end = overlay.end ?? total;

  if (overlay.enter !== "none" && time < overlay.start + span) {
    applyMotion(overlay.enter, (time - overlay.start) / span, height, state);
  }

  if (overlay.exit !== "none" && time > end - span) {
    applyMotion(overlay.exit, (end - time) / span, height, state);
  }

  return state;
}

/**
 * 오버레이를 규격 좌표계에 그린다. 미리보기·편집 화면·내보내기가 모두 이 함수를 쓴다.
 *
 * 글자는 어떤 배경 위에 와도 읽혀야 해서 그림자를 깐다.
 * 광고 소재는 밝은 장면과 어두운 장면이 섞이기 마련이다.
 */
export function drawOverlays(
  ctx: CanvasRenderingContext2D,
  overlays: Overlay[],
  targetWidth: number,
  targetHeight: number,
  time: number,
  total: number
) {
  for (const overlay of overlays) {
    if (!isVisibleAt(overlay, time)) continue;

    const motion = motionAt(overlay, time, total, targetHeight);
    if (motion.alpha <= 0.001) continue;

    ctx.save();
    ctx.globalAlpha = Math.min(1, motion.alpha);

    const cx = overlay.x * targetWidth;
    const cy = overlay.y * targetHeight + motion.dy;

    // 커지는 움직임은 가운데를 기준으로 해야 제자리에서 자란다.
    if (motion.scale !== 1) {
      ctx.translate(cx, cy);
      ctx.scale(motion.scale, motion.scale);
      ctx.translate(-cx, -cy);
    }

    if (overlay.kind === "text") {
      const fontSize = overlay.size * targetHeight;
      ctx.font = `700 ${fontSize}px -apple-system, "Helvetica Neue", Arial, sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.shadowColor = "rgba(0,0,0,.55)";
      ctx.shadowBlur = fontSize * 0.22;
      ctx.shadowOffsetY = fontSize * 0.04;
      ctx.fillStyle = overlay.color;

      // 줄바꿈을 그대로 살린다. 제목은 두 줄로 쓰는 경우가 많다.
      const lines = overlay.text.split("\n");
      const lineHeight = fontSize * 1.18;
      const top = cy - ((lines.length - 1) * lineHeight) / 2;
      lines.forEach((line, i) => ctx.fillText(line, cx, top + i * lineHeight));
    } else if (overlay.element) {
      const width = overlay.size * targetWidth;
      const height = (overlay.element.height / overlay.element.width) * width;
      ctx.drawImage(overlay.element, cx - width / 2, cy - height / 2, width, height);
    }

    ctx.restore();
  }
}
