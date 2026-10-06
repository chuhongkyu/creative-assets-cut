import { type Clip } from "./clips";

/**
 * 조각들의 소리를 타임라인 순서대로 한 줄로 만든다.
 *
 * video 엘리먼트에서는 디코딩된 오디오를 꺼낼 수 없어서, 원본 파일을 다시 읽어
 * decodeAudioData로 푼다. 그 다음 OfflineAudioContext에 제자리에 꽂아 한 번에 렌더한다.
 * 샘플레이트가 다른 소스가 섞여 있어도 OfflineAudioContext가 알아서 맞춰준다.
 *
 * 이미지 구간은 아무것도 꽂지 않으므로 그만큼 무음이 된다.
 */
export const SAMPLE_RATE = 48000;
export const CHANNELS = 2;

export function isAudioExportSupported() {
  return typeof window !== "undefined" && "AudioEncoder" in window && "AudioData" in window;
}

/** 소리가 하나라도 있으면 합쳐 돌려준다. 전부 무음이면 null. */
export async function buildAudioTrack(clips: Clip[], totalSeconds: number): Promise<AudioBuffer | null> {
  if (totalSeconds <= 0) return null;

  const decoded = new Map<File, AudioBuffer | null>();
  const context = new AudioContext({ sampleRate: SAMPLE_RATE });

  try {
    for (const clip of clips) {
      if (!clip.isVideo || !clip.file || decoded.has(clip.file)) continue;

      try {
        const bytes = await clip.file.arrayBuffer();
        decoded.set(clip.file, await context.decodeAudioData(bytes));
      } catch {
        // 오디오 트랙이 없는 영상이다. 무음으로 둔다.
        decoded.set(clip.file, null);
      }
    }
  } finally {
    void context.close();
  }

  const usable = [...decoded.values()].filter(Boolean).length > 0;
  if (!usable) return null;

  const offline = new OfflineAudioContext(
    CHANNELS,
    Math.ceil(totalSeconds * SAMPLE_RATE),
    SAMPLE_RATE
  );

  let at = 0;
  for (const clip of clips) {
    const buffer = clip.file ? decoded.get(clip.file) : null;

    if (buffer) {
      const source = offline.createBufferSource();
      source.buffer = buffer;
      // 원본에서 쓰기로 한 구간만 그 자리에 꽂는다.
      source.start(at, clip.start, Math.min(clip.length, Math.max(0, buffer.duration - clip.start)));
      source.connect(offline.destination);
    }

    at += clip.length;
  }

  return offline.startRendering();
}

/** 합쳐진 소리를 AAC로 인코딩해 muxer에 넣는다. */
export async function encodeAudio(
  buffer: AudioBuffer,
  addChunk: (chunk: EncodedAudioChunk, meta?: EncodedAudioChunkMetadata) => void
) {
  const channels = Math.min(CHANNELS, buffer.numberOfChannels);
  const config: AudioEncoderConfig = {
    codec: "mp4a.40.2", // AAC-LC. mp4에서 가장 넓게 재생된다.
    sampleRate: buffer.sampleRate,
    numberOfChannels: channels,
    bitrate: 128_000,
  };

  const support = await AudioEncoder.isConfigSupported(config);
  if (!support.supported) throw new Error("이 브라우저가 AAC 인코딩을 지원하지 않습니다.");

  let failure: unknown = null;
  const encoder = new AudioEncoder({
    output: (chunk, meta) => addChunk(chunk, meta),
    error: (e) => {
      failure = e;
    },
  });
  encoder.configure(config);

  const planes = Array.from({ length: channels }, (_, c) => buffer.getChannelData(c));
  const chunkFrames = 1024;

  for (let offset = 0; offset < buffer.length; offset += chunkFrames) {
    if (failure) throw failure;

    const frames = Math.min(chunkFrames, buffer.length - offset);

    // f32-planar는 채널을 이어 붙인 한 덩어리로 넘긴다.
    const data = new Float32Array(frames * channels);
    for (let c = 0; c < channels; c++) {
      data.set(planes[c].subarray(offset, offset + frames), c * frames);
    }

    const audioData = new AudioData({
      format: "f32-planar",
      sampleRate: buffer.sampleRate,
      numberOfFrames: frames,
      numberOfChannels: channels,
      timestamp: Math.round((offset / buffer.sampleRate) * 1_000_000),
      data,
    });

    encoder.encode(audioData);
    audioData.close();

    while (encoder.encodeQueueSize > 16 && !failure) {
      await new Promise((resolve) => setTimeout(resolve, 2));
    }
  }

  await encoder.flush();
  encoder.close();
  if (failure) throw failure;

  return { sampleRate: buffer.sampleRate, channels };
}
