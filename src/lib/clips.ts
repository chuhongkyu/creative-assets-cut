import { DEFAULT_TRANSFORM, type Transform } from "./transform";

/** 한 규격에 들어갈 소재 조각. 이미지와 영상을 같은 자리에 줄 세운다. */
export interface Clip {
  id: string;
  name: string;
  isVideo: boolean;
  element: HTMLImageElement | HTMLVideoElement;
  width: number;
  height: number;
  /** 원본 길이(초). 이미지는 0. */
  sourceDuration: number;
  /** 영상에서 가져오기 시작할 지점(초). */
  start: number;
  /** 결과물에서 차지할 길이(초). */
  length: number;
  /** 규격 안에서의 위치와 배율. 조각마다 따로 잡는다. */
  transform: Transform;
  /**
   * 원본 파일. 소리를 담을 때 다시 읽어야 한다.
   *
   * video 엘리먼트에서는 디코딩된 오디오를 꺼낼 수 없다.
   * 파일을 들고 있다가 decodeAudioData로 따로 풀어야 한다.
   */
  file: File | null;
}

/**
 * 파일 선택 창에 보여줄 형식.
 *
 * 끌어다 놓는 쪽은 MIME 접두사(image/, video/)만 보므로 여기 없는 형식도 들어온다.
 * 그래서 두 경로가 어긋나지 않게 목록을 한 곳에 둔다.
 */
export const ACCEPT_MEDIA = "video/mp4,video/quicktime,image/png,image/jpeg,image/webp";
export const ACCEPT_IMAGE = "image/png,image/jpeg,image/webp";

/**
 * 이미지 한 장이 기본으로 차지하는 시간. 너무 짧으면 읽을 수 없고 길면 지루하다.
 * 이미지는 원본에 길이가 없으니 값을 정해줄 수밖에 없다.
 */
export const DEFAULT_IMAGE_SECONDS = 2;

export function totalLength(clips: Clip[]) {
  return clips.reduce((sum, clip) => sum + clip.length, 0);
}

/** 파일 하나를 조각으로 만든다. 디코딩이 끝날 때까지 기다린다. */
export async function createClip(file: File): Promise<Clip> {
  const url = URL.createObjectURL(file);
  const name = file.name.replace(/\.[^.]+$/, "");
  const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

  if (file.type.startsWith("video/")) {
    const video = document.createElement("video");
    video.src = url;
    video.muted = true;
    video.playsInline = true;
    video.preload = "auto";

    await new Promise<void>((resolve, reject) => {
      video.addEventListener("loadeddata", () => resolve(), { once: true });
      video.addEventListener("error", () => reject(new Error(`${file.name} 을 읽지 못했습니다.`)), { once: true });
    });

    // 첫 프레임이 그려져야 미리보기가 검은 화면으로 나오지 않는다.
    await seek(video, 0.1);

    return {
      id,
      name,
      isVideo: true,
      element: video,
      width: video.videoWidth,
      height: video.videoHeight,
      sourceDuration: video.duration,
      start: 0,
      // 영상은 통째로 넣는다. 자르고 싶으면 타임라인에서 끝을 끌면 된다.
      // 임의의 기본 길이를 정해두면 매번 그 값을 되돌리는 일부터 하게 된다.
      length: video.duration,
      transform: { ...DEFAULT_TRANSFORM },
      file,
    };
  }

  const image = new Image();
  image.src = url;
  await image.decode();

  return {
    id,
    name,
    isVideo: false,
    element: image,
    width: image.width,
    height: image.height,
    sourceDuration: 0,
    start: 0,
    length: DEFAULT_IMAGE_SECONDS,
    transform: { ...DEFAULT_TRANSFORM },
    file: null,
  };
}

/** 지정한 시각으로 이동하고 그 프레임이 실제로 준비될 때까지 기다린다. */
export function seek(video: HTMLVideoElement, time: number) {
  return new Promise<void>((resolve) => {
    const done = () => {
      video.removeEventListener("seeked", done);
      resolve();
    };
    video.addEventListener("seeked", done);
    video.currentTime = Math.min(Math.max(0, time), Math.max(0, video.duration - 0.001));
  });
}
