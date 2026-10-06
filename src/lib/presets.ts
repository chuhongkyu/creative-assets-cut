/**
 * App Store 소재 규격.
 *
 * 이 치수는 Apple 공개 문서에 없다. Apple이 디자인 템플릿(Figma/Photoshop/Pixelmator/Sketch)에만
 * 넣어두었기 때문에, 템플릿 캔버스에서 읽은 값을 여기 적어둔다.
 * 템플릿이 갱신되면 이 파일만 고치면 된다.
 *
 * Google Ads 규격은 아직 넣지 않는다. 확정되기 전에 적어두면 틀린 값으로 소재를 만들게 된다.
 */
export interface Preset {
  id: string;
  label: string;
  width: number;
  height: number;
  note: string;
}

export const PRESETS: Preset[] = [
  {
    id: "universal",
    label: "Universal",
    width: 1402,
    height: 962,
    note: "헤더와 검색 결과에 함께 쓰는 소재. 하나만 만든다면 이것.",
  },
  {
    id: "search",
    label: "Search results",
    width: 2168,
    height: 1030,
    note: "검색 결과에 노출되는 소재.",
  },
  {
    id: "header",
    label: "Product page header",
    width: 1646,
    height: 661,
    note: "제품 페이지 최상단. 방문자가 가장 먼저 보는 자리.",
  },
  {
    id: "wide32",
    label: "3:2 영상",
    width: 1920,
    height: 1280,
    note: "H.264 / MP4 / 30fps / 5~30초.",
  },
];

/** 비율을 "1.46 : 1" 형태로. 카드에 실제 모양과 함께 적어준다. */
export function ratioLabel(width: number, height: number) {
  return `${(width / height).toFixed(2)} : 1`;
}

/**
 * Apple은 App Store에 노출되는 모든 소재가 4+ 등급을 만족하도록 요구한다.
 * 앱 자체 등급이 더 높아도 예외가 없다. 자산이 거부되는 가장 흔한 이유라 화면에 적어둔다.
 */
export const APPLE_AGE_RULE =
  "App Store에 노출되는 소재는 앱 등급과 무관하게 4+ 기준을 만족해야 합니다. 유혈·잔혹 묘사, 사람이나 보는 사람을 향해 겨눈 무기, 받지 않은 Apple 선정 표식은 거부 사유가 됩니다.";
