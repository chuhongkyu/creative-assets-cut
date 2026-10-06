/**
 * 내보낼 규격 목록.
 *
 * Apple 쪽 치수는 공개 문서에 없다. Apple이 디자인 템플릿(Figma/Photoshop)에만
 * 넣어두었기 때문에, 템플릿 캔버스에서 읽은 값을 여기 적어둔다.
 * 템플릿이 갱신되면 이 파일만 고치면 된다.
 */
export type PresetGroup = "apple" | "google";

export interface Preset {
  id: string;
  group: PresetGroup;
  label: string;
  width: number;
  height: number;
  /** 영상으로 쓸 수 있는 자리인지. 이미지 전용이면 false. */
  allowsVideo: boolean;
  note?: string;
}

export const PRESETS: Preset[] = [
  {
    id: "apple-universal",
    group: "apple",
    label: "Universal",
    width: 1402,
    height: 962,
    allowsVideo: true,
    note: "헤더와 검색 결과에 함께 쓰는 소재. 하나만 만든다면 이것.",
  },
  {
    id: "apple-header",
    group: "apple",
    label: "Product page header",
    width: 1646,
    height: 661,
    allowsVideo: true,
    note: "제품 페이지 최상단. 방문자가 가장 먼저 보는 자리.",
  },
  {
    id: "apple-search",
    group: "apple",
    label: "Search results",
    width: 2168,
    height: 1030,
    allowsVideo: true,
    note: "검색 결과에 노출되는 소재.",
  },
  {
    id: "google-landscape",
    group: "google",
    label: "가로 1.91:1",
    width: 1200,
    height: 628,
    allowsVideo: false,
  },
  {
    id: "google-portrait",
    group: "google",
    label: "세로 4:5",
    width: 1200,
    height: 1500,
    allowsVideo: false,
  },
  {
    id: "google-square",
    group: "google",
    label: "정사각 1:1",
    width: 1200,
    height: 1200,
    allowsVideo: false,
  },
];

export const GROUP_LABEL: Record<PresetGroup, string> = {
  apple: "App Store",
  google: "Google Ads 앱 캠페인",
};

/**
 * Apple은 App Store에 노출되는 모든 소재가 4+ 등급을 만족하도록 요구한다.
 * 앱 자체 등급이 더 높아도 예외가 없다. 자산이 거부되는 가장 흔한 이유라 UI에 적어둔다.
 */
export const APPLE_AGE_RULE =
  "App Store에 노출되는 소재는 앱 등급과 무관하게 4+ 기준을 만족해야 합니다.";
