"use client";

import { useState } from "react";
import EditorView from "@/components/EditorView";
import { totalLength, type Clip } from "@/lib/clips";
import { APPLE_AGE_RULE, PRESETS, ratioLabel } from "@/lib/presets";

export default function Page() {
  // 규격마다 소재가 다르므로 조각 목록도 규격별로 따로 들고 있는다.
  const [byPreset, setByPreset] = useState<Record<string, Clip[]>>({});
  const [openId, setOpenId] = useState<string | null>(null);

  const open = PRESETS.find((p) => p.id === openId) ?? null;

  if (open) {
    return (
      <main className="wrap wide">
        <EditorView
          preset={open}
          clips={byPreset[open.id] ?? []}
          onClips={(clips) => setByPreset((prev) => ({ ...prev, [open.id]: clips }))}
          onBack={() => setOpenId(null)}
        />
      </main>
    );
  }

  return (
    <main className="wrap">
      <h1>Creative Asset Studio</h1>
      <p className="sub">
        App Store 소재 규격 세 가지를 각각 편집해 내보냅니다. 처리는 전부 브라우저 안에서 끝나고 파일이
        서버로 올라가지 않습니다.
      </p>

      <ul className="preset-list">
        {PRESETS.map((preset) => {
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

      <p className="rule">{APPLE_AGE_RULE}</p>
    </main>
  );
}
