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
}

/** 이미지 한 장이 기본으로 차지하는 시간. 너무 짧으면 읽을 수 없고 길면 지루하다. */
export const DEFAULT_IMAGE_SECONDS = 2;

/** 영상에서 기본으로 가져오는 길이. */
export const DEFAULT_VIDEO_SECONDS = 5;

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
      length: Math.min(DEFAULT_VIDEO_SECONDS, Math.max(1, video.duration)),
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
