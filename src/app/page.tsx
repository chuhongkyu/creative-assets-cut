import AssetSlot from "@/components/AssetSlot";
import { APPLE_AGE_RULE, PRESETS } from "@/lib/presets";

export default function Page() {
  return (
    <main className="wrap">
      <h1>Creative Asset Studio</h1>
      <p className="sub">
        App Store 소재 규격 세 가지를 각각 올려서 잘라내고 내보냅니다. 처리는 전부 브라우저 안에서 끝나고
        파일이 서버로 올라가지 않습니다.
      </p>

      {PRESETS.map((preset) => (
        <AssetSlot key={preset.id} preset={preset} />
      ))}

      <p className="rule">{APPLE_AGE_RULE}</p>
    </main>
  );
}
