"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import PresetCard from "@/components/PresetCard";
import type { FitMode, Focus } from "@/lib/crop";
import { APPLE_AGE_RULE, GROUP_LABEL, PRESETS, type PresetGroup } from "@/lib/presets";

interface Loaded {
  element: HTMLImageElement | HTMLVideoElement;
  isVideo: boolean;
  width: number;
  height: number;
  duration: number;
  name: string;
}

export default function Page() {
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [over, setOver] = useState(false);
  const [mode, setMode] = useState<FitMode>("cover");
  const [focus, setFocus] = useState<Focus>("center");
  const [start, setStart] = useState(0);
  const [duration, setDuration] = useState(8);
  const [fps, setFps] = useState(30);
  const inputRef = useRef<HTMLInputElement>(null);

  const accept = useCallback(async (file: File) => {
    const url = URL.createObjectURL(file);
    const name = file.name.replace(/\.[^.]+$/, "");

    if (file.type.startsWith("video/")) {
      const video = document.createElement("video");
      video.src = url;
      video.muted = true;
      video.playsInline = true;

      await new Promise<void>((resolve) => {
        video.addEventListener("loadeddata", () => resolve(), { once: true });
      });
      // 첫 프레임이 그려져야 미리보기가 검은 화면으로 나오지 않는다.
      video.currentTime = 0.1;
      await new Promise<void>((resolve) => {
        video.addEventListener("seeked", () => resolve(), { once: true });
      });

      setLoaded({
        element: video,
        isVideo: true,
        width: video.videoWidth,
        height: video.videoHeight,
        duration: video.duration,
        name,
      });
      setDuration(Math.min(8, Math.floor(video.duration)));
      return;
    }

    const image = new Image();
    image.src = url;
    await image.decode();
    setLoaded({ element: image, isVideo: false, width: image.width, height: image.height, duration: 0, name });
  }, []);

  const grouped = useMemo(() => {
    const map = new Map<PresetGroup, typeof PRESETS>();
    for (const preset of PRESETS) {
      const list = map.get(preset.group) ?? [];
      list.push(preset);
      map.set(preset.group, list);
    }
    return [...map.entries()];
  }, []);

  return (
    <main className="wrap">
      <h1>Creative Asset Studio</h1>
      <p className="sub">
        영상이나 이미지를 넣으면 App Store와 Google Ads 규격으로 잘라서 내보냅니다. 처리는 전부 브라우저
        안에서 끝나고 파일이 서버로 올라가지 않습니다.
      </p>

      <div
        className={over ? "drop over" : "drop"}
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          setOver(true);
        }}
        onDragLeave={() => setOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setOver(false);
          const file = e.dataTransfer.files[0];
          if (file) void accept(file);
        }}
      >
        <strong>영상이나 이미지를 여기로 끌어다 놓으세요</strong>
        <br />
        <span className="sub">mp4 · mov · png · jpg</span>
        <input
          ref={inputRef}
          type="file"
          accept="video/mp4,video/quicktime,image/png,image/jpeg"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) void accept(file);
          }}
        />
      </div>

      {loaded && (
        <>
          <div className="source" style={{ marginTop: 16 }}>
            <span>
              <b>{loaded.name}</b>
            </span>
            <span className="muted">
              {loaded.width} × {loaded.height}
            </span>
            {loaded.isVideo && <span className="muted">{loaded.duration.toFixed(1)}초</span>}
          </div>

          <div className="controls">
            <label>
              맞춤
              <select value={mode} onChange={(e) => setMode(e.target.value as FitMode)}>
                <option value="cover">잘라서 채우기</option>
                <option value="contain">전체 담기</option>
              </select>
            </label>

            {mode === "cover" && (
              <label>
                세로 기준
                <select value={focus} onChange={(e) => setFocus(e.target.value as Focus)}>
                  <option value="center">가운데</option>
                  <option value="top">위쪽</option>
                  <option value="bottom">아래쪽</option>
                </select>
              </label>
            )}

            {loaded.isVideo && (
              <>
                <label>
                  시작(초)
                  <input
                    type="number"
                    min={0}
                    max={Math.max(0, loaded.duration - 1)}
                    step={0.5}
                    value={start}
                    onChange={(e) => setStart(Number(e.target.value))}
                  />
                </label>
                <label>
                  길이(초)
                  <input
                    type="number"
                    min={1}
                    max={30}
                    value={duration}
                    onChange={(e) => setDuration(Number(e.target.value))}
                  />
                </label>
                <label>
                  fps
                  <select value={fps} onChange={(e) => setFps(Number(e.target.value))}>
                    <option value={24}>24</option>
                    <option value={30}>30</option>
                  </select>
                </label>
              </>
            )}
          </div>

          {grouped.map(([group, presets]) => (
            <section key={group}>
              <h2>{GROUP_LABEL[group]}</h2>
              <div className="grid">
                {presets.map((preset) => (
                  <PresetCard
                    key={preset.id}
                    preset={preset}
                    media={loaded.element}
                    isVideo={loaded.isVideo}
                    sourceSize={{ width: loaded.width, height: loaded.height }}
                    baseName={loaded.name}
                    mode={mode}
                    focus={focus}
                    startSeconds={start}
                    durationSeconds={duration}
                    fps={fps}
                  />
                ))}
              </div>
            </section>
          ))}

          <p className="rule">{APPLE_AGE_RULE}</p>
        </>
      )}
    </main>
  );
}
