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
  };
}

export function isVisibleAt(overlay: Overlay, time: number) {
  if (time < overlay.start) return false;

  return overlay.end === null || time <= overlay.end;
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
  time: number
) {
  for (const overlay of overlays) {
    if (!isVisibleAt(overlay, time)) continue;

    ctx.save();
    ctx.globalAlpha = overlay.opacity;

    const cx = overlay.x * targetWidth;
    const cy = overlay.y * targetHeight;

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
