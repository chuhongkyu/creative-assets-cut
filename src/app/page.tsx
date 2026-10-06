"use client";

import { useState } from "react";
import EditorView from "@/components/EditorView";
import { totalLength, type Clip } from "@/lib/clips";
import { type Overlay } from "@/lib/overlays";
import { PLATFORMS, PRESETS, ratioLabel } from "@/lib/presets";

export default function Page() {
  // 규격마다 소재가 다르므로 조각 목록도 규격별로 따로 들고 있는다.
  const [byPreset, setByPreset] = useState<Record<string, Clip[]>>({});
  const [overlaysByPreset, setOverlaysByPreset] = useState<Record<string, Overlay[]>>({});
  const [openId, setOpenId] = useState<string | null>(null);

  const open = PRESETS.find((p) => p.id === openId) ?? null;

  if (open) {
    return (
      <main className="wrap wide">
        <EditorView
          preset={open}
          clips={byPreset[open.id] ?? []}
          onClips={(clips) => setByPreset((prev) => ({ ...prev, [open.id]: clips }))}
          overlays={overlaysByPreset[open.id] ?? []}
          onOverlays={(overlays) => setOverlaysByPreset((prev) => ({ ...prev, [open.id]: overlays }))}
          onBack={() => setOpenId(null)}
        />
      </main>
    );
  }

  return (
    <main className="wrap">
      <h1>Creative Asset Studio</h1>
      <p className="sub">
        App Store와 YouTube 소재 규격을 자리별로 편집해 내보냅니다. 처리는 전부 브라우저 안에서 끝나고
        파일이 서버로 올라가지 않습니다.
      </p>

      {PLATFORMS.map((platform) => (
        <section key={platform.id} className="platform">
          <h2 className="platform-head">{platform.label}</h2>

          <ul className="preset-list">
            {PRESETS.filter((preset) => preset.platform === platform.id).map((preset) => {
              const clips = byPreset[preset.id] ?? [];
              const seconds = totalLength(clips);

              return (
                <li key={preset.id}>
                  <button className="preset" onClick={() => setOpenId(preset.id)}>
                    <span
                      className="preset-shape"
                      style={{ aspectRatio: `${preset.width} / ${preset.height}` }}
                    />
                    <span className="preset-text">
                      <strong>{preset.label}</strong>
                      <span className="preset-dim">
                        {preset.width} × {preset.height} · {ratioLabel(preset.width, preset.height)}
                      </span>
                      <span className="preset-note">{preset.note}</span>
                      <span className="preset-state">
                        {clips.length === 0
                          ? "비어 있음"
                          : `${clips.length}개 · ${seconds.toFixed(1)}초`}
                      </span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>

          {/* 주의사항은 그 플랫폼 밑에만 둔다. 목록 맨 아래에 한 번만 두면
              App Store 규칙이 YouTube 규격에도 걸리는 것처럼 보인다. */}
          {platform.rule && <p className="rule">{platform.rule}</p>}
        </section>
      ))}
    </main>
  );
}
