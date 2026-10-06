"use client";

import { type Overlay } from "@/lib/overlays";

/**
 * 영상 위에 얹는 글자·이미지 목록.
 *
 * 고르면 미리보기 틀에서 끌어 옮길 수 있다. 조각을 옮기는 것과 같은 자리에서 하므로,
 * 지금 무엇을 옮기고 있는지 분명히 보이게 선택 상태를 강조한다.
 */
export default function OverlayPanel({
  overlays,
  selectedId,
  onSelect,
  onPatch,
  onRemove,
  onAddText,
  onAddImage,
  total,
}: {
  overlays: Overlay[];
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  onPatch: (id: string, next: Partial<Overlay>) => void;
  onRemove: (id: string) => void;
  onAddText: () => void;
  onAddImage: () => void;
  total: number;
}) {
  const selected = overlays.find((o) => o.id === selectedId) ?? null;

  return (
    <div className="overlays">
      <div className="overlays-head">
        <h3>위에 얹기</h3>
        <span className="overlays-add">
          <button className="ghost" onClick={onAddText}>
            글자 추가
          </button>
          <button className="ghost" onClick={onAddImage}>
            이미지 추가
          </button>
        </span>
      </div>

      {overlays.length === 0 ? (
        <p className="overlays-empty">로고나 제목을 얹을 수 있습니다. 영상 전체에 걸쳐 보입니다.</p>
      ) : (
        <ul className="overlay-list">
          {overlays.map((overlay) => (
            <li
              key={overlay.id}
              className={overlay.id === selectedId ? "overlay on" : "overlay"}
              onClick={() => onSelect(overlay.id === selectedId ? null : overlay.id)}
            >
              <span className="overlay-kind">{overlay.kind === "text" ? "글자" : "이미지"}</span>
              <span className="overlay-name">{overlay.kind === "text" ? overlay.text || "(빈 글자)" : overlay.name}</span>
              <button
                className="icon"
                onClick={(e) => {
                  e.stopPropagation();
                  onRemove(overlay.id);
                }}
              >
                ✕
              </button>
            </li>
          ))}
        </ul>
      )}

      {selected && (
        <div className="overlay-edit">
          <p className="hint">미리보기에서 끌어 위치를 옮기세요. 다시 누르면 선택이 풀립니다.</p>

          {selected.kind === "text" && (
            <>
              <label className="wide">
                내용
                <textarea
                  rows={2}
                  value={selected.text}
                  onChange={(e) => onPatch(selected.id, { text: e.target.value, name: e.target.value })}
                  placeholder="줄바꿈도 그대로 들어갑니다"
                />
              </label>
              <label>
                색
                <input
                  type="color"
                  value={selected.color}
                  onChange={(e) => onPatch(selected.id, { color: e.target.value })}
                />
              </label>
            </>
          )}

          <label>
            크기
            <input
              type="range"
              min={0.03}
              max={selected.kind === "text" ? 0.4 : 1}
              step={0.005}
              value={selected.size}
              onChange={(e) => onPatch(selected.id, { size: Number(e.target.value) })}
            />
            <span className="num">{Math.round(selected.size * 100)}%</span>
          </label>

          <label>
            투명도
            <input
              type="range"
              min={0.1}
              max={1}
              step={0.05}
              value={selected.opacity}
              onChange={(e) => onPatch(selected.id, { opacity: Number(e.target.value) })}
            />
            <span className="num">{Math.round(selected.opacity * 100)}%</span>
          </label>

          <div className="overlay-time">
            <label>
              시작
              <input
                type="number"
                min={0}
                max={Math.max(0, total)}
                step={0.1}
                value={selected.start}
                onChange={(e) => onPatch(selected.id, { start: Number(e.target.value) })}
              />
            </label>
            <label>
              끝
              <input
                type="number"
                min={0}
                max={Math.max(0, total)}
                step={0.1}
                value={selected.end ?? total}
                onChange={(e) => onPatch(selected.id, { end: Number(e.target.value) })}
              />
            </label>
            <button className="ghost" onClick={() => onPatch(selected.id, { start: 0, end: null })}>
              전체 구간
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
