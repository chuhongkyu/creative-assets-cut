/**
 * 조각 사이의 전환.
 *
 * 조각이 검정에서 들어오고 검정으로 나간다.
 *
 * **들어올 때와 나갈 때를 따로 고른다.** 하나로 묶으면 '들어올 때만 페이드'를 만들 수 없다.
 * 맨 앞만 검정에서 열고 나머지는 딱 잘라 넘기는 구성이 흔한데, 묶여 있으면 그게 안 된다.
 *
 * 기본값은 둘 다 없음이다. 전환은 넣기로 정한 사람이 넣는 것이지,
 * 모르는 사이에 끼어 있으면 안 된다.
 *
 * 두 조각을 겹쳐 섞는(크로스페이드) 대신 **검정을 거쳐 간다.** 겹치려면 한 프레임에
 * 영상 두 개를 동시에 원하는 시각으로 맞춰 놓아야 하는데, 내보내기는 조각을 하나씩
 * 순서대로 seek하며 돈다. 거기에 두 번째 디코더를 끼우면 구조가 통째로 바뀐다.
 * 검정을 거치는 쪽은 한 번에 한 조각만 있으면 되고, 미리보기와 내보내기가 같은 식을 쓴다.
 */

/** 고를 수 있는 전환 길이(초). 0은 전환 없음. */
export const FADE_CHOICES = [0, 0.3, 0.5, 1] as const;

/** 기본값은 전환 없음. 딱 잘려 바뀐다. */
export const DEFAULT_FADE_SECONDS = 0;

/**
 * 그 시각에 화면을 얼마나 덮을지. 0이면 그대로, 1이면 완전히 검정.
 *
 * 둘을 합친 길이가 조각보다 길면 같은 비율로 줄인다. 안 그러면 들어오는 구간과
 * 나가는 구간이 겹쳐 그 조각은 한 번도 제 밝기에 닿지 못한다.
 * 한쪽만 켜져 있으면 조각 전체를 다 써도 되므로 절반으로 묶지 않는다.
 *
 * 가감속을 넣지 않았다. 위치가 움직이는 것과 달리 밝기는 선형으로 가는 쪽이
 * 눈에 고르게 보이고, 그게 영상에서 쓰는 방식이다.
 */
export function fadeDim(
  localTime: number,
  clipLength: number,
  fadeInSeconds: number,
  fadeOutSeconds: number
) {
  if (clipLength <= 0) return 0;

  let entering = Math.max(0, fadeInSeconds);
  let leaving = Math.max(0, fadeOutSeconds);
  if (entering <= 0 && leaving <= 0) return 0;

  const total = entering + leaving;
  if (total > clipLength) {
    const shrink = clipLength / total;
    entering *= shrink;
    leaving *= shrink;
  }

  // 꺼져 있는 쪽은 제 밝기로 둔다. 1을 넣으면 min에 걸리지 않는다.
  const inRatio = entering > 0 ? localTime / entering : 1;
  const outRatio = leaving > 0 ? (clipLength - localTime) / leaving : 1;
  const visible = Math.min(1, Math.max(0, Math.min(inRatio, outRatio)));

  return 1 - visible;
}

/** 덮는 검정을 그린다. 조각과 오버레이를 다 그린 뒤 맨 위에 올린다. */
export function drawFade(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  dim: number
) {
  if (dim <= 0.001) return;

  ctx.save();
  ctx.globalAlpha = Math.min(1, dim);
  ctx.fillStyle = "#000";
  ctx.fillRect(0, 0, width, height);
  ctx.restore();
}
