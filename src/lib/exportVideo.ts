import { Muxer, ArrayBufferTarget } from "mp4-muxer";
import { paint } from "./transform";
import { drawOverlays, type Overlay } from "./overlays";
import { buildAudioTrack, encodeAudio, isAudioExportSupported } from "./audio";
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
  overlays?: Overlay[];
  /** 영상 구간의 소리를 담을지. */
  withAudio?: boolean;
  onProgress?: (ratio: number) => void;
}

export function isVideoExportSupported() {
  return typeof window !== "undefined" && "VideoEncoder" in window && "VideoFrame" in window;
}

/**
 * 이 해상도를 받아주는 H.264 설정을 고른다.
 *
 * 코덱 문자열 끝 두 자리가 '레벨'이고, 레벨이 해상도 상한을 정한다.
 * 예전에는 avc1.42001f(Baseline 3.1)를 박아 썼는데 그 레벨의 상한이 1280x720이라
 * App Store 규격(가장 큰 것이 2168x1030)에서는 모두 한계를 넘었다.
 * 그러면 configure는 통과하고 첫 encode에서 인코더가 닫히면서
 * "Cannot call 'encode' on a closed codec" 만 보인다. 진짜 원인이 가려지는 셈이다.
 *
 * 그래서 넉넉한 레벨부터 차례로 물어보고 실제로 받아주는 것을 쓴다.
 */
const CODEC_CANDIDATES = [
  "avc1.640034", // High 5.2
  "avc1.4d0034", // Main 5.2
  "avc1.420034", // Baseline 5.2
  "avc1.640028", // High 4.0
  "avc1.42001f", // Baseline 3.1 — 작은 규격용 마지막 보루
];

async function pickCodec(config: Omit<VideoEncoderConfig, "codec">) {
  for (const codec of CODEC_CANDIDATES) {
    try {
      const support = await VideoEncoder.isConfigSupported({ ...config, codec });
      if (support.supported) return codec;
    } catch {
      // 이 조합을 모르는 브라우저다. 다음 후보로 넘어간다.
    }
  }

  return null;
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

  const { fps, overlays = [], withAudio = true, onProgress } = options;

  // 인코더는 짝수 치수를 요구하는 경우가 많다. 규격이 홀수면 1px 줄여 맞춘다.
  const width = targetWidth - (targetWidth % 2);
  const height = targetHeight - (targetHeight % 2);

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("캔버스를 만들 수 없습니다.");

  // 소리를 먼저 만든다. muxer는 트랙 구성을 만들 때 정해야 해서,
  // 담을 소리가 있는지 모른 채로 시작할 수 없다.
  const audio =
    withAudio && isAudioExportSupported() ? await buildAudioTrack(clips, totalLength(clips)) : null;

  const target = new ArrayBufferTarget();
  const muxer = new Muxer({
    target,
    video: { codec: "avc", width, height },
    ...(audio
      ? {
          audio: {
            codec: "aac" as const,
            sampleRate: audio.sampleRate,
            numberOfChannels: Math.min(2, audio.numberOfChannels),
          },
        }
      : {}),
    fastStart: "in-memory",
  });

  const seconds = Math.max(0.1, totalLength(clips));

  // 화소가 많을수록 비트레이트를 올린다. 고정값이면 큰 규격에서 뭉개진다.
  const bitrate = Math.min(24_000_000, Math.max(6_000_000, Math.round(width * height * fps * 0.12)));
  const base = { width, height, bitrate, framerate: fps };

  const codec = await pickCodec(base);
  if (!codec) {
    throw new Error(`이 브라우저가 ${width}×${height} 인코딩을 지원하지 않습니다.`);
  }

  let encoderError: unknown = null;
  const encoder = new VideoEncoder({
    output: (chunk, meta) => muxer.addVideoChunk(chunk, meta),
    error: (e) => {
      encoderError = e;
    },
  });

  encoder.configure({ ...base, codec });

  const frameDuration = 1_000_000 / fps; // 마이크로초
  const totalFrames = Math.max(1, Math.round(totalLength(clips) * fps));
  let frameIndex = 0;

  for (const clip of clips) {
    const size = { width: clip.width, height: clip.height };
    const clipFrames = Math.max(1, Math.round(clip.length * fps));

    for (let i = 0; i < clipFrames; i++) {
      if (encoderError) throw describe(encoderError, width, height, codec);

      if (clip.isVideo) {
        await seek(clip.element as HTMLVideoElement, clip.start + i / fps);
      }

      paint(ctx, clip.element, size, width, height, clip.transform);
      drawOverlays(ctx, overlays, width, height, frameIndex / fps, seconds);

      const frame = new VideoFrame(canvas, {
        timestamp: frameIndex * frameDuration,
        duration: frameDuration,
      });

      // 2초마다, 그리고 조각이 바뀌는 지점에 키프레임을 넣는다. 탐색이 가능해진다.
      encoder.encode(frame, { keyFrame: i === 0 || frameIndex % (fps * 2) === 0 });
      frame.close();

      // 인코더가 밀리면 메모리가 계속 쌓인다. 큐가 줄어들 때까지 기다린다.
      // flush를 쓰면 매번 전체를 비우느라 느려지고 키프레임 배치도 흐트러진다.
      while (encoder.encodeQueueSize > 8 && !encoderError) {
        await new Promise((resolve) => setTimeout(resolve, 4));
      }

      frameIndex++;
      onProgress?.(frameIndex / totalFrames);
    }
  }

  await encoder.flush();
  encoder.close();
  if (encoderError) throw describe(encoderError, width, height, codec);

  if (audio) {
    await encodeAudio(audio, (chunk, meta) => muxer.addAudioChunk(chunk, meta));
  }

  muxer.finalize();

  return new Blob([target.buffer], { type: "video/mp4" });
}

/** 인코더가 던진 것을 그대로 보여주면 원인을 알 수 없다. 설정을 붙여 돌려준다. */
function describe(error: unknown, width: number, height: number, codec: string) {
  const detail = error instanceof Error ? error.message : String(error);

  return new Error(`인코딩에 실패했습니다 (${width}×${height}, ${codec}): ${detail}`);
}
