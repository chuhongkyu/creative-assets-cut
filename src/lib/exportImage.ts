import { paint, type Transform } from "./transform";
import { drawOverlays, type Overlay } from "./overlays";

/** 이미지 한 장을 규격에 맞춰 그려 jpg로 만든다. */
export async function renderImage(
  source: CanvasImageSource,
  sourceSize: { width: number; height: number },
  targetWidth: number,
  targetHeight: number,
  transform: Transform,
  overlays: Overlay[] = []
): Promise<Blob> {
  const canvas = document.createElement("canvas");
  canvas.width = targetWidth;
  canvas.height = targetHeight;

  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("캔버스를 만들 수 없습니다.");

  paint(ctx, source, sourceSize, targetWidth, targetHeight, transform);
  // 정지 이미지는 움직임이 없다. 제자리에 놓인 상태로 그린다.
  drawOverlays(ctx, overlays, targetWidth, targetHeight, 0, 0);

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("이미지를 만들지 못했습니다."))),
      "image/jpeg",
      0.92
    );
  });
}

export function download(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}
