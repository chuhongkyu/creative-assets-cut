/**
 * 내보낼 소재 규격.
 *
 * 규격이 바뀌거나 늘어나면 이 파일만 고치면 된다. 화면과 내보내기가 모두 여기를 읽는다.
 *
 * Google Ads 규격은 아직 넣지 않는다. 확정되기 전에 적어두면 틀린 값으로 소재를 만들게 된다.
 */

/** 규격이 어디에 올라가는지. 주의사항이 플랫폼마다 달라서 묶어둔다. */
export type PlatformId = "appstore" | "youtube";

export interface Preset {
  id: string;
  platform: PlatformId;
  label: string;
  width: number;
  height: number;
  note: string;
}

/**
 * App Store 규격의 출처.
 *
 * 예전에는 Apple 디자인 템플릿(Figma/Photoshop/Pixelmator/Sketch)의 캔버스에서 읽은 값을
 * 적어뒀는데 전부 틀렸다. 템플릿은 믿을 출처가 아니다.
 *
 * 실제 치수는 Apple이 쓰는 소재 파일 이름에 그대로 박혀 있다 —
 * `header_3840x1646_15s.mp4` 처럼 자리와 해상도가 이름에 들어 있다.
 * 규격이 의심스러우면 템플릿을 다시 재지 말고 그 이름을 찾아보는 편이 빠르다.
 *
 * 그 이름 뒤의 `15s`는 파일 하나의 길이일 뿐 규칙이 아니다. 정해진 길이가 없으니
 * 여기에 길이를 적어두지 않고, 앱도 길이를 검사하지 않는다.
 * 다만 3초는 받아주지 않았고 10초는 괜찮았다 — 밝혀진 값은 없지만 하한은 있는 듯하다.
 *
 * Universal(1402×962)도 템플릿에서 나온 값이라 뺐다. 그런 자리가 실제로 있는지
 * 파일 이름으로 확인되면 그때 다시 넣는다.
 */
const APP_STORE_PRESETS: Preset[] = [
  {
    id: "header",
    platform: "appstore",
    label: "Product page header",
    width: 3840,
    height: 1646,
    note: "제품 페이지 최상단. 방문자가 가장 먼저 보는 자리.",
  },
  {
    id: "search",
    platform: "appstore",
    label: "Search results",
    width: 1920,
    height: 1280,
    note: "검색 결과에 노출되는 소재. 3:2.",
  },
];

/**
 * YouTube 권장 규격.
 *
 * App Store와 달리 '규격'이 아니라 권장값이다. 벗어나도 거부되지 않고 YouTube가 알아서
 * 변환한다. 그래도 권장값으로 올리면 재변환을 한 번 덜 거친다.
 *
 * 1080p만 넣어둔다. 720p(1280×720)와 4K(3840×2160)도 받지만, 받는 해상도를 모두
 * 늘어놓으면 고를 때 헷갈리기만 한다. 4K 소재가 생기면 그때 넣으면 된다.
 *
 * 프레임레이트는 YouTube가 '원본 그대로'를 권한다. 그래서 규격에 박지 않고
 * 편집 화면에서 24/30/60 중에 고르게 뒀다.
 */
const YOUTUBE_PRESETS: Preset[] = [
  {
    id: "youtube",
    platform: "youtube",
    label: "동영상",
    width: 1920,
    height: 1080,
    note: "16:9 / 1080p. H.264 영상 + AAC 소리로 나가 권장 형식과 맞는다.",
  },
  {
    id: "youtube-thumb",
    platform: "youtube",
    label: "썸네일",
    width: 1280,
    height: 720,
    note: "이미지 한 장만 올리면 jpg로 나온다. 2MB 이하여야 한다.",
  },
];

export const PRESETS: Preset[] = [...APP_STORE_PRESETS, ...YOUTUBE_PRESETS];

/**
 * Apple은 App Store에 노출되는 모든 소재가 4+ 등급을 만족하도록 요구한다.
 * 앱 자체 등급이 더 높아도 예외가 없다. 자산이 거부되는 가장 흔한 이유라 화면에 적어둔다.
 */
export const APPLE_AGE_RULE =
  "App Store에 노출되는 소재는 앱 등급과 무관하게 4+ 기준을 만족해야 합니다. 유혈·잔혹 묘사, 사람이나 보는 사람을 향해 겨눈 무기, 받지 않은 Apple 선정 표식은 거부 사유가 됩니다.";

export interface Platform {
  id: PlatformId;
  label: string;
  /** 그 플랫폼에서만 걸리는 주의사항. 없으면 띄우지 않는다. */
  rule: string | null;
}

/**
 * 주의사항은 플랫폼 단위로 붙인다.
 * 4+ 규칙을 목록 맨 아래에 한 번만 두면 YouTube 규격에도 걸리는 것처럼 보인다.
 */
export const PLATFORMS: Platform[] = [
  { id: "appstore", label: "App Store", rule: APPLE_AGE_RULE },
  { id: "youtube", label: "YouTube", rule: null },
];

/** 비율을 "1.46 : 1" 형태로. 카드에 실제 모양과 함께 적어준다. */
export function ratioLabel(width: number, height: number) {
  return `${(width / height).toFixed(2)} : 1`;
}
