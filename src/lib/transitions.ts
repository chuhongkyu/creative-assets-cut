/**
 * 조각 사이의 전환.
 *
 * 지금까지는 딱 잘려 바뀌었다. 광고 소재는 장면이 갑자기 바뀌면 거칠어 보여서
 * 조각마다 검정에서 들어오고 검정으로 나가게 했다.
 *
 * 두 조각을 겹쳐 섞는(크로스페이드) 대신 **검정을 거쳐 간다.** 겹치려면 한 프레임에
 * 영상 두 개를 동시에 원하는 시각으로 맞춰 놓아야 하는데, 내보내기는 조각을 하나씩
 * 순서대로 seek하며 돈다. 거기에 두 번째 디코더를 끼우면 구조가 통째로 바뀐다.
 * 검정을 거치는 쪽은 한 번에 한 조각만 있으면 되고, 미리보기와 내보내기가 같은 식을 쓴다.
 */

/** 고를 수 있는 전환 길이(초). 0은 전환 없음. */
export const FADE_CHOICES = [0, 0.3, 0.5, 1] as const;

/** 기본값. 짧은 광고에서 0.5초면 눈에 걸리지 않으면서 장면이 끊기지 않는다. */
export const DEFAULT_FADE_SECONDS = 0.5;

/**
 * 그 시각에 화면을 얼마나 덮을지. 0이면 그대로, 1이면 완전히 검정.
 *
 * 들어오는 구간과 나가는 구간이 겹치면 조각이 한 번도 제 밝기에 닿지 못한다.
 * 그래서 전환 길이를 조각 길이의 절반으로 묶는다. 짧은 조각은 전환도 짧아진다.
 *
 * 가감속을 넣지 않았다. 위치가 움직이는 것과 달리 밝기는 선형으로 가는 쪽이
 * 눈에 고르게 보이고, 그게 영상에서 쓰는 방식이다.
 */
export function fadeDim(localTime: number, clipLength: number, fadeSeconds: number) {
  if (fadeSeconds <= 0 || clipLength <= 0) return 0;

  const span = Math.min(fadeSeconds, clipLength / 2);
  if (span <= 0) return 0;

  const entering = localTime / span;
  const leaving = (clipLength - localTime) / span;
  const visible = Math.min(1, Math.max(0, Math.min(entering, leaving)));

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
