/**
 * 원본을 규격 안 어디에 어떤 크기로 놓을지.
 *
 * 예전에는 위/가운데/아래 세 단계로만 고를 수 있었다. 게임 화면처럼 중요한 것이
 * 화면 한쪽에 몰려 있으면 세 단계로는 맞출 수가 없어서, 자유롭게 끌어 옮기도록 바꿨다.
 *
 * offset은 '원본 픽셀' 단위다. 미리보기와 내보내기의 배율이 달라도 같은 값을 쓸 수 있다.
 */
export interface Transform {
  /** 1이면 규격을 꼭 채운다. 1보다 작으면 규격보다 작게 들어가 여백이 생긴다. */
  zoom: number;
  offsetX: number;
  offsetY: number;
}

export interface Size {
  width: number;
  height: number;
}

export interface Placement {
  dx: number;
  dy: number;
  dw: number;
  dh: number;
}

export const DEFAULT_TRANSFORM: Transform = { zoom: 1, offsetX: 0, offsetY: 0 };

export const MIN_ZOOM = 0.4;
export const MAX_ZOOM = 3;

/** 규격을 빈틈없이 덮는 데 필요한 최소 배율. zoom 1의 기준이 된다. */
export function coverScale(source: Size, targetWidth: number, targetHeight: number) {
  return Math.max(targetWidth / source.width, targetHeight / source.height);
}

/** 규격 좌표계에서 원본을 어디에 얼마나 크게 그릴지. */
export function computePlacement(
  source: Size,
  targetWidth: number,
  targetHeight: number,
  transform: Transform
): Placement {
  const scale = coverScale(source, targetWidth, targetHeight) * transform.zoom;
  const dw = source.width * scale;
  const dh = source.height * scale;

  return {
    dw,
    dh,
    dx: (targetWidth - dw) / 2 + transform.offsetX * scale,
    dy: (targetHeight - dh) / 2 + transform.offsetY * scale,
  };
}

/**
 * 끌어 옮긴 결과가 규격 밖으로 너무 빠져나가지 않게 잡아둔다.
 *
 * 규격을 덮고 있는 동안에는 빈 가장자리가 생기지 않도록 가둔다.
 * 축소해서 규격보다 작아진 상태라면 가둘 이유가 없으므로 가운데로 고정한다.
 */
export function clampTransform(
  source: Size,
  targetWidth: number,
  targetHeight: number,
  transform: Transform
): Transform {
  const zoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, transform.zoom));
  const scale = coverScale(source, targetWidth, targetHeight) * zoom;
  const dw = source.width * scale;
  const dh = source.height * scale;

  const limitX = Math.max(0, (dw - targetWidth) / 2) / scale;
  const limitY = Math.max(0, (dh - targetHeight) / 2) / scale;

  return {
    zoom,
    offsetX: Math.min(limitX, Math.max(-limitX, transform.offsetX)),
    offsetY: Math.min(limitY, Math.max(-limitY, transform.offsetY)),
  };
}

/** 원본이 규격을 다 덮지 못하는지. 덮지 못하면 뒤에 흐린 배경을 깔아야 한다. */
export function hasGaps(source: Size, targetWidth: number, targetHeight: number, transform: Transform) {
  const p = computePlacement(source, targetWidth, targetHeight, transform);

  return p.dx > 0.5 || p.dy > 0.5 || p.dx + p.dw < targetWidth - 0.5 || p.dy + p.dh < targetHeight - 0.5;
}

/** 원본이 규격보다 작아 확대되는지. 확대되면 흐려지므로 미리 알려준다. */
export function willUpscale(source: Size, targetWidth: number, targetHeight: number, transform: Transform) {
  const scale = coverScale(source, targetWidth, targetHeight) * transform.zoom;

  return scale > 1.001;
}

/**
 * 규격 안에 원본을 그린다. 미리보기와 내보내기가 같은 함수를 쓴다.
 * 보이는 것과 나오는 것이 어긋나지 않게 하려는 것이다.
 */
export function paint(
  ctx: CanvasRenderingContext2D,
  media: CanvasImageSource,
  source: Size,
  targetWidth: number,
  targetHeight: number,
  transform: Transform,
  blurRadius = 24
) {
  ctx.clearRect(0, 0, targetWidth, targetHeight);
  ctx.fillStyle = "#000";
  ctx.fillRect(0, 0, targetWidth, targetHeight);

  // 덮지 못한 자리는 단색 띠 대신 원본을 흐리게 깔아 채운다.
  // 띠는 광고에서 눈에 거슬리고, 흐린 배경은 원본 색감을 이어받아 자연스럽다.
  if (hasGaps(source, targetWidth, targetHeight, transform)) {
    const cover = computePlacement(source, targetWidth, targetHeight, { zoom: 1, offsetX: 0, offsetY: 0 });
    ctx.save();
    ctx.filter = `blur(${blurRadius}px)`;
    ctx.drawImage(media, cover.dx - blurRadius, cover.dy - blurRadius, cover.dw + blurRadius * 2, cover.dh + blurRadius * 2);
    ctx.restore();
  }

  const p = computePlacement(source, targetWidth, targetHeight, transform);
  ctx.drawImage(media, p.dx, p.dy, p.dw, p.dh);
}
