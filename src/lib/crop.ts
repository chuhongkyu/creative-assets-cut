/** 잘라내기 계산. 이미지와 영상이 같은 규칙을 쓴다. */

export type FitMode = "cover" | "contain";
export type Focus = "top" | "center" | "bottom";

export interface SourceSize {
  width: number;
  height: number;
}

export interface DrawRect {
  /** 원본에서 가져올 영역 */
  sx: number;
  sy: number;
  sw: number;
  sh: number;
  /** 캔버스에 그릴 위치 */
  dx: number;
  dy: number;
  dw: number;
  dh: number;
}

/**
 * 원본을 목표 크기에 어떻게 올릴지 계산한다.
 *
 * cover   목표 비율에 맞춰 잘라내고 꽉 채운다. 여백이 없는 대신 가장자리가 잘린다.
 * contain 원본을 통째로 담는다. 잘리지 않는 대신 여백이 생긴다.
 */
export function computeDrawRect(
  source: SourceSize,
  targetWidth: number,
  targetHeight: number,
  mode: FitMode,
  focus: Focus
): DrawRect {
  const targetRatio = targetWidth / targetHeight;
  const sourceRatio = source.width / source.height;

  if (mode === "contain") {
    const scale = Math.min(targetWidth / source.width, targetHeight / source.height);
    const dw = Math.round(source.width * scale);
    const dh = Math.round(source.height * scale);

    return {
      sx: 0,
      sy: 0,
      sw: source.width,
      sh: source.height,
      dx: Math.round((targetWidth - dw) / 2),
      dy: Math.round((targetHeight - dh) / 2),
      dw,
      dh,
    };
  }

  // cover — 목표 비율에 맞는 가장 큰 사각형을 원본에서 떼어낸다.
  let sw = source.width;
  let sh = source.height;
  let sx = 0;
  let sy = 0;

  if (sourceRatio > targetRatio) {
    // 원본이 더 넓다 → 좌우를 자른다. 가로는 가운데가 자연스럽다.
    sw = Math.round(source.height * targetRatio);
    sx = Math.round((source.width - sw) / 2);
  } else {
    // 원본이 더 높다 → 위아래를 자른다. 어디를 남길지는 focus가 정한다.
    sh = Math.round(source.width / targetRatio);
    if (focus === "top") sy = 0;
    else if (focus === "bottom") sy = source.height - sh;
    else sy = Math.round((source.height - sh) / 2);
  }

  return { sx, sy, sw, sh, dx: 0, dy: 0, dw: targetWidth, dh: targetHeight };
}

/** 원본이 목표보다 작아 확대되는지. 확대되면 흐려지므로 미리 알려준다. */
export function willUpscale(source: SourceSize, targetWidth: number, targetHeight: number) {
  return source.width < targetWidth || source.height < targetHeight;
}
