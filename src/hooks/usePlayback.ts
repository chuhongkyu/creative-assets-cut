"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { drawClip, locate, type Position } from "@/lib/playback";
import { totalLength, type Clip } from "@/lib/clips";
import { type Overlay } from "@/lib/overlays";

/**
 * 타임라인 재생.
 *
 * 영상 구간은 seek을 반복하지 않고 element를 그냥 재생시킨다.
 * 매 프레임 seek을 걸면 디코더가 따라오지 못해 뚝뚝 끊긴다.
 * 조각이 바뀌는 순간에만 앞엣것을 멈추고 다음 것을 제자리에서 재생한다.
 */
export function usePlayback(
  clips: Clip[],
  overlays: Overlay[],
  canvasRef: React.RefObject<HTMLCanvasElement>
) {
  const [playing, setPlaying] = useState(false);
  const [muted, setMuted] = useState(false);
  const [time, setTime] = useState(0);
  const rafRef = useRef<number | null>(null);
  const lastTickRef = useRef(0);
  const activeRef = useRef<number>(-1);
  const total = totalLength(clips);

  const stopAllVideos = useCallback(() => {
    for (const clip of clips) {
      if (!clip.isVideo) continue;
      const video = clip.element as HTMLVideoElement;
      video.pause();
      // 멈춘 영상은 다시 음소거해 둔다. 위치를 잡느라 seek할 때 소리가 새어 나오면 안 된다.
      video.muted = true;
    }
  }, [clips]);

  /** 그 시각의 화면을 그린다. 재생 중이 아니면 정확한 프레임을 위해 seek한다. */
  const render = useCallback(
    (at: number, live: boolean) => {
      const canvas = canvasRef.current;
      if (!canvas) return;

      const pos: Position | null = locate(clips, at);
      if (!pos) return;

      if (pos.clip.isVideo) {
        const video = pos.clip.element as HTMLVideoElement;
        const want = pos.clip.start + pos.localTime;

        if (live) {
          // 조각이 바뀌었을 때만 자리를 맞추고 재생을 넘긴다.
          if (activeRef.current !== pos.index) {
            stopAllVideos();
            activeRef.current = pos.index;
            video.currentTime = want;

            // 재생은 버튼 클릭에서 시작되므로 자동재생 정책에 걸리지 않는다.
            video.muted = muted;
            video.volume = 1;
            void video.play().catch(() => undefined);
          }
        } else if (Math.abs(video.currentTime - want) > 0.05) {
          video.currentTime = want;
        }
      } else if (live && activeRef.current !== pos.index) {
        stopAllVideos();
        activeRef.current = pos.index;
      }

      drawClip(canvas, pos.clip, overlays, at, total);
    },
    [clips, overlays, canvasRef, stopAllVideos, muted, total]
  );

  // 재생 루프. 실제 흐른 시간만큼 재생 머리를 옮긴다.
  useEffect(() => {
    if (!playing) return;

    lastTickRef.current = performance.now();

    const tick = (now: number) => {
      const delta = (now - lastTickRef.current) / 1000;
      lastTickRef.current = now;

      setTime((prev) => {
        const next = prev + delta;
        if (next >= total) {
          setPlaying(false);
          return total;
        }
        render(next, true);
        return next;
      });

      rafRef.current = requestAnimationFrame(tick);
    };

    rafRef.current = requestAnimationFrame(tick);

    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
      stopAllVideos();
      activeRef.current = -1;
    };
  }, [playing, total, render, stopAllVideos]);

  // 재생 중에 음소거를 바꾸면 지금 울리는 영상에 바로 반영한다.
  useEffect(() => {
    if (!playing) return;
    for (const clip of clips) {
      if (!clip.isVideo) continue;
      const video = clip.element as HTMLVideoElement;
      if (!video.paused) video.muted = muted;
    }
  }, [muted, playing, clips]);

  // 멈춰 있을 때는 재생 머리 위치의 정확한 프레임을 보여준다.
  useEffect(() => {
    if (!playing) render(time, false);
  }, [playing, time, render]);

  const seekTo = useCallback(
    (at: number) => {
      setPlaying(false);
      setTime(Math.max(0, Math.min(total, at)));
    },
    [total]
  );

  const toggle = useCallback(() => {
    if (total <= 0) return;
    setPlaying((p) => {
      if (!p && time >= total - 0.01) setTime(0);
      return !p;
    });
  }, [total, time]);

  return { playing, time, total, muted, setMuted, toggle, seekTo, stop: () => setPlaying(false) };
}
