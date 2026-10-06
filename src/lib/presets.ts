/**
 * App Store 소재 규격.
 *
 * 예전에는 Apple 디자인 템플릿(Figma/Photoshop/Pixelmator/Sketch)의 캔버스에서 읽은 값을
 * 적어뒀는데 전부 틀렸다. 템플릿은 믿을 출처가 아니다.
 *
 * 실제 치수는 Apple이 쓰는 소재 파일 이름에 그대로 박혀 있다 —
 * `header_3840x1646_15s.mp4` 처럼 자리·해상도·길이가 한 줄에 다 들어 있다.
 * 규격이 의심스러우면 템플릿을 다시 재지 말고 그 이름을 찾아보는 편이 빠르다.
 *
 * Universal(1402×962)은 템플릿에서 나온 값이라 뺐다. 그런 자리가 실제로 있는지부터
 * 파일 이름으로 확인되면 그때 다시 넣는다.
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
    id: "header",
    label: "Product page header",
    width: 3840,
    height: 1646,
    note: "제품 페이지 최상단. 방문자가 가장 먼저 보는 자리. 15초.",
  },
  {
    id: "search",
    label: "Search results",
    width: 1920,
    height: 1280,
    note: "검색 결과에 노출되는 소재. 3:2. H.264 / MP4 / 30fps / 5~30초.",
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
