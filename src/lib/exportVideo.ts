import { Muxer, ArrayBufferTarget } from "mp4-muxer";
import { computeDrawRect, type FitMode, type Focus } from "./crop";

/**
 * 영상을 한 규격으로 다시 인코딩한다. 전부 브라우저 안에서 끝나고 서버를 쓰지 않는다.
 *
 * 브라우저가 가진 하드웨어 코덱을 WebCodecs로 직접 부르고, mp4-muxer가 컨테이너를 만든다.
 * ffmpeg.wasm을 쓰지 않는 이유는 30MB 가까운 다운로드와 SharedArrayBuffer 설정이 필요해서다.
 *
 * MediaRecorder도 방법이지만 Chrome이 webm만 내놓는다. Apple은 mp4/mov를 요구하므로 쓸 수 없다.
 */
export interface VideoExportOptions {
  startSeconds: number;
  durationSeconds: number;
  fps: number;
  mode: FitMode;
  focus: Focus;
  onProgress?: (ratio: number) => void;
}

export function isVideoExportSupported() {
  return typeof window !== "undefined" && "VideoEncoder" in window && "VideoFrame" in window;
}

export async function renderVideo(
  video: HTMLVideoElement,
  targetWidth: number,
  targetHeight: number,
  options: VideoExportOptions
): Promise<Blob> {
  if (!isVideoExportSupported()) {
    throw new Error("이 브라우저는 WebCodecs를 지원하지 않습니다. Chrome이나 Safari 16.4 이상을 쓰세요.");
  }

  const { startSeconds, durationSeconds, fps, mode, focus, onProgress } = options;

  // 인코더는 짝수 치수를 요구하는 경우가 많다. 규격이 홀수면 1px 줄여 맞춘다.
  const width = targetWidth - (targetWidth % 2);
  const height = targetHeight - (targetHeight % 2);

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("캔버스를 만들 수 없습니다.");

  const sourceSize = { width: video.videoWidth, height: video.videoHeight };
  const rect = computeDrawRect(sourceSize, width, height, mode, focus);
  const fillRect = computeDrawRect(sourceSize, width, height, "cover", "center");

  const target = new ArrayBufferTarget();
  const muxer = new Muxer({
    target,
    video: { codec: "avc", width, height },
    fastStart: "in-memory",
  });

  const encoder = new VideoEncoder({
    output: (chunk, meta) => muxer.addVideoChunk(chunk, meta),
    error: (e) => {
      throw e;
    },
  });

  encoder.configure({
    codec: "avc1.42001f", // H.264 Baseline. 호환성이 가장 넓다.
    width,
    height,
    bitrate: 6_000_000,
    framerate: fps,
  });

  const totalFrames = Math.max(1, Math.round(durationSeconds * fps));
  const frameDuration = 1_000_000 / fps; // 마이크로초

  for (let i = 0; i < totalFrames; i++) {
    const time = startSeconds + i / fps;
    await seek(video, time);

    if (mode === "contain") {
      ctx.filter = "blur(24px)";
      ctx.drawImage(video, fillRect.sx, fillRect.sy, fillRect.sw, fillRect.sh, -24, -24, width + 48, height + 48);
      ctx.filter = "none";
    }

    ctx.drawImage(video, rect.sx, rect.sy, rect.sw, rect.sh, rect.dx, rect.dy, rect.dw, rect.dh);

    const frame = new VideoFrame(canvas, { timestamp: i * frameDuration, duration: frameDuration });

    // 2초마다 키프레임을 넣어 탐색이 가능하게 한다.
    encoder.encode(frame, { keyFrame: i % (fps * 2) === 0 });
    frame.close();

    // 인코더가 밀리면 메모리가 계속 쌓인다. 적당히 기다려준다.
    if (encoder.encodeQueueSize > 8) await encoder.flush();

    onProgress?.((i + 1) / totalFrames);
  }

  await encoder.flush();
  encoder.close();
  muxer.finalize();

  return new Blob([target.buffer], { type: "video/mp4" });
}

/** 지정한 시각으로 이동하고 그 프레임이 실제로 준비될 때까지 기다린다. */
function seek(video: HTMLVideoElement, time: number) {
  return new Promise<void>((resolve) => {
    const done = () => {
      video.removeEventListener("seeked", done);
      resolve();
    };
    video.addEventListener("seeked", done);
    video.currentTime = Math.min(time, Math.max(0, video.duration - 0.001));
  });
}
