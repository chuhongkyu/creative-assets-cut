import { playableLength, type Clip } from "./clips";
import { fadeSpans } from "./transitions";

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

/**
 * 조각 경계마다 최소한으로 넣는 기울기(초).
 *
 * 파형을 아무 데서나 끊으면 '툭' 하는 소리가 난다. 전환을 끈 상태에서도
 * 이만큼은 깎아야 깨끗하게 붙는다. 10ms라 들리지 않는다.
 */
const DECLICK_SECONDS = 0.01;

export function isAudioExportSupported() {
  return typeof window !== "undefined" && "AudioEncoder" in window && "AudioData" in window;
}

/** 소리가 하나라도 있으면 합쳐 돌려준다. 전부 무음이면 null. */
export async function buildAudioTrack(
  clips: Clip[],
  totalSeconds: number,
  fadeInSeconds = 0,
  fadeOutSeconds = 0
): Promise<AudioBuffer | null> {
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

      // 실제로 들리는 길이. 끝을 끌어 멈춰 세운 구간은 원본이 없으므로 소리도 없다.
      const audible = Math.min(
        playableLength(clip),
        Math.max(0, buffer.duration - clip.start)
      );

      /**
       * 소리를 줄이는 기준은 조각 길이가 아니라 **들리는 길이**다.
       *
       * 멈춤 구간이 있으면 화면은 조각 끝에서 어두워지지만 소리는 그보다 먼저 끝난다.
       * 화면 기준으로 줄이면 소리가 이미 사라진 뒤에 줄이는 셈이라 끊김이 그대로 남는다.
       */
      const { entering, leaving } = fadeSpans(audible, fadeInSeconds, fadeOutSeconds);

      // 각 기울기는 들리는 길이의 절반을 넘지 않는다. 최소 기울기를 더한 탓에
      // 둘을 합친 것이 들리는 길이보다 길어지면 게인 이벤트 순서가 뒤집힌다.
      const half = audible / 2;
      const inEnd = Math.min(Math.max(DECLICK_SECONDS, entering), half);
      const outStart = Math.max(inEnd, audible - Math.min(Math.max(DECLICK_SECONDS, leaving), half));

      const gain = offline.createGain();
      const g = gain.gain;
      g.setValueAtTime(0, at);
      g.linearRampToValueAtTime(1, at + inEnd);
      g.setValueAtTime(1, at + outStart);
      g.linearRampToValueAtTime(0, at + audible);

      source.connect(gain);
      gain.connect(offline.destination);

      // 원본에서 쓰기로 한 구간만 그 자리에 꽂는다.
      source.start(at, clip.start, audible);
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
