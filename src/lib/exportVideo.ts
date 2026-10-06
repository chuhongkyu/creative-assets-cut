import { Muxer, ArrayBufferTarget } from "mp4-muxer";
import { paint } from "./transform";
import { seek, totalLength, type Clip } from "./clips";

/**
 * 조각 여러 개를 이어 붙여 mp4 하나로 만든다. 전부 브라우저 안에서 끝나고 서버를 쓰지 않는다.
 *
 * 브라우저가 가진 하드웨어 코덱을 WebCodecs로 직접 부르고, mp4-muxer가 컨테이너를 만든다.
 * ffmpeg.wasm을 쓰지 않는 이유는 30MB 가까운 다운로드와 SharedArrayBuffer 설정이 필요해서다.
 * MediaRecorder도 방법이지만 Chrome이 webm만 내놓는다. Apple은 mp4/mov를 요구하므로 쓸 수 없다.
 *
 * 조각마다 인코더를 새로 만들지 않고 하나로 쭉 간다. 그래야 끊김 없이 한 영상이 된다.
 */
export interface SequenceOptions {
  fps: number;
  onProgress?: (ratio: number) => void;
}

export function isVideoExportSupported() {
  return typeof window !== "undefined" && "VideoEncoder" in window && "VideoFrame" in window;
}

export async function renderSequence(
  clips: Clip[],
  targetWidth: number,
  targetHeight: number,
  options: SequenceOptions
): Promise<Blob> {
  if (!isVideoExportSupported()) {
    throw new Error("이 브라우저는 WebCodecs를 지원하지 않습니다. Chrome이나 Safari 16.4 이상을 쓰세요.");
  }
  if (clips.length === 0) throw new Error("내보낼 소재가 없습니다.");

  const { fps, onProgress } = options;

  // 인코더는 짝수 치수를 요구하는 경우가 많다. 규격이 홀수면 1px 줄여 맞춘다.
  const width = targetWidth - (targetWidth % 2);
  const height = targetHeight - (targetHeight % 2);

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("캔버스를 만들 수 없습니다.");

  const target = new ArrayBufferTarget();
  const muxer = new Muxer({
    target,
    video: { codec: "avc", width, height },
    fastStart: "in-memory",
  });

  let encoderError: unknown = null;
  const encoder = new VideoEncoder({
    output: (chunk, meta) => muxer.addVideoChunk(chunk, meta),
    error: (e) => {
      encoderError = e;
    },
  });

  encoder.configure({
    codec: "avc1.42001f", // H.264 Baseline. 호환성이 가장 넓다.
    width,
    height,
    bitrate: 6_000_000,
    framerate: fps,
  });

  const frameDuration = 1_000_000 / fps; // 마이크로초
  const totalFrames = Math.max(1, Math.round(totalLength(clips) * fps));
  let frameIndex = 0;

  for (const clip of clips) {
    const size = { width: clip.width, height: clip.height };
    const clipFrames = Math.max(1, Math.round(clip.length * fps));

    for (let i = 0; i < clipFrames; i++) {
      if (encoderError) throw encoderError;

      if (clip.isVideo) {
        await seek(clip.element as HTMLVideoElement, clip.start + i / fps);
      }

      paint(ctx, clip.element, size, width, height, clip.transform);

      const frame = new VideoFrame(canvas, {
        timestamp: frameIndex * frameDuration,
        duration: frameDuration,
      });

      // 2초마다, 그리고 조각이 바뀌는 지점에 키프레임을 넣는다. 탐색이 가능해진다.
      encoder.encode(frame, { keyFrame: i === 0 || frameIndex % (fps * 2) === 0 });
      frame.close();

      // 인코더가 밀리면 메모리가 계속 쌓인다. 적당히 비워준다.
      if (encoder.encodeQueueSize > 8) await encoder.flush();

      frameIndex++;
      onProgress?.(frameIndex / totalFrames);
    }
  }

  await encoder.flush();
  encoder.close();
  if (encoderError) throw encoderError;

  muxer.finalize();

  return new Blob([target.buffer], { type: "video/mp4" });
}
